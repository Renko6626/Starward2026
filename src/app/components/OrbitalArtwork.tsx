import { useId } from 'react';
import { coastDirectionPaths, coastReference, departure, earthRadius, insertion, lunarAssist, missionMetadata, moonRadius, osculatingOrbitPath, parkingRadius, transferPaths } from './orbital-transfer';

// Numerically propagated lunar-assisted trajectory in a planar Earth–Moon
// corotating frame. See scripts/orbit-transfer/ and the validation report.
// The frozen reference ellipse is a geometric overlay; solid states use the
// rotating frame. Their separation is not a measure of lunar perturbation.
function TransferDiagram({ arrowId, rotation }: { arrowId: string; rotation: number }) {
  const mobile = rotation === 15;
  const missionLabel = mobile ? '265 620' : '365 285';
  const lunarLabel = { x: lunarAssist.x + (mobile ? -55 : 29), y: lunarAssist.y + (mobile ? 85 : -36) };
  return (
    <>
      <g className="orbit-construction">
        <circle cx="270" cy="460" r="390" />
        <path d="M270 460 L660 460 L465 122.25 Z" strokeDasharray="3 9" />
        <path d="M235 460 H300 M270 425 V495 M645 460 H675 M660 445 V475" />
        <path d="M457 122.25 H473 M465 114.25 V130.25" />
        <path d="M332 460 A62 62 0 0 0 301 406.3" />
        <text x="336" y="448">60°</text>
      </g>
      <g className="orbit-guides">
        <path d="M125 460 H770 M270 560 V65" strokeDasharray="2 9" />
        <path d="M465 122.25 V460" strokeDasharray="4 9" />
        <path d={`M${coastReference.x} ${coastReference.y} V460 M270 ${coastReference.y} H${coastReference.x}`} strokeDasharray="2 9" />
        <path d="M465 447 V473 M452 460 V447 H465" />
        <text x="779" y="464">x</text>
        <text x="278" y="73">y</text>
      </g>
      {osculatingOrbitPath && <g className="orbit-reference"><path d={osculatingOrbitPath} strokeDasharray="5 7" /></g>}
      <g className="orbit-track">
        <circle cx="270" cy="460" r={parkingRadius} />
        <circle cx="270" cy="460" r={earthRadius} />
        <circle cx="660" cy="460" r={moonRadius} />
        {transferPaths.map((d, index) => <path key={index} d={d} />)}
        {coastDirectionPaths.map((d, index) => <path key={index} d={d} markerEnd={`url(#${arrowId})`} />)}
      </g>
      <g className="orbit-maneuvers">
        <circle cx={departure.x} cy={departure.y} r="2" />
        <circle cx={lunarAssist.x} cy={lunarAssist.y} r="2" />
        <circle cx={insertion.x} cy={insertion.y} r="2.5" />
        <text x="285" y="485">Δv₁</text>
        <text x={lunarAssist.x + 18} y={lunarAssist.y + 27}>Δv₂</text>
        <text x={insertion.x + 17} y={insertion.y + 35}>Δv₃</text>
        <text x="238" y="482">Earth</text>
        <text x="672" y="465">Moon</text>
        <text x="486" y="115">L₄</text>
      </g>
      <g className="orbit-metadata">
        <g transform={`translate(${missionLabel}) rotate(${-rotation})`}>
          <text className="orbit-mission-name" y="0">Project Starward</text>
          <text y="14">Flight time {missionMetadata.flightDays.toFixed(2)} days</text>
        </g>
        <path d="M270 476 L259 508" />
        <g transform={`translate(259 508) rotate(${-rotation})`}>
          <text y="17">Parking orbit</text>
          <text y="34">Altitude {missionMetadata.parkingAltitudeKm.toFixed(0)} km</text>
        </g>
        <path d={`M${lunarAssist.x + 6} ${lunarAssist.y - 7} L${lunarLabel.x} ${lunarLabel.y}`} />
        <g transform={`translate(${lunarLabel.x} ${lunarLabel.y}) rotate(${-rotation})`} textAnchor={mobile ? 'end' : 'start'}>
          <text y="-23">Powered lunar assist</text>
          <text y="-6">Altitude {missionMetadata.lunarAltitudeKm.toFixed(0)} km</text>
          <text className="orbit-metadata-detail" y="11">Δv {missionMetadata.lunarDeltaVKmS.toFixed(3)} km/s</text>
        </g>
      </g>
    </>
  );
}

export function OrbitalArtwork() {
  const id = useId().replaceAll(':', '');
  const arrowId = `orbit-arrow-${id}`;
  const fadeId = `orbit-fade-${id}`;
  const maskId = `orbit-mask-${id}`;
  return (
    <div className="orbital-artwork" aria-hidden="true">
      <svg className="orbital-artwork-desktop" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M1 1 L7 4 L1 7" fill="none" stroke="currentColor" strokeWidth="1" />
          </marker>
          <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="white" /><stop offset=".7" stopColor="white" />
            <stop offset=".9" stopColor="black" /><stop offset="1" stopColor="black" />
          </linearGradient>
          <mask id={maskId}><rect width="1600" height="1000" fill={`url(#${fadeId})`} /></mask>
        </defs>
        <g mask={`url(#${maskId})`}>
          <g transform="translate(270 460) rotate(35) scale(1.35) translate(-270 -460)">
            <TransferDiagram arrowId={arrowId} rotation={35} />
          </g>
        </g>
        <g className="station-annotation">
          <circle cx="1100" cy="728" r="1.5" />
          <path d="M1100 728 L1160 818 H1320" />
          <text x="1160" y="838">Satellite Torifune</text>
        </g>
      </svg>
      <svg className="orbital-artwork-mobile" viewBox="0 0 390 844" preserveAspectRatio="xMidYMin slice" focusable="false">
        <g transform="translate(70 310) rotate(15) scale(.73) translate(-270 -460)"><TransferDiagram arrowId={arrowId} rotation={15} /></g>
        <g className="station-annotation">
          <circle cx="277" cy="350" r="1" />
          <path d="M277 350 L315 456 H190" />
          <text x="190" y="476" textAnchor="end">Satellite Torifune</text>
        </g>
      </svg>
    </div>
  );
}
