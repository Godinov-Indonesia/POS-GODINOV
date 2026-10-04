"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASING, viewportStandard } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "article" | "li" | "span" | "header";
}

export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: RevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const MotionComponent = motion[as];

  if (shouldReduceMotion) {
    const FallbackComp = as;
    return <FallbackComp className={className}>{children}</FallbackComp>;
  }

  return (
    <MotionComponent
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportStandard}
      transition={{
        duration: 0.5,
        delay,
        ease: EASING,
      }}
      className={cn(className)}
    >
      {children}
    </MotionComponent>
  );
}
