import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { animate } from 'motion/mini';

export function useDialogMotion(ref: RefObject<HTMLDialogElement | null>) {
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const revision = useRef(0);
  const closing = useRef(false);
  const stop = useCallback(() => {
    revision.current++;
    animation.current?.stop();
    closing.current = false;
  }, []);
  useEffect(() => stop, [stop]);

  const enter = useCallback(() => {
    stop();
    if (!ref.current) return;
    animation.current = animate(ref.current, {
      opacity: [0, 1], transform: ['scale(.98)', 'scale(1)'], '--dialog-backdrop-opacity': [0, 1],
    }, { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : .18, ease: 'easeOut' });
  }, [ref, stop]);

  const exit = useCallback((closed: () => void) => {
    if (closing.current) return;
    stop();
    if (!ref.current?.open || matchMedia('(prefers-reduced-motion: reduce)').matches) { closed(); return; }
    closing.current = true;
    const current = revision.current;
    animation.current = animate(ref.current, {
      opacity: 0, transform: 'scale(.98)', '--dialog-backdrop-opacity': 0,
    }, { duration: .12, ease: 'easeIn' });
    void animation.current.then(() => {
      if (current !== revision.current) return;
      closing.current = false;
      closed();
    });
  }, [ref, stop]);
  return { enter, exit, stop };
}
