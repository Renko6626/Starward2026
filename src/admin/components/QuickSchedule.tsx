import { useState, type FormEvent } from 'react';
import { Field, StateNotice } from '../../app/components/ui';
import { requestJson } from '../../app/lib/api';
import { formatScheduledTime } from '../../app/lib/format';
import type { AdminSegmentItem, AdminSegmentListResponse, AdminSegmentMutationResponse } from '../../shared/admin';
import { buildQuickSchedule, type QuickScheduleEntry } from '../lib/quick-schedule';

export function QuickSchedule({ segments, disabled, onSaved, onSavingChange }: {
  segments: AdminSegmentItem[];
  disabled: boolean;
  onSaved: (items: AdminSegmentItem[], replace?: boolean) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const [start, setStart] = useState('');
  const [interval, setInterval] = useState('60');
  const [preview, setPreview] = useState<QuickScheduleEntry[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const pending = preview?.filter(entry => entry.needsSave) ?? [];

  function showPreview(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      const entries = buildQuickSchedule(segments, start, Number(interval));
      setPreview(entries);
      if (!entries.some(entry => entry.needsSave)) setNotice({ message: '标准格已有发布时间，无需补填。', tone: 'success' });
    } catch (error) {
      setPreview(null);
      setNotice({ message: error instanceof Error ? error.message : '无法生成排期。', tone: 'error' });
    }
  }

  async function savePreview() {
    if (!preview || !pending.length || saving || disabled) return;
    setSaving(true);
    onSavingChange(true);
    setProgress(0);
    setNotice(null);
    const saved: AdminSegmentItem[] = [];
    try {
      const latest = await requestJson<AdminSegmentListResponse>('/api/admin/segments');
      const standards = latest.items.filter(item => item.kind === 'standard' && item.isVisible).sort((a, b) => a.sortOrder - b.sortOrder);
      if (standards.length !== preview.length || standards.some((item, index) => {
        const previous = preview[index];
        return !previous || item.id !== previous.segment.id || item.scheduledAt !== previous.segment.scheduledAt;
      })) {
        onSaved(latest.items, true);
        throw new Error('排期已被更新，请重新生成预览后保存。');
      }
      for (const entry of pending) {
        const current = standards.find(item => item.id === entry.segment.id)!;
        const response = await requestJson<AdminSegmentMutationResponse>(`/api/admin/segments/${current.id}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'fill-empty-time', scheduledAt: entry.scheduledAt }),
        });
        saved.push(response.item);
        setProgress(saved.length);
      }
      setNotice({ message: `已保存 ${saved.length} 个发布时间，原有配置和追加坑位保持不变。`, tone: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败。';
      setNotice({ message: saved.length ? `已保存 ${saved.length} 个，其余尚未保存。${message} 请重新预览后继续。` : message, tone: 'error' });
    } finally {
      if (saved.length) onSaved(saved);
      setPreview(null);
      setSaving(false);
      onSavingChange(false);
    }
  }

  return <details className="panel admin-disclosure">
    <summary>快速排期</summary>
    <p className="pt-4 text-sm text-on-surface-variant">按标准格顺序安排发布时间，只补填空白时间。已有时间仍占原来的序号，隐藏格和追加坑位不参与。</p>
    {disabled && !saving ? <p className="mt-3 text-sm text-on-surface-variant">请先保存各格子的修改，等待其他操作完成后再生成排期。</p> : null}
    <form onSubmit={showPreview} className="pt-4">
      <fieldset disabled={disabled || saving} className="flex flex-wrap items-end gap-4">
        <Field label="起始时间（北京时间）"><input required className="field-input" type="datetime-local" value={start} onChange={event => { setStart(event.target.value); setPreview(null); setNotice(null); }} /></Field>
        <Field label="间隔（分钟）"><input required className="field-input w-28" type="number" min={1} max={10080} step={1} value={interval} onChange={event => { setInterval(event.target.value); setPreview(null); setNotice(null); }} /></Field>
        <button className="min-h-10 px-4 py-2 bg-primary text-on-primary rounded-md disabled:opacity-60" type="submit" disabled={disabled || saving}>生成预览</button>
      </fieldset>
    </form>
    {preview ? <div className="mt-5 space-y-4">
      <p className="text-sm text-on-surface-variant">将补填 {pending.length} 个，保留 {preview.length - pending.length} 个已有时间。</p>
      <div className="max-h-80 overflow-auto border border-outline-variant">
        <table className="w-full text-sm text-left"><thead><tr className="border-b border-outline-variant"><th className="p-3">标准格</th><th className="p-3">北京时间</th><th className="p-3">处理</th></tr></thead>
          <tbody>{preview.map(entry => <tr key={entry.segment.id} className="border-b border-outline-variant last:border-0"><td className="p-3">{entry.segment.code}</td><td className="p-3 whitespace-nowrap">{formatScheduledTime(entry.scheduledAt)}</td><td className="p-3 whitespace-nowrap">{entry.needsSave ? '待保存' : '保留'}</td></tr>)}</tbody>
        </table>
      </div>
      <button type="button" onClick={() => void savePreview()} disabled={disabled || saving || !pending.length} className="min-h-10 px-4 py-2 bg-primary text-on-primary rounded-md disabled:opacity-60">{saving ? `正在保存 ${progress}/${pending.length}…` : `保存 ${pending.length} 个发布时间`}</button>
    </div> : null}
    {notice ? <div className="mt-4"><StateNotice {...notice} /></div> : null}
  </details>;
}
