import { useId, useLayoutEffect, useRef } from "react";
import Vivus from "vivus";

/** Decorative axes draw once, using visible time rather than refresh-rate-dependent frames. */
export function ScheduleTrace({ direction, delay = 0 }: { direction: "horizontal" | "vertical"; delay?: number }) {
  const id = `schedule-trace-${useId().replaceAll(":", "")}`;
  const root = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const svg = root.current;
    const path = svg?.querySelector("path");
    if (!svg || !path) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const duration = direction === "horizontal" ? 700 : 850;
    let animation: Vivus | undefined;
    let frame = 0, elapsed = 0, previous: number | null = null;
    let visible = false, finished = preference.matches, length = 0;
    const progress = () => Math.min(1, Math.max(0, (elapsed - delay) / duration));
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = null;
    };
    const finish = () => {
      finished = true;
      stop();
      animation?.destroy();
      animation = undefined;
    };
    const tick = (time: number) => {
      frame = 0;
      if (previous !== null) elapsed += time - previous;
      previous = time;
      animation?.setFrameProgress(progress());
      if (progress() >= 1) finish();
      else frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (preference.matches) finish();
      else if (!finished && animation && visible && !document.hidden) {
        if (!frame) frame = requestAnimationFrame(tick);
      } else stop();
    };
    const measure = () => {
      const bounds = svg.getBoundingClientRect();
      const next = direction === "horizontal" ? bounds.width : bounds.height;
      if (Math.abs(next - length) < 0.5) return;
      length = next;
      animation?.destroy();
      animation = undefined;
      path.setAttribute("d", direction === "horizontal" ? `M0 .5H${length}` : `M.5 0V${length}`);
      if (!finished && length > 0) {
        animation = new Vivus(id, {
          type: "sync", start: "manual", duration: 100, forceRender: false,
          pathTimingFunction: Vivus.EASE_OUT,
        });
        animation.setFrameProgress(progress());
      }
      sync();
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(svg);
    const observer = new IntersectionObserver(entries => {
      visible = entries[0]!.isIntersecting;
      sync();
    });
    observer.observe(svg);
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      animation?.destroy();
      resize.disconnect();
      observer.disconnect();
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [id, direction, delay]);

  return <svg ref={root} id={id} className={`ops-trace ops-trace--${direction}`} aria-hidden="true" focusable="false">
    <path />
  </svg>;
}
