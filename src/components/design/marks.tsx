import { COVERAGE_DISCLAIMER, RELEVANCE_DISCLAIMER } from "@/lib/format";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1.25" y="1.25" width="13.5" height="13.5" fill="none" stroke="#EDEAE4" strokeWidth="1.5" />
        <path d="M4.4 10.6 L8 4.2 L11.6 10.6" fill="none" stroke="#E07A3D" strokeWidth="1.5" strokeLinejoin="miter" strokeLinecap="square" />
      </svg>
      {compact ? null : (
        <span className="text-sm font-medium tracking-[0.16em] text-foreground uppercase">Ignis</span>
      )}
    </span>
  );
}

export function PrototypeBadge({ researchModel = false }: { researchModel?: boolean }) {
  return (
    <div className="prototype-badge" role="note">
      <span className="prototype-badge-mark" aria-hidden="true" />
      {researchModel ? "Prototype — Research-informed model" : "Prototype — Synthetic Demonstration Data"}
    </div>
  );
}

export function StatusChip({
  level,
  children,
}: {
  level: "nominal" | "info" | "caution" | "warning" | "critical" | "category";
  children: React.ReactNode;
}) {
  return (
    <span className={`status-chip status-${level}`}>
      <span className="status-mark" aria-hidden="true" />
      {children}
    </span>
  );
}

export function ScoreDisclaimer({ kind }: { kind: "relevance" | "coverage" }) {
  return (
    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
      {kind === "relevance" ? RELEVANCE_DISCLAIMER : COVERAGE_DISCLAIMER}
    </p>
  );
}

export function SyntheticStamp() {
  return <span className="synthetic-stamp">Synthetic data</span>;
}
