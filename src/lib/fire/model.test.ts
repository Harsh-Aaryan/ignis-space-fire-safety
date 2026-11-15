import { describe, expect, it } from "vitest";
import { FIRE_MATERIALS, materialById } from "@/data/fire/materials";
import { FIRE_SOURCES, FIRE_MODEL_VERSION } from "@/data/fire/sources";
import { materialParameterRecords } from "@/data/fire/parameters";
import { ignitionById } from "@/data/fire/options";
import { createFireState, stepFire, runFire, ignitionDelayS, buoyantBaseVelocity } from "./model";
import { genericFireInput } from "./scenario";
import { reactionYields } from "./chemistry";
import { exchangeGas, equaliseGas, gasEnergy, gasPressure, makeZone, brownianDiffusivity, opticalOpacity } from "./transport";
import { heatSolid, thickIgnitionBenchmark } from "./thermal";
import { applicability } from "./evidence";
import { explainScenario } from "@/services/scenario-assistant";
const scenario={gravityG:0.165,oxygenPct:32,pressurePsi:10.2,airflowMs:.05};
const setup=()=>genericFireInput(scenario,"pmma","hot-wire");

describe("material provenance and scoped evidence",()=>{
  it("retains all twelve profiles and gives every value a registered source",()=>{
    expect(FIRE_MATERIALS).toHaveLength(12);
    for(const m of FIRE_MATERIALS) for(const v of Object.values(m)) if(v&&typeof v==="object"&&"source" in v)expect(FIRE_SOURCES.some(s=>s.id===(v as {source:string}).source)).toBe(true);
  });
  it("exports units, reference pressure, model version and uncertain inputs",()=>{
    const rows=materialParameterRecords(materialById("pei"));
    expect(rows.find(r=>r.parameter==="loc1gPct")?.referencePressureKpa).toBe(70.3);
    expect(rows.find(r=>r.parameter==="specificHeatKJkgK")?.evidence).toBe("assumed");
    expect(rows.every(r=>r.modelVersion===FIRE_MODEL_VERSION&&r.units&&r.uncertainty)).toBe(true);
  });
  it("does not call partial-g simulations validated",()=>{
    expect(applicability(setup())).toMatchObject({independentValidation:false,status:"Exploratory / extrapolated"});
  });
});

describe("independent conservation checks",()=>{
  it.each([.001,.25,100])("conserves energy and species during unequal-temperature mixing, dt=%s",dt=>{
    const a=makeZone(10,101.325,21,350),b=makeZone(10,101.325,21,295.15);
    a.co=1;a.smokeKg=.002;
    const energy=gasEnergy(a)+gasEnergy(b),oxygen=a.o2+b.o2,smoke=a.smokeKg+b.smokeKg;
    for(let i=0;i<20;i++){exchangeGas(a,b,.1,dt);equaliseGas(a,b);}
    expect(gasEnergy(a)+gasEnergy(b)).toBeCloseTo(energy,6);
    expect(a.o2+b.o2).toBeCloseTo(oxygen,10);expect(a.smokeKg+b.smokeKg).toBeCloseTo(smoke,12);
    expect(gasPressure(a)).toBeCloseTo(gasPressure(b),9);
  });
  it.each(["pmma","sibal","paper","ldpe-wire"])("closes elemental mass for %s",id=>{
    for(const o2 of [5,12,21,32]){
      const y=reactionYields(materialById(id),o2),e=y.elements;
      expect(y.co2*12/44+y.co*12/28+y.soot).toBeCloseTo(e.c,12);
      expect(y.water*2/18).toBeCloseTo(e.h,12);
      expect(y.co2*32/44+y.co*16/28+y.water*16/18).toBeCloseTo(e.o+y.oxygen,12);
      expect(y.co2+y.co+y.soot+y.water+y.residue).toBeCloseTo(1+y.oxygen,12);
    }
  });
  it("tracks oxygen consumption and carbon over a complete coupled run",()=>{
    const input=setup(),s=runFire(input,{durationS:300}).state;
    const zones=[s.local,s.room,s.rest];
    const oxygenUsed=(s.initial.o2-zones.reduce((n,z)=>n+z.o2,0))*.032;
    expect(oxygenUsed).toBeCloseTo(s.cumulativeOxygenKg,9);
    const carbon=(zones.reduce((n,z)=>n+z.co2,0)-s.initial.co2)*.012+zones.reduce((n,z)=>n+z.co,0)*.012+zones.reduce((n,z)=>n+z.smokeKg,0)+s.removedSmokeKg;
    expect(carbon).toBeCloseTo(s.fuelBurnedKg*.6,9);
    expect(s.totalHeatJ).toBeCloseTo(s.fuelBurnedKg*input.material.heatOfCombustionMJkg.value*1e6,6);
    expect(s.fuelPyrolysedKg).toBeLessThanOrEqual(s.fuelTotalKg);
    const storedVapor = zones.reduce((n,z)=>n+z.vapor*.1,0);
    const condensedFuel = zones.reduce((n,z)=>n+z.aerosolFuelKg,0)+s.removedAerosolFuelKg;
    expect(s.fuelPyrolysedKg-s.fuelBurnedKg).toBeCloseTo(storedVapor+condensedFuel,9);
  });
  it("cannot burn when every oxygen inventory is depleted",()=>{
    const input=setup(),s=createFireState(input);s.phase="flaming";s.vaporFuelKg=.01;
    for(const z of [s.local,s.room,s.rest]){z.inert+=z.o2;z.o2=0;}
    for(let i=0;i<40;i++)stepFire(s,input,.125);
    expect(s.totalHeatJ).toBe(0);expect(s.phase).toBe("extinguished");
  });
});

