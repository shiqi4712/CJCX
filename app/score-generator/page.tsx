import { Suspense } from "react";
import { ScoreGenerator } from "@/components/ScoreGenerator";

export default function ScoreGeneratorPage() {
  return <Suspense fallback={<main className="parent-shell" />}><ScoreGenerator /></Suspense>;
}
