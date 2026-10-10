// Measure rendered frames (not RAF ticks) over a sustained window. Start at
// full quality; isolated startup/resize stalls must not lower the resolution.
export function createRenderQuality() {
  let scale = 1, last = null, elapsed = 0, frames = 0, fastWindows = 0;
  const reset = () => { last = null; elapsed = 0; frames = 0; fastWindows = 0; };
  return {
    reset,
    sample(now) {
      if (last === null) { last = now; return scale; }
      const delta = now - last;
      last = now;
      if (delta <= 0 || delta > 1000) { reset(); return scale; }
      elapsed += delta; frames++;
      if (elapsed < 2000) return scale;
      const average = elapsed / frames;
      if (average > 1000 / 24) {
        scale = Math.max(.6, scale * .85);
        fastWindows = 0;
      } else if (average < 35) {
        // Recover slowly to avoid oscillating between two resolutions.
        if (++fastWindows >= 4) { scale = Math.min(1, scale / .85); fastWindows = 0; }
      } else fastWindows = 0;
      elapsed = 0; frames = 0;
      return scale;
    },
  };
}
