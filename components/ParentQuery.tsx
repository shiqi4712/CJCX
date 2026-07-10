"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProgramLandingName, normalizeProgramType } from "@/lib/programs";

export function ParentQuery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const programType = normalizeProgramType(searchParams.get("program"));
  const title = `${getProgramLandingName(programType)}录取结果查询`;
  const [studentName, setStudentName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!studentName.trim()) {
      setMessage("请输入学员姓名后再查询。");
      return;
    }

    setLoading(true);
    setMessage("");
    router.push(`/result?name=${encodeURIComponent(studentName.trim())}`);
  }

  return (
    <main className="parent-shell">
      <section className="query-hero" aria-label={title}>
        <header className="brand-strip">
          <img src="/images/lab-logo-white.png" alt="北大-点猫科技人工智能教育联合实验室" />
        </header>

        <div className="hero-copy">
          <p>编程猫在线教育中心</p>
          <h1>{title}</h1>
          <span>输入学员姓名，查看本次选拔录取结果</span>
        </div>

        <form className="lookup-panel" onSubmit={handleSubmit}>
          <label>
            <span>学员姓名</span>
            <input
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="请输入学员姓名"
              autoComplete="name"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "查询中..." : "查询录取结果"}
          </button>
        </form>
      </section>

      {message ? <section className="inline-message">{message}</section> : null}
    </main>
  );
}
