import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { StationScene } from './scene';

export function StationBackdrop({ paused, onTogglePaused }: { paused: boolean; onTogglePaused: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<StationScene | null>(null);
  const [ready, setReady] = useState(false);
  const pausedRef = useRef(paused);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setReduced(preference.matches);
    syncPreference();
    preference.addEventListener('change', syncPreference);
    let cancelled = false;
    let scrollFrame = 0;
    let progress = 0;
    const updateScroll = () => {
      scrollFrame = 0;
      const backdrop = root.current;
      const home = backdrop?.closest<HTMLElement>('.station-home');
      if (!backdrop || !home) return;
      const distance = Math.max(0, -home.getBoundingClientRect().top);
      progress = Math.min(1, distance / Math.max(1, home.offsetHeight - window.innerHeight));
      const heroHeight = home.querySelector<HTMLElement>('.orbital-hero')?.offsetHeight ?? window.innerHeight;
      const fade = Math.min(1, distance / Math.max(1, heroHeight * .85));
      backdrop.style.setProperty('--station-dim', String(fade * .78));
      scene.current?.setScrollProgress(progress);
    };
    const scheduleScroll = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScroll);
    };
    const home = root.current?.closest('.station-home');
    const sizeObserver = new ResizeObserver(scheduleScroll);
    if (home) sizeObserver.observe(home);
    window.addEventListener('scroll', scheduleScroll, { passive: true });
    window.addEventListener('resize', scheduleScroll);
    updateScroll();
    const timer = window.setTimeout(() => {
      void import('./scene').then(({ mountStationScene }) => {
        const canvas = root.current?.querySelector<HTMLElement>('.station-canvas');
        if (cancelled || !canvas) return;
        scene.current = mountStationScene(canvas, {
          paused: pausedRef.current,
          onReady: () => setReady(true), onUnavailable: () => setReady(false),
        });
        scene.current.setScrollProgress(progress);
      }).catch(error => { if (!cancelled) setReady(false); console.error('Station scene unavailable', error); });
    }, 80);
    return () => {
      cancelled = true; window.clearTimeout(timer);
      window.cancelAnimationFrame(scrollFrame);
      sizeObserver.disconnect();
      window.removeEventListener('scroll', scheduleScroll);
      window.removeEventListener('resize', scheduleScroll);
      preference.removeEventListener('change', syncPreference);
      scene.current?.dispose(); scene.current = null;
    };
  }, []);
  useEffect(() => { pausedRef.current = paused; scene.current?.setPaused(paused); }, [paused]);
  return (
    <>
      <div ref={root} className={`station-backdrop ${ready ? 'is-ready' : ''}`} aria-hidden="true">
        <picture className="station-poster">
          <source media="(max-width: 699px)" srcSet="/station/mobile.jpg" />
          <img src="/station/desktop.jpg" alt="" fetchPriority="high" />
        </picture>
        <div className="station-canvas" data-station-ready={ready ? 'true' : 'false'} />
        <div className="orbital-shade" />
        <div className="station-reading-shade" />
      </div>
      {ready && !reduced ? (
        <button className="station-motion" type="button" aria-pressed={paused} onClick={onTogglePaused}>
          {paused ? <Play size={13} /> : <Pause size={13} />}
          {paused ? '继续运行' : '暂停运行'}
        </button>
      ) : null}
    </>
  );
}
