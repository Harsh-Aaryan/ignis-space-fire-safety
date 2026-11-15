import { FLIGHT_OBSERVATIONS, SAFFIRE_BENCHMARKS, peakHrrAnalyses, type FlightObservation, type SaffireBenchmark } from "@/data/fire/options";
import type { AccuracyMetric, EvaluationRow, MetricAccuracy, ModelEvaluation } from "./benchmarks";
import { cfastComparisons } from "./cfast";
import type { FireInput } from "./model";

/**
 * Accuracy against published flight data, for the interface.
 *
 * EVALUATION_SNAPSHOT and ACCURACY_SUMMARY are a committed copy of evaluateModel() /
 * summarizeAccuracy() in benchmarks.ts (calibration, leave-one-out prediction and
 * independent checks take several minutes, too long for a page). benchmarks.test.ts re-runs
 * the evaluation and fails if this copy drifts.
 *
 * "In-sample": the calibrated coefficients were fitted to the rows being compared.
 * "Held-out": each Saffire row is predicted with coefficients re-fitted without it.
 * Temperatures are never fitted.
 */

// BEGIN GENERATED (scripts: src/lib/fire/__probe/evaluate.test.ts). Do not edit by hand;
// benchmarks.test.ts re-runs evaluateModel() and fails if these drift.
export const EVALUATION_SNAPSHOT: ModelEvaluation = {
  "inSampleCoefficients": {
    "sibalSpreadMmS": 4.6842283,
    "pmmaFluxGm2s": 0.82143178,
    "pmmaThickSpreadMmS": 0.5550148,
    "sibalCoCo2": 0.046455348,
    "pmmaCoCo2": 0.03769931
  },
  "rows": [
    {
      "id": "IV-1",
      "materialId": "sibal",
      "hrrBasis": "mean",
      "measured": {
        "hrrW": 3150,
        "heatKJ": 409,
        "co2Ppm": 1390,
        "coPpm": 80,
        "coCo2": 0.057553957,
        "durationS": 130,
        "outletRiseK": 25,
        "farFieldRiseK": 5
      },
      "inSample": {
        "hrrW": 3137.6974,
        "peakHrrW": 3849.5954,
        "heatKJ": 407.90067,
        "co2Ppm": 1275.0358,
        "coPpm": 67.674368,
        "coCo2": 0.053076445,
        "durationS": 121.5,
        "outletRiseK": 21.575238,
        "farFieldRiseK": 2.1789482,
        "pressureRiseMbar": 8.8553723
      },
      "heldOut": {
        "hrrW": 3137.0892,
        "peakHrrW": 4214.9537,
        "heatKJ": 407.8216,
        "co2Ppm": 1278.4213,
        "coPpm": 63.829624,
        "coCo2": 0.049928472,
        "durationS": 110.375,
        "outletRiseK": 23.417056,
        "farFieldRiseK": 2.2942121,
        "pressureRiseMbar": 9.2633973
      },
      "heldOutCoefficients": {
        "sibalSpreadMmS": 5.2125904,
        "pmmaFluxGm2s": 0.82143178,
        "pmmaThickSpreadMmS": 0.5550148,
        "sibalCoCo2": 0.042841355,
        "pmmaCoCo2": 0.03769931
      },
      "fixedByFuel": true
    },
    {
      "id": "VI-2",
      "materialId": "sibal",
      "hrrBasis": "peak",
      "measured": {
        "hrrW": 3217,
        "heatKJ": 580,
        "co2Ppm": 2800,
        "coPpm": 120,
        "coCo2": 0.042857143,
        "durationS": 112,
        "outletRiseK": 28,
        "farFieldRiseK": 0
      },
      "inSample": {
        "hrrW": 3869.7668,
        "peakHrrW": 3869.7668,
        "heatKJ": 374.98212,
        "co2Ppm": 2302.8863,
        "coPpm": 107.02102,
        "coCo2": 0.046472558,
        "durationS": 122.25,
        "outletRiseK": 23.608397,
        "farFieldRiseK": 1.679967,
        "pressureRiseMbar": 4.4413255
      },
      "heldOut": {
        "hrrW": 3614.0673,
        "peakHrrW": 3614.0673,
        "heatKJ": 350.00979,
        "co2Ppm": 2139.9131,
        "coPpm": 109.32277,
        "coCo2": 0.05108748,
        "durationS": 130.75,
        "outletRiseK": 22.451789,
        "farFieldRiseK": 1.5671222,
        "pressureRiseMbar": 4.1474137
      },
      "heldOutCoefficients": {
        "sibalSpreadMmS": 4.3202925,
        "pmmaFluxGm2s": 0.82143178,
        "pmmaThickSpreadMmS": 0.5550148,
        "sibalCoCo2": 0.051068432,
        "pmmaCoCo2": 0.03769931
      },
      "fixedByFuel": false
    },
    {
      "id": "VI-3",
      "materialId": "pmma",
      "hrrBasis": "peak",
      "measured": {
        "hrrW": 3080,
        "heatKJ": 1280,
        "co2Ppm": 8539,
        "coPpm": 308,
        "coCo2": 0.036069797,
        "durationS": null,
        "outletRiseK": 57,
        "farFieldRiseK": 1
      },
      "inSample": {
        "hrrW": 2839.6271,
        "peakHrrW": 2839.6271,
        "heatKJ": 1340.5218,
        "co2Ppm": 6561.7386,
        "coPpm": 247.43891,
        "coCo2": 0.037709352,
        "durationS": null,
        "outletRiseK": 21.04636,
        "farFieldRiseK": 2.4615112,
        "pressureRiseMbar": 6.8032807
      },
      "heldOut": {
        "hrrW": 1831.2357,
        "peakHrrW": 1831.2357,
        "heatKJ": 751.09048,
        "co2Ppm": 3665.9324,
        "coPpm": 144.52366,
        "coCo2": 0.039423439,
        "durationS": null,
        "outletRiseK": 14.305602,
        "farFieldRiseK": 1.34946,
        "pressureRiseMbar": 3.9181309
      },
      "heldOutCoefficients": {
        "sibalSpreadMmS": 4.6842283,
        "pmmaFluxGm2s": 0.87078668,
        "pmmaThickSpreadMmS": 0.2071788,
        "sibalCoCo2": 0.046455348,
        "pmmaCoCo2": 0.039412901
      },
      "fixedByFuel": false
    },
    {
      "id": "VI-4",
      "materialId": "pmma",
      "hrrBasis": "peak",
      "measured": {
        "hrrW": 1507,
        "heatKJ": 830,
        "co2Ppm": 8117,
        "coPpm": 320,
        "coCo2": 0.039423432,
        "durationS": null,
        "outletRiseK": 37,
        "farFieldRiseK": 1
      },
      "inSample": {
        "hrrW": 1440.4513,
        "peakHrrW": 1440.4513,
        "heatKJ": 1488.0514,
        "co2Ppm": 7243.5718,
        "coPpm": 273.1504,
        "coCo2": 0.037709352,
        "durationS": null,
        "outletRiseK": 13.01011,
        "farFieldRiseK": 2.7608119,
        "pressureRiseMbar": 7.9835509
      },
      "heldOut": {
        "hrrW": 1569.2875,
        "peakHrrW": 1569.2875,
        "heatKJ": 1643.0439,
        "co2Ppm": 8007.1668,
        "coPpm": 288.81688,
        "coCo2": 0.036069797,
        "durationS": null,
        "outletRiseK": 14.069004,
        "farFieldRiseK": 3.0387193,
        "pressureRiseMbar": 8.7937577
      },
      "heldOutCoefficients": {
        "sibalSpreadMmS": 4.6842283,
        "pmmaFluxGm2s": 0.8995988,
        "pmmaThickSpreadMmS": 0.61885743,
        "sibalCoCo2": 0.046455348,
        "pmmaCoCo2": 0.036060219
      },
      "fixedByFuel": false
    }
  ],
  "independent": [
    {
      "id": "Saffire-I S1",
      "source": "psi-saffire-i",
      "quantity": "Burn time, 94 cm SIBAL, concurrent",
      "unit": "s",
      "measured": "420",
      "model": "230",
      "errorPct": -45.178571,
      "verdict": "partly agrees",
      "note": "Model spread is calibrated to Saffire VI IV-1 and VI-2, which imply a faster front than Saffire-I at nearly the same oxygen, pressure and flow."
    },
    {
      "id": "Saffire-I S2",
      "source": "saffire-i-iii-matrix",
      "quantity": "Burn time, remaining ~10 cm SIBAL, opposed flow",
      "unit": "s",
      "measured": "70",
      "model": "39",
      "errorPct": -44.285714,
      "verdict": "partly agrees",
      "note": "NASA's test matrix specifies approximately 10 cm of remaining fuel for the second ignition. The earlier 94 cm comparison used the original sheet size. The opposed/concurrent spread ratio (0.65) remains assumed."
    },
    {
      "id": "Saffire-II 2-5",
      "source": "psi-saffire-ii",
      "quantity": "Mean concurrent spread rate, 5 cm SIBAL strip",
      "unit": "mm/s",
      "measured": "2.1",
      "model": "4.46",
      "errorPct": 112.45421,
      "verdict": "disagrees",
      "note": "Narrow strip: side losses can slow the real flame; the model has no width effect. The same rows' burn time minus travel time sets the thin-fuel burnout flux, so their burn time is not an independent check."
    },
    {
      "id": "Saffire-II 2-6",
      "source": "psi-saffire-ii",
      "quantity": "Mean concurrent spread rate, 5 cm SIBAL strip",
      "unit": "mm/s",
      "measured": "2.6",
      "model": "5.00",
      "errorPct": 92.307692,
      "verdict": "disagrees",
      "note": "Narrow strip: side losses can slow the real flame; the model has no width effect. The same rows' burn time minus travel time sets the thin-fuel burnout flux, so their burn time is not an independent check."
    },
    {
      "id": "Saffire-II 2-8",
      "source": "psi-saffire-ii",
      "quantity": "Involved length after 600 s, PMMA",
      "unit": "cm",
      "measured": "~10",
      "model": "29.0",
      "errorPct": 190,
      "verdict": "disagrees",
      "note": "Tests the calibrated thick-fuel growth law at 22 % O₂ and about 101 kPa, outside the Saffire VI fitting conditions (29–30 % O₂, 55 kPa). Damage length is approximate and taken as the involved length."
    },
    {
      "id": "Saffire-II 2-9",
      "source": "psi-saffire-ii",
      "quantity": "Involved length after 900 s, PMMA",
      "unit": "cm",
      "measured": "~10",
      "model": "29.0",
      "errorPct": 190,
      "verdict": "disagrees",
      "note": "Tests the calibrated thick-fuel growth law at 22 % O₂ and about 101 kPa, outside the Saffire VI fitting conditions (29–30 % O₂, 55 kPa). Damage length is approximate and taken as the involved length."
    },
    {
      "id": "Saffire-II 2-1 to 2-4",
      "source": "psi-saffire-ii",
      "quantity": "Sustained flame on thin silicone",
      "unit": "",
      "measured": "insignificant burn",
      "model": "no flame",
      "errorPct": null,
      "verdict": "uninformative",
      "note": "Consistent, but for the wrong reason: silicone flaming chemistry is withheld in the model. Its modelled oxygen limit at 20 cm/s (20.6 %) is below the 21.5–22.1 % flight oxygen, so the limit alone would allow burning."
    },
    {
      "id": "BASS-II PMMA",
      "source": "psi-bass-ii",
      "quantity": "CO/CO₂ molar ratio, PMMA, initial O₂ ≥ 20.5 % (11 runs)",
      "unit": "%",
      "measured": "3.40 (IQR 3.12–3.67)",
      "model": "3.77",
      "errorPct": 10.880323,
      "verdict": "agrees",
      "note": "Small glovebox samples at 1 atm. The low-oxygen BASS-II runs set the CO starvation gain and are not counted here."
    },
    {
      "id": "BASS-II SIBAL",
      "source": "psi-bass-ii",
      "quantity": "CO/CO₂ molar ratio, SIBAL, all valid runs (4 runs)",
      "unit": "%",
      "measured": "5.83 (IQR 4.64–6.95)",
      "model": "5.77",
      "errorPct": -0.98962051,
      "verdict": "agrees",
      "note": "Evaluated at the runs' median initial oxygen (18.75 %). Four runs with 500–700 ppm CO₂ rises: ±15–20 % quantisation per run."
    },
    {
      "id": "IV-1 spread rate",
      "source": "saffire-iv-vi-emission",
      "quantity": "Mean thin-fuel spread rate, SIBAL",
      "unit": "mm/s",
      "measured": "3.60",
      "model": "4.17",
      "errorPct": 15.740741,
      "verdict": "agrees",
      "basis": "in-sample consistency",
      "note": "The SIBAL spread rate was calibrated to the burn durations of IV-1 and VI-2 (130 s over 50 cm, an average 3.8 mm/s including burnout), so agreement with this table is expected and is not an independent test. Re-fitted without this test (the other SIBAL test only) the model gives 4.59 mm/s."
    },
    {
      "id": "VI-2 spread rate",
      "source": "saffire-iv-vi-emission",
      "quantity": "Mean thin-fuel spread rate, SIBAL",
      "unit": "mm/s",
      "measured": "4.05",
      "model": "4.12",
      "errorPct": 1.6105269,
      "verdict": "agrees",
      "basis": "in-sample consistency",
      "note": "The SIBAL spread rate was calibrated to the burn durations of IV-1 and VI-2 (112 s over 50 cm, an average 4.5 mm/s including burnout), so agreement with this table is expected and is not an independent test. Re-fitted without this test (the other SIBAL test only) the model gives 3.85 mm/s."
    },
    {
      "id": "V-2 spread rate",
      "source": "saffire-iv-vi-emission",
      "quantity": "Thin-fuel spread rate, cotton t-shirt fabric (context)",
      "unit": "mm/s",
      "measured": "3.40",
      "model": "not modelled",
      "errorPct": null,
      "verdict": "uninformative",
      "basis": "context",
      "note": "Cotton t-shirt fabric is not SIBAL (a cotton/fiberglass blend) and has no material profile, so it is excluded from the model and shown as published context."
    },
    {
      "id": "IV-1 / VI-2 / VI-3 / VI-4 pressure rise",
      "source": "saffire-iv-vi-emission",
      "quantity": "Cabin pressure rise (IV-1 / VI-2 / VI-3 / VI-4)",
      "unit": "mbar",
      "measured": "0.33 / 0.31 / 0.34 / 0.25",
      "model": "8.9 / 4.4 / 6.8 / 8.0",
      "errorPct": 2242.2055,
      "verdict": "disagrees",
      "basis": "held-out",
      "note": "Maximum pressure increase in the cabin (a single value, not a point-sensor reading). The model treats the cabin as a sealed gas volume whose only heat sink is an assumed lumped wall; the flight cabin held cargo bags and trash that may absorb heat, and its leakage is unknown. Error is the median over the four tests."
    },
    {
      "id": "IV-1 / VI-2 / VI-3 / VI-4 temperature rise",
      "source": "saffire-iv-vi-emission",
      "quantity": "Far-field temperature rise (IV-1 / VI-2 / VI-3 / VI-4)",
      "unit": "K",
      "measured": "0.25 / 0.29 / 0.50 / 0.25",
      "model": "2.2 / 1.7 / 2.5 / 2.8",
      "errorPct": 625.43911,
      "verdict": "disagrees",
      "basis": "held-out",
      "note": "The measurement is a point reading at the Far Field Diagnostics beside the air intake, a rise of 0.25–0.50 K; the model value is a cabin-average peak and the wall heat transfer is assumed. NIST CFAST on the same heat release gives 6.8–10.7 K. Error is the median over the four tests."
    },
    {
      "id": "VI-3 smoke alarm 2 mg/m³",
      "source": "saffire-iv-vi-emission",
      "quantity": "Time from ignition to 2 mg/m³ total particulate at the far-field detector, VI-3",
      "unit": "s",
      "measured": "400",
      "model": "93",
      "errorPct": -76.84375,
      "verdict": "disagrees",
      "basis": "held-out",
      "note": "Experiment clock: ignition at 637 s (NASA ICES-2024 presentation), alarm at 1037 s. The model's cabin-average concentration reaches 2 mg/m³ 83 s after ignition, at its far-field detector 93 s. Soot yield (0.022) is a handbook value, not fitted to any Saffire test. The model reaches the level sooner than flight, so its alarm time is not conservative for detection. The presentation does not say whether its ignition time marks heater start or flame; the 60 s ignition period bounds the difference."
    },
    {
      "id": "VI-3 smoke alarm 1 mg/m³",
      "source": "saffire-vi",
      "quantity": "Time from ignition to 1 mg/m³ total particulate at the far-field detector, VI-3",
      "unit": "s",
      "measured": "344",
      "model": "66",
      "errorPct": -80.850291,
      "verdict": "disagrees",
      "basis": "held-out",
      "note": "Experiment clock: ignition at 637 s (NASA ICES-2024 presentation), alarm at 981 s. The model's cabin-average concentration reaches 1 mg/m³ 57 s after ignition, at its far-field detector 66 s. Soot yield (0.022) is a handbook value, not fitted to any Saffire test. The model reaches the level sooner than flight, so its alarm time is not conservative for detection. The presentation does not say whether its ignition time marks heater start or flame; the 60 s ignition period bounds the difference."
    }
  ],
  "consistency": {
    "rows": [
      {
        "id": "IV-1",
        "publishedHeatKJ": 409,
        "carbonHeatKJ": 428.47687,
        "ratio": 1.0476207,
        "co2PpmPerKJ": 3.398533
      },
      {
        "id": "VI-2",
        "publishedHeatKJ": 580,
        "carbonHeatKJ": 429.58945,
        "ratio": 0.74067146,
        "co2PpmPerKJ": 4.8275862
      },
      {
        "id": "VI-3",
        "publishedHeatKJ": 1280,
        "carbonHeatKJ": 1654.8211,
        "ratio": 1.292829,
        "co2PpmPerKJ": 6.6710937
      },
      {
        "id": "VI-4",
        "publishedHeatKJ": 830,
        "carbonHeatKJ": 1595.4732,
        "ratio": 1.9222569,
        "co2PpmPerKJ": 9.7795181
      }
    ],
    "vi2FuelConsumptionKJ": 409,
    "heatBandPct": 27.607878,
    "heatRangePct": [
      4.7620705,
      92.225689
    ],
    "coBandPct": 17.146283
  },
  "thickGrowth": [
    {
      "id": "VI-3",
      "sampleLengthMm": 180,
      "modelRateMmS": 0.55102041,
      "accelerationRatio": 0.92628993,
      "reachesSampleEndS": 324.625,
      "measuredGrowthMmS": 0.38,
      "measuredMaxFlameLengthMm": 89.9
    },
    {
      "id": "VI-4",
      "sampleLengthMm": 180,
      "modelRateMmS": 0.53465347,
      "accelerationRatio": 0.96116505,
      "reachesSampleEndS": 331.375,
      "measuredGrowthMmS": 0.27,
      "measuredMaxFlameLengthMm": 93.3
    }
  ]
};

