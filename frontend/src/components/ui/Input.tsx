import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, LabelHTMLAttributes, forwardRef } from "react";
import { twMerge } from "tailwind-merge";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={twMerge(
          "flex h-9 w-full rounded-xl border border-border/70 bg-card/40 backdrop-blur-md px-3 py-1.5 text-xs text-foreground shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/80 hover:border-border/90 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={twMerge(
          "flex min-h-[60px] w-full rounded-xl border border-border/70 bg-card/40 backdrop-blur-md px-3 py-2 text-xs text-foreground shadow-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/80 hover:border-border/90 disabled:cursor-not-allowed disabled:opacity-50 font-sans",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={twMerge(
          "flex h-9 w-full rounded-xl border border-border/70 bg-card/60 backdrop-blur-md px-3 py-1 text-xs text-foreground shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/80 hover:border-border/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer font-sans",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={twMerge(
          "text-xs font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-75 text-foreground/90 select-none",
          className
        )}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";
