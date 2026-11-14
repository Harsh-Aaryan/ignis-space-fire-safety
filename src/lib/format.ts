export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatOxygen(value: number): string {
  return formatNumber(value, 1);
}

export function formatPsi(value: number): string {
  return formatNumber(value, 1);
}

export function formatGravity(value: number): string {
  if (Math.abs(value) < 0.05) return "~0";
  if (Math.abs(value - 0.38) < 0.005) return "0.38";
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatAir(value: number): string {
  return formatNumber(value, 2);
}

/** Relevance, coverage and priority are 0–1 scores, shown to two decimals. */
export function formatScore(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(2);
}

export function formatRelevance(value: number | null): string {
  return formatScore(value);
}

export function formatCoverage(percent: number): string {
  return (percent / 100).toFixed(2);
}

export function formatWhen(at: number): string {
  if (at === 0) return "This session";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

export const RELEVANCE_DISCLAIMER =
  "Weighted match to the current mission. Not a fire-ignition or mission-safety probability.";

export const COVERAGE_DISCLAIMER =
  "Share of requested condition-space with at least one synthetic run. Not a safety probability.";