export const ACCURACY_SUMMARY: MetricAccuracy[] = [
  {
    "metric": "hrr",
    "label": "Heat release rate",
    "unit": "%",
    "inSample": {
      "medianAbs": 7.8043133,
      "maxAbs": 20.291166,
      "n": 3
    },
    "heldOut": {
      "medianAbs": 12.342781,
      "maxAbs": 40.544294,
      "n": 3
    },
    "established": true,
    "excluded": [
      "IV-1: published heat and mean heat release equal fuel mass × ΔHc, and ΔHc comes from the same table, so the comparison is fixed, not a test."
    ],
    "applicability": "0 g; SIBAL 41 cm × 50 cm and PMMA 41 cm × 18 cm; near the oxygen and pressure of a Saffire VI test; matching concurrent-flow history. VI-4 airflow history remains incomplete.",
    "note": "Peak or mean heat release as published.",
    "dataBand": 27.607878,
    "fitted": true
  },
  {
    "metric": "heat",
    "label": "Total heat",
    "unit": "%",
    "inSample": {
      "medianAbs": 35.347911,
      "maxAbs": 79.283303,
      "n": 3
    },
    "heldOut": {
      "medianAbs": 41.321057,
      "maxAbs": 97.957093,
      "n": 3
    },
    "established": true,
    "excluded": [
      "IV-1: published heat and mean heat release equal fuel mass × ΔHc, and ΔHc comes from the same table, so the comparison is fixed, not a test."
    ],
    "applicability": "0 g; SIBAL 41 cm × 50 cm and PMMA 41 cm × 18 cm; near the oxygen and pressure of a Saffire VI test; matching concurrent-flow history. VI-4 airflow history remains incomplete.",
    "note": "Heat at the published duration.",
    "dataBand": 27.607878,
    "fitted": true
  },
  {
    "metric": "co2",
    "label": "CO₂ rise",
    "unit": "%",
    "inSample": {
      "medianAbs": 14.257271,
      "maxAbs": 23.155656,
      "n": 4
    },
    "heldOut": {
      "medianAbs": 15.800887,
      "maxAbs": 57.068364,
      "n": 4
    },
    "established": true,
    "excluded": [],
    "applicability": "0 g; SIBAL 41 cm × 50 cm and PMMA 41 cm × 18 cm; near the oxygen and pressure of a Saffire VI test; matching concurrent-flow history. VI-4 airflow history remains incomplete.",
    "note": "Cabin CO₂ rise at the published duration.",
    "dataBand": 27.607878,
    "fitted": true
  },
  {
    "metric": "co",
    "label": "CO rise",
    "unit": "%",
    "inSample": {
      "medianAbs": 15.023771,
      "maxAbs": 19.662692,
      "n": 4
    },
    "heldOut": {
      "medianAbs": 14.978847,
      "maxAbs": 53.076733,
      "n": 4
    },
    "established": true,
    "excluded": [],
    "applicability": "0 g; SIBAL 41 cm × 50 cm and PMMA 41 cm × 18 cm; near the oxygen and pressure of a Saffire VI test; matching concurrent-flow history. VI-4 airflow history remains incomplete.",
    "note": "Cabin CO rise at the published duration.",
    "dataBand": 32.499076,
    "fitted": true
  },
  {
    "metric": "coRatio",
    "label": "CO/CO₂ ratio",
    "unit": "%",
    "inSample": {
      "medianAbs": 6.1625912,
      "maxAbs": 8.4359678,
      "n": 4
    },
    "heldOut": {
      "medianAbs": 11.273462,
      "maxAbs": 19.204119,
      "n": 4
    },
    "established": true,
    "excluded": [],
    "applicability": "0 g; SIBAL 41 cm × 50 cm and PMMA 41 cm × 18 cm; near the oxygen and pressure of a Saffire VI test; matching concurrent-flow history. VI-4 airflow history remains incomplete.",
    "note": "Ratio fitted to the four Saffire VI tests; BASS-II glovebox runs agree independently.",
    "dataBand": 17.146283,
    "fitted": true
  },
  {
    "metric": "duration",
    "label": "SIBAL burn duration",
    "unit": "%",
    "inSample": {
      "medianAbs": 7.8451236,
      "maxAbs": 9.1517857,
      "n": 2
    },
    "heldOut": {
      "medianAbs": 15.918613,
      "maxAbs": 16.741071,
      "n": 2
    },
    "established": true,
    "excluded": [],
    "applicability": "0 g SIBAL, 41 cm × 50 cm samples (IV-1, VI-2).",
    "note": "Ignition to flame-out.",
    "dataBand": null,
    "fitted": true
  },
  {
    "metric": "farField",
    "label": "Cabin temperature rise",
    "unit": "K",
    "inSample": {
      "medianAbs": 1.7203894,
      "maxAbs": 2.8210518,
      "n": 4
    },
    "heldOut": {
      "medianAbs": 1.8029207,
      "maxAbs": 2.7057879,
      "n": 4
    },
    "established": false,
    "excluded": [],
    "applicability": "Saffire far-field maxima, 1 °C resolution, starting temperature assumed 20 °C.",
    "note": "Not established. The flight signals are 0–5 K point readings against an assumed 20 °C start, and NIST CFAST gives several times the IGNIS cabin rise on identical heat release (src/data/fire/cfast-reference.json). Wall heat transfer is assumed. ICES-2026-577 reports the rises directly (0.25–0.50 K at the far-field detector for these four tests) and both models give larger rises; see the independent checks.",
    "dataBand": 1,
    "fitted": false
  },
  {
    "metric": "outlet",
    "label": "Duct outlet temperature rise",
    "unit": "%",
    "inSample": {
      "medianAbs": 39.380428,
      "maxAbs": 64.837539,
      "n": 4
    },
    "heldOut": {
      "medianAbs": 40.895352,
      "maxAbs": 74.902453,
      "n": 4
    },
    "established": false,
    "excluded": [],
    "applicability": "Molar-flow-weighted source/bypass mixing after modeled fuel and wall losses; a point thermocouple need not read the mixed mean. Duct geometry is unresolved.",
    "note": "Not established: source/bypass mixing after modeled wall losses gives 0.4–0.9 times the measured outlet rise. Duct geometry and sensor position remain unresolved.",
    "dataBand": null,
    "fitted": false
  }
];
// END GENERATED

