import type { Transition, Variants } from "framer-motion";

export const EASING = [0.16, 1, 0.3, 1] as const;

export const transitionBase: Transition = {
  duration: 0.5,
  ease: EASING,
};

export const transitionMicro: Transition = {
  duration: 0.2,
  ease: EASING,
};

export const transitionSyncPhase: Transition = {
  duration: 0.8,
  ease: EASING,
};

export const viewportStandard = {
  once: true,
  margin: "-80px",
} as const;

export const fadeUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionBase,
  },
};

export const staggerContainerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};
