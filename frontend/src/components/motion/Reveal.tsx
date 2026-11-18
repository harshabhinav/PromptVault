import React from "react";
import { motion } from "framer-motion";

interface RevealProps {
  children: React.ReactNode;
  index?: number; // stagger position within a row
  delay?: number; // base delay before the stagger
  /** "card": rise with a slight perspective tilt-in; "text": rise with blur-to-focus */
  variant?: "card" | "text";
  className?: string;
}

const VARIANTS = {
  card: { initial: { opacity: 0, y: 26, rotateX: 8 }, show: { opacity: 1, y: 0, rotateX: 0 } },
  text: { initial: { opacity: 0, y: 14, filter: "blur(8px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } },
};

/**
 * Scroll-triggered entrance, once. Reduced motion is handled globally by
 * <MotionConfig reducedMotion="user"> (transforms are skipped, content still shows).
 */
export const Reveal: React.FC<RevealProps> = ({ children, index = 0, delay = 0, variant = "card", className }) => (
  <motion.div
    initial={VARIANTS[variant].initial}
    whileInView={VARIANTS[variant].show}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: delay + index * 0.09 }}
    style={variant === "card" ? { transformPerspective: 1000 } : undefined}
    className={className}
  >
    {children}
  </motion.div>
);
