import React, { useEffect, useMemo, useRef } from "react";

const PARTICLE_COUNT = 22;

// Deterministic pseudo-random so particles keep the same layout across renders
const seeded = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * App-wide cinematic backdrop (dark theme only): drifting violet orbs, a slow
 * gradient mesh, faint rising particles and a soft cursor-following light.
 *
 * Fixed behind all content and inert to pointer events. Everything animates via
 * transform/opacity in CSS; the cursor light writes its position straight to the
 * DOM from a rAF-throttled listener (no React re-renders). The cursor light is
 * skipped on touch devices and with reduced motion; CSS stops the rest.
 */
export const AmbientBackground: React.FC = () => {
  const glowRef = useRef<HTMLDivElement>(null);

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        left: `${(seeded(i, 1) * 100).toFixed(2)}%`,
        top: `${(30 + seeded(i, 2) * 70).toFixed(2)}%`,
        size: 1 + Math.round(seeded(i, 3) * 2),
        duration: `${14 + seeded(i, 4) * 14}s`,
        delay: `${-(seeded(i, 5) * 28).toFixed(1)}s`,
      })),
    []
  );

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow) return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      glow.style.transform = `translate3d(${x - 300}px, ${y - 300}px, 0)`;
      glow.style.opacity = "1";
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      glow.style.opacity = "0";
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pv-ambient hidden dark:block">
      <div className="pv-ambient-mesh" />
      <div className="pv-orb pv-orb-a" />
      <div className="pv-orb pv-orb-b" />
      <div className="pv-orb pv-orb-c" />
      <div className="pv-particles">
        {particles.map((p, i) => (
          <span
            key={i}
            style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDuration: p.duration, animationDelay: p.delay }}
          />
        ))}
      </div>
      <div ref={glowRef} className="pv-cursor-light" />
      <div className="pv-ambient-vignette" />
    </div>
  );
};
