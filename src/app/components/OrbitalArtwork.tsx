import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Vivus from 'vivus';
import { coastDirectionPaths, coastReference, departure, earthRadius, insertion, lunarAssist, missionMetadata, missionPositionAt, moonRadius, osculatingOrbitPath, parkingRadius, transferPaths } from './orbital-transfer';
import { RELAY_START } from './MissionCountdown';

const arrivalTime = Date.parse(RELAY_START);

// Numerically propagated lunar-assisted trajectory in a planar Earth–Moon
// corotating frame. See scripts/orbit-transfer/ and the validation report.
// The frozen reference ellipse is a geometric overlay; solid states use the
// rotating frame. Their separation is not a measure of lunar perturbation.
function TransferDiagram({ arrowId, rotation, position, paused }: {
  arrowId: string; rotation: number; position: ReturnType<typeof missionPositionAt>; paused: boolean;
}) {
  const id = useId().replaceAll(':', '');
  const lightId = `orbit-light-${id}`;
  const lightMaskId = `orbit-light-mask-${id}`;
  const parkingId = `orbit-parking-${id}`;
  const trackId = (index: number) => `orbit-track-${id}-${index}`;
  const entryMaskId = (index: number) => `orbit-entry-${id}-${index}`;
  const diagram = useRef<SVGGElement>(null);
  const pausedRef = useRef(paused);
  const syncPlayback = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    pausedRef.current = paused;
    syncPlayback.current?.();
  }, [paused]);
  // Start and finish the full parking circle at the actual departure point.
  const parkingPath = `M${departure.x} ${departure.y} A${parkingRadius} ${parkingRadius} 0 1 0 ${540 - departure.x} ${920 - departure.y} A${parkingRadius} ${parkingRadius} 0 1 0 ${departure.x} ${departure.y}`;
  useLayoutEffect(() => {
    const root = diagram.current;
    const drawing = root?.querySelector<SVGGElement>('.orbit-entry-masks');
    if (!root || !drawing) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation: Vivus | undefined;
    let frame = 0, elapsed = 0, previous: number | null = null, visible = false;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = null;
      root.classList.add('is-paused');
    };
    const finish = () => {
      stop();
      animation?.destroy();
      animation = undefined;
      root.classList.remove('is-entering', 'is-tracing', 'is-paused');
      root.classList.add('has-entered');
    };
    const tick = (time: number) => {
      frame = 0;
      if (previous !== null) elapsed += time - previous;
      previous = time;
      // Vivus uses frame counts internally; drive progress with visible wall
      // time so high refresh rates and hidden tabs don't skip the entrance.
      const cycle = elapsed % 8000;
      if (elapsed < 2700) animation?.setFrameProgress(Math.min(cycle / 2300, 1));
      else {
        root.classList.remove('is-entering');
        root.classList.add('has-entered');
        const tracing = cycle < 2700;
        root.classList.toggle('is-tracing', tracing);
        if (tracing) animation?.setFrameProgress(Math.min(cycle / 2300, 1));
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (animation && visible && !document.hidden && !preference.matches && !pausedRef.current) {
        root.classList.remove('is-paused');
        if (!frame) frame = requestAnimationFrame(tick);
      } else stop();
    };
    syncPlayback.current = sync;
    const start = () => {
      elapsed = 0;
      root.classList.remove('has-entered');
      const paths = [...drawing.querySelectorAll<SVGPathElement>('path')];
      const lengths = paths.slice(1).map(path => path.getTotalLength());
      const totalLength = lengths.reduce((sum, length) => sum + length, 0);
      let start = 0;
      paths.forEach((path, index) => {
        const duration = index === 0 ? 36 : index === paths.length - 1
          ? 138 - start : Math.round(102 * lengths[index - 1]! / totalLength);
        path.dataset.start = String(start);
        path.dataset.duration = String(duration);
        start += duration;
      });
      animation = new Vivus(drawing.id, { type: 'scenario', start: 'manual', duration: 138, forceRender: false });
      root.classList.add('is-entering');
      sync();
    };
    const observer = new IntersectionObserver(entries => {
      visible = entries[0]!.isIntersecting;
      sync();
    });
    observer.observe(root.ownerSVGElement!);
    if (preference.matches) finish();
    else start();
    const onPreferenceChange = () => {
      if (preference.matches) finish();
      else if (!animation) start();
    };
    preference.addEventListener('change', onPreferenceChange);
    document.addEventListener('visibilitychange', sync);
    return () => {
      syncPlayback.current = null;
      observer.disconnect();
      preference.removeEventListener('change', onPreferenceChange);
      document.removeEventListener('visibilitychange', sync);
      finish();
    };
  }, []);
  const lightRadius = 32;
  const mobile = rotation === 15;
  const missionLabel = mobile ? '265 620' : '365 285';
  const lunarLabel = { x: lunarAssist.x + (mobile ? -55 : 29), y: lunarAssist.y + (mobile ? 85 : -36) };
  return (
    <g ref={diagram} className="orbit-diagram">
      <defs>
        <g id={`orbit-entry-masks-${id}`} className="orbit-entry-masks">
          {[parkingPath, ...transferPaths].map((d, index) => (
            <mask key={index} id={entryMaskId(index)} maskUnits="userSpaceOnUse" x="-1000" y="-1000" width="3000" height="3000">
              <path d={d} fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" />
            </mask>
          ))}
        </g>
        <radialGradient id={lightId}>
          <stop offset="0" stopColor="white" />
          <stop offset=".25" stopColor="white" stopOpacity=".85" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id={lightMaskId} maskUnits="userSpaceOnUse"
          x={position.x - lightRadius} y={position.y - lightRadius}
          width={lightRadius * 2} height={lightRadius * 2}>
          <circle cx={position.x} cy={position.y} r={lightRadius} fill={`url(#${lightId})`} stroke="none" />
        </mask>
      </defs>
      <g className="orbit-entry-guides">
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
      </g>
      <g className="orbit-track">
        <circle className="orbit-entry-track" id={parkingId} cx="270" cy="460" r={parkingRadius} mask={`url(#${entryMaskId(0)})`} />
        <circle cx="270" cy="460" r={earthRadius} />
        <circle cx="660" cy="460" r={moonRadius} />
        {transferPaths.map((d, index) => <path className="orbit-entry-track" key={index} id={trackId(index)} d={d} mask={`url(#${entryMaskId(index + 1)})`} />)}
        <g className="orbit-entry-details">
          {coastDirectionPaths.map((d, index) => <path key={index} d={d} markerEnd={`url(#${arrowId})`} />)}
        </g>
      </g>
      <g className="orbit-entry-sweep">
        {[parkingPath, ...transferPaths].map((d, index) => <path key={index} d={d} mask={`url(#${entryMaskId(index)})`} />)}
      </g>
      <g className="orbit-entry-live">
        <g className="orbit-lit-track" mask={`url(#${lightMaskId})`}>
          <use href={`#${parkingId}`} />
          {transferPaths.map((_, index) => <use key={index} href={`#${trackId(index)}`} />)}
        </g>
      </g>
      <g className="orbit-entry-details">
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
      </g>
      <g className="orbit-mission-star orbit-entry-live" transform={`translate(${position.x} ${position.y}) rotate(${-rotation})`}>
        <path d="M0 -7 L1.3 -1.3 L5 0 L1.3 1.3 L0 7 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z" />
      </g>
    </g>
  );
}

export function OrbitalArtwork({ paused = false }: { paused?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => { if (!document.hidden) setNow(Date.now()); };
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const position = missionPositionAt(now, arrivalTime);
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
            <TransferDiagram arrowId={arrowId} rotation={35} position={position} paused={paused} />
          </g>
        </g>
      </svg>
      <svg className="orbital-artwork-mobile" viewBox="0 0 390 844" preserveAspectRatio="xMidYMin slice" focusable="false">
        <g transform="translate(70 310) rotate(15) scale(.73) translate(-270 -460)"><TransferDiagram arrowId={arrowId} rotation={15} position={position} paused={paused} /></g>
      </svg>
    </div>
  );
}
