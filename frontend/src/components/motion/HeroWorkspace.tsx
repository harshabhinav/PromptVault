import React from "react";
import { motion, useReducedMotion, useTransform, MotionValue } from "framer-motion";
import { Bot, BrainCircuit, MessageSquare, GitCommit, Sparkles } from "lucide-react";

interface HeroWorkspaceProps {
  /** Smoothed pointer position (-0.5..0.5) already tracked by the hero */
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  /** False on touch devices / reduced motion: the scene stays flat-facing */
  interactive: boolean;
}

// One shared loop (see the pv-ws-* keyframes in index.css): capture → transfer →
// editor update → new version → evaluation. SMIL packets use the same 8s clock.
const CYCLE = "8s";

/**
 * Decorative, purely presentational 3D scene for the landing hero that tells the
 * PromptVault story: a prompt is captured from an AI agent by the extension, flows
 * into the editor, becomes V3 of a blueprint and gets evaluated. CSS 3D layers
 * (translateZ) inside one perspective container tilted by the pointer.
 */
export const HeroWorkspace: React.FC<HeroWorkspaceProps> = ({ pointerX, pointerY, interactive }) => {
  const reduce = useReducedMotion();
  const rotateY = useTransform(pointerX, (v) => (interactive ? v * 16 : 0));
  const rotateX = useTransform(pointerY, (v) => (interactive ? -v * 10 : 0));

  return (
    <div aria-hidden="true" className="pv-ws hidden lg:block w-full max-w-[540px] select-none pointer-events-none">
      <motion.div
        className="pv-ws-stage relative w-full aspect-[9/5]"
        style={{ rotateX, rotateY, transformPerspective: 1200, transformStyle: "preserve-3d" }}
      >
        {/* Floor grid and ambient light */}
        <div className="pv-ws-floor" />

        {/* Background AI agents */}
        {[
          { Icon: Bot, cls: "left-[44%] top-[2%]", z: -40, delay: "0s" },
          { Icon: BrainCircuit, cls: "left-[86%] top-[78%]", z: -30, delay: "-2s" },
          { Icon: MessageSquare, cls: "left-[1%] top-[66%]", z: -50, delay: "-4s" },
        ].map(({ Icon, cls, z, delay }, i) => (
          <div key={i} className={`absolute ${cls}`} style={{ transform: `translateZ(${z}px)` }}>
            <div className="pv-ws-agent pv-float" style={{ animationDelay: delay }}>
              <Icon className="h-3.5 w-3.5" />
            </div>
          </div>
        ))}

        {/* Connection lines + travelling packets */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 180 100" style={{ transform: "translateZ(10px)" }}>
          <defs>
            <linearGradient id="pv-ws-line" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#7657ff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          <path id="pv-ws-path-capture" d="M 68 20 C 86 20, 98 24, 99 40" className="pv-ws-line" stroke="url(#pv-ws-line)" />
          <path id="pv-ws-path-version" d="M 138 62 C 146 62, 146 50, 147 42" className="pv-ws-line" stroke="url(#pv-ws-line)" />
          <path id="pv-ws-path-eval" d="M 100 88 C 100 94, 112 95, 128 93" className="pv-ws-line" stroke="url(#pv-ws-line)" />
          {!reduce && (
            <>
              <circle r="1.6" className="pv-ws-packet">
                <animateMotion dur={CYCLE} repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;0.18;0.42;1">
                  <mpath href="#pv-ws-path-capture" />
                </animateMotion>
                <animate attributeName="opacity" dur={CYCLE} repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.17;0.2;0.4;0.43;1" />
              </circle>
              <circle r="1.4" className="pv-ws-packet">
                <animateMotion dur={CYCLE} repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;0.46;0.54;1">
                  <mpath href="#pv-ws-path-version" />
                </animateMotion>
                <animate attributeName="opacity" dur={CYCLE} repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.45;0.47;0.53;0.55;1" />
              </circle>
              <circle r="1.4" className="pv-ws-packet">
                <animateMotion dur={CYCLE} repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;0.56;0.64;1">
                  <mpath href="#pv-ws-path-eval" />
                </animateMotion>
                <animate attributeName="opacity" dur={CYCLE} repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.55;0.57;0.63;0.65;1" />
              </circle>
            </>
          )}
        </svg>

        {/* 1. AI agent conversation with the extension capture */}
        <div className="absolute left-0 top-[6%] w-[38%]" style={{ transform: "translateZ(40px)" }}>
          <div className="pv-ws-card p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[8.5px] font-semibold text-muted-foreground">
              <span className="h-4 w-4 rounded-md bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                <Bot className="h-2.5 w-2.5" />
              </span>
              AI agent chat
            </div>
            <p className="text-[9px] leading-snug text-gray-200 font-mono">
              Summarize this support ticket in 3 bullets<span className="pv-ws-caret" />
            </p>
            <div className="pv-ws-anim pv-ws-capture inline-flex items-center gap-1 rounded-full border border-indigo-400/40 bg-indigo-500/15 px-1.5 py-0.5 text-[7.5px] font-bold text-indigo-200">
              <img src="/pv-logo.png" alt="" className="h-2.5 w-2.5 rounded-sm" />
              Captured by PromptVault
            </div>
          </div>
        </div>

        {/* 2. PromptVault editor receiving the prompt */}
        <div className="absolute left-[30%] top-[40%] w-[46%]" style={{ transform: "translateZ(70px)" }}>
          <div className="pv-ws-card overflow-hidden">
            <div className="flex items-center gap-1 border-b border-white/[0.06] px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
              <span className="ml-1.5 text-[7.5px] font-mono text-muted-foreground">support-summarizer.prompt</span>
            </div>
            <div className="px-2.5 py-2 space-y-1 font-mono text-[8px] leading-relaxed">
              <div className="text-gray-400"><span className="text-muted-foreground/50 mr-1.5">1</span>You are a support analyst.</div>
              <div className="text-gray-400"><span className="text-muted-foreground/50 mr-1.5">2</span>Be concise and neutral.</div>
              <div className="pv-ws-anim pv-ws-added rounded-sm text-emerald-300">
                <span className="text-emerald-400/70 mr-1.5">+</span>Summarize in 3 bullets.
              </div>
            </div>
          </div>
        </div>

        {/* 3. Version stack: V1, V2, then V3 arrives */}
        <div className="absolute right-0 top-[4%] w-[24%] space-y-1.5" style={{ transform: "translateZ(55px)" }}>
          {["V1", "V2"].map((v) => (
            <div key={v} className="pv-ws-card pv-ws-version">
              <GitCommit className="h-2.5 w-2.5 text-muted-foreground" />
              <span>{v}</span>
            </div>
          ))}
          <div className="pv-ws-anim pv-ws-v3 pv-ws-card pv-ws-version border-indigo-400/50">
            <GitCommit className="h-2.5 w-2.5 text-indigo-300" />
            <span className="text-indigo-100">V3</span>
            <span className="ml-auto rounded bg-indigo-500/25 px-1 text-[6.5px] font-bold text-indigo-200">NEW</span>
          </div>
        </div>

        {/* 4. Evaluation */}
        <div className="absolute right-[1%] bottom-[2%] w-[27%]" style={{ transform: "translateZ(85px)" }}>
          <div className="pv-ws-card flex items-center gap-2 p-2">
            <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90 shrink-0">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="url(#pv-ws-line)" strokeWidth="3" strokeLinecap="round" pathLength="100" className="pv-ws-anim pv-ws-score" />
            </svg>
            <div className="leading-tight">
              <div className="flex items-center gap-1 text-[7.5px] font-semibold text-muted-foreground">
                <Sparkles className="h-2.5 w-2.5 text-cyan-300" /> AI evaluation
              </div>
              <div className="text-[11px] font-black text-white">92<span className="text-[8px] text-muted-foreground font-semibold">/100</span></div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
