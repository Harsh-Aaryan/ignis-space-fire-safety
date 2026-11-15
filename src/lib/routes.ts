/** Canonical paths. Components link through these so a route is named in one place. */
export const ROUTES = {
  overview: "/",
  simulation: "/simulation",
  compare: "/simulation/compare",
  research: "/research",
  investigation: (id: string) => `/research/${id}`,
  researchCompare: "/research/compare",
  modelingData: "/research/data",
  controls: "/research/controls",
  gaps: "/research/gaps",
  results: "/results",
} as const;

/** Paths the site used before the sections were renamed. next.config.ts redirects each one. */
export const LEGACY_REDIRECTS: Array<{ source: string; destination: string }> = [
  { source: "/firetwin", destination: ROUTES.simulation },
  { source: "/predict", destination: ROUTES.compare },
  { source: "/materials", destination: ROUTES.modelingData },
  { source: "/gravity-bridge", destination: ROUTES.gaps },
  { source: "/firelab", destination: ROUTES.gaps },
  { source: "/reports", destination: ROUTES.results },
];

export const PRIMARY_NAV = [
  { href: ROUTES.overview, label: "Overview" },
  { href: ROUTES.simulation, label: "Simulation" },
  { href: ROUTES.research, label: "Research" },
  { href: ROUTES.results, label: "Results" },
] as const;

export const SIMULATION_TABS = [
  { href: ROUTES.simulation, label: "Scenario" },
  { href: ROUTES.compare, label: "Compare gravity" },
] as const;

/** One tab per question the challenge asks of the research, plus the gaps they leave. */
export const RESEARCH_TABS = [
  { href: ROUTES.research, label: "Investigations" },
  { href: ROUTES.researchCompare, label: "Compare" },
  { href: ROUTES.modelingData, label: "Modeling data" },
  { href: ROUTES.controls, label: "Detection and suppression" },
  { href: ROUTES.gaps, label: "Evidence gaps" },
] as const;

export type SectionId = "overview" | "simulation" | "research" | "results";

export function sectionForPath(pathname: string): SectionId {
  if (pathname.startsWith(ROUTES.simulation)) return "simulation";
  if (pathname.startsWith(ROUTES.research)) return "research";
  if (pathname.startsWith(ROUTES.results)) return "results";
  return "overview";
}

/** Whether a tab is the current one. The section root only matches itself and its detail pages. */
export function isTabActive(pathname: string, href: string, tabs: ReadonlyArray<{ href: string }>): boolean {
  if (pathname === href) return true;
  const deeper = tabs.some((tab) => tab.href !== href && tab.href.startsWith(href) && pathname.startsWith(tab.href));
  return !deeper && pathname.startsWith(`${href}/`);
}

/** The research comparison for up to three investigation ids. */
export function researchCompareHref(ids: string[]): string {
  return ids.length ? `${ROUTES.researchCompare}?ids=${ids.map(encodeURIComponent).join(",")}` : ROUTES.researchCompare;
}
