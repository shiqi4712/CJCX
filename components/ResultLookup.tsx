"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdmissionResult, type QueryResult } from "@/components/AdmissionResult";

const REVIEW_MESSAGE = "教学中心成绩审核进行中，请您耐心等待";
const MIN_REVIEW_LOADING_MS = 4000;

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
    let settled = false;
    const reviewTimer = window.setTimeout(() => {
      if (cancelled || settled) return;
      setResult(null);
      setLoading(false);
      setMessage(REVIEW_MESSAGE);
    }, MIN_REVIEW_LOADING_MS);

    async function fetchResult() {
      setLoading(true);
      setMessage("正在查询...");
      const startedAt = Date.now();

      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName })
      }).catch(() => null);

      if (!response) {
        if (cancelled) return;
        settled = true;
        window.clearTimeout(reviewTimer);
        setResult(null);
        setLoading(false);
        setMessage("查询暂时失败，请稍后重试");
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (cancelled) return;

      if (response.status === 423) {
        const remainingMs = Math.max(0, MIN_REVIEW_LOADING_MS - (Date.now() - startedAt));
        if (remainingMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
        }
        if (cancelled) return;
      }

      settled = true;
      window.clearTimeout(reviewTimer);
      setLoading(false);
      if (!response.ok) {
        setResult(null);
        setMessage(response.status === 423 ? REVIEW_MESSAGE : data.message ?? "未查询到相关结果");
        return;
      }

      setMessage("");
      setResult(data);
    }

    fetchResult();

    return () => {
      cancelled = true;
      window.clearTimeout(reviewTimer);
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
