import { afterEach, expect, it, vi } from 'vitest';
import { ApiError, requestJson } from './api';

afterEach(() => vi.unstubAllGlobals());

it('keeps a business refusal on the page instead of announcing lost admin access', async () => {
  const events: Event[] = [];
  const target = new EventTarget();
  target.addEventListener('admin-access-lost', event => events.push(event));
  vi.stubGlobal('window', target);
  vi.stubGlobal('fetch', async () => Response.json({ error: {
    code: 'management_account_protected', message: '管理员账号请使用正常登录方式。',
  } }, { status: 403 }));

  await expect(requestJson('/api/admin/assisted-access', { method: 'POST' }))
    .rejects.toMatchObject({ status: 403, message: '管理员账号请使用正常登录方式。' });
  expect(events).toHaveLength(0);
});

it.each([
  ['/api/admin/session', 403],
  ['/api/admin/participants', 401],
] as const)('announces lost access for %s returning %s', async (url, status) => {
  const statuses: number[] = [];
  const target = new EventTarget();
  target.addEventListener('admin-access-lost', event => statuses.push((event as CustomEvent<number>).detail));
  vi.stubGlobal('window', target);
  vi.stubGlobal('fetch', async () => Response.json({ error: { code: 'http_error', message: '访问被拒绝。' } }, { status }));

  await expect(requestJson(url)).rejects.toBeInstanceOf(ApiError);
  expect(statuses).toEqual([status]);
});
