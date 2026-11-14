import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { palette } from "@/design/palette";

describe("palette fallbacks", () => {
  it("match the CSS variables that style the app", () => {
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const expected: Record<string, string> = {
      "--background": palette.background,
      "--secondary": palette.secondary,
      "--card": palette.card,
      "--primary": palette.accent,
      "--status-info": palette.cyan,
      "--status-nominal": palette.evidence,
      "--status-caution": palette.amber,
      "--destructive": palette.critical,
      "--foreground": palette.text,
      "--muted-foreground": palette.muted,
      "--terrain": palette.terrain,
      "--terrain-mars": palette.terrainMars,
      "--hull": palette.hull,
      "--hull-mars": palette.hullMars,
      "--sky": palette.sky,
      "--metal": palette.metal,
      "--text-primary": palette.bone,
      "--accent-text": palette.emberText,
      "--sun": palette.sun,
      "--earthshine": palette.earthshine,
      "--pad": palette.pad,
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(css).toContain(`${name}: ${value}`);
    }
  });
});
