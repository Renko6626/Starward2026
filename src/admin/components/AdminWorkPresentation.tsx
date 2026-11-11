import { useEffect, useState } from 'react';
import { Button, Notice } from '../../app/components/ui';
import { WorkPresentation } from '../../app/components/WorkPresentation';
import { requestJson } from '../../app/lib/api';
import { workTypeLabels, type WorkPresentation as WorkData } from '../../shared/works';
import { parseBilibiliUrl, presentationImageUrl, presentationIssues, PRESENTATION_IMAGE_MAX_SIZE,
  type AdminWorkPresentation as SavedPresentation, type WorkPresentationInput, type PresentationContent } from '../../shared/work-presentations';
import './work-presentation.css';

type Props={segmentId:string;initialTitle:string;initialSummary:string;authorName:string;onSaved:()=>Promise<void>};
const empty:WorkPresentationInput={title:'',summary:'',workType:null,thumbnailId:null,thumbnailAlt:'',sourceUrl:'',content:null};
export function AdminWorkPresentation({segmentId,initialTitle,initialSummary,authorName,onSaved}:Props) {
  const endpoint=`/api/admin/segments/${encodeURIComponent(segmentId)}/presentation`;
  const [draft,setDraft]=useState<WorkPresentationInput>({...empty,title:initialTitle,summary:initialSummary});
  const [saved,setSaved]=useState<SavedPresentation|null>(null),[loaded,setLoaded]=useState(false);
  const [kind,setKind]=useState<PresentationContent['kind']>('gallery');
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
  const [preview,setPreview]=useState(false),[dirty,setDirty]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    void requestJson<{presentation:SavedPresentation|null}>(endpoint).then(({presentation})=>{
      if(cancelled)return;
      setSaved(presentation);
      if(presentation){setDraft(presentation);setKind(presentation.content?.kind ?? 'gallery');}
      setLoaded(true);
    }).catch(e=>{if(!cancelled)setError(e.message);});
    return()=>{cancelled=true;};
  },[endpoint]);
  function patch(value:Partial<WorkPresentationInput>){setDraft(d=>({...d,...value}));setDirty(true);setMessage(null);}
  function chooseKind(next:PresentationContent['kind']){
    if(next===kind)return;
    if(draft.content && !window.confirm('切换展示形式将替换当前正文。保存后生效，是否继续？'))return;
    setKind(next);patch({content:next==='gallery'?{kind:'gallery',images:[]}:next==='markdown'?{kind:'markdown',markdown:''}:parseBilibiliUrl(draft.sourceUrl)});
  }
  async function upload(files:FileList|null,thumbnail=false){
    if(!files?.length)return;
    setBusy(true);setError(null);setMessage(null);
    const uploaded:{id:string;alt:string}[]=[];
    try{
      for(const file of Array.from(files)){
        if(file.size>PRESENTATION_IMAGE_MAX_SIZE)throw new Error(`${file.name} 超过 20 MiB。`);
        const {id}=await requestJson<{id:string}>(endpoint+'/images',{method:'POST',body:file});
        uploaded.push({id,alt:''});
      }
      if(thumbnail)patch({thumbnailId:uploaded[0]!.id});
    }catch(e){setError(e instanceof Error?e.message:'图片上传失败，请重试。');}
    finally{
      if(!thumbnail && uploaded.length)setDraft(d=>({...d,content:{kind:'gallery',images:[...(d.content?.kind==='gallery'?d.content.images:[]),...uploaded]}}));
      if(uploaded.length)setDirty(true);
      setBusy(false);
    }
  }
  function editImage(index:number,action:'up'|'down'|'remove',alt?:string){
    if(draft.content?.kind!=='gallery')return;
    const images=[...draft.content.images];
    if(alt!==undefined)images[index]={...images[index]!,alt};
    else if(action==='remove')images.splice(index,1);
    else{const other=index+(action==='up'?-1:1);if(other<0 || other>=images.length)return;[images[index],images[other]]=[images[other]!,images[index]!];}
    patch({content:{kind:'gallery',images}});
  }
  async function save(){
    setBusy(true);setError(null);setMessage(null);
    try{
      const result=await requestJson<{presentation:SavedPresentation;message:string}>(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
      setSaved(result.presentation);setDraft(result.presentation);setDirty(false);setMessage(result.message);
      await onSaved();
    }catch(e){setError(e instanceof Error?e.message:'保存失败。');}finally{setBusy(false);}
  }
  async function publish(){
    setBusy(true);setError(null);setMessage(null);
    try{
      const result=await requestJson<{presentation:SavedPresentation;message:string}>(endpoint+(saved?.publishedAt?'/unpublish':'/publish'),{method:'POST'});
      setSaved(result.presentation);setMessage(result.message);await onSaved();
    }catch(e){setError(e instanceof Error?e.message:'公开状态修改失败。');}finally{setBusy(false);}
  }
  const content=draft.content?.kind==='gallery'?{kind:'gallery' as const,images:draft.content.images.map(i=>({url:presentationImageUrl(segmentId,i.id,true),alt:i.alt}))}:draft.content;
  const work:WorkData & {content:typeof content}={previewTitle:draft.title,previewSummary:draft.summary,publicAuthorName:authorName,
    workType:draft.workType,formatLabel:null,publicTags:[],coverUrl:draft.thumbnailId?presentationImageUrl(segmentId,draft.thumbnailId,true):saved?.legacyThumbnailUrl??null,coverAlt:draft.thumbnailAlt,workUrl:draft.sourceUrl||null,publishedAt:saved?.publishedAt??null,content};
  return <section className="panel showcase-editor" aria-labelledby="showcase-editor-title">
    <div><h2 id="showcase-editor-title">展示资料</h2><p>{saved?.publishedAt?'作品已公开，保存修改会直接更新公开页面。':'作品尚未公开，准备好后由管理员手动公开。'}</p>
      <p className="field-hint">标题、简介和预览图保存后可显示在时间表；正文须手动公开。投稿文件继续用于审核和归档。</p></div>
    {error&&<Notice tone="error">{error}</Notice>}{message&&<Notice tone="success">{message}</Notice>}
    {!loaded?<p>正在读取展示资料。</p>:<>
      <fieldset disabled={busy} className="showcase-editor-fields">
        <div className="showcase-meta"><label>展示标题<input className="field-input" maxLength={120} value={draft.title} onChange={e=>patch({title:e.target.value})}/></label>
          <label>作品类型<select className="field-input" value={draft.workType??''} onChange={e=>patch({workType:e.target.value as WorkPresentationInput['workType']||null})}><option value="">请选择</option>{Object.entries(workTypeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
        <label>展示简介<textarea className="field-input" rows={3} maxLength={1600} value={draft.summary} onChange={e=>patch({summary:e.target.value})}/></label>
        <div className="showcase-thumbnail"><label>预览图<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>{void upload(e.target.files,true);e.target.value='';}}/></label>
          {(draft.thumbnailId||saved?.legacyThumbnailUrl)&&<img src={draft.thumbnailId?presentationImageUrl(segmentId,draft.thumbnailId,true):saved?.legacyThumbnailUrl??''} alt={draft.thumbnailAlt||'预览图'}/>}
          <label>预览图说明<input className="field-input" maxLength={500} value={draft.thumbnailAlt} onChange={e=>patch({thumbnailAlt:e.target.value})}/></label></div>
        <label>B 站或原作链接{kind!=='bilibili'?'（选填）':''}<input className="field-input" type="url" maxLength={2048} value={draft.sourceUrl} placeholder="https://www.bilibili.com/video/BV…" onChange={e=>patch({sourceUrl:e.target.value,...(kind==='bilibili'?{content:parseBilibiliUrl(e.target.value)}:{})})}/></label>
        <label>展示形式<select className="field-input" value={kind} onChange={e=>chooseKind(e.target.value as PresentationContent['kind'])}><option value="gallery">图片集</option><option value="markdown">Markdown 文章</option><option value="bilibili">B 站视频</option></select></label>
        {kind==='gallery'?<div className="showcase-gallery-editor"><label>上传正文图片（可多选，单张不超过 20 MiB）<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>{void upload(e.target.files);e.target.value='';}}/></label>
          {draft.content?.kind==='gallery'&&draft.content.images.map((image,index)=><div className="showcase-image-row" key={image.id}><img src={presentationImageUrl(segmentId,image.id,true)} alt={image.alt||`第 ${index+1} 张`}/><div><label>第 {index+1} 张图片说明<input className="field-input" value={image.alt} maxLength={500} onChange={e=>editImage(index,'up',e.target.value)}/></label><div className="showcase-actions"><button type="button" className="text-link" disabled={index===0} onClick={()=>editImage(index,'up')}>上移</button><button type="button" className="text-link" disabled={index===(draft.content?.kind==='gallery'?draft.content.images.length:0)-1} onClick={()=>editImage(index,'down')}>下移</button><button type="button" className="text-link" onClick={()=>patch({thumbnailId:image.id})}>用作预览图</button><button type="button" className="text-link" onClick={()=>editImage(index,'remove')}>移除</button></div></div></div>)}</div>
          :kind==='markdown'?<><label>导入 Markdown 文件<input type="file" accept=".md,text/markdown,text/plain" onChange={e=>{const file=e.target.files?.[0];if(file)void file.text().then(markdown=>patch({content:{kind:'markdown',markdown}})).catch(()=>setError('无法读取 Markdown 文件。'));e.target.value='';}}/></label><label>Markdown 正文<textarea className="field-input showcase-markdown-input" rows={18} maxLength={400000} value={draft.content?.kind==='markdown'?draft.content.markdown:''} onChange={e=>patch({content:{kind:'markdown',markdown:e.target.value}})}/></label></>
          :<p>{draft.content?.kind==='bilibili'?`视频 ${draft.content.bvid}，第 ${draft.content.page} P。`:'请在上方填写完整的 B 站视频链接。'}播放器不自动播放。</p>}
      </fieldset>
      <div className="showcase-actions"><Button appearance="industrial" disabled={busy} onClick={()=>void save()}>{busy?'处理中…':'保存展示资料'}</Button><Button appearance="industrial" variant="secondary" onClick={()=>setPreview(v=>!v)}>{preview?'收起预览':'预览正文'}</Button>
        <Button appearance="industrial" disabled={busy||(!saved?.publishedAt&&(!saved||dirty||presentationIssues(draft).length>0))} onClick={()=>void publish()}>{saved?.publishedAt?'撤下作品':'手动公开'}</Button></div>
      {dirty&&<p className="field-hint">有尚未保存的修改。公开前请先保存。</p>}
      {preview&&<div className="showcase-preview"><WorkPresentation work={work}/></div>}
    </>}
  </section>;
}
