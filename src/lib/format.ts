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
