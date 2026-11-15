"use client";

import { Download } from "lucide-react";
import { Note, Panel, actionClass, table } from "@/components/design/kit";
import { Cite } from "@/components/fire/cite";
import { HAZARD_LIMITS, SAFFIRE_IV_VI_EMISSION, SAFFIRE_IV_VI_EMISSION_META, type SaffireEmissionTest } from "@/data/fire/options";
import { downloadText } from "@/lib/research/export";
import { cn } from "@/lib/utils";

const CO_24H = HAZARD_LIMITS.co24hPpm.value;
const CO_1H = HAZARD_LIMITS.co1hPpm.value;
const CO2_MMHG = HAZARD_LIMITS.co2MmHg.value;

const MATERIAL_LABEL: Record<SaffireEmissionTest["material"], string> = { PMMA: "Acrylic (PMMA)", SIBAL: "SIBAL fabric", Cotton: "Cotton fabric" };

/** Value with the limit it passes, if any. The text carries the flag so colour is not the only cue. */
function Flagged({ value, over, label, digits }: { value: number; over: string | null; label?: string; digits?: number }) {
  const text = digits === undefined ? String(value) : value.toFixed(digits);
  if (!over) return <span>{text}</span>;
  return (
    <span className="text-status-warning" title={`Above ${label}`}>
      {text}
      <span className="ml-1 text-[12px]">{over}</span>
    </span>
  );
}

const coFlag = (ppm: number) => (ppm > CO_1H ? "> 1 h" : ppm > CO_24H ? "> 24 h" : null);
const co2Flag = (mmHg: number) => (mmHg > CO2_MMHG ? "> 3" : null);

const dash = <span className="text-text-tertiary">–</span>;
const sides = (test: SaffireEmissionTest) => `${test.sidesBurning === 1 ? "one" : "two"}-sided`;
const material = (test: SaffireEmissionTest) => (test.material === "PMMA" ? `${MATERIAL_LABEL[test.material]}, ${sides(test)}` : MATERIAL_LABEL[test.material]);

const CSV_COLUMNS: Array<[string, (test: SaffireEmissionTest) => string | number | null]> = [
  ["test", (t) => t.id],
  ["material", (t) => t.material],
  ["sides_burning", (t) => t.sidesBurning],
  ["pressure_mbar", (t) => t.pressureMbar],
  ["oxygen_mole_fraction", (t) => t.oxygenMolFraction],
  ["free_volume_m3", (t) => t.freeVolumeM3],
  ["flame_growth_rate_mm_s", (t) => t.flameGrowthRateMmS],
  ["flame_spread_rate_mm_s", (t) => t.flameSpreadRateMmS],
  ["max_flame_length_mm", (t) => t.maxFlameLengthMm],
  ["peak_hrr_w", (t) => t.peakHrrW],
  ["max_co2_rise_mmhg", (t) => t.maxCo2RiseMmHg],
  ["max_co_rise_ppm", (t) => t.maxCoRisePpm],
  ["pressure_rise_mbar", (t) => t.pressureRiseMbar],
  ["max_temperature_rise_c", (t) => t.maxTemperatureRiseC],
  ["time_to_alarm_s_from_timeline_start", (t) => t.timeToAlarmS],
  ["flame_length_at_alarm_mm", (t) => t.flameLengthAtAlarmMm],
  ["hrr_at_alarm_w", (t) => t.hrrAtAlarmW],
  ["co2_rise_at_alarm_mmhg", (t) => t.co2RiseAtAlarmMmHg],
  ["co_rise_at_alarm_ppm", (t) => t.coRiseAtAlarmPpm],
];

function exportCsv() {
  const lines = [CSV_COLUMNS.map(([name]) => name).join(",")];
  for (const test of SAFFIRE_IV_VI_EMISSION) lines.push(CSV_COLUMNS.map(([, read]) => read(test) ?? "").join(","));
  downloadText("saffire-iv-vi-emission.csv", `${lines.join("\n")}\n`, "text/csv");
}

