import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inputs = ['model.py', 'solver.py', 'validation.py', 'generate.py', 'config.json', 'requirements.txt']
  .map(name => `scripts/orbit-transfer/${name}`).concat('scripts/orbit-assets.mjs');
const hash = createHash('sha256');
for (const file of inputs) {
  hash.update(file); hash.update('\0'); hash.update(await readFile(join(root, file))); hash.update('\0');
}
const fingerprint = hash.digest('hex');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  if (process.argv.includes('--fingerprint')) {
    console.log(fingerprint);
  } else if (process.argv.includes('--check')) {
    const frontend = await readFile(join(root, 'src/app/components/orbital-transfer.json'));
    const payload = JSON.parse(frontend);
    const directory = join(root, 'docs/design/orbit-transfer');
    const report = JSON.parse(await readFile(join(directory, 'validation.json'), 'utf8'));
    if (payload.inputFingerprint !== fingerprint || report.inputFingerprint !== fingerprint || !report.accepted) {
      throw new Error('轨迹数据已过期或未通过验收，请运行 npm run orbit:generate。');
    }
    if (digest(frontend) !== report.frontendSha256) throw new Error('主页轨迹数据校验失败，请重新生成。');
    for (const [file, expected] of Object.entries(report.sha256)) {
      if (digest(await readFile(join(directory, file))) !== expected) throw new Error(`轨迹产物校验失败：${file}`);
    }
    console.log('月球辅助轨迹与当前模型一致，数值验收已通过。');
  } else {
    const result = spawnSync(process.env.ORBIT_PYTHON || 'python3',
      [join(root, 'scripts/orbit-transfer/generate.py'), '--fingerprint', fingerprint], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(`${error.message}\n首次使用或输入更新后，请运行 npm run orbit:generate。`);
  process.exitCode = 1;
}
