import { useSiteTranslation } from "../../i18n/use-site-translation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

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
  const { t } = useSiteTranslation();
  const navigate = useNavigate();
  const details = useRef<HTMLDetailsElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const desiredOpen = useRef(defaultOpen);
  const setExpanded = useCallback((expanding: boolean) => {
    const node = details.current;
    const body = content.current;
    if (!node || !body || (desiredOpen.current === expanding && !animation.current)) return;
    const currentHeight = node.open ? body.getBoundingClientRect().height : 0;
    const currentOpacity = node.open ? getComputedStyle(body).opacity : "0";
    animation.current?.cancel();
    animation.current = null;
    desiredOpen.current = expanding;
    body.inert = !expanding;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.open = expanding;
      setOpen(expanding);
      return;
    }
    if (expanding) { node.open = true; setOpen(true); }
    const motion = body.animate([
      { height: `${currentHeight}px`, opacity: currentOpacity },
      { height: `${expanding ? body.scrollHeight : 0}px`, opacity: expanding ? 1 : 0 },
    ], { duration: 180, easing: "ease-out" });
    animation.current = motion;
    motion.onfinish = () => {
      if (!expanding) { node.open = false; setOpen(false); }
      animation.current = null;
    };
  }, []);
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
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      const href = anchor?.getAttribute("href");
      if (href?.startsWith("#") && !anchor?.target) {
        const target = document.getElementById(href.slice(1));
        if (target && details.current?.contains(target)) {
          event.preventDefault();
          setExpanded(true);
          if (window.location.hash !== href) void navigate({ hash: href.slice(1), resetScroll: false, hashScrollIntoView: false });
          details.current.querySelector<HTMLElement>(":scope > summary")?.focus({ preventScroll: true });
          target.scrollIntoView({
            block: "start",
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          });
        }
      }
    };
    const onReveal = () => { animation.current?.cancel(); animation.current = null; desiredOpen.current = true; setOpen(true); };
    const node = details.current;
    node?.addEventListener("archive-reveal", onReveal);
    reveal();
    window.addEventListener("hashchange", reveal);
    document.addEventListener("click", onClick);
    return () => { node?.removeEventListener("archive-reveal", onReveal); window.removeEventListener("hashchange", reveal); document.removeEventListener("click", onClick); animation.current?.cancel(); };
  }, [enabled, navigate, setExpanded]);
  if (!enabled) return <section className={className}>{children}</section>;
  return <details id={id} ref={details} className="archive-chapter" open={open} onToggle={event => { if (!animation.current) { desiredOpen.current = event.currentTarget.open; setOpen(event.currentTarget.open); } }}>
    <summary onClick={event => {
      event.preventDefault();
      setExpanded(!desiredOpen.current);
    }}><span className="chapter-number">{number}</span><h2>{title}</h2><span className="chapter-state">{state}</span><span className="chapter-toggle">{open ? t("portal.archive.collapse") : t("portal.archive.expand")}</span></summary>
    <div ref={content} className="chapter-content" inert={!open}><div className="chapter-sheet">{children}</div></div>
  </details>;
}
