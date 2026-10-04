import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionShellProps {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function SectionShell({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className,
  headerClassName,
}: SectionShellProps) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-testid={id ? `section-${id}` : undefined}
      className={cn("relative py-20 md:py-28 lg:py-32", className)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(eyebrow || title || subtitle) && (
          <header className={cn("mb-12 md:mb-16 max-w-3xl", headerClassName)}>
            {eyebrow && (
              <p className="text-xs font-mono tracking-wider uppercase text-brand-300 mb-3">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2
                id={headingId}
                className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-paper-50"
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-4 text-base sm:text-lg text-paper-50/70 leading-relaxed max-w-[58ch]">
                {subtitle}
              </p>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
