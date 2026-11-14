/** Ember Instrument palette. Hex values match src/app/globals.css. */
export const palette = {
  background: "#0D0F13",
  secondary: "#16181C",
  card: "#1F2125",
  accent: "#E07A3D",
  cyan: "#6BA3C7",
  evidence: "#3DCC8D",
  amber: "#E8C15A",
  critical: "#F67A6C",
  text: "#EDEAE4",
  muted: "#A39E96",
  terrain: "#3A342C",
  terrainMars: "#5C4036",
  hull: "#D8D2C6",
  hullMars: "#C4B2A4",
  sky: "#000000",
  metal: "#8A8E94",
  bone: "#EDEAE4",
  emberText: "#F0A66A",
  sun: "#FFF3DC",
  earthshine: "#B7C8E0",
  pad: "#3A342C",
} as const;

export type Palette = { -readonly [K in keyof typeof palette]: string };

const CSS_VARS: Record<keyof Palette, string> = {
  background: "--background",
  secondary: "--secondary",
  card: "--card",
  accent: "--primary",
  cyan: "--status-info",
  evidence: "--status-nominal",
  amber: "--status-caution",
  critical: "--destructive",
  text: "--foreground",
  muted: "--muted-foreground",
  terrain: "--terrain",
  terrainMars: "--terrain-mars",
  hull: "--hull",
  hullMars: "--hull-mars",
  sky: "--sky",
  metal: "--metal",
  bone: "--text-primary",
  emberText: "--accent-text",
  sun: "--sun",
  earthshine: "--earthshine",
  pad: "--pad",
};

export function readPalette(): Palette {
  if (typeof document === "undefined") return { ...palette };
  const style = getComputedStyle(document.documentElement);
  const next: Palette = { ...palette };
  (Object.keys(CSS_VARS) as Array<keyof Palette>).forEach((key) => {
    const value = style.getPropertyValue(CSS_VARS[key]).trim();
    if (value) next[key] = value;
  });
  return next;
}

export const COVERAGE_RAMP = [
  "#23180E",
  "#442605",
  "#673500",
  "#8A7040",
  "#A95B00",
  "#C57400",
  "#DD9021",
  "#EFAE5C",
  "#FECE93",
] as const;

export const DATA_SERIES = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#2484C6",
  "#D55E00",
  "#CC79A7",
  "#DEDEDE",
] as const;
