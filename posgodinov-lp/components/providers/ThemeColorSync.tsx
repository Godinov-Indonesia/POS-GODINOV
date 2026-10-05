"use client";

import * as React from "react";
import { useTheme } from "next-themes";

const THEME_COLOR: Record<string, string> = {
  dark: "#0B061A",
  light: "#F7F6FB",
};

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (!resolvedTheme) return;
    const color = THEME_COLOR[resolvedTheme] ?? THEME_COLOR.dark;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);
  }, [resolvedTheme]);

  return null;
}
