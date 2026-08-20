import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={twMerge(
          clsx(
            "inline-flex items-center justify-center font-bold tracking-wide transition-all duration-200 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer select-none",
            // Variants matching Landing Page Design System
            {
              "bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:brightness-110 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01]": variant === "primary",
              "bg-card/40 backdrop-blur-xl border border-border/70 hover:border-indigo-500/40 text-foreground hover:bg-secondary/40 shadow-sm": variant === "secondary",
              "border border-border/70 bg-secondary/20 hover:bg-secondary/60 hover:border-border text-foreground shadow-sm": variant === "outline",
              "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30": variant === "ghost",
              "bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 shadow-sm": variant === "danger",
            },
            // Sizes
            {
              "px-3 py-1.5 text-xs h-8": size === "sm",
              "px-4 py-2 text-xs h-9": size === "md",
              "px-6 py-2.5 text-sm h-11": size === "lg",
              "h-9 w-9 p-0": size === "icon",
            }
          ),
          className
        )}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
