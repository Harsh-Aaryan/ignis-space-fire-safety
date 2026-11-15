import type { Metadata } from "next";
import { PredictView } from "@/components/predict/predict-view";

export const metadata: Metadata = {
  title: "Compare gravity",
  description: "Run the same fire at orbital, lunar and Martian gravity.",
};

export default function Page() {
  return <PredictView />;
}
