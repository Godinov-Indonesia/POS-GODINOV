import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  label?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, label, hint, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    const inputNode = (
      <input
        id={inputId}
        type={type}
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg",
          "placeholder:text-fg-subtle transition-colors",
          "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-danger focus:border-danger focus:ring-danger",
          className
        )}
        {...props}
      />
    );

    if (!label && !hint) {
      return inputNode;
    }

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-fg mb-1.5">
            {label}
          </label>
        )}
        {inputNode}
        {hint && (
          <p className="mt-1 text-[11px] text-muted-fg">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
