import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-bg-muted", className)}
      {...props}
    />
  );
}

export function Banner({
  tone = "info",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: "info" | "warning" | "danger" | "success";
}) {
  const STYLES = {
    info: "bg-accent-subtle text-accent border-accent/20",
    warning: "bg-warning-subtle text-warning-text border-warning/30",
    danger: "bg-danger-subtle text-danger border-danger/30",
    success: "bg-success-subtle text-success-text border-success/30",
  };

  return (
    <div
      className={cn("rounded-lg border p-3.5 text-xs flex items-start gap-2.5", STYLES[tone], className)}
      {...props}
    >
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface p-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-xl bg-bg-muted text-fg-subtle mb-3">
          <Icon className="size-6" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
