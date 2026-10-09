import { useEffect, useRef } from 'react';

export function ObservatoryBackdrop() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import('./scene').then(({ mountObservatoryScene }) => {
      if (cancelled || !root.current) return;
      dispose = mountObservatoryScene(root.current);
    }).catch(error => {
      if (!cancelled) console.warn('Observatory artwork unavailable', error);
    });
    return () => { cancelled = true; dispose?.(); };
  }, []);
  return <div ref={root} className="schedule-observatory" aria-hidden="true">
    <div className="schedule-orbit" />
    <div className="schedule-antenna" />
  </div>;
}