/** Model 2.1.0 against the same published rows, measured with the 2.1.0 code before the
 * 3.0.0 changes: published / modelled. Kept for the before-and-after record. */
export const PREVIOUS_MODEL_COMPARISON = [
  { id: "IV-1", hrrW: [3150, 813], heatKJ: [409, 103], co2Ppm: [1390, 335], coPpm: [80, 1] },
  { id: "VI-2", hrrW: [3217, 1108], heatKJ: [580, 105], co2Ppm: [2800, 681], coPpm: [120, 3] },
  { id: "VI-3", hrrW: [3080, 1520], heatKJ: [1280, 829], co2Ppm: [8539, 4204], coPpm: [308, 31] },
  { id: "VI-4", hrrW: [1507, 931], heatKJ: [830, 778], co2Ppm: [8117, 3909], coPpm: [320, 29] },
] as const;

export function accuracyFor(metric: AccuracyMetric): MetricAccuracy {
  return ACCURACY_SUMMARY.find((item) => item.metric === metric)!;
}

/**
 * How close a run must be to one actual Saffire VI test for that test's held-out error to
 * apply. Oxygen and pressure must both be near the SAME test; flow concurrent at about
 * 20 cm/s; 0 g; same material; sample width and length near the tested sample (41 cm ×
 * 50 cm SIBAL, 41 cm × 18 cm PMMA) and, for PMMA, the same number of burning sides (the
 * one-sided 0.5 cm and two-sided 1 cm slabs). Anything else is extrapolated.
 */
