import { describe, expect, it } from 'vitest';
import { adminReturnTo, isAdminPath } from './admin-access';
describe('admin destinations', () => {
  it.each(['/admin', '/admin/', '/admin/participants', '/ADMIN/settings', '/%61dmin/schedule'])('recognizes protected path %s', path => expect(isAdminPath(path)).toBe(true));
  it.each(['https://evil.example/admin', '//evil.example/admin', '/administrator', '/admin-access', '/admin\\evil', '/admin\n', '/portal', null])('rejects unsafe return destination %s', path => expect(adminReturnTo(path)).toBeUndefined());
  it('preserves a local admin deep link', () => expect(adminReturnTo('/admin/participants?view=all#entry')).toBe('/admin/participants?view=all#entry'));
});
