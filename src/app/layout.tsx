import { plexMono, plexSans } from "@/lib/fonts";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "IGNIS — Fire safety research for crewed spaceflight",
    template: "%s · IGNIS",
  },
  description:
    "NASA's flight fire experiments, indexed by the crew environments they bear on, with a physics model of fire in habitats from microgravity to the Moon and Mars.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider delay={200}>
          <Suspense fallback={<div className="p-6 text-[13px] text-muted-foreground">Loading…</div>}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </TooltipProvider>
      </body>
    </html>
  );
}
