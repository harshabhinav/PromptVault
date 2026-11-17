import React from "react";
import { motion } from "framer-motion";

interface RevealProps {
  children: React.ReactNode;
  index?: number; // stagger position within a row
  className?: string;
}

/**
 * Scroll-triggered entrance: fade + rise + slight perspective tilt-in, once.
 * Reduced motion is handled globally by <MotionConfig reducedMotion="user">.
 */
export const Reveal: React.FC<RevealProps> = ({ children, index = 0, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 26, rotateX: 8 }}
    whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: index * 0.09 }}
    style={{ transformPerspective: 1000 }}
    className={className}
  >
    {children}
  </motion.div>
);
