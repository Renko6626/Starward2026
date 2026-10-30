import { formatWorkFileSize, type WorkFile } from '../../shared/work-files';
export function AdminWorkFiles({draftId,files}: {draftId:string;files:WorkFile[]}) {
  return <section aria-label="作品文件"><h3>完整作品文件</h3>{files.length ? <ul className="work-file-list">{files.map(file => <li key={file.id}>
    <a className="text-link" href={`/api/admin/project-drafts/${draftId}/files/${file.id}/download`} download={file.filename}>{file.filename}</a><span className="ml-3 text-sm">{formatWorkFileSize(file.size)}</span>
  </li>)}</ul> : <p>此版本没有文件。</p>}</section>;
}