describe("thermal physics and numerical convergence",()=>{
  it("reproduces the semi-infinite analytical ignition benchmark",()=>{
    expect(thickIgnitionBenchmark(1e6,300,30000)).toBeCloseTo(Math.PI*25,10);
  });
  it("conserves an isolated 1-D slab's sensible energy under conduction",()=>{
    const solid={temperaturesK:[500,400,300,300],thicknessM:.02,densityKgM3:1190,conductivityWMK:.2};
    const before=solid.temperaturesK.reduce((a,b)=>a+b,0);
    heatSolid(solid,1400,0,500,500,0,.01,0);
    expect(solid.temperaturesK.reduce((a,b)=>a+b,0)).toBeCloseTo(before,10);
    expect(solid.temperaturesK[0]).toBeLessThan(500);
    expect(solid.temperaturesK[2]).toBeGreaterThan(300);
  });
  it("retains thermal history when heating is removed",()=>{
    const input=setup(),s=createFireState(input);
    for(let i=0;i<40;i++)stepFire(s,input,.125);
    const warm=s.surfaceTempC;s.sourceActive=false;stepFire(s,input,.125);
    expect(s.surfaceTempC).toBeGreaterThan(22);expect(s.surfaceTempC).toBeLessThan(warm);
  });
  it("respects the finite energy of a short arc",()=>{
    const input={...setup(),ignition:ignitionById("short-circuit")};
    const s=runFire(input,{durationS:20,dt:.7}).state;
    expect(s.sourceEnergyJ).toBeCloseTo(450,8);expect(s.sourceActive).toBe(false);
    expect(s.ignitionTime).toBeNull();
  });
  it("keeps integrated heat stable when the integration step is halved",()=>{
    const a=runFire(setup(),{durationS:300,dt:.125}).state,b=runFire(setup(),{durationS:300,dt:.0625}).state;
    expect(a.totalHeatJ).toBeGreaterThan(1000);
    expect(Math.abs(a.totalHeatJ-b.totalHeatJ)/b.totalHeatJ).toBeLessThan(.01);
    expect(Math.abs(a.ignitionTime!-b.ignitionTime!)).toBeLessThan(.26);
  });
  it("heats a thin fuel faster than a slab for a short arc",()=>{
    const arc=ignitionById("short-circuit");
    expect(ignitionDelayS(materialById("paper"),arc,22,.05)).not.toBeNull();
    expect(ignitionDelayS(materialById("pmma"),arc,22,.05)).toBeNull();
  });
});

describe("transport and observed versus modeled behavior",()=>{
  it("has zero buoyant base velocity in freefall and finite partial-g velocity",()=>{
    expect(buoyantBaseVelocity(0,70)).toBe(0);expect(buoyantBaseVelocity(.165,70)).toBeGreaterThan(0);
  });
  it("separates aerosol Brownian diffusion from molecular gas diffusion",()=>{
    const d=brownianDiffusivity(.2e-6,295.15,101.325);
    expect(d).toBeGreaterThan(0);expect(d).toBeLessThan(1e-8);
    expect(Math.sqrt(6*d*60)).toBeLessThan(.001);
  });
  it("maps smoke opacity to concentration and path length",()=>{
    expect(opticalOpacity(0,1)).toBe(0);
    expect(opticalOpacity(1e-5,2)).toBeGreaterThan(opticalOpacity(1e-5,1));
    expect(opticalOpacity(1e-5,1)).toBeLessThan(1);
  });
  it("never invents a buoyant smoke layer in orbit",()=>{
    const input={...setup(),gravityG:0};
    const s=runFire(input,{durationS:120}).state;
    expect(s.layerHeightM).toBe(input.roomHeightM);expect(s.flame.flickerHz).toBe(0);
  });
  it("uses a labeled assumed return when no detector is modeled in the room",()=>{
    const input={...setup(),spatial:{origin:[0,1,0] as [number,number,number],flow:[0,0,1] as [number,number,number],size:[3,2.4,3] as [number,number,number],detectors:[],obstacles:[]}};
    const s=runFire(input,{durationS:20}).state;
    expect(s.detectorLocations[0].id).toBe("assumed-return");expect(Number.isFinite(s.transportS)).toBe(true);
  });
  it("bounds evaporated water and does not overcool the fuel below incoming water",()=>{
    const result=runFire(setup(),{durationS:300,actions:[{t:150,id:"power-off"},{t:150,id:"water-mist"}]}).state;
    expect(result.phase).toBe("extinguished");expect(result.surfaceTempC).toBeGreaterThanOrEqual(21.9);
    expect(result.agent.mistEvaporatedKg+result.agent.mistDepositedKg).toBeCloseTo(result.agent.mistReleasedKg,10);
    expect(result.agent.mistReleasedKg).toBeCloseTo(2.72,10);
  });
  it("answers from a captured scenario and real source IDs",()=>{
    const s=runFire(setup(),{durationS:20}).state;
    const answer=explainScenario("Explain this run",setup(),s);
    expect(answer.context).toContain("20.0 s");expect(answer.text).toContain("chemical HRR");
    expect(answer.sources.every(id=>FIRE_SOURCES.some(source=>source.id===id))).toBe(true);
    expect(explainScenario("stop ventilation",setup(),s).compareVentilation).toBe(true);
  });
});
