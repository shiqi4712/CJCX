"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdmissionResult, type QueryResult } from "@/components/AdmissionResult";

const REVIEW_MESSAGE = "教学中心成绩审核进行中，请您耐心等待";
const REQUEST_TIMEOUT_MS = 12000;

export function ResultLookup() {
  const searchParams = useSearchParams();
  const studentName = searchParams.get("name")?.trim() ?? "";
  const [result, setResult] = useState<QueryResult | null>(null);
  const [message, setMessage] = useState(studentName ? "正在查询..." : "请输入学员姓名后再查询。");
  const [loading, setLoading] = useState(Boolean(studentName));

  useEffect(() => {
    if (!studentName) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const requestTimer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    async function fetchResult() {
      setLoading(true);
      setMessage("正在查询...");

      const statusResponse = await fetch("/api/query/status", {
        cache: "no-store",
        signal: controller.signal
      }).catch(() => null);
      const releaseState = statusResponse?.ok
        ? ((await statusResponse.json().catch(() => null)) as { open?: boolean } | null)
        : null;

      if (releaseState?.open === false) {
        void fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentName }),
          cache: "no-store"
        }).catch(() => null);
        window.clearTimeout(requestTimer);
        if (cancelled) return;
        setResult(null);
        setLoading(false);
        setMessage(REVIEW_MESSAGE);
        return;
      }

      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName }),
        cache: "no-store",
        signal: controller.signal
      }).catch(() => null);

      window.clearTimeout(requestTimer);
      if (cancelled) return;

      if (!response) {
        setResult(null);
        setLoading(false);
        setMessage("查询暂时失败，请稍后重试");
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (cancelled) return;
      setLoading(false);
      if (!response.ok) {
        setResult(null);
        setMessage(response.status === 423 || response.status === 404 ? REVIEW_MESSAGE : data.message ?? REVIEW_MESSAGE);
        return;
      }

      setMessage("");
      setResult(data);
    }

    fetchResult();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(requestTimer);
    };
  }, [studentName]);

  return (
    <main className="result-page">
      {loading || message ? (
        <section className="result-state">
          <img src="/images/lab-logo-white.png" alt="北大-点猫科技人工智能教育联合实验室" />
          <p>{message}</p>
          {!loading ? <Link href="/">返回查询</Link> : null}
        </section>
      ) : null}

      {result ? (
        <>
          <AdmissionResult result={result} />
          <nav className="result-actions">
            <Link href="/">返回查询</Link>
          </nav>
        </>
      ) : null}
    </main>
  );
}
