import { useEffect, useRef } from "react";

// Fixed positions keep the star field stable across renders and page transitions.
const stars = Array.from({ length: 420 }, (_, i) => {
  const noise = (n: number) => {
    const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const band = i > 160;
  const x = noise(i + 1) * 600;
  return {
    x,
    y: band ? 540 - x * 0.76 + (noise(i + 430) - 0.5) * 140 : noise(i + 430) * 600,
    radius: band ? 0.3 + noise(i + 880) * 0.45 : 0.5 + noise(i + 880) * 0.85,
    depth: 0.3 + noise(i + 1320) * 0.7,
    phase: noise(i + 1760) * Math.PI * 2,
    opacity: band ? 0.12 + noise(i + 2200) * 0.25 : 0.18 + noise(i + 2200) * 0.5,
  };
});

export function StarField({ running, compact }: { running: boolean; compact: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let frame = 0;
    let lastTime: number | null = null;
    let size = 0;
    const field = compact ? stars.slice(0, 100) : stars;

    function draw() {
      if (!canvas || !context || !size) return;
      const scale = canvas.width / 600;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, 600, 600);
      const time = elapsedRef.current / 1000;
      for (const star of field) {
        const drift = Math.sin(time * 0.035 + star.phase) * 5 * star.depth;
        const x = star.x + drift;
        const y = star.y + Math.cos(time * 0.025 + star.phase) * 4 * star.depth;
        const fade = Math.max(0, Math.min(1, (290 - Math.hypot(x - 300, y - 300)) / 85));
        context.globalAlpha = star.opacity * fade * (0.8 + Math.sin(time * 0.45 + star.phase) * 0.2);
        context.fillStyle = star.depth > 0.6 ? "#dbe5fa" : "#b8a8d2";
        context.beginPath();
        context.arc(x, y, star.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }

    function resize() {
      if (!canvas) return;
      size = canvas.getBoundingClientRect().width;
      const resolution = Math.round(size * Math.min(window.devicePixelRatio, 2));
      canvas.width = resolution;
      canvas.height = resolution;
      draw();
    }

    function animate(time: number) {
      if (lastTime !== null) elapsedRef.current += Math.min(time - lastTime, 64);
      lastTime = time;
      draw();
      frame = requestAnimationFrame(animate);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (running) frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [running, compact]);

  return <canvas ref={canvasRef} className="star-chart-field" aria-hidden="true" />;
}
