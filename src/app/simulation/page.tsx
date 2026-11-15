import type { Metadata } from "next";
import { SimulationView } from "@/components/simulation/simulation-view";

export const metadata: Metadata = {
  title: "Simulation",
  description: "Set a fire inside a Moon, Mars or orbital habitat and watch how it grows, is detected and is put out.",
};

export default function Page() {
  return <SimulationView />;
}
