import type { Metadata } from "next";
import { MissionOverview } from "@/components/dashboard/mission-overview";

export const metadata: Metadata = {
  title: "IGNIS | Space fire safety research",
  description:
    "Explore conceptual space habitats, trace equipment to NASA combustion literature, and examine research gaps. A research prototype with verified citation metadata and clearly labeled synthetic demonstrations.",
};

export default function Page() {
  return <MissionOverview />;
}
