import { Suspense } from "react";
import { ResultLookup } from "@/components/ResultLookup";

export default function ResultPage() {
  return (
    <Suspense fallback={<main className="result-page"><section className="result-state">正在查询...</section></main>}>
      <ResultLookup />
    </Suspense>
  );
}
