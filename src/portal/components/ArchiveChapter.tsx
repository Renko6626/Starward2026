import { useEffect, useRef, useState, type ReactNode } from "react";

/** Reveal mounted chapter contents before hash navigation or validation focus. */
export function revealArchiveTarget(target: HTMLElement) {
  let parent: HTMLElement | null = target;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) {
      parent.dispatchEvent(new Event("archive-reveal"));
      parent.open = true;
      parent.querySelector<HTMLElement>(":scope > .chapter-content")?.removeAttribute("inert");
    }
    parent = parent.parentElement;
  }
}

export function ArchiveChapter({ id, number, title, state, defaultOpen = false, enabled = true, className, children }: {
  id?: string; number: string; title: string; state?: ReactNode; defaultOpen?: boolean; enabled?: boolean; className?: string; children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const desiredOpen = useRef(defaultOpen);
  useEffect(() => {
    if (!enabled) return;
    const reveal = () => {
      const hash = window.location.hash.slice(1);
      const target = hash ? document.getElementById(hash) : null;
      if (target && details.current?.contains(target)) {
        animation.current?.cancel();
        revealArchiveTarget(target);
        setOpen(true);
        requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
      }
    };
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      const href = anchor?.getAttribute("href");
      if (href?.startsWith("#")) {
        const target = document.getElementById(href.slice(1));
        if (target && details.current?.contains(target)) { animation.current?.cancel(); revealArchiveTarget(target); setOpen(true); }
      }
    };
    const onReveal = () => { animation.current?.cancel(); animation.current = null; desiredOpen.current = true; setOpen(true); };
    const node = details.current;
    node?.addEventListener("archive-reveal", onReveal);
    reveal();
    window.addEventListener("hashchange", reveal);
    document.addEventListener("click", onClick);
    return () => { node?.removeEventListener("archive-reveal", onReveal); window.removeEventListener("hashchange", reveal); document.removeEventListener("click", onClick); animation.current?.cancel(); };
  }, [enabled]);
  if (!enabled) return <section className={className}>{children}</section>;
  return <details id={id} ref={details} className="archive-chapter" open={open} onToggle={event => { if (!animation.current) { desiredOpen.current = event.currentTarget.open; setOpen(event.currentTarget.open); } }}>
    <summary onClick={event => {
      event.preventDefault();
      const node = details.current;
      const body = content.current;
      if (!node || !body) return;
      const currentHeight = node.open ? body.getBoundingClientRect().height : 0;
      const currentOpacity = node.open ? getComputedStyle(body).opacity : "0";
      animation.current?.cancel();
      animation.current = null;
      const expanding = !desiredOpen.current;
      desiredOpen.current = expanding;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { node.open = expanding; body.inert = !expanding; setOpen(expanding); return; }
      if (expanding) { node.open = true; body.inert = false; setOpen(true); }
      else body.inert = true;
      const height = body.scrollHeight;
      const motion = body.animate([{ height: `${currentHeight}px`, opacity: currentOpacity }, { height: `${expanding ? height : 0}px`, opacity: expanding ? 1 : 0 }], { duration: 180, easing: "ease-out" });
      animation.current = motion;
      motion.onfinish = () => { if (!expanding) { node.open = false; setOpen(false); } animation.current = null; };
    }}><span className="chapter-number">{number}</span><h2>{title}</h2><span className="chapter-state">{state}</span><span className="chapter-toggle">{open ? "收起 −" : "展开 +"}</span></summary>
    <div ref={content} className="chapter-content" inert={!open}><div className="chapter-sheet">{children}</div></div>
  </details>;
}
