import { EvidenceTag, Tag } from "@/components/design/kit";
import { applicability } from "@/lib/fire/evidence";
import { cn } from "@/lib/utils";

type ApplicabilityInput = Parameters<typeof applicability>[0];

export function isWithinSaffire(input: ApplicabilityInput): boolean {
  return applicability(input).status === "Comparable Saffire conditions";
}

/** Whether the current setup lies inside the conditions NASA tested, with the reason. */
export function ModelApplicability({ input, className }: { input: ApplicabilityInput; className?: string }) {
  const result = applicability(input);
  return (
    <div className={cn("flex flex-wrap items-start gap-x-2 gap-y-1", className)}>
      <ApplicabilityTag input={input} />
      <p className="min-w-0 flex-1 basis-48 text-[13px] leading-5 text-muted-foreground">{result.reason}</p>
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
