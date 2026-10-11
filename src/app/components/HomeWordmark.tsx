import { useId, useLayoutEffect, useRef } from 'react';
import { animate, motionValue } from 'motion';
import Vivus from 'vivus';
import wordmarkSvg from '../../../public/brand/starward-pilgrimage.svg?raw';

// Keep the animated outline and the finished wordmark on the same artwork.
const paths = [...wordmarkSvg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => match[1]!);

export function HomeWordmark() {
  const id = `home-wordmark-${useId().replaceAll(':', '')}`;
  const root = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLImageElement>(null);
  const outline = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const element = root.current;
    const image = fill.current;
    const svg = outline.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || !image || !svg || preference.matches) return;

    const drawing = new Vivus(id, { type: 'sync', start: 'manual', duration: 60, forceRender: false });
    drawing.setFrameProgress(0);
    element.classList.add('is-drawing');
    const progress = motionValue(0);
    const unsubscribe = progress.on('change', value => drawing.setFrameProgress(value));
    const playback = animate([
      [progress, 1, { at: .15, duration: 1, ease: 'linear' }],
      [image, { opacity: [0, 1] }, { at: .95, duration: .35, ease: 'easeOut' }],
      [svg, { opacity: [1, 0] }, { at: 1.15, duration: .25 }],
    ]);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      unsubscribe();
      drawing.destroy();
      element.classList.remove('is-drawing');
      image.style.removeProperty('opacity');
      svg.style.removeProperty('opacity');
    };
    const onPreferenceChange = () => {
      if (preference.matches) {
        playback.stop();
        finish();
      }
    };
    void playback.then(finish);
    preference.addEventListener('change', onPreferenceChange);
    return () => {
      preference.removeEventListener('change', onPreferenceChange);
      playback.stop();
      finish();
    };
  }, [id]);

  return <span ref={root} className="home-wordmark">
    <img ref={fill} src="/brand/starward-pilgrimage.svg" width={13181} height={1200} alt="Starward Pilgrimage" />
    <svg ref={outline} id={id} className="home-wordmark-outline" viewBox="0 0 13181 1200" aria-hidden="true" focusable="false">
      {paths.map((d, index) => <path key={index} d={d} fill="none" stroke="currentColor" strokeWidth="20" strokeLinejoin="round" />)}
    </svg>
  </span>;
}
