import { useSiteTranslation } from "../../i18n/use-site-translation";
import './station-technical-drawing.css';

const views = [
  { file: 'assembly.svg', label: 'Torifune', ref: 'TF / 01', height: 930, alt: "public.drawing.assembly" },
  { file: 'end-view.svg', label: 'End view', ref: 'TF / 02', height: 930, alt: "public.drawing.end" },
  { file: 'docking.svg', label: 'Dock', ref: 'B', height: 650, alt: "public.drawing.dock" },
  { file: 'propulsion.svg', label: 'Propulsion', ref: 'C', height: 650, alt: "public.drawing.propulsion" },
];

export function StationTechnicalDrawing({ variant }: { variant: 'entry' | 'guide' }) {
  const { t } = useSiteTranslation();
  return (
    <div className={`station-technical-drawing station-technical-drawing--${variant}`}>
      {(variant === 'entry' ? views.slice(0, 1) : views.slice(1)).map((view, index) => (
        <figure className="station-drawing-view" key={view.file}>
          <figcaption className="station-drawing-caption"><span>{view.label}</span><span>{view.ref}</span></figcaption>
          <img className="station-drawing-plate" src={`/station-drawings/${view.file}`} alt={t(view.alt)} width={1120} height={view.height} loading={index === 0 ? 'eager' : 'lazy'} />
        </figure>
      ))}
    </div>
  );
}
