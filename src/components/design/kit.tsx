import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared page furniture. Every section composes these so headings, panels,
 * figures and provenance marks look the same everywhere. No hooks: safe in
 * server and client components.
 */

/** Page title. `meta` is a quiet line under the title, such as who ran a test and when. */
export function PageHeader({
  meta,
  title,
  description,
  actions,
  className,
}: {
  meta?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="max-w-3xl">
        <h1 className="text-[28px] leading-8 font-normal text-foreground md:text-[32px] md:leading-10">{title}</h1>
        {meta ? <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{meta}</p> : null}
        {description ? <p className="mt-2 max-w-[62ch] text-[15px] leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  actions,
  id,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="max-w-3xl">
        <h2 id={id} className="text-[20px] leading-7 font-medium text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-1 max-w-[62ch] text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A bordered surface. Give it a title for a headed card, or leave it bare. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
  ...rest
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Drop the body padding, for tables and media that run edge to edge. */
  flush?: boolean;
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <section className={cn("rounded-lg border border-border-subtle bg-card", className)} {...rest}>
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle px-6 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] leading-5 font-medium text-foreground">{title}</h2> : null}
            {description ? <p className="mt-1 max-w-[62ch] text-[13px] leading-5 text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(flush ? "" : "p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

/** One number with its label. Wrap a group of these in a <dl>. */
export function Stat({
  label,
  value,
  unit,
  note,
  size = "md",
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  note?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const scale = size === "lg" ? "text-[30px] leading-9" : size === "sm" ? "text-[16px] leading-5" : "text-[22px] leading-7";
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[12px] leading-4 text-muted-foreground">{label}</dt>
      <dd className={cn("numeric mt-1 text-foreground", scale)}>
        {value}
        {unit ? <span className="ml-1 font-sans text-[13px] text-muted-foreground">{unit}</span> : null}
      </dd>
      {note ? <dd className="mt-0.5 text-[12px] leading-4 text-text-tertiary">{note}</dd> : null}
    </div>
  );
}

export type EvidenceClass = "measured" | "derived" | "calibrated" | "assumed" | "extrapolated";

const EVIDENCE: Record<EvidenceClass, { label: string; hint: string; dot: string }> = {
  measured: { label: "Measured", hint: "Read directly from a NASA or peer-reviewed measurement.", dot: "bg-status-nominal" },
  derived: { label: "Derived", hint: "Calculated from published measurements.", dot: "bg-status-info" },
  calibrated: { label: "Calibrated", hint: "Fitted so the model reproduces a published result.", dot: "bg-status-caution" },
  assumed: { label: "Assumed", hint: "A modeling choice or handbook value, not a measurement for this case.", dot: "bg-text-tertiary" },
  extrapolated: { label: "Extrapolated", hint: "Model output outside the conditions that were tested.", dot: "bg-status-warning" },
};

/** Says where a number comes from. Use the same five classes everywhere. */
export function EvidenceTag({ kind, className }: { kind: EvidenceClass; className?: string }) {
  const item = EVIDENCE[kind];
  return (
    <span
      title={item.hint}
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border border-border-subtle px-2 py-0.5 text-[12px] leading-4 whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", item.dot)} aria-hidden="true" />
      {item.label}
    </span>
  );
}

export function evidenceHint(kind: EvidenceClass): string {
  return EVIDENCE[kind].hint;
}

/** A quiet label chip for categories such as record type or gravity regime. */
export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "positive";
  className?: string;
}) {
  const tones = {
    neutral: "border-border-subtle text-muted-foreground",
    accent: "border-border text-foreground",
    positive: "border-status-nominal/50 text-status-nominal",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded-sm border px-2 py-0.5 text-[12px] leading-4 whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

/**
 * Links read as primary text with a quiet underline. The ember accent is kept
 * for the one main action and the current selection, so links never compete with them.
 */
export const LINK =
  "inline-flex items-center gap-2 text-foreground underline decoration-foreground/25 underline-offset-4 transition-colors hover:decoration-foreground";
const LINK_ICON = "size-4 shrink-0 text-muted-foreground";

/** A link that leaves the site, to a NASA record or a paper. */
export function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn(LINK, className)}>
      {children}
      <ArrowUpRight className={LINK_ICON} aria-hidden="true" />
    </a>
  );
}

/** A link to another page of the site. */
export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn(LINK, className)}>
      {children}
      <ArrowRight className={LINK_ICON} aria-hidden="true" />
    </Link>
  );
}

/** Button-styled link. "primary" is the one main action of a view. */
export function ActionLink({
  href,
  children,
  variant = "secondary",
  size = "md",
  onClick,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  size?: ActionSize;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link href={href} onClick={onClick} className={cn(actionClass(variant, size), className)}>
      {children}
    </Link>
  );
}

export type ActionSize = "md" | "lg";

/** The same look for a <button>. "lg" is for the one lead action on a page, such as the hero. */
export function actionClass(variant: "primary" | "secondary" = "secondary", size: ActionSize = "md"): string {
  return cn(
    "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
    size === "lg" ? "min-h-14 gap-2.5 px-6 text-base" : "min-h-11 gap-2 px-4 text-sm",
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/85"
      : "border border-border bg-transparent text-foreground hover:bg-elev-3",
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border px-5 py-8 text-center">
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** A plain statement of a limit or caveat. One per view, in words, instead of warning badges. */
export function Note({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <aside className={cn("max-w-[62ch] border-l border-border py-0.5 pl-3 text-[13px] leading-5 text-muted-foreground", className)}>
      {title ? <span className="font-medium text-foreground">{title} </span> : null}
      {children}
    </aside>
  );
}

/** Class names for data tables, so every table shares one density and rule weight. */
export const table = {
  wrap: "overflow-x-auto rounded-md border border-border-subtle",
  root: "w-full border-collapse text-left text-[13px] leading-5",
  head: "bg-elev-2 text-[12px] text-muted-foreground",
  th: "border-b border-border px-3 py-2 font-medium whitespace-nowrap",
  tr: "border-b border-border-subtle last:border-b-0 hover:bg-elev-2/60 focus-within:bg-elev-2",
  td: "px-3 py-2 align-top",
  num: "numeric px-3 py-2 text-right align-top",
} as const;
