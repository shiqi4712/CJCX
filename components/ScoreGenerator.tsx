"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ScoreGenerator({ basePath = "/score-generator" }: { basePath?: string }) {
  const router = useRouter();
  const [studentName, setStudentName] = useState("");
  const [score, setScore] = useState("");
  const [className, setClassName] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = studentName.trim();
    const group = className.trim();
    const level = score.trim().toUpperCase();
    if (!name || !level || !group) {
      setMessage("请输入学生姓名、成绩和班型。");
      return;
    }
    setMessage("");
    const params = new URLSearchParams({ name, score: level, class: group });
    router.push(`${basePath}/result?${params}`);
  }

  return (
    <main className="parent-shell score-generator-shell">
      <section className="query-hero" aria-label="成绩生成">
        <header className="brand-strip">
          <img src="/images/parent-login-logo.png" alt="北大-点猫科技人工智能教育联合实验室" />
        </header>
        <div className="hero-copy">
          <p>学生成绩展示工具</p>
          <strong className="hero-brand-slogan">成绩生成</strong>
        </div>
        <form className="lookup-panel" onSubmit={handleSubmit}>
          <div className="lookup-intro">
            <h1>生成成绩页面</h1>
            <span>输入学生信息，查看对应的成绩展示</span>
          </div>
          <label>
            <span>学生姓名</span>
            <input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="请输入学生姓名" />
          </label>
          <label>
            <span>成绩</span>
            <select value={score} onChange={(event) => setScore(event.target.value)}>
              <option value="">请选择成绩</option>
              <option value="A+">A+</option>
              <option value="B">B</option>
            </select>
          </label>
          <label>
            <span>班型</span>
            <select value={className} onChange={(event) => setClassName(event.target.value)}>
              <option value="">请选择班型</option>
              <option value="科特班">科特班</option>
              <option value="育才班">育才班</option>
              <option value="英才班">英才班</option>
            </select>
          </label>
          <button type="submit">查看成绩页面</button>
        </form>
      </section>
      {message ? <section className="inline-message">{message}</section> : null}
    </main>
  );
}
