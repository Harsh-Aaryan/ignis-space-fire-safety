"use client";

import { useEffect, useState } from "react";
import { palette, readPalette, type Palette } from "@/design/palette";

export function usePalette(): Palette {
  const [colors, setColors] = useState<Palette>(palette);
  useEffect(() => {
    const read = () => setColors(readPalette());
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, []);
  return colors;
}