export const SAFFIRE_VI_NEIGHBOURHOOD = {
  gravityG: 0,
  oxygenPoints: 1,
  pressureFraction: 0.05,
  flowMs: 0.2,
  flowFraction: 0.1,
  sizeFraction: 0.1,
  orientation: "concurrent",
} as const;

export type CoverageInput = Pick<FireInput, "gravityG" | "material" | "oxygenPct" | "pressureKpa" | "ventilationMs" | "fuel"> & Partial<Pick<FireInput, "flowOrientation" | "ventilationSchedule">>;

export type Coverage =
  | { kind: "saffire-vi"; rowId: string }
  | { kind: "flight"; checkId: string; verdict: string; summary: string }
  | { kind: "extrapolated"; reason: string };

const near = (value: number, reference: number, fraction: number) => Math.abs(value - reference) <= fraction * reference + 1e-9;
const orientationOf = (input: CoverageInput) => input.flowOrientation ?? "concurrent";

function nearSaffireVi(input: CoverageInput, row: SaffireBenchmark) {
  const n = SAFFIRE_VI_NEIGHBOURHOOD;
  return input.material.id === row.materialId
    && Math.abs(input.oxygenPct - row.oxygenPct) <= n.oxygenPoints + 1e-9
    && near(input.pressureKpa, row.pressureKpa, n.pressureFraction)
    && near(input.fuel.widthM, row.widthM, n.sizeFraction)
    && near(input.fuel.lengthM, row.lengthM, n.sizeFraction)
    && (row.materialId !== "pmma" || input.fuel.sides === row.sides);
}

