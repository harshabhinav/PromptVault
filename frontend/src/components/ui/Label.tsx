import React from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label: React.FC<LabelProps> = ({ className = "", children, ...props }) => {
  return (
    <label
      className={`block text-xs font-semibold text-muted-foreground select-none ${className}`}
      {...props}
    >
      {children}
    </label>
  );
};
