import { earthIconRadius, earthPosition, flightSeconds, lunarOrbit, missionArcs, missionBurns, missionFrameAt, moonIconRadius, orbitLayers, predictionTracks } from './mission-orbit';

export function mountMissionOrbit(container: HTMLElement): () => void {
  const earth = earthPosition;
  const dockingHeading = missionFrameAt(108).heading;
  const mask = (layer: number) => `url(#mission-occlusion-${layer})`;
  const layers = (className: string) => `<g class="${className}">${[0, 1, 2, 3].map(layer => `<path mask="${mask(layer)}"/>`).join('')}</g>`;
  container.innerHTML = `<svg class="mission-orbit" viewBox="0 0 1200 1000" role="presentation">
    <defs>
      <marker id="mission-burn-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M1 1L6 3.5L1 6"/></marker>
      <linearGradient id="mission-depth" gradientUnits="userSpaceOnUse" x1="0" y1="160" x2="0" y2="820"><stop stop-color="#c3cec0"/><stop offset="1" stop-color="#526d70"/></linearGradient>
      <g id="mission-vehicle-symbol">
        <path class="mission-vehicle-hull" d="M6 0L2 -3H-5V3H2Z"/>
        <path d="M6 -1.5V1.5 M-3 -3V-5 M-3 3V5"/>
        <rect x="-7" y="-8" width="8" height="3"/><rect x="-7" y="5" width="8" height="3"/>
      </g>
      ${[0, 1, 2, 3].map(layer => `<mask id="mission-occlusion-${layer}" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="1000"><rect width="1200" height="1000" fill="white"/>${layer & 1 ? `<circle cx="${earth.x}" cy="${earth.y}" r="${earthIconRadius}" fill="black"/>` : ''}${layer & 2 ? `<circle class="mission-moon-mask" r="${moonIconRadius}" fill="black"/>` : ''}</mask>`).join('')}
    </defs>
    <g class="mission-earth" transform="translate(${earth.x} ${earth.y})">
      <circle class="mission-body-limb" r="${earthIconRadius}"/>
      <g class="mission-earth-grid" transform="rotate(-17)">
        <ellipse rx="27" ry="8"/><ellipse rx="11" ry="27"/>
        <ellipse cy="-11" rx="23" ry="6"/><ellipse cy="11" rx="23" ry="6"/>
      </g>
    </g>
    <g class="mission-moon"><circle class="mission-body-limb" r="${moonIconRadius}"/>
      <g class="mission-moon-surface"><circle cx="-2.4" cy="-1.5" r="1.6"/><circle cx="2" cy="2.1" r="1.1"/><path d="M1 -4.5Q3 -4 3.5 -2.5"/></g>
    </g>
    ${layers('mission-reference')}
    ${predictionTracks.map((_, index) => layers(`mission-prediction mission-prediction--${index}`)).join('')}
    ${layers('mission-planned')}
    ${layers('mission-completed')}
    <g class="mission-nodes">${missionBurns.map(burn => `<circle cx="${burn.position.x}" cy="${burn.position.y}" r="3"/>`).join('')}</g>
    <g class="mission-burns">${missionBurns.map(burn => `<path d="M${burn.position.x} ${burn.position.y}L${burn.tip.x} ${burn.tip.y}" marker-end="url(#mission-burn-arrow)" opacity="0"/>`).join('')}</g>
    <g class="mission-target-occlusion"><g class="mission-target">
      <g class="mission-station-symbol">
        <path class="mission-station-axis" d="M0 -2.5H8V-4H48V4H8V2.5H0Z"/>
        <ellipse cx="22" rx="5" ry="15"/><ellipse cx="35" rx="4" ry="10"/>
        <path class="mission-station-structure" d="M22 -15V15 M35 -10V10 M19 -11L25 11 M32 -7L38 7 M42 -4V-9 M42 4V9"/>
        <rect x="40" y="-15" width="13" height="6"/><rect x="40" y="9" width="13" height="6"/>
        <path class="mission-docking-port" d="M0 -3.5V3.5 M3 -2.5V2.5"/>
      </g>
      <g class="mission-docked-vehicle" opacity="0"><use href="#mission-vehicle-symbol" transform="translate(-6 0)"/></g>
    </g></g>
    <g class="mission-craft-occlusion"><g class="mission-craft"><use href="#mission-vehicle-symbol"/></g></g>
  </svg>`;
  const paths = (className: string) => [...container.querySelectorAll<SVGPathElement>(`.${className} > path`)];
  const planned = paths('mission-planned'), completed = paths('mission-completed'), reference = paths('mission-reference');
  const progress = container.querySelector<SVGGElement>('.mission-completed')!;
  const predictions = predictionTracks.map((_, index) => paths(`mission-prediction--${index}`));
  const craft = container.querySelector<SVGGElement>('.mission-craft')!;
  const moon = container.querySelector<SVGGElement>('.mission-moon')!;
  const target = container.querySelector<SVGGElement>('.mission-target')!;
  const dockedVehicle = container.querySelector<SVGGElement>('.mission-docked-vehicle')!;
  const targetOcclusion = container.querySelector<SVGGElement>('.mission-target-occlusion')!;
  const craftOcclusion = container.querySelector<SVGGElement>('.mission-craft-occlusion')!;
  const moonMasks = [...container.querySelectorAll<SVGCircleElement>('.mission-moon-mask')];
  const burns = paths('mission-burns');
  const nodes = [...container.querySelectorAll<SVGCircleElement>('.mission-nodes circle')];
  const allPoints = missionArcs.flatMap(arc => arc.points);
  const update = (elapsed: number) => {
    const state = missionFrameAt(elapsed);
    const layerAt = (depth: number) => (depth < 0 ? 1 : 0) + (depth < state.moon.depth ? 2 : 0);
    moon.setAttribute('transform', `translate(${state.moon.x} ${state.moon.y}) scale(${state.moon.scale})`);
    target.setAttribute('transform', `translate(${state.target.x} ${state.target.y}) rotate(${dockingHeading}) scale(${state.target.scale})`);
    // Masks use SVG world coordinates: apply them outside transformed symbol groups.
    targetOcclusion.setAttribute('mask', mask(layerAt(state.target.depth)));
    craftOcclusion.setAttribute('mask', mask(layerAt(state.position.depth)));
    moonMasks.forEach(circle => {
      circle.setAttribute('cx', String(state.moon.x)); circle.setAttribute('cy', String(state.moon.y));
      circle.setAttribute('r', String(moonIconRadius * state.moon.scale));
    });
    craft.setAttribute('transform', `translate(${state.position.x} ${state.position.y}) rotate(${state.heading}) scale(${state.position.scale})`);
    // Endpoint remains the validated L4 arrival. The attached glyph represents
    // docking narratively; no close-range guidance or contact dynamics are inferred.
    const arrived = state.seconds >= flightSeconds;
    craft.setAttribute('opacity', String(arrived ? 0 : state.opacity));
    dockedVehicle.setAttribute('opacity', String(arrived ? state.opacity : 0));
    target.classList.toggle('is-docked', arrived);
    progress.setAttribute('opacity', String(state.opacity));
    const flown = missionArcs.slice(0, state.arcIndex).flatMap(arc => arc.points)
      .concat(missionArcs[state.arcIndex]!.points.slice(0, state.sampleIndex + 1), state.position);
    const plannedLayers = orbitLayers(allPoints, state.moon.depth);
    const completedLayers = orbitLayers(flown, state.moon.depth);
    const referenceLayers = orbitLayers(lunarOrbit, state.moon.depth);
    planned.forEach((path, layer) => path.setAttribute('d', plannedLayers[layer]!));
    completed.forEach((path, layer) => path.setAttribute('d', completedLayers[layer]!));
    reference.forEach((path, layer) => path.setAttribute('d', referenceLayers[layer]!));
    predictions.forEach((paths, index) => {
      const layers = orbitLayers(predictionTracks[index]!, state.moon.depth);
      paths.forEach((path, layer) => path.setAttribute('d', layers[layer]!));
    });
    burns.forEach((path, index) => {
      path.setAttribute('opacity', String(state.burnOpacity[index]! * state.opacity));
      path.setAttribute('mask', mask(layerAt(missionBurns[index]!.position.depth)));
    });
    nodes.forEach((node, index) => node.setAttribute('mask', mask(layerAt(missionBurns[index]!.position.depth))));
  };

  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, elapsed = 0, previous: number | null = null, visible = false;
  const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = null; };
  const tick = (time: number) => {
    frame = 0;
    if (previous === null) previous = time;
    if (time - previous >= 1000 / 24) {
      elapsed += (time - previous) / 1000;
      previous = time; update(elapsed);
    }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    if (preference.matches) { stop(); update(58); }
    else if (visible && !document.hidden) { update(elapsed); if (!frame) frame = requestAnimationFrame(tick); }
    else stop();
  };
  const observer = new IntersectionObserver(entries => { visible = entries[0]!.isIntersecting; sync(); });
  observer.observe(container);
  preference.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  update(preference.matches ? 58 : 0);
  return () => {
    stop(); observer.disconnect();
    preference.removeEventListener('change', sync);
    document.removeEventListener('visibilitychange', sync);
    container.replaceChildren();
  };
}
