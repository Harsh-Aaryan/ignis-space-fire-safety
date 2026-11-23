"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { isTabActive } from "@/lib/routes";
import { cn } from "@/lib/utils";

const FADE = "24px";

/** Fades the edge(s) that still have tabs beyond them, so a cut-off row reads as scrollable. */
function edgeMask(start: boolean, end: boolean): CSSProperties | undefined {
  if (!start && !end) return undefined;
  const image = `linear-gradient(to right, ${start ? "transparent" : "#000"} 0, #000 ${start ? FADE : "0"}, #000 calc(100% - ${end ? FADE : "0px"}), ${end ? "transparent" : "#000"} 100%)`;
  return { maskImage: image, WebkitMaskImage: image };
}

/** The second level of navigation inside a section. Each tab is a route. */
export function RouteTabs({
  tabs,
  label,
  className,
}: {
  tabs: ReadonlyArray<{ href: string; label: string }>;
  label: string;
  className?: string;
}) {
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () => {
      const max = element.scrollWidth - element.clientWidth;
      const start = element.scrollLeft > 1;
      const end = element.scrollLeft < max - 1;
      setEdges((current) => (current.start === start && current.end === end ? current : { start, end }));
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  // Bring the current tab into view inside the row only: the page itself never scrolls.
  useEffect(() => {
    const element = scroller.current;
    const active = element?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!element || !active) return;
    const row = element.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    const pad = 24;
    const offset = tab.left < row.left ? tab.left - row.left - pad : tab.right > row.right ? tab.right - row.right + pad : 0;
    if (!offset) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: offset, behavior: reduce ? "auto" : "smooth" });
  }, [pathname]);

  return (
    <nav aria-label={label} className={cn("no-print border-b border-border-subtle", className)}>
      <div ref={scroller} className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={edgeMask(edges.start, edges.end)}>
        {tabs.map((tab) => {
          const active = isTabActive(pathname, tab.href, tabs);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 shrink-0 items-center px-4 text-sm transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {active ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" aria-hidden="true" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
