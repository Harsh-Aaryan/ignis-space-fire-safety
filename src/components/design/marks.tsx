export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1.25" y="1.25" width="13.5" height="13.5" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground" />
        <path d="M4.4 10.6 L8 4.2 L11.6 10.6" fill="none" strokeWidth="1.5" strokeLinejoin="miter" strokeLinecap="square" className="stroke-ember" />
      </svg>
      {compact ? null : <span className="text-sm font-medium tracking-[0.16em] text-foreground uppercase">Ignis</span>}
    </span>
  );
}
