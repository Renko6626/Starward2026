import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashPassword } from 'better-auth/crypto';
import { parseWranglerConfig, validateProductionConfig } from './production-deploy.mjs';

const email = 'admin@hifuu.moe';
const literal = value => `'${String(value).replaceAll("'", "''")}'`;

export async function buildAdminBootstrap(saved = {}) {
  const password = saved.password ?? randomBytes(24).toString('base64url');
  const passwordHash = await hashPassword(password);
  const userId = saved.userId ?? randomUUID(), accountId = randomUUID(), now = new Date().toISOString();
  const sql = `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES (${literal(userId)}, '初始管理员', '${email}', 1, ${literal(now)}, ${literal(now)});
    INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
    VALUES (${literal(accountId)}, ${literal(userId)}, 'credential', ${literal(userId)}, ${literal(passwordHash)}, ${literal(now)}, ${literal(now)});
    INSERT INTO admin_roles (user_id, role) VALUES (${literal(userId)}, 'owner');`;
  return { email, password, userId, sql };
}

async function main() {
  if (!process.argv.includes('--production')) throw new Error('Use --production to explicitly target the configured production database.');
  const config = parseWranglerConfig(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  validateProductionConfig(config);
  if (config.env.production.vars.BETTER_AUTH_URL !== 'https://hifuu.moe') throw new Error('Unexpected production origin.');
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
  const credentialIndex = process.argv.indexOf('--credentials');
  if (credentialIndex !== -1) {
    const values = (await readFile(resolve(process.argv[credentialIndex + 1]), 'utf8')).trim().split(/\r?\n/).map(value => value.trim());
    accountId = values.find(value => /^[a-f0-9]{32}$/i.test(value));
    token = values.find(value => value !== accountId && /^[A-Za-z0-9_-]{35,}$/.test(value));
  }
  if (!accountId || !token) throw new Error('Provide CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, or an explicitly authorized two-line credential file.');
  const database = config.env.production.d1_databases.find(binding => binding.binding === 'DB');
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${database.database_id}`;
  async function request(path = '', body) {
    const response = await fetch(endpoint + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json();
    if (!response.ok || !payload.success || (Array.isArray(payload.result) && payload.result.some(item => item.success === false))) {
      // Do not print SQL, hashes, credentials or provider error bodies.
      throw new Error(`Cloudflare D1 request failed (${response.status}); no credential values were logged.`);
    }
    return payload.result;
  }
  const metadata = await request();
  if (metadata.name !== database.database_name) throw new Error('Production database identity mismatch.');
  const query = async sql => request('/query', { sql });
  const existing = (await query(`SELECT id FROM "user" WHERE lower(email) = '${email}'`))[0].results;
  const tables = (await query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('admin_roles','d1_migrations')"))[0].results.map(row => row.name);
  if (existing.length) {
    const role = tables.includes('admin_roles') ? (await query(`SELECT role FROM admin_roles WHERE user_id = ${literal(existing[0].id)}`))[0].results[0]?.role : null;
    if (role === 'owner') { console.log('Production owner already exists. Its password and permissions were not changed.'); return; }
    throw new Error('The requested email already belongs to an account. Refusing to overwrite or elevate it automatically.');
  }
  if (tables.includes('admin_roles') && (await query("SELECT user_id FROM admin_roles WHERE role='owner'"))[0].results.length) throw new Error('An owner already exists; refusing to create a second owner.');
  let migration = '';
  if (!tables.includes('admin_roles')) {
    migration = await readFile(new URL('../migrations/0022_admin_roles.sql', import.meta.url), 'utf8');
    if (tables.includes('d1_migrations')) migration += "\nINSERT INTO d1_migrations (name) VALUES ('0022_admin_roles.sql');";
  }
  const directory = resolve('.admin-credentials');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = resolve(directory, 'production-owner.json');
  let saved;
  try { saved = JSON.parse(await readFile(destination, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Cannot read the saved owner credential file; preserve it for recovery.'); }
  if (saved && (saved.site !== 'https://hifuu.moe' || saved.email !== email || saved.status !== 'prepared'
    || !/^[A-Za-z0-9_-]{32}$/.test(saved.password ?? '') || !/^[a-f0-9-]{36}$/i.test(saved.userId ?? ''))) {
    throw new Error('Saved credentials do not describe a pending bootstrap. Refusing to overwrite them.');
  }
  const bootstrap = await buildAdminBootstrap(saved);
  const credentials = saved ?? { site: 'https://hifuu.moe', email, userId: bootstrap.userId, password: bootstrap.password, status: 'prepared', createdAt: new Date().toISOString() };
  // Save first, exclusively: a successful account creation must never lose its password.
  if (!saved) await writeFile(destination, JSON.stringify(credentials, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await query(migration + '\n' + bootstrap.sql);
  const verified = (await query(`SELECT u.id, u.email, r.role FROM "user" u JOIN admin_roles r ON r.user_id=u.id WHERE u.id=${literal(bootstrap.userId)}`))[0].results[0];
  if (verified?.email !== email || verified?.role !== 'owner') throw new Error('Owner verification failed; retain the credential file for investigation.');
  credentials.status = 'created';
  await writeFile(destination, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600 });
  console.log(`Created ${email} as the production owner in ${database.database_name}.`);
  console.log(`Generated password saved to ${destination}; password not printed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
