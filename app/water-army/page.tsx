import { Suspense } from "react";
import { ScoreGenerator } from "@/components/ScoreGenerator";

export default function WaterArmyPage() {
  return <Suspense fallback={<main className="parent-shell" />}><ScoreGenerator basePath="/water-army" /></Suspense>;
}
