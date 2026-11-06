import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "neutral" | "danger" | "ghost" | "success";
  size?: "sm" | "md" | "lg" | "icon";
  block?: boolean;
}

const VARIANTS = {
  primary: "bg-accent text-fg-inverse hover:bg-accent-hover shadow-card",
  neutral: "bg-surface text-fg border border-border-strong hover:bg-bg-muted",
  danger: "bg-danger text-fg-inverse hover:bg-danger-hover shadow-card",
  ghost: "bg-transparent text-fg-muted hover:bg-bg-muted hover:text-fg",
  success: "bg-success text-fg-inverse hover:brightness-95 shadow-card",
};

const SIZES = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3.5 text-xs min-h-[36px]",
  lg: "h-11 px-5 text-sm",
  icon: "size-9 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "neutral", size = "md", block, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer",
          "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          VARIANTS[variant],
          SIZES[size],
          block && "w-full",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
