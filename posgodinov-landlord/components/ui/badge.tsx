import * as React from "react";
import { cn } from "@/lib/utils";

const TONE = {
  neutral: "bg-bg-muted text-fg-muted border-border",
  info: "bg-accent-subtle text-accent border-accent/30",
  success: "bg-success-subtle text-success-text border-success-text/30",
  warning: "bg-warning-subtle text-warning-text border-warning-text/30",
  danger: "bg-danger-subtle text-danger border-danger/30",
} as const;

export type BadgeTone = keyof typeof TONE;

export function Badge({
  tone = "neutral",
  icon: Icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[tone],
        className
      )}
      {...props}
    >
      {Icon && <Icon className="size-3 shrink-0" />}
      {children}
    </span>
  );
}
