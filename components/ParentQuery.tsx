"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProgramQueryTitle, normalizeProgramType } from "@/lib/programs";

export function ParentQuery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const programType = normalizeProgramType(searchParams.get("program"));
  const title = getProgramQueryTitle(programType);
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
          <img src="/images/parent-login-logo.png" alt="北大-点猫科技人工智能教育联合实验室" />
        </header>

        <div className="hero-copy">
          <p>学编程，就选</p>
          <strong className="hero-brand-slogan">北大认可品牌！</strong>
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
