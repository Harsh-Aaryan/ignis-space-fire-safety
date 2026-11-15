import { EvidenceTag, Tag } from "@/components/design/kit";
import { accuracyCue, testCoverage } from "@/lib/fire/accuracy";
import { applicability } from "@/lib/fire/evidence";
import { cn } from "@/lib/utils";

type ApplicabilityInput = Parameters<typeof applicability>[0];

export function isWithinSaffire(input: ApplicabilityInput): boolean {
  return applicability(input).status === "Comparable Saffire conditions";
}

/** Whether the current setup lies inside the conditions NASA tested, with the reason and,
 * inside them, the held-out error of the readings against Saffire. */
export function ModelApplicability({ input, className }: { input: ApplicabilityInput; className?: string }) {
  const result = applicability(input);
  const coverage = testCoverage(input);
  const cues = (["hrr", "co", "co2"] as const).map((quantity) => [quantity, accuracyCue(quantity, input)] as const);
  const tested = coverage.kind === "saffire-vi";
  const label = { hrr: "heat release", co: "CO", co2: "CO₂" } as const;
  return (
    <div className={cn("flex flex-wrap items-start gap-x-2 gap-y-1", className)}>
      <ApplicabilityTag input={input} />
      <div className="min-w-0 flex-1 basis-48 text-[13px] leading-5 text-muted-foreground">
        <p>{result.reason}</p>
        <p className="mt-1 text-[12px] leading-4 text-text-tertiary">
          {tested
            ? `Held-out error against Saffire VI: ${cues.map(([quantity, cue]) => `${label[quantity]} ${cue.short}`).join(", ")}. Cabin temperature accuracy is not established.`
            : coverage.kind === "flight"
              ? `The matching flight test ${coverage.checkId} disagrees with the model, so the readings carry no error bar.`
              : "No flight comparison covers these conditions, so the readings carry no tested error bar."}
        </p>
      </div>
    </div>
  );
}

export function ApplicabilityTag({ input }: { input: ApplicabilityInput }) {
  return isWithinSaffire(input) ? (
    <Tag tone="positive">Within Saffire test conditions</Tag>
  ) : (
    <EvidenceTag kind="extrapolated" />
  );
}
