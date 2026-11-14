"use client";

import Link from "next/link";
import { useState } from "react";
import { Cite, CitedValue } from "@/components/fire/cite";
import { BenchmarkComparison } from "@/components/research/benchmark-comparison";
import { PsiDatasets } from "@/components/research/psi-datasets";
import { FIRE_MATERIALS, materialById } from "@/data/fire/materials";
import { SAFFIRE_BENCHMARKS, SAME2_TABLE, WSTF_LIMITS } from "@/data/fire/options";
import { FIRE_SOURCES, RETRIEVED_AT } from "@/data/fire/sources";
import { useFireSimStore } from "@/stores/fire-sim-store";

const field = "rounded border border-border bg-background px-3 py-2 text-sm";

export function MaterialsView() {
  const configured = useFireSimStore((state) => state.config.materialId);
  const [selectedId, setSelectedId] = useState(configured ?? "pmma");
  const material = materialById(selectedId);
  const properties = [
    ["Piloted ignition temperature", material.ignitionTempC, "°C"],
    ["Thermal inertia kρc", material.thermalInertia, "(kW/m²K)² s"],
    ["Critical heat flux", material.criticalHeatFluxKwM2, "kW/m²"],
    ["Heat of combustion", material.heatOfCombustionMJkg, "MJ/kg"],
    ["Combustible mass per surface area", material.arealFuelKgM2, "kg/m²"],
    ["1 g oxygen limit", material.loc1gPct, "% O₂"],
    ["Low-flow oxygen margin", material.lowFlowMarginPct, "percentage points"],
    ["CO₂ yield", material.co2Yield, "kg/kg fuel"],
    ["CO yield in 1 g", material.coYield1g, "kg/kg fuel"],
    ["Soot yield", material.sootYield, "kg/kg fuel"],
    ["Radiative fraction", material.radiativeFraction, ""],
    ["Reference mass flux", material.refMassFluxGm2s, "g/m² s"],
  ] as const;

  return (
    <div className="min-w-0 space-y-5">
      <header>
        <h1 className="font-cond text-[22px] font-semibold">Materials and NASA measurements</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Published measurements, handbook values and model assumptions carry separate source labels.
          The extracted tables below are independent of the synthetic demonstration catalog. Sources checked {RETRIEVED_AT}.
        </p>
      </header>
      <PsiDatasets />
      <section className="rounded border border-border bg-card p-4" aria-label="Material properties">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Material
            <select aria-label="Research material" className={field} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {FIRE_MATERIALS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <Link href="/predict" className="border border-primary px-3 py-2 text-sm text-ember-text" onClick={() => {
            const sim = useFireSimStore.getState();
            sim.reset();
            sim.patchConfig({ materialId: material.id });
          }}>Use this material in Predict</Link>
        </div>
        <p className="mt-3 text-sm">{material.use}</p>
        <p className="mt-2 text-sm text-muted-foreground">{material.nasaFinding}</p>
        <p className="mt-2 flex flex-wrap gap-2">{material.nasaSources.map((id) => <Cite key={id} id={id} />)}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[550px] text-left text-xs">
            <caption className="sr-only">{material.name} properties and provenance</caption>
            <thead><tr><th className="py-2">Property</th><th className="text-right">Value and source</th><th className="pl-4">Context</th></tr></thead>
            <tbody>{properties.map(([label, cited, unit]) => <tr key={label} className="border-t border-border align-top">
              <th scope="row" className="py-2 font-normal">{label}</th>
              <td className="py-2 text-right"><CitedValue cited={cited} unit={unit} /></td>
              <td className="max-w-md py-2 pl-4 text-muted-foreground">{cited.note ?? "See the cited reference; configuration and test conditions affect applicability."}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Oxygen limits are configuration-specific test results, not universal ignition thresholds.
          The model applies a flow correlation and an assumed pressure correction to other conditions.
        </p>
      </section>
      <section className="rounded border border-border bg-card p-4">
        <h2 className="text-lg">Saffire IV and VI: cabin-scale fire products <Cite id="saffire-vi" /></h2>
        <p className="mt-2 text-xs text-muted-foreground">Tables 1–2, ICES-2024-365. All cases are microgravity with 0.20 m/s concurrent flow initially. Mean and peak HRR are different measurements.</p>
        <DataTable caption="Extracted Saffire measurements" headers={["Test / material", "O₂ (%)", "Pressure (kPa)", "Volume (m³)", "Duration (s)", "HRR (W)", "Heat (kJ)", "CO₂ rise (ppm)", "CO rise (ppm)"]} rows={SAFFIRE_BENCHMARKS.map((b) => [
          `${b.id} / ${b.material}`, b.oxygenPct, b.pressureKpa, b.freeVolumeM3, b.burnDurationS,
          `${b.peakHeatW ?? b.avgHeatW} ${b.peakHeatW === null ? "mean, fuel estimate" : "peak, O₂ calorimetry"}`,
          b.totalHeatKJ, b.co2RisePpm, b.coRisePpm,
        ])} />
        <p className="mt-2 text-xs text-muted-foreground">
          IV-1 total heat is a fuel-consumption estimate. VI-2 reports 580 kJ by oxygen calorimetry and 409 kJ by fuel consumption;
          the reported duration, average and peak do not form a consistent constant-HRR time series. Those published values are retained separately.
          The PMMA trials used changing fan settings. These summary rows do not reconstruct their HRR histories.
        </p>
        <BenchmarkComparison />
      </section>
      <section className="rounded border border-border bg-card p-4">
        <h2 className="text-lg">White Sands: material flammability limits <Cite id="hirsch-2011" /></h2>
        <p className="mt-2 text-xs text-muted-foreground">ULOI = upward limiting oxygen index. MOC = maximum oxygen concentration meeting the test criterion. Values are in % O₂; nominal pressure 14.7 psia unless noted.</p>
        <DataTable caption="White Sands test results" headers={["Material / configuration", "ULOI (%)", "MOC (%)", "Condition"]} rows={WSTF_LIMITS.map((row) => [row.material, row.uloi, row.moc, row.note])} />
        <p className="mt-2 text-xs text-muted-foreground">NASA-STD-6001B with Change 3 defines material test procedures; passing a ground test does not establish safety at lunar, Martian or microgravity conditions. <Cite id="nasa-std-6001b" /></p>
      </section>
      <section className="rounded border border-border bg-card p-4">
        <h2 className="text-lg">SAME-2: smoke particle sizes <Cite id="same-2" /></h2>
        <p className="mt-2 text-xs text-muted-foreground">Table 1. Diameter values in µm; fresh and aged 720 s. These measurements inform the model’s particle-size response, not a measured detector alarm time.</p>
        <DataTable caption="SAME-2 smoke size measurements" headers={["Material", "Fresh count mean", "Aged count mean", "Fresh mass mean", "Aged mass mean"]} rows={SAME2_TABLE.map((row) => [row.material, ...row.countMean, ...row.massMean])} />
      </section>
      <section className="rounded border border-border bg-card p-4" id="sources">
        <h2 className="text-lg">Research and applicability</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Saffire and BASS address solid-fuel fires; SAME informs smoke detection; ISS studies inform isolation and extinguishers.
          ACME / s-Flame provides spherical diffusion-flame context, with no solid-fuel coefficients transferred here.
        </p>
        <div className="mt-4 space-y-4">{FIRE_SOURCES.map((source) => <article key={source.id} id={`source-${source.id}`} className="scroll-mt-4 border-l-2 border-border pl-3">
          <h3 className="text-sm font-medium">{source.title} <Cite id={source.id} compact /></h3>
          <p className="mt-1 text-xs text-muted-foreground">{source.authors} · {source.venue} · {source.year ?? "date not specified"}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{source.extracted.map((finding) => <li key={finding}>{finding}</li>)}</ul>
        </article>)}</div>
      </section>
    </div>
  );
}

function DataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: (string | number | null)[][] }) {
  return <div className="mt-3 max-w-full overflow-x-auto"><table className="w-full text-left text-xs">
    <caption className="sr-only">{caption}</caption>
    <thead><tr>{headers.map((header) => <th key={header} scope="col" className="px-2 py-2 whitespace-nowrap font-medium">{header}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index} className="border-t border-border">{row.map((cell, column) => <td key={column} className={`px-2 py-2 ${column ? "numeric whitespace-nowrap" : "min-w-40"}`}>{cell ?? "Not reported"}</td>)}</tr>)}</tbody>
  </table></div>;
}
