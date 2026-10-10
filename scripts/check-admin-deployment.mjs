const origin = process.env.PRODUCTION_URL;
if (!origin || new URL(origin).protocol !== 'https:') throw new Error('Set PRODUCTION_URL to the HTTPS deployment origin.');
for (const path of ['/portal/admin', '/portal/admin/participants', '/PORTAL/ADMIN/settings/admins', '/portal/%61dmin/schedule']) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual' });
  const location = response.headers.get('location');
  if (response.status !== 302 || !location || new URL(location, origin).pathname !== '/portal/login') throw new Error(`Anonymous admin page was not protected: ${path} (${response.status})`);
}
for (const path of ['/admin', '/admin/participants']) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual' });
  if (response.status !== 404 || response.headers.has('location')) throw new Error(`Removed admin path is still available: ${path}`);
}
const response = await fetch(new URL('/api/admin/session', origin), { redirect: 'manual' });
if (response.status !== 401 || !response.headers.get('cache-control')?.includes('no-store')) throw new Error('Anonymous admin API protection failed.');
console.log('Admin pages require login; anonymous admin API requests are denied.');
