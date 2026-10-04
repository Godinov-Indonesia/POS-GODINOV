"use client";

import * as React from "react";
import { Lottie } from "lottie-react";

export interface LottiePlayerProps {
  animationData: object | string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const emptySubscribe = () => () => {};

// Global in-memory cache to prevent re-parsing or garbage collection across scroll renders
const memoryCache = new WeakMap<object, object>();

function getCachedSource(source: object | string): object | string {
  if (typeof source !== "object" || source === null) return source;
  const cached = memoryCache.get(source);
  if (cached) return cached;
  memoryCache.set(source, source);
  return source;
}

export function LottiePlayer({
  animationData,
  loop = true,
  autoplay = true,
  className,
  style,
}: LottiePlayerProps) {
  const isMounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const cachedData = React.useMemo(
    () => getCachedSource(animationData),
    [animationData]
  );

  if (!isMounted) {
    return <div className={className} style={style} aria-hidden="true" />;
  }

  return (
    <div
      className={className}
      style={{
        transform: "translate3d(0, 0, 0)",
        backfaceVisibility: "hidden",
        willChange: "transform",
        contain: "paint",
        ...style,
      }}
      aria-hidden="true"
    >
      <Lottie
        src={cachedData}
        loop={loop}
        autoplay={autoplay}
        className="h-full w-full"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
