export type AdminSession = { email: string; role: 'owner' | 'admin' };
export type AdminUser = { id: string; name: string; email: string; emailVerified: boolean; role: 'owner' | 'admin' | null };

export function isAdminPath(pathname: string) {
  try {
    const path = decodeURIComponent(pathname).toLowerCase();
    return path === '/admin' || path.startsWith('/admin/');
  } catch { return false; }
}

/** Only allow local admin destinations; never redirect to an arbitrary URL. */
export function adminReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[\\\u0000-\u0020]/.test(value)) return undefined;
  try {
    const url = new URL(value, 'https://local.invalid');
    if (!value.startsWith('/') || url.origin !== 'https://local.invalid' || !isAdminPath(url.pathname)) return undefined;
    return url.pathname + url.search + url.hash;
  } catch { return undefined; }
}
