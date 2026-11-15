import { CREW_ENVIRONMENTS, investigationsForEnvironment, type CrewEnvironment } from "@/data/research/investigations";
import { cn } from "@/lib/utils";

const ENVIRONMENTS = Object.entries(CREW_ENVIRONMENTS) as Array<[CrewEnvironment, (typeof CREW_ENVIRONMENTS)[CrewEnvironment]]>;

function counts(environment: CrewEnvironment): string {
  const tested = investigationsForEnvironment(environment, "tested").length;
  const applies = investigationsForEnvironment(environment, "applies").length;
  const transferable = investigationsForEnvironment(environment, "transferable").length;
  return [`${tested} tested`, applies ? `${applies} apply directly` : null, `${transferable} transferable`].filter(Boolean).join(" · ");
}

const chip =
  "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-left text-[13px] leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** The five crew environments, plus "all", as one compact row of toggles. The choice ranks the index; it hides nothing. */
export function EnvironmentPicker({
  selected,
  onSelect,
}: {
  selected: CrewEnvironment | null;
  onSelect: (environment: CrewEnvironment | null) => void;
}) {
  const current = selected ? CREW_ENVIRONMENTS[selected] : null;
  return (
    <section aria-labelledby="environment-heading" className="min-w-0">
      <h2 id="environment-heading" className="text-[12px] leading-4 text-muted-foreground">
        Crew environment
      </h2>
      {/* One scrollable row on phones so the ranked results stay near the top; wraps on wider screens. */}
      <div
        role="group"
        aria-labelledby="environment-heading"
        className="-mx-4 mt-1.5 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>button]:shrink-0 [&>button]:whitespace-nowrap"
      >
        <button
          type="button"
          aria-pressed={selected === null}
          onClick={() => onSelect(null)}
          className={cn(chip, selected === null ? "border-primary bg-elev-3 text-foreground" : "border-border-subtle bg-card text-muted-foreground hover:bg-elev-2")}
        >
          All environments
        </button>
        {ENVIRONMENTS.map(([id, environment]) => {
          const isSelected = selected === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : id)}
              className={cn(chip, isSelected ? "border-primary bg-elev-3 text-foreground" : "border-border-subtle bg-card text-muted-foreground hover:bg-elev-2")}
            >
              {environment.label}
              <span className="numeric text-[12px] text-text-tertiary">{environment.gravityLabel}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] leading-5 text-text-tertiary" aria-live="polite">
        {current && selected ? (
          <>
            <span className="text-muted-foreground">{current.note}</span> {counts(selected)}.
          </>
        ) : (
          "Choose where a crew lives to rank records by how directly they bear on it."
        )}
      </p>
    </section>
  );
}
