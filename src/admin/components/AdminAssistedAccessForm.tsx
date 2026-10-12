import { useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Button, Field, Notice } from '../../app/components/ui';
import { requestJson } from '../../app/lib/api';
import { formatDateTime } from '../../app/lib/format';
import type { AdminAssistedAccessResponse } from '../../shared/admin-access';

export function AdminAssistedAccessForm() {
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState<AdminAssistedAccessResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setAccess(null);
    try {
      setAccess(await requestJson<AdminAssistedAccessResponse>('/api/admin/assisted-access', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }),
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法生成验证码，请重试。');
    } finally { setBusy(false); }
  }

  return <details className="panel admin-disclosure">
    <summary>辅助开号与登录</summary>
    <div className="space-y-4 pt-4">
      <p className="text-sm text-on-surface-variant">用于无法完成人机验证的用户。核对本人身份和登录邮箱后，将验证码私下发给对方。已有账号也可以使用；管理员账号请正常登录。</p>
      <form className="admin-user-search" onSubmit={issue}>
        <input className="field-input" type="email" aria-label="对方的登录邮箱" placeholder="对方的登录邮箱" required maxLength={320} value={email} disabled={busy} onChange={event => { setEmail(event.target.value); setAccess(null); setError(''); }} />
        <Button type="submit" disabled={busy}>{busy ? '正在生成…' : '生成验证码'}</Button>
      </form>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {access ? <>
        <Notice tone="success">验证码已生成，{formatDateTime(access.expiresAt)} 前有效，只能使用一次。该邮箱原来的登录验证码已失效。</Notice>
        <Field label="复制后发给对方">
          <textarea className="field-input" readOnly rows={5} value={`请打开 ${window.location.origin}/portal/login?assisted=1\n登录邮箱：${access.email}\n管理员验证码：${access.otp}\n有效期 10 分钟，只能使用一次。首次使用请同意活动规则并设置密码。`} />
        </Field>
        <Link className="text-link" to="/portal/login" search={{ assisted: '1' }}>查看辅助登录入口</Link>
      </> : null}
    </div>
  </details>;
}
