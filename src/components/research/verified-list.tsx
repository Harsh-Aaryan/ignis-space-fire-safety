"use client";

import type { VerifiedCitation } from "@/data/verified";

export function VerifiedCitationList({
  citations,
  query,
}: {
  citations: VerifiedCitation[];
  query: string;
}) {
  const needle = query.trim().toLowerCase();
  const visible = citations.filter((item) => {
    if (!needle) return true;
    return `${item.title} ${item.indexHint} ${item.abstractExcerpt} ${item.keywords.join(" ")}`
      .toLowerCase()
      .includes(needle);
  });
  return (
    <section className="rounded border border-border bg-card p-4">
      <h2 className="font-cond text-[12px] tracking-[0.08em] uppercase">Verified NASA metadata</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Public NTRS citation records retrieved 2026-11-12. No measurements were extracted. These rows are not synthetic dossiers and are not binned into the heatmap.
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {visible.map((item) => (
          <li key={item.id} className="border-b border-[#2A2D32] pb-2">
            <a href={`/research/${item.id}`} className="text-sm text-ember-text">
              {item.title}
            </a>
            <p className="text-xs text-muted-foreground">
              {item.indexHint} · {item.stiType ?? "record"} · {item.year ?? "year unreported"} · NTRS {item.id}
            </p>
          </li>
        ))}
      </ul>
      {visible.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No indexed record matches that text.</p> : null}
    </section>
  );
}
