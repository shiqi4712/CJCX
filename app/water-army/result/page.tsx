import { Suspense } from "react";
import { GeneratedScoreResult } from "@/components/GeneratedScoreResult";

export default function WaterArmyResultPage() {
  return <Suspense fallback={<main className="result-page" />}><GeneratedScoreResult /></Suspense>;
}
