import type { PropsWithChildren } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';

function Layer({ children }: PropsWithChildren) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  return <motion.div className="crossfade-layer" aria-hidden={!present || undefined} inert={!present}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: reduced ? 0 : .14, ease: 'easeOut' }}>{children}</motion.div>;
}

/** Only wrap presentation content; editable forms remain mounted outside. */
export function Crossfade({ valueKey, children }: PropsWithChildren<{ valueKey: string }>) {
  return <div className="crossfade"><AnimatePresence initial={false}>
    <Layer key={valueKey}>{children}</Layer>
  </AnimatePresence></div>;
}
