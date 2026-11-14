/* Reproducible, read-only source audit. Uses the installed TypeScript compiler;
 * writes reports only under .qa-baseline. No application coefficients are fitted.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} }; cache.set(absolute, module);
  const source = fs.readFileSync(absolute, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const localRequire = specifier => {
    if (specifier.startsWith("@/")) return load(path.join("src", specifier.slice(2)) + ".ts");
    if (specifier.startsWith(".")) return load(path.resolve(path.dirname(absolute), specifier) + ".ts");
    return require(specifier);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: absolute })(localRequire, module, module.exports);
  return module.exports;
}
const { compareSaffireSummaries } = load("src/lib/fire/benchmarks.ts");
const { genericFireInput } = load("src/lib/fire/scenario.ts");
const { runFire } = load("src/lib/fire/model.ts");
const { makeZone, exchangeGas, equaliseGas, gasEnergy } = load("src/lib/fire/transport.ts");
const { FIRE_MODEL_VERSION } = load("src/data/fire/sources.ts");
const a = makeZone(10, 101.325, 21, 350), b = makeZone(10, 101.325, 21, 295.15);
const before = gasEnergy(a) + gasEnergy(b);
exchangeGas(a, b, .1, .25); equaliseGas(a, b);
const after = gasEnergy(a) + gasEnergy(b);
const comparisons = compareSaffireSummaries();
const scenario = { gravityG: .165, oxygenPct: 32, pressurePsi: 10.2, airflowMs: .05 };
const input = genericFireInput(scenario, "pmma", "hot-wire");
const steps = [.25, .125, .0625].map(dt => {
  const start = performance.now();
  const result = runFire(input, { durationS: 600, dt });
  const elapsedMs = performance.now() - start;
  return { dt, elapsedMs, simulatedSecondsPerWallSecond: 600 / (elapsedMs / 1000), heatJ: result.state.totalHeatJ, peakW: result.state.peakHrrW, ignitionS: result.state.ignitionTime, alarmS: result.state.firstAlarmTime, phase: result.state.phase };
});
const agentCases = ["co2", "water-mist", "halon"].map(id => {
  const s = runFire(input, { durationS: 300, actions: [{ t: 150, id: "power-off" }, { t: 150, id }] }).state;
  return { id, phase: s.phase, flameOutS: s.extinctionTime, residualSurfaceC: s.surfaceTempC, coPpm: s.coPpm, co2TotalMmHg: s.co2TotalMmHg, delivered: s.agent };
});
const report = { modelVersion: FIRE_MODEL_VERSION, generatedAt: new Date().toISOString(), interpretation: "Software verification and comparison; no independent predictive validation. Constant initial Saffire flow is not the complete flight fan history.", exchange: { beforeJ: before, afterJ: after, residualJ: after - before }, integration: steps, comparisons, agentCases };
fs.mkdirSync(path.join(root, ".qa-baseline"), { recursive: true });
fs.writeFileSync(path.join(root, ".qa-baseline", "v2-physics-audit.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
