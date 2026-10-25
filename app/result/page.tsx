import { Suspense } from "react";
import { ResultLookup } from "@/components/ResultLookup";
import { ResultStateBrand } from "@/components/ResultStateBrand";

export default function ResultPage() {
  return (
    <Suspense
      fallback={(
        <main className="result-page">
          <section className="result-state">
            <ResultStateBrand />
            <p className="result-state-message">正在查询...</p>
          </section>
        </main>
      )}
    >
      <ResultLookup />
    </Suspense>
  );
}
