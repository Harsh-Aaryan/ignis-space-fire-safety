import { FIRE_MODEL_VERSION, sourceById, type Cited } from "./sources";
import type { FireMaterial } from "./materials";
const UNITS: Record<string,string> = {
  heatOfCombustionMJkg:"MJ/kg", ignitionTempC:"°C", thermalInertia:"(kW/m² K)² s", criticalHeatFluxKwM2:"kW/m²",
  arealFuelKgM2:"kg/m²", loc1gPct:"vol % O₂", lowFlowMarginPct:"percentage points", co2Yield:"kg/kg", coYield1g:"kg/kg", sootYield:"kg/kg", radiativeFraction:"fraction", smokeCountMeanUm:"µm", smokeMassMeanUm:"µm", refMassFluxGm2s:"g/(m² s)", refSpreadMmS:"mm/s",
};
export function materialParameterRecords(m: FireMaterial) {
  const records = Object.entries(m).filter(([,value])=>value&&typeof value==="object"&&"source" in value).map(([key,value])=>{
    const v=value as Cited<unknown>;
    return { parameter:key,value:v.value,units:UNITS[key]??"unspecified",evidence:v.evidence??"assumed",source:sourceById(v.source).url,
      locator:v.locator,uncertainty:v.uncertainty,specimen:m.name,configuration:m.form,
      referencePressureKpa:key==="loc1gPct"?m.id==="pei"?70.3:101.325:null,
      conditions: v.source === "same-2" ? "Microgravity, below ignition, fresh versus aged 720 s; source airflow must be matched" : v.source === "bass-ii" ? "PMMA rod observation; not a slab or wire qualification" : v.source === "saffire-vi" ? "Microgravity, 0.2 m/s initial concurrent duct flow; original atmosphere/geometry in Tables 1–2" : "Refer to specimen-specific source; application transfer is not verified",
      applicability:"Source specimen and method required; arbitrary habitat transfer is exploratory",modelVersion:FIRE_MODEL_VERSION };
  });
  return [...records,{parameter:"specificHeatKJkgK",value:m.specificHeatKJkgK,units:"kJ/(kg K)",evidence:"assumed",source:null,locator:"Nominal value; primary table not verified",uncertainty:"Not quantified",specimen:m.name,configuration:m.form,referencePressureKpa:null,applicability:"Exploratory",modelVersion:FIRE_MODEL_VERSION}];
}
