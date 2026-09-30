import { motion, useInView, useSpring } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { StarField } from "./StarField";
import "./star-chart.css";

const relayPath = "M218 352 C205 239 309 163 388 226";
const constellationPath = "M133 389L172 309L218 352L293 382L354 322L388 226L451 276L470 359";
const stars = [
  [133, 389, 2], [172, 309, 2.8], [293, 382, 2.4],
  [354, 322, 2.8], [451, 276, 2], [470, 359, 1.6],
  [181, 218, 1.8], [260, 159, 2.2], [322, 180, 1.5],
] as const;

export function StarChart({
  className = "",
  variant = "hero",
}: {
  className?: string;
  variant?: "hero" | "compact";
}) {
  const id = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.1 });
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [paused, setPaused] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [activeStar, setActiveStar] = useState<"renko" | "merry" | null>(null);
  const compact = variant === "compact";
  const running = inView && pageVisible && !paused && !reducedMotion;
  const x = useSpring(0, { stiffness: 65, damping: 24 });
  const y = useSpring(0, { stiffness: 65, damping: 24 });

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!running) {
      x.jump(0);
      y.jump(0);
      setActiveStar(null);
    }
  }, [running, x, y]);

  function followPointer(event: PointerEvent<HTMLDivElement>) {
    if (!running || compact || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    x.set(((event.clientX - box.left) / box.width - 0.5) * 12);
    y.set(((event.clientY - box.top) / box.height - 0.5) * 12);
  }

  return (
    <div
      ref={rootRef}
      className={`star-chart star-chart--${variant} ${className}`}
      data-running={running}
      data-active-star={activeStar ?? undefined}
    >
      <div
        className="star-chart-scene"
        role="img"
        aria-label="秘封观测星盘：银白星轨围绕金色的莲子星与淡紫色的梅莉星，一束光连接两颗星。"
        onPointerMove={followPointer}
        onPointerLeave={() => { x.set(0); y.set(0); setActiveStar(null); }}
      >
        <div className="star-chart-nebula" aria-hidden="true" />
        <StarField running={running} compact={compact} />
        <motion.svg
          className="star-chart-map"
          viewBox="0 0 600 600"
          fill="none"
          aria-hidden="true"
          style={{ x, y }}
        >
          <defs>
            <radialGradient id={`${id}-gold`}>
              <stop stopColor="#f6dbac" stopOpacity="0.32" />
              <stop offset="0.3" stopColor="#e8bd75" stopOpacity="0.09" />
              <stop offset="1" stopColor="#e8bd75" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-violet`}>
              <stop stopColor="#d6c1ff" stopOpacity="0.34" />
              <stop offset="0.3" stopColor="#aa8be0" stopOpacity="0.1" />
              <stop offset="1" stopColor="#aa8be0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}-relay`} x1="218" y1="352" x2="388" y2="226" gradientUnits="userSpaceOnUse">
              <stop stopColor="#efd39f" />
              <stop offset="0.5" stopColor="#e5dbea" />
              <stop offset="1" stopColor="#bd9de8" />
            </linearGradient>
            <linearGradient id={`${id}-orbit`} x1="90" y1="460" x2="510" y2="140" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e3c28c" stopOpacity="0.5" />
              <stop offset="0.5" stopColor="#c3cddc" stopOpacity="0.12" />
              <stop offset="1" stopColor="#b99cdb" stopOpacity="0.6" />
            </linearGradient>
            <filter id={`${id}-glow`} x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>

          <g className="star-chart-grid" stroke="currentColor" strokeWidth="0.65">
            <circle cx="300" cy="300" r="248" />
            <circle cx="300" cy="300" r="226" strokeDasharray="1 7" />
            {!compact && <>
              <circle cx="300" cy="300" r="159" strokeDasharray="2 7" />
              <path d="M300 75V525M75 300H525" strokeDasharray="2 8" />
              <circle cx="300" cy="300" r="78" opacity="0.45" />
            </>}
          </g>

          <g className="star-chart-dial" stroke="currentColor">
            {Array.from({ length: compact ? 60 : 120 }, (_, i) => {
              const major = i % (compact ? 5 : 10) === 0;
              return <path key={i} d={`M300 37V${major ? 49 : 42}`} transform={`rotate(${i * (compact ? 6 : 3)} 300 300)`} opacity={major ? 0.75 : 0.32} strokeWidth={major ? 1.2 : 0.7} />;
            })}
            <path className="star-chart-rim" d="M75 160A265 265 0 0 1 478 103M525 440A265 265 0 0 1 122 497" strokeWidth="1.1" />
          </g>

          {!compact && <g className="star-chart-coordinates" fill="currentColor" textAnchor="middle">
            {Array.from({ length: 12 }, (_, i) => {
              const angle = (i * 30 - 90) * Math.PI / 180;
              return <text key={i} x={300 + Math.cos(angle) * 283} y={304 + Math.sin(angle) * 283}>{String(i * 2).padStart(2, "0")}</text>;
            })}
          </g>}

          <g stroke={`url(#${id}-orbit)`}>
            <ellipse cx="300" cy="300" rx="281" ry="104" transform="rotate(-35 300 300)" strokeWidth="0.9" />
            {!compact && <ellipse cx="300" cy="300" rx="206" ry="275" transform="rotate(35 300 300)" strokeWidth="0.65" strokeDasharray="3 8" opacity="0.6" />}
          </g>

          <g className="star-chart-reveal">
            <path d="M172 309L181 218L260 159L322 180L388 226" className="star-chart-secondary-path" strokeDasharray="2 6" />
            <path
              d={constellationPath}
              className="star-chart-constellation star-chart-draw"
              pathLength="1"
            />
            {stars.map(([cx, cy, r], index) => (
              <g key={index} className="star-chart-minor-star">
                <circle cx={cx} cy={cy} r={r + 4} fill="currentColor" opacity="0.07" />
                <circle cx={cx} cy={cy} r={r} fill="currentColor" />
              </g>
            ))}
          </g>

          <g className="star-chart-relay" stroke={`url(#${id}-relay)`}>
            <path
              d={relayPath}
              className="star-chart-draw star-chart-draw--relay"
              pathLength="1"
              strokeWidth="0.9"
              opacity="0.55"
            />
            <path className="star-chart-light-trail" d={relayPath} pathLength="1" strokeWidth="5" filter={`url(#${id}-glow)`} />
            <path className="star-chart-light-trail" d={relayPath} pathLength="1" strokeWidth="1.8" strokeLinecap="round" />
          </g>

          <g className="star-chart-primary star-chart-primary--renko" onPointerEnter={() => setActiveStar("renko")} onPointerLeave={() => setActiveStar(null)}>
            <circle className="star-chart-aura" cx="218" cy="352" r="76" fill={`url(#${id}-gold)`} />
            <circle className="star-chart-focus-ring" cx="218" cy="352" r="22" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 5" />
            <path d="M218 331L220 349L232 352L220 355L218 373L216 355L204 352L216 349Z" fill="currentColor" />
            <circle cx="218" cy="352" r="3" fill="#fff6df" />
          </g>

          <g className="star-chart-primary star-chart-primary--merry" onPointerEnter={() => setActiveStar("merry")} onPointerLeave={() => setActiveStar(null)}>
            <circle className="star-chart-aura" cx="388" cy="226" r="84" fill={`url(#${id}-violet)`} />
            <circle className="star-chart-focus-ring" cx="388" cy="226" r="22" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 5" />
            <path d="M388 210L391 222L404 226L391 230L388 242L385 230L372 226L385 222Z" fill="currentColor" />
            <circle cx="388" cy="226" r="2.8" fill="#f7efff" />
          </g>

          {!compact && <g className="star-chart-annotations" fill="currentColor">
            <path d="M291 300H309M300 291V309" stroke="currentColor" strokeWidth="0.6" />
          </g>}
        </motion.svg>
        {!compact && <div className="star-chart-corner" aria-hidden="true">CELESTIAL ATLAS</div>}
      </div>
      {!reducedMotion && <button
        type="button"
        className="star-chart-pause"
        aria-label={paused ? "播放星图动画" : "暂停星图动画"}
        onClick={() => setPaused((current) => !current)}
      >
        {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
        <span>{paused ? "播放" : "暂停"}</span>
      </button>}
    </div>
  );
}
