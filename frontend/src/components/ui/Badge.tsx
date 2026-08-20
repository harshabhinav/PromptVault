import React, { HTMLAttributes } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "outline" | "success" | "warning" | "danger";
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = "primary", ...props }) => {
  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-all duration-200 focus:outline-none shadow-sm select-none",
          {
            "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400": variant === "primary",
            "bg-secondary/40 border border-border/60 text-secondary-foreground": variant === "secondary",
            "border border-border/70 text-foreground bg-card/40 backdrop-blur-sm": variant === "outline",
            "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20": variant === "success",
            "bg-amber-500/10 text-amber-400 border border-amber-500/20": variant === "warning",
            "bg-rose-500/10 text-rose-400 border border-rose-500/20": variant === "danger",
          }
        ),
        className
      )}
      {...props}
    />
  );
};