function nearFlightObservation(input: CoverageInput, row: FlightObservation) {
  const n = SAFFIRE_VI_NEIGHBOURHOOD;
  return input.material.id === row.materialId
    && orientationOf(input) === row.flow
    && !input.ventilationSchedule?.length
    && near(input.ventilationMs, row.reproduction?.flowMs ?? row.flowMs, n.flowFraction)
    && Math.abs(input.oxygenPct - row.oxygenPct) <= n.oxygenPoints + 1e-9
    && near(input.pressureKpa, row.pressureKpa, n.pressureFraction)
    && near(input.fuel.widthM, row.widthM, n.sizeFraction)
    && near(input.fuel.lengthM, row.reproduction?.lengthM ?? row.lengthM, n.sizeFraction);
}

/** Which flight comparison, if any, covers a run. A Saffire VI neighbour carries that
 * evaluation's held-out error. A run near a Saffire-I or Saffire-II test carries that
 * test's independent check instead (currently every one disagrees). Otherwise the result
 * is extrapolated, with the first reason that applies. */
export function testCoverage(input: CoverageInput): Coverage {
  const n = SAFFIRE_VI_NEIGHBOURHOOD;
  if (input.gravityG === n.gravityG) {
    for (const observation of FLIGHT_OBSERVATIONS) {
      if (!nearFlightObservation(input, observation)) continue;
      const check = EVALUATION_SNAPSHOT.independent.find((item) => item.id === observation.id);
      if (check && check.verdict !== "uninformative") return { kind: "flight", checkId: check.id, verdict: check.verdict, summary: `${check.quantity}: measured ${check.measured}${check.unit ? ` ${check.unit}` : ""}, model ${check.model}${check.unit ? ` ${check.unit}` : ""}` };
    }
  }
  if (input.gravityG !== n.gravityG) return { kind: "extrapolated", reason: "untested at this gravity" };
  if (!SAFFIRE_BENCHMARKS.some((row) => row.materialId === input.material.id)) return { kind: "extrapolated", reason: "untested for this material" };
  if (orientationOf(input) !== n.orientation) return { kind: "extrapolated", reason: "untested in opposed or cross flow" };
  if (!near(input.ventilationMs, n.flowMs, n.flowFraction)) return { kind: "extrapolated", reason: "airflow differs from the 20 cm/s Saffire tests" };
  const sameMaterial = SAFFIRE_BENCHMARKS.filter((row) => row.materialId === input.material.id);
  const sized = sameMaterial.filter((row) => near(input.fuel.widthM, row.widthM, n.sizeFraction) && near(input.fuel.lengthM, row.lengthM, n.sizeFraction) && (row.materialId !== "pmma" || input.fuel.sides === row.sides));
  if (!sized.length) return { kind: "extrapolated", reason: "sample size differs from the Saffire VI samples" };
  const match = sized.find((row) => nearSaffireVi(input, row));
  if (!match) return { kind: "extrapolated", reason: "no Saffire VI test at this oxygen and pressure" };
  // The 2026 follow-up reports 900 s of initial flow for VI-4, but does not give
  // its complete subsequent commands. Matching the initial speed is insufficient.
  if (match.id === "VI-4") return { kind: "extrapolated", reason: "the complete Saffire VI-4 airflow history is unavailable" };
  const actual = input.ventilationSchedule ?? [], expected = match.ventilationSchedule ?? [];
  if (actual.length !== expected.length || actual.some((step, i) => Math.abs(step.afterIgnitionS - expected[i].afterIgnitionS) > 1e-9 || Math.abs(step.speedMs - expected[i].speedMs) > 1e-9)) {
    return { kind: "extrapolated", reason: "airflow history differs from the published Saffire test" };
  }
  return { kind: "saffire-vi", rowId: match.id };
}

