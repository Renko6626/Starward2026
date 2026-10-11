import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { authClient } from '../../portal/lib/auth-client';
import { Button, Notice } from '../../app/components/ui';
import '../admin.css';

export function AdminAccessPage({ reason = 'forbidden', returnTo = '/portal/admin' }: { reason?: string; returnTo?: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function switchAccount() {
    setBusy(true); setError('');
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error('退出失败，请重试。');
      window.location.assign(`/portal/login?${new URLSearchParams({ returnTo })}`);
    } catch { setError('退出失败，请重试。'); setBusy(false); }
  }
  return <section className="admin-access-panel">
    <ShieldAlert size={32} strokeWidth={1.2} aria-hidden="true" />
    <p className="eyebrow">ORGANIZER ACCESS</p>
    <h1>{reason === 'forbidden' ? '此账号尚无管理权限' : '暂时无法验证管理权限'}</h1>
    <p>{reason === 'forbidden' ? '请使用已获授权的账号登录。如需加入管理团队，请联系初始管理员授予权限。' : '请稍后重试。管理内容会在身份验证通过后显示。'}</p>
    {error ? <Notice tone="error">{error}</Notice> : null}
    <div className="admin-access-actions"><Button disabled={busy} onClick={() => void switchAccount()}>切换登录账号</Button><a className="button button--secondary" href={returnTo}>重新验证</a><Link className="text-link" to="/">返回首页</Link></div>
  </section>;
}
