"use client";

import Link from "next/link";
import { StatusChip } from "@/components/design/marks";
import { formatNumber } from "@/lib/format";
import { useAnalysis } from "@/hooks/use-analysis";
import { useMissionStore } from "@/stores/mission-store";

export function PredictView() {
  const analysis = useAnalysis();
  const scenario = useMissionStore((state) => state.scenario);
  const verified = analysis.verifiedPrediction;
  const demo = analysis.syntheticDemo;
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-cond text-[22px] font-semibold tracking-[0.04em]">Predictive analytics</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Two separate results for {scenario.name}. The verified index is not mixed into the synthetic fit.
        </p>
      </header>
      <section className="rounded border border-border bg-card p-4">
        <div className="mb-2 flex flex-wrap gap-2">
          <StatusChip level="info">Verified</StatusChip>
          <StatusChip level="caution">Insufficient</StatusChip>
        </div>
        <h2 className="text-lg font-medium">{verified.message}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {analysis.indexed.summary} No confidence percentage is assigned to that statement. {analysis.indexed.caveat}
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {analysis.indexed.citations.slice(0, 6).map((item) => (
            <li key={item.id}>
              <a href={item.sourceUrl} className="text-ember-text">
                {item.title}
              </a>
              <span className="block text-xs text-muted-foreground">
                {item.indexHint} · NTRS {item.id} · retrieved {item.retrievedAt} · measurements extracted: no
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded border border-border bg-card p-4">
        <div className="mb-2 flex flex-wrap gap-2">
          <StatusChip level="info">Synthetic</StatusChip>
          <span className="status-chip status-info evidence-dashed">
            <span className="status-mark" />
            Model
          </span>
          {demo.outsideObservedRange ? <StatusChip level="warning">Outside observed range</StatusChip> : null}
          <StatusChip level="caution">Statistical uncertainty</StatusChip>
        </div>
        <h2 className="text-lg font-medium">Synthetic flame-spread baseline</h2>
        <p className="mt-2 text-sm">{demo.message}</p>
        {demo.status === "baseline" && demo.fit && demo.confidenceInterval && demo.predictionInterval ? (
          <>
            <IntervalSketch confidence={demo.confidenceInterval} prediction={demo.predictionInterval} n={demo.fit.n} />
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Method</dt>
                <dd>{demo.method}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Held-out investigation</dt>
                <dd className="numeric">
                  {(demo.holdoutGroup ?? "").toUpperCase()} · MAE {demo.holdoutMae == null ? "—" : formatNumber(demo.holdoutMae, 3)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">95% CI</dt>
                <dd className="numeric">
                  {formatNumber(demo.confidenceInterval.low, 3)}–{formatNumber(demo.confidenceInterval.high, 3)} (95% CI)
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">95% PI</dt>
                <dd className="numeric">
                  {formatNumber(demo.predictionInterval.low, 3)}–{formatNumber(demo.predictionInterval.high, 3)} (95% PI)
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-3 text-sm">Insufficient experimental evidence for reliable prediction.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          A confidence interval is about the mean response. A prediction interval is about one future point and is wider. Neither is a fire-safety probability.
        </p>
        <Link href="/firetwin" className="mt-3 inline-block text-sm text-ember-text">
          Back to FireTwin
        </Link>
      </section>
    </div>
  );
}

function IntervalSketch({
  confidence,
  prediction,
  n,
}: {
  confidence: { low: number; high: number };
  prediction: { low: number; high: number };
  n: number;
}) {
  const span = Math.max(prediction.high - prediction.low, 0.001);
  const x = (value: number) => ((value - prediction.low) / span) * 280 + 20;
  const width = Math.max(2, x(confidence.high) - x(confidence.low));
  return (
    <svg viewBox="0 0 320 72" className="mt-3 w-full max-w-md" role="img" aria-label="Confidence interval and prediction interval">
      <line x1={x(prediction.low)} y1="36" x2={x(prediction.high)} y2="36" stroke="#EDEAE4" strokeDasharray="4 3" />
      <rect x={x(confidence.low)} y="28" width={width} height="16" fill="#EDEAE4" fillOpacity="0.25" stroke="#EDEAE4" />
      <text x="8" y="14" fill="#A39E96" fontSize="10">
        95% CI · n = {n} · OLS, grouped by investigation
      </text>
      <text x="8" y="66" fill="#A39E96" fontSize="10">
        PREDICTION INTERVAL — a future measurement, not the mean
      </text>
    </svg>
  );
}
