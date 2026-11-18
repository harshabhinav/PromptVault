import React, { useId, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useSpring, useMotionValueEvent, useReducedMotion, Variants } from "framer-motion";
import { MousePointerClick, FolderOpen, GitBranch, ArrowRightLeft, Gauge, Bot, Check, Search, GitCommit, ShieldCheck } from "lucide-react";
import { SplitText } from "./TextMotion";
import { Reveal } from "./Reveal";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const GRADIENT = "bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-400";

const STEPS = [
  {
    title: "Capture a Prompt",
    body: "The browser extension saves prompts straight from ChatGPT, Claude, Gemini, Perplexity and Grok, one click with Quick Save.",
    icon: MousePointerClick,
  },
  {
    title: "Save to Blueprint",
    body: "Every prompt lands in a blueprint: a named, searchable home for that prompt and its whole history.",
    icon: FolderOpen,
  },
  {
    title: "Create Versions",
    body: "Each save becomes a new version (V1, V2, V3) with an optional commit message, so nothing is ever overwritten.",
    icon: GitBranch,
  },
  {
    title: "Compare Changes",
    body: "Put two versions side by side and see exactly what changed in a Git-style line diff.",
    icon: ArrowRightLeft,
  },
  {
    title: "Evaluate Performance",
    body: "Run saved test cases, get AI scorecards and catch regressions before a change ships.",
    icon: Gauge,
  },
];

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } } };
const item: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } };

const Item: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <motion.div variants={item} className={className}>
    {children}
  </motion.div>
);

