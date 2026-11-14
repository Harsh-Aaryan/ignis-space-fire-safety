import { plexCond, plexMono, plexSans } from "@/lib/fonts";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "IGNIS — Evidence-grounded space fire safety",
  description:
    "Phase 1 prototype for NASA Space Apps Challenge 2026, Flame in Freefall. Synthetic demonstration data only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexCond.variable} ${plexMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider delay={200}>
          <Suspense fallback={<div className="p-6 text-[13px] text-muted-foreground">Loading IGNIS…</div>}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </TooltipProvider>
      </body>
    </html>
  );
}