/** Whether the modeled peak heat release falls inside the range spanned by NASA's two analyses of the same
 * test (ICES-2024-365 and ICES-2026-577). The primary error stays against the 2024 calibration value; this is
 * reported beside it and does not change any pass or fail threshold. Only tests with a peak in both papers. */
export function peakHrrRangeStatus(rows: ReadonlyArray<Pick<EvaluationRow, "id" | "inSample" | "heldOut">>) {
  return rows.flatMap((row) => {
    const range = peakHrrAnalyses(row.id);
    if (!range) return [];
    const inside = (w: number) => w >= range.lowW && w <= range.highW;
    return [{ id: row.id, ...range, inSampleW: row.inSample.peakHrrW, heldOutW: row.heldOut.peakHrrW, inSampleInside: inside(row.inSample.peakHrrW), heldOutInside: inside(row.heldOut.peakHrrW) }];
  });
}

/** Peak cabin rise of NIST CFAST over IGNIS on identical heat release, Saffire cases. */
export function cfastTemperatureGap() {
  const pairs = cfastComparisons().filter((c) => c.sameHeatRelease && c.gravityG === 0 && c.caseId.startsWith("saffire") && c.ignisPeakRiseC && c.ignisPeakRiseC > 0);
  if (!pairs.length) return null;
  const ratios = pairs.map((c) => c.cfastPeakRiseC / c.ignisPeakRiseC!);
  return { low: Math.min(...ratios), high: Math.max(...ratios), cases: pairs.length };
}

