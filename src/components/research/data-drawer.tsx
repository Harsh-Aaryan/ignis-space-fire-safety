"use client";

import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { useState } from "react";
import { Cite } from "@/components/fire/cite";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FIRE_MATERIALS } from "@/data/fire/materials";
import { FIRE_SOURCES, RETRIEVED_AT } from "@/data/fire/sources";
import { VERIFIED_CITATIONS } from "@/data/verified";

/**
 * Materials and citations, reachable from the top bar on every page so the
 * numbers behind the model are never more than one click away.
 */
export function DataDrawer() {
  const [open, setOpen] = useState(false);
  const measured = FIRE_SOURCES.filter((source) => source.kind === "nasa" || source.kind === "peer-reviewed");
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex h-7 shrink-0 items-center gap-1.5 border border-[#2A2D32] bg-card px-2 font-cond text-[11px] tracking-[0.08em] whitespace-nowrap text-[#C9C5BD] uppercase hover:bg-[#292C30]"
        aria-label="Materials and citations"
      >
        <BookOpenText className="size-3.5" strokeWidth={1.5} />
        <span className="hidden 2xl:inline">Data and citations</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100vw,460px)] overflow-y-auto bg-[#16181C] sm:max-w-[460px]">
        <SheetHeader>
          <SheetTitle>Materials and citations</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-8 text-[12px] leading-5" onClick={(event) => (event.target as HTMLElement).closest("a[href^='/']") && setOpen(false)}>
          <p className="text-muted-foreground">
            The fire model uses these {FIRE_MATERIALS.length} materials. Every value carries a chip saying where it came from.
            Sources retrieved {RETRIEVED_AT}.
          </p>
          <p className="flex flex-wrap gap-1.5">
            <Cite id="saffire-vi" compact /> measured by NASA
            <Cite id="sfpe" compact /> standard reference
            <Cite id="model" compact /> model assumption
          </p>
          <section>
            <h3 className="mb-2 font-cond text-[11px] tracking-[0.1em] text-[#D5D4CC] uppercase">Materials</h3>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-[#847F79]">
                  <th className="py-1 pr-2 font-normal">Material</th>
                  <th className="py-1 pr-2 text-right font-normal">O₂ limit, 1 g</th>
                  <th className="py-1 text-right font-normal">Low-flow margin</th>
                </tr>
              </thead>
              <tbody>
                {FIRE_MATERIALS.map((material) => (
                  <tr key={material.id} className="border-t border-[#2A2D32] align-top">
                    <td className="py-1.5 pr-2">
                      {material.name}
                      <span className="block text-[10px] text-muted-foreground">{material.use}</span>
                    </td>
                    <td className="numeric py-1.5 pr-2 text-right whitespace-nowrap">
                      {material.loc1gPct.value} % <Cite id={material.loc1gPct.source} compact />
                    </td>
                    <td className="numeric py-1.5 text-right whitespace-nowrap">
                      −{material.lowFlowMarginPct.value} % <Cite id={material.lowFlowMarginPct.source} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link href="/materials" className="mt-2 inline-block text-[#D8B58D] underline">
              Full property tables and NASA measurements
            </Link>
          </section>
          <section>
            <h3 className="mb-2 font-cond text-[11px] tracking-[0.1em] text-[#D5D4CC] uppercase">
              Model references and related NASA studies
            </h3>
            <ul className="space-y-2">
              {measured.map((source) => (
                <li key={source.id} className="border-l border-[#667A79] pl-2">
                  <a href={source.url ?? "#"} target="_blank" rel="noreferrer" className="text-[#C5D8D3] hover:underline">
                    {source.title} ↗
                  </a>
                  <p className="text-[10px] text-muted-foreground">
                    {source.authors} · {source.year} · {source.extracted.length} findings used
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <p><Link href="/materials#psi-datasets" className="text-[#D8B58D] underline">Browse downloaded NASA PSI experiment tables</Link></p>
          <section>
            <h3 className="mb-2 font-cond text-[11px] tracking-[0.1em] text-[#D5D4CC] uppercase">
              Indexed NASA investigations
            </h3>
            <p className="text-muted-foreground">
              {VERIFIED_CITATIONS.length} NTRS records are indexed for search and ranking.
            </p>
            <Link href="/research" className="mt-1 inline-block text-[#D8B58D] underline">
              Open the research explorer
            </Link>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
