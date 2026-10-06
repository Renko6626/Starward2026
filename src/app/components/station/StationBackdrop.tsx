import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { StationScene } from './scene';

export function StationBackdrop() {
  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<StationScene | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setReduced(preference.matches);
    syncPreference();
    preference.addEventListener('change', syncPreference);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void import('./scene').then(({ mountStationScene }) => {
        if (cancelled || !root.current) return;
        scene.current = mountStationScene(root.current, {
          paused: pausedRef.current,
          onReady: () => setReady(true), onUnavailable: () => setReady(false),
        });
      }).catch(error => { if (!cancelled) setReady(false); console.error('Station scene unavailable', error); });
    }, 80);
    return () => {
      cancelled = true; window.clearTimeout(timer);
      preference.removeEventListener('change', syncPreference);
      scene.current?.dispose(); scene.current = null;
    };
  }, []);
  useEffect(() => { pausedRef.current = paused; scene.current?.setPaused(paused); }, [paused]);
  return (
    <>
      <div className={`station-backdrop ${ready ? 'is-ready' : ''}`} aria-hidden="true">
        <picture className="station-poster">
          <source media="(max-width: 699px)" srcSet="/station/mobile.jpg" />
          <img src="/station/desktop.jpg" alt="" fetchPriority="high" />
        </picture>
        <div ref={root} className="station-canvas" data-station-ready={ready ? 'true' : 'false'} />
      </div>
      {ready && !reduced ? (
        <button className="station-motion" type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
          {paused ? <Play size={13} /> : <Pause size={13} />}
          {paused ? '继续运行' : '暂停运行'}
        </button>
      ) : null}
    </>
  );
}
