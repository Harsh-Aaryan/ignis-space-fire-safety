"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import {
  ActionLink,
  EvidenceTag,
  ExternalLink,
  Note,
  Panel,
  Stat,
  Tag,
  TextLink,
  actionClass,
  evidenceHint,
  table,
  type EvidenceClass,
} from "@/components/design/kit";
import { Cite, CitedValue } from "@/components/fire/cite";
import { fieldClass } from "@/components/research/index-filter-bar";
import { PsiDatasets } from "@/components/research/psi-datasets";
import { FIRE_MATERIALS, materialById, type FireMaterial } from "@/data/fire/materials";
import { SAFFIRE_BENCHMARKS, SAME2_TABLE, WSTF_LIMITS } from "@/data/fire/options";
import { materialParameterRecords } from "@/data/fire/parameters";
import { FIRE_MODEL_VERSION, FIRE_SOURCES, RETRIEVED_AT, type Cited } from "@/data/fire/sources";
import { RESEARCH_INDEX_SUMMARY, investigationsForPillar } from "@/data/research/investigations";
import { compareSaffireSummaries } from "@/lib/fire/benchmarks";
import { reactionYields } from "@/lib/fire/chemistry";
import { downloadText } from "@/lib/research/export";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useFireSimStore } from "@/stores/fire-sim-store";

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "tables", label: "NASA experiment tables" },
  { id: "materials", label: "Material properties" },
  { id: "measurements", label: "Flammability and smoke" },
  { id: "check", label: "Model check" },
  { id: "sources", label: "Sources" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

const EVIDENCE_ORDER: EvidenceClass[] = ["measured", "derived", "calibrated", "assumed"];

const SOURCE_KIND_LABEL = { nasa: "NASA", "peer-reviewed": "Peer-reviewed", handbook: "Reference", assumption: "Assumption" } as const;

function isView(value: string | null): value is ViewId {
  return VIEWS.some((view) => view.id === value);
}

/** Every cited property across the material profiles. */
function citedEntries(material: FireMaterial): Cited<unknown>[] {
  return Object.values(material).filter((value): value is Cited<unknown> => Boolean(value) && typeof value === "object" && "source" in (value as object));
}

/** Reads the view and table from the URL. Render inside a Suspense boundary. */
export function ModelingDataFromQuery() {
  const params = useSearchParams();
  const view = params.get("view");
  const tableId = params.get("table");
  return <ModelingDataView key={params.toString()} initialView={isView(view) ? view : tableId ? "tables" : "overview"} initialTable={tableId ?? undefined} />;
}

/** Modeling data: what a fire model can be built on and checked against. */
export function ModelingDataView({ initialView = "overview", initialTable }: { initialView?: ViewId; initialTable?: string }) {
  const [view, setView] = useState<ViewId>(initialView);

  function show(next: ViewId) {
    setView(next);
    window.history.replaceState(null, "", next === "overview" ? window.location.pathname : `${window.location.pathname}?view=${next}`);
  }

  return (
    <div className="min-w-0">
      <div role="tablist" aria-label="Modeling data views" className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            onClick={() => show(item.id)}
            className={cn(
              "min-h-10 shrink-0 rounded-md border px-3 text-sm transition-colors",
              view === item.id ? "border-primary bg-elev-2 text-foreground" : "border-border-subtle text-muted-foreground hover:bg-elev-2 hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === "overview" ? <Overview onShow={show} /> : null}
      {view === "tables" ? <PsiDatasets initialId={initialTable} /> : null}
      {view === "materials" ? <MaterialProperties /> : null}
      {view === "measurements" ? <Measurements /> : null}
      {view === "check" ? <ModelCheck /> : null}
      {view === "sources" ? <Sources /> : null}
    </div>
  );
}

function Overview({ onShow }: { onShow: (view: ViewId) => void }) {
  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const entry of FIRE_MATERIALS.flatMap(citedEntries)) tally[entry.evidence ?? "assumed"] = (tally[entry.evidence ?? "assumed"] ?? 0) + 1;
    return tally;
  }, []);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const records = investigationsForPillar("predictive-modeling");

  return (
    <div className="flex flex-col gap-5">
      <Panel title="What is held here">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          <Stat label="NASA experiment tables" value={RESEARCH_INDEX_SUMMARY.psiTables} note="Original files with checksums" />
          <Stat label="Saffire I sensor readings" value="1,215" note="Temperature, pressure, smoke detectors" />
          <Stat label="Material profiles" value={FIRE_MATERIALS.length} note={`${total} properties, each with a source`} />
          <Stat label="Saffire reference burns" value={SAFFIRE_BENCHMARKS.length} note="Cabin-scale results the model is compared with" />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={actionClass("secondary")} onClick={() => onShow("tables")}>
            Open the experiment tables
          </button>
          <button type="button" className={actionClass("secondary")} onClick={() => onShow("check")}>
            See the model check
          </button>
        </div>
      </Panel>

      <Panel
        title="Where the model's material inputs come from"
        description={`${total} properties across ${FIRE_MATERIALS.length} materials. Most are handbook values or modeling choices; NASA measurements anchor the ones that matter most for flammability.`}
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EVIDENCE_ORDER.map((kind) => (
            <li key={kind} className="rounded-md border border-border-subtle p-3">
              <p className="numeric text-[22px] leading-7 text-foreground">{counts[kind] ?? 0}</p>
              <EvidenceTag kind={kind} className="mt-1" />
              <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{evidenceHint(kind)}</p>
            </li>
          ))}
        </ul>
        <Note className="mt-4">
          Model output for a cabin that no experiment matches is marked <EvidenceTag kind="extrapolated" className="mx-0.5 align-middle" />. That
          includes every result at lunar and Martian gravity.
        </Note>
      </Panel>

      <Panel title="Records that support modeling" description="What each record contributes to the IGNIS fire model." flush>
        <ul className="divide-y divide-border-subtle">
          {records.map((record) => (
            <li key={record.id} className="grid gap-x-6 gap-y-2 px-5 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="min-w-0">
                <TextLink href={ROUTES.investigation(record.id)} className="text-sm font-medium">
                  {record.name}
                </TextLink>
                <p className="mt-1 text-[13px] leading-5 text-text-tertiary">{record.platform}</p>
              </div>
              {record.modelUse.length ? (
                <ul className="space-y-1 text-[13px] leading-5 text-muted-foreground">
                  {record.modelUse.map((use) => (
                    <li key={use}>{use}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] leading-5 text-text-tertiary">Not used by the model.</p>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function MaterialProperties() {
  const configured = useFireSimStore((state) => state.config.materialId);
  const [selectedId, setSelectedId] = useState(configured ?? "pmma");
  const material = materialById(selectedId);
  const properties: Array<[string, Cited<number | null>, string]> = [
    ["Piloted ignition temperature", material.ignitionTempC, "°C"],
    ["Thermal inertia kρc", material.thermalInertia, "(kW/m²K)² s"],
    ["Critical heat flux", material.criticalHeatFluxKwM2, "kW/m²"],
    ["Heat of combustion", material.heatOfCombustionMJkg, "MJ/kg"],
    ["Combustible mass per surface area", material.arealFuelKgM2, "kg/m²"],
    ["Oxygen limit in Earth gravity", material.loc1gPct, "% O₂"],
    ["Low-flow oxygen margin", material.lowFlowMarginPct, "% O₂"],
    ["CO₂ yield", material.co2Yield, "kg/kg"],
    ["CO yield in Earth gravity", material.coYield1g, "kg/kg"],
    ["Soot yield", material.sootYield, "kg/kg"],
    ["Radiative fraction", material.radiativeFraction, ""],
    ["Reference burning rate", material.refMassFluxGm2s, "g/m²s"],
  ];

  function exportParameters() {
    const payload = { parameters: materialParameterRecords(material), activeReactionYields: reactionYields(material, 21) };
    downloadText(`ignis-${material.id}-parameters.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function compareMaterial() {
    const sim = useFireSimStore.getState();
    sim.reset();
    sim.patchConfig({ materialId: material.id });
  }

  return (
    <Panel
      aria-label="Material properties"
      title="Material properties"
      description={`${FIRE_MATERIALS.length} materials found in crewed vehicles. Every value carries its evidence class and its source.`}
      actions={
        <ActionLink href={ROUTES.compare} onClick={compareMaterial}>
          Compare this material
        </ActionLink>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1 text-[12px] text-muted-foreground sm:max-w-sm">
          Material
          <select aria-label="Research material" className={fieldClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {FIRE_MATERIALS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={actionClass("secondary")} onClick={exportParameters}>
          <Download className="size-4" aria-hidden="true" />
          Export parameters and sources
        </button>
      </div>

      <p className="mt-4 text-sm leading-6 text-foreground">{material.use}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{material.nasaFinding}</p>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {material.nasaSources.map((id) => (
          <Cite key={id} id={id} />
        ))}
      </p>

      <div className={cn(table.wrap, "mt-5")}>
        <table className={cn(table.root, "min-w-[640px]")}>
          <caption className="sr-only">{material.name} properties and where each comes from</caption>
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>
                Property
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Value and source
              </th>
              <th scope="col" className={table.th}>
                Context
              </th>
            </tr>
          </thead>
          <tbody>
            {properties.map(([label, cited, unit]) => (
              <tr key={label} className={table.tr}>
                <th scope="row" className={cn(table.td, "font-normal text-foreground")}>
                  {label}
                </th>
                <td className={cn(table.td, "text-right")}>
                  <CitedValue cited={cited} unit={unit} />
                </td>
                <td className={cn(table.td, "max-w-md text-muted-foreground")}>
                  {cited.note ?? "See the cited reference. Configuration and test conditions affect whether it applies."}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Note className="mt-4">
        An oxygen limit is the result of one test configuration, not a universal threshold. Each limit keeps the pressure it was
        measured at. The model adjusts CO₂ so that the carbon in the fuel is conserved.
      </Note>
    </Panel>
  );
}

function SimpleTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: Array<Array<string | number | null>> }) {
  return (
    <div className={table.wrap}>
      <table className={table.root}>
        <caption className="sr-only">{caption}</caption>
        <thead className={table.head}>
          <tr>
            {headers.map((header, index) => (
              <th key={header} scope="col" className={cn(table.th, index ? "text-right" : "")}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className={table.tr}>
              {row.map((cell, column) => (
                <td key={column} className={column ? cn(table.num, "whitespace-nowrap") : cn(table.td, "min-w-40 text-foreground")}>
                  {cell === null || cell === "" ? <span className="text-text-tertiary">–</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Measurements() {
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Saffire: cabin-scale fire products"
        description="Tables 1 and 2 of the Saffire VI paper. All tests in microgravity with 20 cm/s airflow at the start."
        actions={<Cite id="saffire-vi" />}
      >
        <SimpleTable
          caption="Extracted Saffire measurements"
          headers={["Test and material", "O₂ (%)", "Pressure (kPa)", "Volume (m³)", "Duration (s)", "Heat release (W)", "Heat (kJ)", "CO₂ rise (ppm)", "CO rise (ppm)"]}
          rows={SAFFIRE_BENCHMARKS.map((item) => [
            `${item.id} · ${item.material}`,
            item.oxygenPct,
            item.pressureKpa,
            item.freeVolumeM3,
            item.burnDurationS,
            `${item.peakHeatW ?? item.avgHeatW} ${item.peakHeatW === null ? "mean" : "peak"}`,
            item.totalHeatKJ,
            item.co2RisePpm,
            item.coRisePpm,
          ])}
        />
        <Note className="mt-4">
          Mean and peak heat release are different measurements. Test VI-2 reports 580 kJ by oxygen calorimetry and 409 kJ by fuel
          consumption; both are published and neither is reconciled here. The acrylic tests changed fan settings during the burn.
        </Note>
      </Panel>

      <Panel
        title="White Sands: material flammability limits"
        description="Upward limiting oxygen index (ULOI) and maximum oxygen concentration (MOC), in % O₂, at 14.7 psia unless noted. Earth gravity."
        actions={<Cite id="hirsch-2011" />}
      >
        <SimpleTable
          caption="White Sands test results"
          headers={["Material and configuration", "ULOI (%)", "MOC (%)", "Condition"]}
          rows={WSTF_LIMITS.map((row) => [row.material, row.uloi, row.moc, row.note])}
        />
        <Note className="mt-4">
          Passing a ground test does not establish behavior in microgravity or partial gravity. <Cite id="nasa-std-6001b" />
        </Note>
      </Panel>

      <Panel
        title="SAME-2: smoke particle sizes"
        description="Diameters in micrometers, fresh and after aging 720 s, measured in microgravity from materials heated below ignition."
        actions={<Cite id="same-2" />}
      >
        <SimpleTable
          caption="SAME-2 smoke size measurements"
          headers={["Material", "Count mean, fresh", "Count mean, aged", "Mass mean, fresh", "Mass mean, aged"]}
          rows={SAME2_TABLE.map((row) => [row.material, ...row.countMean, ...row.massMean])}
        />
        <Note className="mt-4">These sizes set how the modeled detectors respond. They are not measured alarm times.</Note>
      </Panel>
    </div>
  );
}

function ratio(model: number, measured: number): string {
  return measured > 0 ? `${((model / measured) * 100).toFixed(0)}%` : "–";
}

function ModelCheck() {
  const rows = useMemo(() => compareSaffireSummaries(), []);
  const quantities: Array<{ label: string; measured: (row: (typeof rows)[number]) => number; modeled: (row: (typeof rows)[number]) => number }> = [
    { label: "Heat release (W)", measured: (row) => row.measuredHrrW, modeled: (row) => row.modelHrrW },
    { label: "Total heat (kJ)", measured: (row) => row.measuredHeatKJ, modeled: (row) => row.modelHeatKJ },
    { label: "CO₂ rise (ppm)", measured: (row) => row.measuredCo2Ppm, modeled: (row) => row.modelCo2Ppm },
    { label: "CO rise (ppm)", measured: (row) => row.measuredCoPpm, modeled: (row) => row.modelCoPpm },
  ];

  const heatRatios = rows.map((row) => (row.modelHrrW / row.measuredHrrW) * 100);
  const heatLow = Math.min(...heatRatios).toFixed(0);
  const heatHigh = Math.max(...heatRatios).toFixed(0);
  const coHigh = Math.max(...rows.map((row) => (row.modelCoPpm / row.measuredCoPpm) * 100)).toFixed(0);

  function exportComparison() {
    const payload = {
      scope: `IGNIS model ${FIRE_MODEL_VERSION} compared with published Saffire summaries; not independent validation`,
      source: "https://ntrs.nasa.gov/citations/20240002981",
      rows,
    };
    downloadText("ignis-saffire-comparison.json", JSON.stringify(payload, null, 2), "application/json");
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="The model against four Saffire burns"
        description={`Model ${FIRE_MODEL_VERSION}, run for each test's reported duration at its reported atmosphere, with constant airflow.`}
        actions={<Cite id="saffire-vi" />}
        flush
      >
        <div className="overflow-x-auto">
          <table className={table.root} aria-label="Saffire model comparison">
            <thead className={table.head}>
              <tr>
                <th scope="col" className={table.th}>
                  Test
                </th>
                <th scope="col" className={table.th}>
                  Quantity
                </th>
                <th scope="col" className={cn(table.th, "text-right")}>
                  Published
                </th>
                <th scope="col" className={cn(table.th, "text-right")}>
                  Modeled
                </th>
                <th scope="col" className={cn(table.th, "text-right")}>
                  Modeled ÷ published
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((row) =>
                quantities.map((quantity, index) => (
                  <tr key={`${row.id}-${quantity.label}`} className={table.tr}>
                    {index === 0 ? (
                      <th scope="rowgroup" rowSpan={quantities.length} className={cn(table.td, "font-medium whitespace-nowrap text-foreground")}>
                        {row.id}
                        <span className="block text-[12px] font-normal text-text-tertiary">{row.hrrBasis} heat release</span>
                      </th>
                    ) : null}
                    <td className={cn(table.td, "text-muted-foreground")}>{quantity.label}</td>
                    <td className={table.num}>{quantity.measured(row).toFixed(0)}</td>
                    <td className={table.num}>{quantity.modeled(row).toFixed(0)}</td>
                    <td className={table.num}>{ratio(quantity.modeled(row), quantity.measured(row))}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="How to read this">
        <div className="max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            <span className="text-foreground">The model underpredicts these fires.</span> Its heat release is {heatLow}% to{" "}
            {heatHigh}% of the published values, and its carbon monoxide at most {coHigh}%. It has not been tuned to close those
            gaps.
          </p>
          <p>
            These are comparisons with summary values from one publication, not an independent validation. The flights changed
            fan settings during the burns and the model holds airflow constant, so the histories differ as well as the totals.
          </p>
          <p>
            What the model does reproduce is which fires persist and which go out: acrylic burning at low airflow, a flame that
            dies when the fans stop, no ignition in still microgravity air. A closer match needs the full flight time histories.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className={actionClass("secondary")} onClick={exportComparison}>
            <Download className="size-4" aria-hidden="true" />
            Export comparison (JSON)
          </button>
          <ExternalLink href="https://ntrs.nasa.gov/citations/20240002981">Saffire VI paper on NTRS</ExternalLink>
        </div>
      </Panel>
    </div>
  );
}

function Sources() {
  return (
    <Panel
      id="sources"
      title="Sources read for the model"
      description={`${FIRE_SOURCES.length} documents, with what was taken from each. Checked ${RETRIEVED_AT}.`}
      flush
    >
      <ul className="divide-y divide-border-subtle">
        {FIRE_SOURCES.map((source) => (
          <li key={source.id} id={`source-${source.id}`} className="scroll-mt-4 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <h3 className="min-w-0 flex-1 basis-72 text-sm leading-6 font-medium text-foreground">{source.title}</h3>
              <span className="flex flex-wrap items-center gap-2">
                <Tag>{SOURCE_KIND_LABEL[source.kind]}</Tag>
                {source.url ? <ExternalLink href={source.url}>Open</ExternalLink> : null}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-5 text-text-tertiary">
              {source.authors} · {source.venue}
              {source.year ? ` · ${source.year}` : ""}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-5 text-muted-foreground">
              {source.extracted.map((statement) => (
                <li key={statement}>{statement}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
