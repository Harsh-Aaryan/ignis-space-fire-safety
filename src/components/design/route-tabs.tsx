"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isTabActive } from "@/lib/routes";
import { cn } from "@/lib/utils";

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
  return (
    <nav aria-label={label} className={cn("no-print flex overflow-x-auto border-b border-border-subtle", className)}>
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
            {active ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
