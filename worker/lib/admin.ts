import { HTTPException } from 'hono/http-exception';
import { getRealAuthEmail } from '../../src/shared/auth-identity';
import { requireWebsiteSession } from './auth';
import { getRequiredDb } from './http';
import type { AppContext } from './types';

export function getAdminIdentity(c: AppContext) {
  const identity = c.get('adminIdentity');
  if (!identity) throw new HTTPException(500, { message: 'Admin identity missing from verified context.' });
  return identity;
}

export async function requireAdminAccess(c: AppContext) {
  c.header('Cache-Control', 'private, no-store');
  const session = await requireWebsiteSession(c, true);
  if (!session) throw new HTTPException(401, { message: '请先登录管理员账号。' });
  const email = getRealAuthEmail(session.user.email);
  if (!email || !session.user.emailVerified) throw new HTTPException(403, { message: '管理员必须使用已验证的真实邮箱。' });
  const access = await getRequiredDb(c).prepare('SELECT role FROM admin_roles WHERE user_id = ?')
    .bind(session.user.id).first<{ role: 'owner' | 'admin' }>();
  if (!access || !['owner', 'admin'].includes(access.role)) throw new HTTPException(403, { message: '当前账号没有管理员权限。' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)
    && (c.req.header('origin') !== new URL(c.req.url).origin || c.req.header('sec-fetch-site') === 'cross-site')) {
    throw new HTTPException(403, { message: '管理操作必须从本站发起。' });
  }
  c.set('adminIdentity', email);
  c.set('adminUserId', session.user.id);
  c.set('adminRole', access.role);
}

export function requireAdminOwner(c: AppContext) {
  if (c.get('adminRole') !== 'owner') throw new HTTPException(403, { message: '只有初始管理员可以管理管理员权限。' });
}