export type CueQuantity = "hrr" | "heat" | "co" | "co2" | "temperature";
const CUE_METRIC: Record<CueQuantity, AccuracyMetric> = { hrr: "hrr", heat: "heat", co: "co", co2: "co2", temperature: "farField" };

export interface AccuracyCue {
  /** A Saffire VI neighbour, so the held-out error applies. */
  tested: boolean;
  /** A few characters for the telemetry strip, e.g. "±13 %", "extrapolated", "disagrees". */
  short: string;
  /** A phrase for stat notes, e.g. "±13 % vs Saffire, held-out". */
  label: string;
  /** A sentence for tooltips and the run review. */
  long: string;
  /** Typical relative uncertainty for rounding, or null when untested. */
  relative: number | null;
}

const capital = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}`;

/** Accuracy cue for a displayed quantity. Cabin temperature is never established. Elsewhere
 * a Saffire VI neighbour carries the metric's held-out error, a Saffire-I or -II neighbour
 * carries that test's disagreement, and anything else is labelled extrapolated. */
export function accuracyCue(quantity: CueQuantity, input: CoverageInput): AccuracyCue {
  const a = accuracyFor(CUE_METRIC[quantity]);
  if (!a.established) {
    const gap = cfastTemperatureGap();
    const cfast = gap ? ` On identical heat release NIST CFAST gives ${gap.low.toFixed(0)}–${gap.high.toFixed(0)} times the IGNIS cabin rise for the Saffire cases.` : "";
    return { tested: false, short: "not established", label: "Accuracy not established", long: `${a.label}: accuracy not established. Saffire far-field rises are 0–5 K point readings against an assumed 20 °C start, and the wall heat transfer is assumed.${cfast}`, relative: null };
  }
  const coverage = testCoverage(input);
  if (coverage.kind === "extrapolated") return { tested: false, short: "extrapolated", label: `${capital(coverage.reason)} — extrapolated`, long: `${capital(coverage.reason)}: extrapolated, no flight comparison applies.`, relative: null };
  if (coverage.kind === "flight") return { tested: false, short: coverage.verdict, label: `Near ${coverage.checkId} — model ${coverage.verdict}`, long: `Closest flight test is ${coverage.checkId}, which the model ${coverage.verdict === "disagrees" ? "does not reproduce" : "only partly reproduces"}: ${coverage.summary}.`, relative: null };
  const k = a.heldOut;
  const median = Math.max(1, Math.round(k.medianAbs));
  const range = quantity === "hrr" ? peakHrrAnalyses(coverage.rowId) : null;
  const rangeNote = range ? ` NASA's two analyses of this test's peak (ICES-2024-365 and ICES-2026-577) give ${range.lowW}–${range.highW} W; the error above is against the ICES-2024 value of ${range.ices2024W} W.` : "";
  const excluded = a.excluded.length ? ` ${a.excluded.length} test${a.excluded.length > 1 ? "s" : ""} excluded: ${a.excluded.join(" ")}` : "";
  return {
    tested: true,
    short: `±${median} %`,
    label: `±${median} % vs Saffire, held-out`,
    long: `Nearest flight test ${coverage.rowId}. ${a.label}: held-out error against ${k.n} Saffire VI tests is ${k.medianAbs.toFixed(0)} % median, ${k.maxAbs.toFixed(0)} % worst; the published data disagree with themselves by about ${a.dataBand?.toFixed(0) ?? "an unquantified amount"} %.${rangeNote}${excluded}`,
    relative: Math.max(k.medianAbs, k.maxAbs / 2) / 100,
  };
}

/** Significant figures a reading can carry given its relative uncertainty. */
export function significantFigures(relative: number | null) {
  if (relative === null) return 2;
  return relative <= 0.03 ? 3 : relative <= 0.3 ? 2 : 1;
}
