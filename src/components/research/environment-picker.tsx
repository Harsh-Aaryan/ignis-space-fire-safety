import { CREW_ENVIRONMENTS, INVESTIGATIONS, investigationsForEnvironment, type CrewEnvironment } from "@/data/research/investigations";
import { cn } from "@/lib/utils";

const ENVIRONMENTS = Object.entries(CREW_ENVIRONMENTS) as Array<[CrewEnvironment, (typeof CREW_ENVIRONMENTS)[CrewEnvironment]]>;

function counts(environment: CrewEnvironment): string[] {
  const tested = investigationsForEnvironment(environment, "tested").length;
  const applies = investigationsForEnvironment(environment, "applies").length;
  const transferable = investigationsForEnvironment(environment, "transferable").length;
  return [`${tested} tested`, applies ? `${applies} apply directly` : null, `${transferable} transferable`].filter((item): item is string => item !== null);
}

const card =
  "flex h-full w-full flex-col rounded-md border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** The five crew environments as selectable cards, plus "all". */
export function EnvironmentPicker({
  selected,
  onSelect,
}: {
  selected: CrewEnvironment | null;
  onSelect: (environment: CrewEnvironment | null) => void;
}) {
  return (
    <section aria-labelledby="environment-heading">
      <h2 id="environment-heading" className="text-[17px] leading-6 font-medium text-foreground">
        Crew environment
      </h2>
      <p className="mt-1 mb-3 max-w-3xl text-sm leading-6 text-muted-foreground">
        Choose where a crew lives to see which records bear on it, and on what basis.
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <li>
          <button
            type="button"
            aria-pressed={selected === null}
            onClick={() => onSelect(null)}
            className={cn(card, selected === null ? "border-primary bg-elev-2" : "border-border-subtle bg-card hover:bg-elev-2")}
          >
            <span className="text-sm font-medium text-foreground">All environments</span>
            <span className="mt-1 text-[12px] text-muted-foreground">Every gravity regime</span>
            <span className="mt-2 text-[13px] leading-5 text-muted-foreground">The whole index, without an environment filter.</span>
            <span className="mt-auto pt-3 text-[12px] leading-5 text-text-tertiary">{INVESTIGATIONS.length} records</span>
          </button>
        </li>
        {ENVIRONMENTS.map(([id, environment]) => {
          const isSelected = selected === id;
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(isSelected ? null : id)}
                className={cn(card, isSelected ? "border-primary bg-elev-2" : "border-border-subtle bg-card hover:bg-elev-2")}
              >
                <span className="text-sm font-medium text-foreground">{environment.label}</span>
                <span className="mt-1 text-[12px] text-muted-foreground">{environment.gravityLabel}</span>
                <span className="mt-2 text-[13px] leading-5 text-muted-foreground">{environment.note}</span>
                <span className="mt-auto flex flex-col pt-3 text-[12px] leading-5 text-text-tertiary">
                  {counts(id).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
