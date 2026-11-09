import { Suspense } from "react";
import { ParentQuery } from "@/components/ParentQuery";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="parent-shell" />}>
      <ParentQuery />
    </Suspense>
  );
}
