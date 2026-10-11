import { describe, expect, it } from 'vitest';
import { adminReturnTo, isAdminPath } from './admin-access';
describe('admin destinations', () => {
  it.each(['/portal/admin', '/portal/admin/', '/portal/admin/participants', '/PORTAL/ADMIN/settings', '/portal/%61dmin/schedule'])('recognizes protected path %s', path => expect(isAdminPath(path)).toBe(true));
  it.each(['https://evil.example/admin', '//evil.example/admin', '/administrator', '/admin-access', '/admin\\evil', '/admin\n', '/portal', null])('rejects unsafe return destination %s', path => expect(adminReturnTo(path)).toBeUndefined());
  it.each(['/portal/administrator', '/portal/admin-access', '/portal', '/admin'])('does not misclassify %s', path => expect(isAdminPath(path)).toBe(false));
  it('preserves a local admin deep link', () => expect(adminReturnTo('/portal/admin/participants?view=all#entry')).toBe('/portal/admin/participants?view=all#entry'));
  it('rejects removed admin destinations', () => {
    expect(adminReturnTo('/admin/participants?view=all#entry')).toBeUndefined();
    expect(adminReturnTo('/%61dmin/schedule')).toBeUndefined();
  });
});