/** Smoke alarm timing and flame growth for the seven Saffire IV–VI tests of ICES-2026-577, Table 1. */
export function SaffireDetection() {
  return (
    <>
      <Panel
        title="Smoke detection timing in Saffire IV–VI"
        description={`Seven flight tests. Time for total particulate at the far-field detector to reach ${SAFFIRE_IV_VI_EMISSION_META.alarmThresholdMgM3.value} mg/m³, with the CO and CO₂ rises at that moment beside the largest rise of the test. Rises are above a baseline already in the cabin and are read next to the cabin air intake.`}
        actions={<Cite id="saffire-iv-vi-emission" />}
        flush
      >
        <Note className="mx-5 mt-4">
          Times are measured from the start of the experiment timeline, about 10 minutes before ignition, not from ignition. Heat release was not
          measured on Saffire IV and V.
        </Note>
        <div className="overflow-x-auto">
          <table className={cn(table.root, "mt-3")}>
            <caption className="sr-only">Time to the 2 mg/m³ smoke alarm and gas rises in the seven Saffire IV to VI tests</caption>
            <thead className={table.head}>
              <tr>
                <th scope="col" className={table.th}>Test</th>
                <th scope="col" className={cn(table.th, "text-right")}>O₂ (mole fraction)</th>
                <th scope="col" className={cn(table.th, "text-right")}>Pressure (mbar)</th>
                <th scope="col" className={cn(table.th, "text-right")}>Time to alarm (s)</th>
                <th scope="col" className={cn(table.th, "text-right")}>Heat release at alarm (W)</th>
                <th scope="col" className={cn(table.th, "text-right")}>CO rise, alarm / maximum (ppm)</th>
                <th scope="col" className={cn(table.th, "text-right")}>CO₂ rise, alarm / maximum (mmHg)</th>
              </tr>
            </thead>
            <tbody>
              {SAFFIRE_IV_VI_EMISSION.map((test) => (
                <tr key={test.id} className={table.tr}>
                  <th scope="row" className={cn(table.td, "min-w-40 font-normal text-foreground")}>
                    {test.id}
                    <span className="block text-[12px] text-text-tertiary">{material(test)}</span>
                  </th>
                  <td className={table.num}>{test.oxygenMolFraction.toFixed(2)}</td>
                  <td className={table.num}>{test.pressureMbar}</td>
                  <td className={cn(table.num, "whitespace-nowrap")}>{test.timeToAlarmS}</td>
                  <td className={cn(table.num, "whitespace-nowrap")}>{test.hrrAtAlarmW ?? dash}</td>
                  <td className={cn(table.num, "whitespace-nowrap")}>
                    <Flagged value={test.coRiseAtAlarmPpm} over={coFlag(test.coRiseAtAlarmPpm)} label="the CO limit" /> /{" "}
                    <Flagged value={test.maxCoRisePpm} over={coFlag(test.maxCoRisePpm)} label="the CO limit" />
                  </td>
                  <td className={cn(table.num, "whitespace-nowrap")}>
                    <Flagged value={test.co2RiseAtAlarmMmHg} over={co2Flag(test.co2RiseAtAlarmMmHg)} label="3 mmHg" digits={2} /> /{" "}
                    <Flagged value={test.maxCo2RiseMmHg} over={co2Flag(test.maxCo2RiseMmHg)} label="3 mmHg" digits={2} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="max-w-[62ch] text-sm leading-6 text-muted-foreground">
            <span className="text-foreground">A {SAFFIRE_IV_VI_EMISSION_META.alarmThresholdMgM3.value} mg/m³ threshold did not detect these fires before some cases passed the 24-hour CO limit.</span>{" "}
            The authors conclude that a lower threshold, or more detectors to shorten transport time, would be needed for this spacecraft.
          </p>
          <Note>
            Flags mark a rise above {CO_24H} ppm CO (&gt; 24 h, the 24-hour SMAC), {CO_1H} ppm (&gt; 1 h, the 1-hour SMAC) or {CO2_MMHG} mmHg CO₂ (the 1-hour average limit). The limits are
            exposure averages, so a flag marks a rise above the value, not a determined exposure violation. The detector sat on a direct path from the
            fire, so smoke arrived with little delay; detection is likely quicker here than in many spacecraft. These far-field maxima and peak heat release values
            differ from the ICES-2024-365 values the model is compared with (for example VI-3 peak heat release of 3240 W against 3080 W), and the two sets are kept separate.
          </Note>
        </div>
      </Panel>

      <Panel
        title="Flame growth in Saffire IV–VI"
        description="Acrylic flames stayed anchored at the leading edge and grew as the material regressed. Thin fabrics spread."
        actions={
          <button type="button" className={actionClass("secondary")} onClick={exportCsv}>
            <Download className="size-4" aria-hidden="true" />
            Download table (CSV)
          </button>
        }
        flush
      >
        <div className="overflow-x-auto">
          <table className={table.root}>
            <caption className="sr-only">Flame growth rate, maximum flame length and thin-fuel spread rate in the seven Saffire IV to VI tests</caption>
            <thead className={table.head}>
              <tr>
                <th scope="col" className={table.th}>Test</th>
                <th scope="col" className={cn(table.th, "text-right")}>Flame length growth (mm/s)</th>
                <th scope="col" className={cn(table.th, "text-right")}>Maximum flame length (mm)</th>
                <th scope="col" className={cn(table.th, "text-right")}>Flame spread, thin fabric (mm/s)</th>
                <th scope="col" className={cn(table.th, "text-right")}>Peak heat release (W)</th>
              </tr>
            </thead>
            <tbody>
              {SAFFIRE_IV_VI_EMISSION.map((test) => (
                <tr key={test.id} className={table.tr}>
                  <th scope="row" className={cn(table.td, "min-w-40 font-normal text-foreground")}>
                    {test.id}
                    <span className="block text-[12px] text-text-tertiary">{material(test)}</span>
                  </th>
                  <td className={table.num}>{test.flameGrowthRateMmS ?? dash}</td>
                  <td className={table.num}>{test.maxFlameLengthMm ?? dash}</td>
                  <td className={table.num}>{test.flameSpreadRateMmS ?? dash}</td>
                  <td className={table.num}>{test.peakHrrW ?? dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="max-w-[62ch] text-sm leading-6 text-muted-foreground">
            Acrylic flames grew linearly, at 0.22–0.38 mm/s, rather than accelerating as upward flames do in Earth gravity. One-sided samples began to
            plateau near 380 s (Saffire V) and 420 s (Saffire VI); two-sided samples were still growing at about 500 s.
          </p>
          <Note>
            All samples were {SAFFIRE_IV_VI_EMISSION_META.flow.widthCm} cm wide in {SAFFIRE_IV_VI_EMISSION_META.flow.speedCmS} cm/s flow. Acrylic was {SAFFIRE_IV_VI_EMISSION_META.pmmaLengthCm} cm long
            ({SAFFIRE_IV_VI_EMISSION_META.pmmaThicknessMm.oneSided} mm thick one-sided, {SAFFIRE_IV_VI_EMISSION_META.pmmaThicknessMm.twoSided} mm two-sided); fabrics were {SAFFIRE_IV_VI_EMISSION_META.thinFuelLengthCm} cm long.
            The paper&rsquo;s table caption says opposed flow, while the text and the earlier Saffire papers describe concurrent flow; IGNIS records the tests as concurrent.
          </Note>
        </div>
      </Panel>
    </>
  );
}