/** Small illustrative UI for each step (decorative). */
const StepVisual: React.FC<{ index: number; trigger?: "mount" | "view" }> = ({ index, trigger = "mount" }) => {
  const gradId = "pv-story-grad-" + useId().replace(/:/g, "");
  const body = (() => {
    switch (index) {
      case 0:
        return (
          <>
            <Item className="pv-ws-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                <span className="h-5 w-5 rounded-md bg-emerald-500/15 text-emerald-300 flex items-center justify-center"><Bot className="h-3 w-3" /></span>
                AI agent chat
              </div>
              <p className="text-xs font-mono text-gray-200 leading-relaxed">Summarize this support ticket in 3 bullets.</p>
            </Item>
            <Item className="pv-ws-card p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-200">
                <img src="/pv-logo.png" alt="" className="h-5 w-5 rounded" />
                PromptVault Quick Save
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 text-[10px] font-bold text-emerald-300">
                <Check className="h-3 w-3" /> Saved
              </span>
            </Item>
            <Item className="flex flex-wrap gap-1.5">
              {["ChatGPT", "Claude", "Gemini", "Perplexity", "Grok"].map((n) => (
                <span key={n} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{n}</span>
              ))}
            </Item>
          </>
        );
      case 1:
        return (
          <>
            <Item className="pv-ws-card px-3 py-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Search className="h-3.5 w-3.5" /> Search blueprints
            </Item>
            {[
              { name: "Support Summarizer", meta: "Quick Save · just now", active: true },
              { name: "Code Review Assistant", meta: "4 versions" },
              { name: "SEO Blog Writer", meta: "7 versions" },
            ].map((b) => (
              <Item key={b.name} className={`pv-ws-card px-3 py-2.5 flex items-center justify-between gap-3 ${b.active ? "border-indigo-400/50 shadow-[0_0_24px_-6px_rgba(118,87,255,0.6)]" : "opacity-70"}`}>
                <span className="flex items-center gap-2 text-xs font-semibold text-gray-100">
                  <FolderOpen className={`h-3.5 w-3.5 ${b.active ? "text-indigo-300" : "text-muted-foreground"}`} /> {b.name}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">{b.meta}</span>
              </Item>
            ))}
          </>
        );
      case 2:
        return (
          <div className="relative pl-6 space-y-3">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-white/10 via-indigo-400/50 to-indigo-400" />
            {[
              { v: "V1", memo: "Initial draft" },
              { v: "V2", memo: "More concise tone" },
              { v: "V3", memo: "Bullet-point summary", latest: true },
            ].map((x) => (
              <Item key={x.v} className="relative">
                <span className={`absolute -left-6 top-3 h-3.5 w-3.5 rounded-full border-2 ${x.latest ? "border-indigo-400 bg-indigo-500/30 shadow-[0_0_14px_rgba(118,87,255,0.8)]" : "border-white/20 bg-[#0d0d14]"}`} />
                <div className={`pv-ws-card px-3 py-2.5 flex items-center gap-2 ${x.latest ? "border-indigo-400/50" : ""}`}>
                  <GitCommit className={`h-3.5 w-3.5 ${x.latest ? "text-indigo-300" : "text-muted-foreground"}`} />
                  <span className="font-mono text-xs font-bold text-gray-100">{x.v}</span>
                  <span className="text-[11px] text-muted-foreground truncate">{x.memo}</span>
                  {x.latest && <span className="ml-auto rounded bg-indigo-500/25 px-1.5 py-0.5 text-[9px] font-bold text-indigo-200">LATEST</span>}
                </div>
              </Item>
            ))}
          </div>
        );
      case 3:
        return (
          <Item className="pv-ws-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2 text-[10px] font-mono text-muted-foreground">
              <span>support-summarizer.prompt</span>
              <span className="text-indigo-300">V2 → V3</span>
            </div>
            <div className="py-2 font-mono text-[11px] leading-relaxed">
              {[
                { t: " ", text: "You are a support analyst.", cls: "text-gray-400" },
                { t: "-", text: "Summarize the ticket.", cls: "bg-rose-500/10 text-rose-300 shadow-[inset_2px_0_0_rgba(251,113,133,0.6)]" },
                { t: "+", text: "Summarize in 3 bullets.", cls: "bg-emerald-500/10 text-emerald-300 shadow-[inset_2px_0_0_rgba(52,211,153,0.6)]" },
                { t: " ", text: "Keep a neutral tone.", cls: "text-gray-400" },
              ].map((l, i) => (
                <motion.div key={i} variants={item} className={`px-3 py-0.5 flex gap-3 ${l.cls}`}>
                  <span className="w-3 opacity-70">{l.t}</span>
                  {l.text}
                </motion.div>
              ))}
            </div>
          </Item>
        );
      default:
        return (
          <>
            <Item className="pv-ws-card p-4 flex items-center gap-4">
              <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90 shrink-0">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <motion.circle
                  cx="18" cy="18" r="15" fill="none" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round"
                  variants={{ hidden: { pathLength: 0 }, show: { pathLength: 0.92, transition: { duration: 1.1, ease: EASE, delay: 0.25 } } }}
                />
                <defs>
                  <linearGradient id={gradId} x1="0" x2="1">
                    <stop offset="0%" stopColor="#7657ff" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground">AI scorecard</div>
                <div className="text-2xl font-black text-white">92<span className="text-sm text-muted-foreground font-semibold">/100</span></div>
              </div>
            </Item>
            {[
              { k: "Clarity", v: 94 },
              { k: "Context", v: 88 },
              { k: "Output quality", v: 91 },
            ].map((m, i) => (
              <Item key={m.k} className="space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground"><span>{m.k}</span><span className="font-mono text-gray-200">{m.v}%</span></div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 origin-left"
                    style={{ width: `${m.v}%` }}
                    variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.9, ease: EASE, delay: 0.3 + i * 0.08 } } }}
                  />
                </div>
              </Item>
            ))}
            <Item className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
              <ShieldCheck className="h-3 w-3" /> No regressions detected
            </Item>
          </>
        );
    }
  })();
  return (
    <motion.div
      variants={container}
      initial="hidden"
      {...(trigger === "mount" ? { animate: "show" } : { whileInView: "show", viewport: { once: true, amount: 0.4 } })}
      className="w-full max-w-sm space-y-3"
    >
      {body}
    </motion.div>
  );
};

const Header: React.FC<{ align?: "left" | "center" }> = ({ align = "left" }) => (
  <div className={`space-y-3 ${align === "center" ? "text-center" : ""}`}>
    <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-300/80">The PromptVault workflow</span>
    <SplitText
      as="h2"
      className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-foreground"
      segments={["Follow a prompt", { text: "through the vault.", className: GRADIENT, underline: true }]}
    />
  </div>
);

