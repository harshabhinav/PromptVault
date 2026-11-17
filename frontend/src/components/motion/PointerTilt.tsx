import { useEffect } from "react";

const MAX_TILT_DEG = 5;
const MAX_MAGNET_PX = 4;

const SURFACE = "[data-tilt],[data-spotlight]";
const SURFACE_VARS = ["--pv-rx", "--pv-ry", "--pv-mx", "--pv-my", "--pv-lift"];

/**
 * Global, render-free controller for pointer-driven effects (styling lives in index.css):
 *  - `data-tilt="<lift px>"`: 3D tilt toward the cursor, lift, and a soft spotlight.
 *  - `data-spotlight`: the spotlight only, no movement (large panels, auth card).
 *  - `data-magnetic`: the element eases a few px toward the cursor (primary buttons).
 *
 * One passive pointer listener, throttled to animation frames, writes CSS variables on
 * the hovered elements. Disabled on touch / coarse pointers and when the user prefers
 * reduced motion; elements then keep their original hover styles.
 */
export const PointerTilt: React.FC = () => {
  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let surface: HTMLElement | null = null;
    let magnet: HTMLElement | null = null;
    let frame = 0;
    let lastEvent: PointerEvent | null = null;

    const resetSurface = (el: HTMLElement | null) => {
      if (!el) return;
      el.classList.remove("pv-tilt-active", "pv-spot-active");
      SURFACE_VARS.forEach((v) => el.style.removeProperty(v));
    };
    const resetMagnet = (el: HTMLElement | null) => {
      if (!el) return;
      el.classList.remove("pv-mag-active");
      el.style.removeProperty("--pv-magx");
      el.style.removeProperty("--pv-magy");
    };

    const update = () => {
      frame = 0;
      const e = lastEvent;
      if (!e) return;
      const target = e.target as Element | null;

      const nextSurface = (target?.closest?.(SURFACE) as HTMLElement | null) ?? null;
      if (nextSurface !== surface) {
        resetSurface(surface);
        surface = nextSurface;
      }
      if (surface) {
        const r = surface.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        surface.style.setProperty("--pv-mx", `${(px * 100).toFixed(1)}%`);
        surface.style.setProperty("--pv-my", `${(py * 100).toFixed(1)}%`);
        if (surface.hasAttribute("data-tilt")) {
          const lift = parseFloat(surface.dataset.tilt || "4") || 0;
          surface.style.setProperty("--pv-ry", `${((px - 0.5) * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
          surface.style.setProperty("--pv-rx", `${(-(py - 0.5) * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
          surface.style.setProperty("--pv-lift", `${-lift}px`);
          surface.classList.add("pv-tilt-active");
        } else {
          surface.classList.add("pv-spot-active");
        }
      }

      const nextMagnet = (target?.closest?.("[data-magnetic]") as HTMLElement | null) ?? null;
      if (nextMagnet !== magnet) {
        resetMagnet(magnet);
        magnet = nextMagnet;
      }
      if (magnet && !(magnet as HTMLButtonElement).disabled) {
        const r = magnet.getBoundingClientRect();
        magnet.style.setProperty("--pv-magx", `${(((e.clientX - r.left) / r.width - 0.5) * 2 * MAX_MAGNET_PX).toFixed(2)}px`);
        magnet.style.setProperty("--pv-magy", `${(((e.clientY - r.top) / r.height - 0.5) * 2 * MAX_MAGNET_PX).toFixed(2)}px`);
        magnet.classList.add("pv-mag-active");
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      lastEvent = e;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onLeaveWindow = () => {
      resetSurface(surface);
      resetMagnet(magnet);
      surface = null;
      magnet = null;
    };

    const enabled = () => finePointer.matches && !reducedMotion.matches;
    let listening = false;
    const sync = () => {
      if (enabled() && !listening) {
        document.addEventListener("pointermove", onMove, { passive: true });
        document.documentElement.addEventListener("pointerleave", onLeaveWindow);
        window.addEventListener("blur", onLeaveWindow);
        listening = true;
      } else if (!enabled() && listening) {
        document.removeEventListener("pointermove", onMove);
        document.documentElement.removeEventListener("pointerleave", onLeaveWindow);
        window.removeEventListener("blur", onLeaveWindow);
        onLeaveWindow();
        listening = false;
      }
    };

    sync();
    finePointer.addEventListener("change", sync);
    reducedMotion.addEventListener("change", sync);
    return () => {
      finePointer.removeEventListener("change", sync);
      reducedMotion.removeEventListener("change", sync);
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeaveWindow);
      window.removeEventListener("blur", onLeaveWindow);
      onLeaveWindow();
    };
  }, []);

  return null;
};
