"use client";

import { useState } from "react";
import { COURSE_TIME_OPTIONS } from "@/lib/course-times";

export type QueryResult = {
  studentId: string;
  studentName: string;
  score: string;
  admissionResult: string;
  recommendedClass: string;
  admissionDetail: string;
  advice: string;
  preferredCourseTime: string | null;
  queryDate: string;
};

export function AdmissionResult({ result }: { result: QueryResult }) {
  const admitted = result.admissionResult === "已录取";
  const [courseTime, setCourseTime] = useState(result.preferredCourseTime ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveCourseTime(value: string) {
    setCourseTime(value);
    setMessage("");
    if (!value) return;

    setSaving(true);
    const response = await fetch("/api/students/course-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: result.studentId, courseTime: value })
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "上课时间已保存" : data.message ?? "保存失败，请稍后重试");
  }

  return (
    <section className={`certificate ${admitted ? "" : "not-admitted"}`}>
      <div className="certificate-frame">
        <header className="certificate-title">
          <span />
          <h2>{admitted ? "录取结果" : "查询结果"}</h2>
          <span />
        </header>

        <div className="student-display">
          <p>{admitted ? "恭喜" : "亲爱的"}</p>
          <strong>{result.studentName}</strong>
          <em>{admitted ? "同学获得英才班录取资格" : "同学暂未获得本次录取资格"}</em>
        </div>

        <div className="score-display">
          <span>学生成绩</span>
          <strong>{result.score}</strong>
          <i>
            {result.admissionResult} · {result.recommendedClass}
          </i>
        </div>

        <article className="invitation">
          <div className="invitation-head">
            <img src="/images/lab-logo-white.png" alt="北大-点猫科技人工智能教育联合实验室" />
            <p>北大 - 点猫科技人工智能教育联合实验室</p>
            <h3>{admitted ? "编程猫英才班" : "编程猫学习建议"}</h3>
            <h4>{admitted ? "入学邀请函" : "继续加油"}</h4>
          </div>
          <div className="invitation-body">
            <p>
              {admitted ? "经编程猫教学中心审核，" : ""}
              {result.admissionDetail}
            </p>
            <strong>{admitted ? `${result.recommendedClass}录取资格` : "期待下一次突破"}</strong>
            <p>{result.advice}</p>
          </div>
        </article>

        {admitted ? (
          <section className="course-time-card">
            <h3>请选择上课时间</h3>
            <p>请选择一个意向上课时间，老师会根据班级安排进一步确认。</p>
            <select value={courseTime} onChange={(event) => void saveCourseTime(event.target.value)} disabled={saving}>
              <option value="">请选择上课时间</option>
              {COURSE_TIME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {message ? <span>{message}</span> : null}
          </section>
        ) : null}

        <footer className="certificate-footer">
          <span>{result.queryDate}</span>
        </footer>
      </div>
    </section>
  );
}
