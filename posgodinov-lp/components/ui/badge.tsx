import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500",
  {
    variants: {
      variant: {
        default:
          "border border-brand-500/30 bg-brand-500/10 text-brand-300",
        secondary:
          "border border-ink-800 bg-ink-900 text-paper-50/80",
        signal:
          "border border-signal-500/30 bg-signal-500/10 text-signal-500",
        alert:
          "border border-alert-500/30 bg-alert-500/10 text-alert-500",
        outline:
          "border border-ink-800 text-paper-50/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
