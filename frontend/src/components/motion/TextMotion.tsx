import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, MotionValue, Variants } from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** A run of text; give it a className for emphasis (e.g. gradient), `underline` for a sweep under it. */
export type TextSegment = string | { text: string; className?: string; underline?: boolean };

const MOTION_TAGS = { h1: motion.h1, h2: motion.h2, h3: motion.h3, p: motion.p, span: motion.span, div: motion.div };
type Tag = keyof typeof MOTION_TAGS;

const normalize = (seg: TextSegment) => (typeof seg === "string" ? { text: seg } : seg);
const splitWords = (text: string) => text.split(/\s+/).filter(Boolean);

interface SplitTextProps {
  as?: Tag;
  segments: TextSegment[];
  className?: string;
  /** "word": each word staggers in; "line": words on the same rendered line move together */
  by?: "word" | "line";
  /** "view": once, when scrolled into view; "mount": immediately (hero) */
  trigger?: "view" | "mount";
  delay?: number;
  /** Seconds between words (word mode) or lines (line mode) */
  stagger?: number;
  /** Clip each word while it rises (headings); otherwise a soft fade-up */
  mask?: boolean;
  blur?: boolean;
}

/**
 * Split-text reveal. Words stay real DOM text (selectable, read normally by screen
 * readers); only their inline-block wrappers animate with transform/opacity/filter.
 * Renders plain static text when the user prefers reduced motion.
 */
export const SplitText: React.FC<SplitTextProps> = ({
  as = "p",
  segments,
  className,
  by = "word",
  trigger = "view",
  delay = 0,
  stagger,
  mask = true,
  blur = true,
}) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [lineOf, setLineOf] = useState<number[] | null>(by === "line" ? null : []);
  const step = stagger ?? (by === "line" ? 0.12 : 0.045);

  // Line mode: group words by their rendered line before the animation starts
  useLayoutEffect(() => {
    if (by !== "line" || !ref.current) return;
    const tops = [...ref.current.querySelectorAll<HTMLElement>("[data-word]")].map((el) => el.offsetTop);
    const distinct = [...new Set(tops)].sort((a, b) => a - b);
    setLineOf(tops.map((t) => distinct.indexOf(t)));
  }, [by]);

  const Plain = as;
  if (reduce) {
    return (
      <Plain className={className}>
        {segments.map(normalize).map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && " "}
            <span className={s.className}>{s.text}</span>
          </React.Fragment>
        ))}
      </Plain>
    );
  }

  const ready = lineOf !== null;
  const wordVariants: Variants = {
    hidden: { y: mask ? "110%" : "0.5em", opacity: 0, filter: blur ? "blur(8px)" : "blur(0px)" },
    show: (order: number) => ({
      y: "0%",
      opacity: 1,
      filter: "blur(0px)",
      transition: { duration: mask ? 0.85 : 0.7, ease: EASE, delay: delay + order * step },
      transitionEnd: { filter: "none" }, // keep text crisp once settled
    }),
  };

  let wordIndex = 0;
  const totalWords = segments.reduce<number>((n, s) => n + splitWords(normalize(s).text).length, 0);
  const renderWord = (w: string, cls?: string, leadingSpace = true) => {
    const i = wordIndex++;
    const order = by === "line" ? lineOf?.[i] ?? 0 : i;
    return (
      <React.Fragment key={i}>
        {leadingSpace && i > 0 && " "}
        <span data-word="" className={mask ? "inline-block overflow-hidden align-top pb-[0.14em] -mb-[0.14em]" : "inline-block align-top"}>
          <motion.span className={`inline-block ${cls ?? ""}`} variants={wordVariants} custom={order}>
            {w}
          </motion.span>
        </span>
      </React.Fragment>
    );
  };

  const Component = MOTION_TAGS[as] as React.ElementType;
  const triggerProps =
    trigger === "mount"
      ? { animate: ready ? "show" : "hidden" }
      : { whileInView: ready ? "show" : undefined, viewport: { once: true, amount: 0.6 } };

  return (
    <Component ref={ref} className={className} initial="hidden" {...triggerProps}>
      {segments.map(normalize).map((s, si) => {
        const words = splitWords(s.text);
        if (!s.underline) return <React.Fragment key={si}>{words.map((w) => renderWord(w, s.className))}</React.Fragment>;
        const first = wordIndex;
        const content = words.map((w, wi) => renderWord(w, s.className, wi > 0)); // group's own leading space sits outside it
        return (
          <React.Fragment key={si}>
            {first > 0 && " "}
            <span className="relative inline-block whitespace-nowrap">
              {content}
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0 -bottom-[0.02em] h-[2px] origin-left rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-300"
                variants={{
                  hidden: { scaleX: 0, opacity: 0 },
                  show: { scaleX: 1, opacity: 0.85, transition: { duration: 0.9, ease: EASE, delay: delay + totalWords * step + 0.15 } },
                }}
              />
            </span>
          </React.Fragment>
        );
      })}
    </Component>
  );
};

const ScrollWord: React.FC<{ progress: MotionValue<number>; range: [number, number]; children: React.ReactNode }> = ({ progress, range, children }) => {
  const opacity = useTransform(progress, range, [0.2, 1]);
  return <motion.span style={{ opacity }}>{children}</motion.span>;
};

/**
 * Scroll-linked reading highlight: words brighten from muted to full as the paragraph
 * travels up the viewport. Never fully invisible; static when reduced motion is preferred.
 */
export const ScrollText: React.FC<{ as?: Tag; text: string; className?: string }> = ({ as = "p", text, className }) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.92", "start 0.45"] });
  const Component = MOTION_TAGS[as] as React.ElementType;
  // The ref stays attached in every mode so the scroll tracker always has a target
  if (reduce) return <Component ref={ref} className={className}>{text}</Component>;
  const words = splitWords(text);
  return (
    <Component ref={ref} className={className}>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          {i > 0 && " "}
          <ScrollWord progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
            {w}
          </ScrollWord>
        </React.Fragment>
      ))}
    </Component>
  );
};

/**
 * Moves its content slightly against the scroll (depth). Desktop/tablet only and off
 * for reduced motion, so touch scrolling on phones is untouched.
 */
export const Parallax: React.FC<{ speed?: number; className?: string; children: React.ReactNode }> = ({ speed = 0.4, className, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [60 * speed, -60 * speed]);
  return (
    <motion.div ref={ref} style={wide && !reduce ? { y } : undefined} className={className}>
      {children}
    </motion.div>
  );
};
