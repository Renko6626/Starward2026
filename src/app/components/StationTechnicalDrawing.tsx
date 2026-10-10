import './station-technical-drawing.css';

const views = [
  { file: 'assembly.svg', label: 'Torifune', ref: 'TF / 01', height: 930, alt: '鸟船侧视图，带图纸分区、环体直径、轴向尺寸和比例尺' },
  { file: 'end-view.svg', label: 'End view', ref: 'TF / 02', height: 930, alt: '双环端视图，带直径和辐条角度标注' },
  { file: 'docking.svg', label: 'Dock', ref: 'B', height: 650, alt: '对接端局部放大图，带舱段尺寸和比例尺' },
  { file: 'propulsion.svg', label: 'Propulsion', ref: 'C', height: 650, alt: '推进尾段局部放大图，带储罐数量与喷口尺寸' },
];

export function StationTechnicalDrawing({ variant }: { variant: 'entry' | 'guide' }) {
  return (
    <div className={`station-technical-drawing station-technical-drawing--${variant}`}>
      {(variant === 'entry' ? views.slice(0, 1) : views.slice(1)).map((view, index) => (
        <figure className="station-drawing-view" key={view.file}>
          <figcaption className="station-drawing-caption"><span>{view.label}</span><span>{view.ref}</span></figcaption>
          <img className="station-drawing-plate" src={`/station-drawings/${view.file}`} alt={view.alt} width={1120} height={view.height} loading={index === 0 ? 'eager' : 'lazy'} />
        </figure>
      ))}
    </div>
  );
}
