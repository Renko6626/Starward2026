import { useEffect, useState, type FormEvent } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button, Notice, PageHeading, ReadError, StatusBadge } from '../../app/components/ui';
import { requestJson } from '../../app/lib/api';
import type { AdminUser } from '../../shared/admin-access';

export function AdminUsersPage() {
  const { admin } = getRouteApi('/admin').useRouteContext();
  const [query, setQuery] = useState(''), [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  async function load(search: string, signal?: AbortSignal) {
    setLoading(true); setError('');
    try { const result = await requestJson<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(search)}`, { signal }); setUsers(result.users); }
    catch (caught) { if (!signal?.aborted) setError(caught instanceof Error ? caught.message : '无法读取账号。'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); if (admin.role === 'owner') void load('', controller.signal); return () => controller.abort(); }, [admin.role]);
  if (admin.role !== 'owner') return <Notice>只有初始管理员可以管理管理员权限。</Notice>;
  async function changeRole() {
    if (!selected) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await requestJson(`/api/admin/users/${encodeURIComponent(selected.id)}/role`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: selected.role === 'admin' ? null : 'admin' }) });
      setMessage(`已${selected.role === 'admin' ? '撤销' : '授予'} ${selected.email} 的管理员权限。`); setSelected(null); await load(query);
    } catch (caught) { setError(caught instanceof Error ? caught.message : '权限保存失败。'); }
    finally { setBusy(false); }
  }
  function search(event: FormEvent) { event.preventDefault(); setSelected(null); setMessage(''); void load(query); }
  return <div className="page-content">
    <PageHeading title="管理员权限" description="管理团队成员可以审核报名、作品及排期。只有初始管理员可以授予或撤销管理权限。" />
    <form className="admin-user-search" onSubmit={search}><input className="field-input" type="search" aria-label="按邮箱或姓名查找账号" placeholder="输入已注册用户的邮箱或姓名" value={query} onChange={event => setQuery(event.target.value)} disabled={busy} /><Button type="submit" disabled={busy || loading}>查找账号</Button></form>
    <p className="text-sm text-on-surface-variant">不输入搜索词时显示当前管理员。搜索最多显示 50 个账号，只有已验证邮箱的用户可以被授予权限。</p>
    {error ? <ReadError message={error} /> : null}{message ? <Notice tone="success">{message}</Notice> : null}
    {selected ? <div className="admin-role-confirm" role="region" aria-label="确认权限变更"><p>确认{selected.role === 'admin' ? '撤销' : '授予'} <strong>{selected.email}</strong> 的管理员权限？{selected.role === 'admin' ? '其后续管理请求将被拒绝。' : '该账号将能够访问报名、联系方式、作品与排期。'}</p><Button disabled={busy} onClick={() => void changeRole()}>{busy ? '正在保存…' : '确认变更'}</Button><Button variant="secondary" disabled={busy} onClick={() => setSelected(null)}>取消</Button></div> : null}
    {loading ? <Notice>正在读取账号。</Notice> : !users.length ? <Notice>未找到匹配账号，请确认用户已经注册并调整搜索词。</Notice> : <div className="table-frame"><div className="table-scroll" role="region" aria-label="管理员账号" tabIndex={0}><table className="data-table admin-compact-table admin-users-table"><thead><tr><th>账号</th><th>邮箱状态</th><th>权限</th><th>操作</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><div>{user.name}</div><div className="text-on-surface-variant">{user.email}</div></td><td>{user.emailVerified ? '已验证' : '未验证'}</td><td><StatusBadge>{user.role === 'owner' ? '初始管理员' : user.role === 'admin' ? '管理员' : '普通用户'}</StatusBadge></td><td>{user.role === 'owner' ? <span className="text-on-surface-variant">固定权限</span> : <Button variant="secondary" disabled={busy || (!user.role && !user.emailVerified)} onClick={() => { setSelected(user); setMessage(''); }}>{user.role === 'admin' ? '撤销权限' : '设为管理员'}</Button>}</td></tr>)}</tbody></table></div></div>}
  </div>;
}
