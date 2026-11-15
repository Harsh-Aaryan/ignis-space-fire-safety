import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { evaluateModel, summarizeAccuracy } from "@/lib/fire/benchmarks";

/**
 * Regenerates the model evaluation (calibration, leave-one-out and independent
 * checks). Skipped unless IGNIS_EVALUATE=1:
 *
 *   $env:IGNIS_EVALUATE=1; npx vitest run src/lib/fire/__probe/evaluate.test.ts
 *
 * Writes the result to IGNIS_EVALUATE_OUT if set. src/lib/fire/accuracy.ts holds the
 * committed copy; benchmarks.test.ts checks that it still matches.
 */
it.skipIf(!process.env.IGNIS_EVALUATE)("evaluate", () => {
  const evaluation = evaluateModel();
  const json = JSON.stringify({ evaluation, summary: summarizeAccuracy(evaluation) }, null, 1);
  if (process.env.IGNIS_EVALUATE_OUT) writeFileSync(process.env.IGNIS_EVALUATE_OUT, json);
  else console.log(json);
}, 300_000);