/**
 * Scroll story for the landing page. Desktop: the section pins while the active step
 * follows scroll progress. Below lg: a simple stacked sequence (no pinning) so touch
 * scrolling stays natural.
 */
export const WorkflowStory: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  // Re-renders only when the active step actually changes
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length))));
  });

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * ((i + 0.5) / STEPS.length), behavior: reduce ? "auto" : "smooth" });
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="relative z-10 border-t border-border/40 bg-black/40">
      {/* Desktop: pinned story */}
      <div ref={ref} className="hidden lg:block relative" style={{ height: `${100 + STEPS.length * 55}vh` }}>
        <div className="sticky top-0 h-screen flex items-center px-8 overflow-hidden">
          <div className="absolute right-[12%] top-1/2 -translate-y-1/2 w-[520px] h-[420px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
          <div className="relative max-w-6xl mx-auto w-full grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-14 items-center">
            <div>
              <Header />
              <ol className="relative mt-10 space-y-1">
                <div className="absolute left-[15px] top-4 bottom-4 w-px bg-white/10 overflow-hidden">
                  <motion.div className="w-full h-full origin-top bg-gradient-to-b from-indigo-400 to-cyan-300" style={{ scaleY: progress }} />
                </div>
                {STEPS.map((s, i) => {
                  const isActive = i === active;
                  const Icon = s.icon;
                  return (
                    <li key={s.title}>
                      <button
                        type="button"
                        onClick={() => goTo(i)}
                        aria-current={isActive ? "step" : undefined}
                        className="relative w-full text-left flex gap-4 py-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                      >
                        <span
                          className={`relative z-10 h-[31px] w-[31px] shrink-0 rounded-full border flex items-center justify-center transition-all duration-500 ${
                            i <= active ? "border-indigo-400/60 bg-indigo-950 text-indigo-200" : "border-white/10 bg-[#0d0d14] text-muted-foreground"
                          } ${isActive ? "shadow-[0_0_20px_-2px_rgba(118,87,255,0.75)]" : ""}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 pt-1">
                          <span className={`block text-sm font-bold transition-colors duration-500 ${isActive ? "text-white" : "text-muted-foreground/70"}`}>
                            <span className="font-mono text-[10px] mr-2 opacity-60">{pad(i + 1)}</span>
                            {s.title}
                          </span>
                          <AnimatePresence initial={false}>
                            {isActive && (
                              <motion.span
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.4, ease: EASE }}
                                className="block overflow-hidden"
                              >
                                <span className="block pt-1.5 text-sm text-muted-foreground leading-relaxed max-w-md">{s.body}</span>
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 text-[11px] font-mono text-muted-foreground">
                <span>Step {pad(active + 1)} / {pad(STEPS.length)}</span>
                <span className="text-indigo-300/80">{STEPS[active].title}</span>
              </div>
              <div className="relative aspect-[4/3] rounded-2xl border border-white/[0.08] bg-[rgba(22,20,32,0.65)] backdrop-blur-xl overflow-hidden shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(118,87,255,0.14),transparent_60%)] pointer-events-none" />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                    exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="absolute inset-0 p-8 flex items-center justify-center"
                  >
                    <StepVisual index={active} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phones & tablets: stacked sequence, no pinning */}
      <div className="lg:hidden px-4 sm:px-6 py-20 max-w-xl mx-auto space-y-10">
        <Header align="center" />
        <ol className="space-y-5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title}>
                <Reveal variant="text">
                  <div className="rounded-2xl border border-white/[0.08] bg-[rgba(22,20,32,0.65)] p-5 space-y-4">
                    <div className="flex gap-3">
                      <span className="h-[31px] w-[31px] shrink-0 rounded-full border border-indigo-400/60 bg-indigo-950 text-indigo-200 flex items-center justify-center">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          <span className="font-mono text-[10px] mr-2 opacity-60">{pad(i + 1)}</span>
                          {s.title}
                        </h3>
                        <p className="pt-1 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                      </div>
                    </div>
                    <StepVisual index={i} trigger="view" />
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};
