import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PublicPresentationContent } from '../../shared/work-presentations';

export function PresentationBody({content}:{content:PublicPresentationContent|null|undefined}) {
  if (!content) return null;
  if (content.kind==='gallery') return <div className="presentation-gallery">{content.images.map((image,index)=><figure key={`${image.url}-${index}`}>
    <img src={image.url} alt={image.alt || `作品图片 ${index+1}`} loading="lazy" decoding="async" />
    {image.alt && <figcaption>{image.alt}</figcaption>}
  </figure>)}</div>;
  if (content.kind==='bilibili') return <div className="presentation-video"><iframe
    title="Bilibili 作品播放器" src={`https://player.bilibili.com/player.html?bvid=${encodeURIComponent(content.bvid)}&p=${content.page}&autoplay=0`}
    loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>;
  return <article className="presentation-article"><Markdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={['img']}
    components={{a:({children,href})=><a href={href} target="_blank" rel="noopener noreferrer">{children}</a>}}>{content.markdown}</Markdown></article>;
}
