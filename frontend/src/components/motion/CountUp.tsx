import React, { useLayoutEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

/**
 * Animates an integer from its last shown value to `value` by writing straight to
 * the DOM (no React re-render per frame). The span's text is owned entirely by
 * this effect. Shows the final value immediately when reduced motion is preferred.
 */
export const CountUp: React.FC<{ value: number; duration?: number }> = ({ value, duration = 0.9 }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const write = (v: number) => {
      shown.current = v;
      el.textContent = String(Math.round(v));
    };
    if (reduce || !Number.isFinite(value)) {
      write(value);
      return;
    }
    write(shown.current); // paint the starting value before the first frame
    const controls = animate(shown.current, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: write });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return <span ref={ref} />;
};
