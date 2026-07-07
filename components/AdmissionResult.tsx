"use client";

import { useState } from "react";
import { COURSE_DAYS, COURSE_SLOTS } from "@/lib/course-times";
import { getProgramIntro, getProgramLandingName, normalizeProgramType } from "@/lib/programs";

export type QueryResult = {
  studentId: string;
  studentName: string;
  score: string;
  programType?: string;
  admissionResult: string;
  recommendedClass: string;
  admissionDetail: string;
  advice: string;
  preferredCourseTime: string | null;
  queryDate: string;
};

function splitCourseTime(value: string | null) {
  if (!value) return { day: "", slot: "" };

  const [day, slot] = value.split(" ");
  return {
    day: COURSE_DAYS.includes(day as (typeof COURSE_DAYS)[number]) ? day : "",
    slot: COURSE_SLOTS.includes(slot as (typeof COURSE_SLOTS)[number]) ? slot : ""
  };
}

export function AdmissionResult({ result }: { result: QueryResult }) {
  const admitted = result.admissionResult === "已录取";
  const programType = normalizeProgramType(result.programType ?? result.recommendedClass);
  const programLandingName = getProgramLandingName(programType);
  const certificateTitle = `${programType}录取通知书`;
  const savedCourseTime = splitCourseTime(result.preferredCourseTime);
  const [selectedDay, setSelectedDay] = useState(savedCourseTime.day);
  const [selectedSlot, setSelectedSlot] = useState(savedCourseTime.slot);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function chooseDay(day: string) {
    setSelectedDay(day);
    setMessage("");
  }

  function chooseSlot(slot: string) {
    setSelectedSlot(slot);
    setMessage("");
  }

  async function saveCourseTime() {
    setMessage("");
    if (!selectedDay || !selectedSlot) {
      setMessage("请先选择日期和时段");
      return;
    }

    setSaving(true);
    const courseTime = `${selectedDay} ${selectedSlot}`;
    const response = await fetch("/api/students/course-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: result.studentId, courseTime })
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
          <h2>{admitted ? certificateTitle : "查询结果"}</h2>
          <span />
        </header>

        <article className={`invitation ${admitted ? "admission-letter" : ""}`}>
          <div className="invitation-head">
            <img src="/images/lab-logo-white.png" alt="北大-点猫科技人工智能教育联合实验室" />
            <p>北大 - 点猫科技人工智能教育联合实验室</p>
            <div className="program-line">
              <strong>{admitted ? programLandingName : "编程猫学习建议"}</strong>
            </div>
            <h4>{admitted ? certificateTitle : "继续加油"}</h4>
          </div>
          <div className="invitation-body">
            {admitted ? (
              <>
                <p className="letter-kicker">恭喜</p>
                <strong className="letter-student">{result.studentName}</strong>
                <p className="letter-copy">
                  本期综合成绩
                  <b>{result.score}</b>
                  ，已录取
                  <b>{programType}</b>
                  。
                </p>
                <p className="letter-status">已获得{programType}录取资格</p>
                <p className="letter-note">{getProgramIntro(programType)}</p>
              </>
            ) : (
              <>
                <p>{result.admissionDetail}</p>
                <strong>期待下一次突破</strong>
                <p>{result.advice}</p>
              </>
            )}
          </div>
        </article>

        {admitted ? (
          <section className="course-time-card" aria-label="选择上课时间">
            <div className="course-time-head">
              <h3>选择上课安排</h3>
              <p>请选择日期和时段，确认后老师会优先核对。</p>
            </div>

            <div className="course-picker-group">
              <span>日期</span>
              <div className="course-choice-grid days">
                {COURSE_DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={selectedDay === day ? "active" : ""}
                    onClick={() => chooseDay(day)}
                    disabled={saving}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="course-picker-group">
              <span>时段</span>
              <div className="course-choice-grid slots">
                {COURSE_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className={selectedSlot === slot ? "active" : ""}
                    onClick={() => chooseSlot(slot)}
                    disabled={saving}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <button className="course-confirm" type="button" onClick={() => void saveCourseTime()} disabled={saving}>
              {saving ? "正在确认..." : "确认选择"}
            </button>
            {message ? <span className="course-time-message">{message}</span> : null}
          </section>
        ) : null}

        <footer className="certificate-footer">
          <span>{result.queryDate}</span>
        </footer>
      </div>
    </section>
  );
}
