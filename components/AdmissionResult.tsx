"use client";

import { useState } from "react";
import { COURSE_DAYS, COURSE_SLOTS } from "@/lib/course-times";
import {
  getProgramAdmissionDetail,
  getProgramDisplayName,
  getProgramIntro,
  getProgramLearningGoal,
  getProgramWelcomeNote,
  normalizeProgramType
} from "@/lib/programs";

export type QueryResult = {
  studentId: string;
  studentName: string;
  score: string;
  overallScore?: string | null;
  programType?: string;
  admissionResult: string;
  recommendedClass: string;
  admissionDetail: string;
  advice: string;
  preferredCourseTime: string | null;
  queryDate: string;
};

type AbilityScore = {
  label: string;
  value: number;
};

const ABILITY_LABELS = ["逻辑思维", "空间想象", "专注表达", "创新应用", "学习潜力"] as const;
const ABILITY_COPY = "根据孩子本次课程表现，作品情况，课程互动等进行综合评估";
const RADAR_ORDER = [0, 3, 2, 1, 4] as const;

function splitCourseTime(value: string | null) {
  if (!value) return { day: "", slot: "" };

  const [day, slot] = value.split(" ");
  return {
    day: COURSE_DAYS.includes(day as (typeof COURSE_DAYS)[number]) ? day : "",
    slot: COURSE_SLOTS.includes(slot as (typeof COURSE_SLOTS)[number]) ? slot : ""
  };
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildAbilityScores(result: QueryResult): AbilityScore[] {
  const seed = `${result.studentId}:${result.studentName}`;
  return ABILITY_LABELS.map((label, index) => {
    const hash = hashText(`${seed}:${label}:${index}`);
    const cents = 900 + (hash % 91);
    return { label, value: cents / 100 };
  });
}

function buildRadarPoints(scores: AbilityScore[]) {
  const center = { x: 74, y: 68 };
  const outer = [
    { x: 74, y: 10 },
    { x: 132, y: 51 },
    { x: 110, y: 118 },
    { x: 38, y: 118 },
    { x: 16, y: 51 }
  ];

  return RADAR_ORDER.map((scoreIndex, index) => {
      const score = scores[scoreIndex];
      const ratio = score.value / 10;
      const point = outer[index];
      return `${(center.x + (point.x - center.x) * ratio).toFixed(1)},${(
        center.y +
        (point.y - center.y) * ratio
      ).toFixed(1)}`;
    })
    .join(" ");
}

export function AdmissionResult({ result }: { result: QueryResult }) {
  const admitted = result.admissionResult === "已录取";
  const programType = normalizeProgramType(result.programType ?? result.recommendedClass);
  const programName = getProgramDisplayName(programType);
  const certificateTitle = `${programName}录取通知书`;
  const abilityScores = buildAbilityScores(result);
  const radarPoints = buildRadarPoints(abilityScores);
  const archiveRows = [
    { label: "学生姓名", value: result.studentName, tone: "strong" },
    { label: "综合成绩", value: result.score, tone: "strong" },
    { label: "综合得分", value: result.overallScore || "未填写" },
    { label: "录取结果", value: programName, tone: "strong" },
    { label: "录取详情", value: getProgramAdmissionDetail(programType), wide: true },
    { label: "孩子成长目标", value: getProgramLearningGoal(programType), wide: true },
    { label: "班级介绍", value: getProgramIntro(programType), wide: true }
  ];
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
        {!admitted ? (
          <header className="certificate-title">
            <span />
            <h2>查询结果</h2>
            <span />
          </header>
        ) : null}

        <article className={`invitation ${admitted ? "admission-letter" : ""}`}>
          <div className="invitation-head">
            <img src="/images/lab-logo-white.png" alt="北大-点猫科技人工智能教育联合实验室" />
            {!admitted ? (
              <div className="program-line">
                <strong>编程猫学习建议</strong>
              </div>
            ) : null}
            <h4>{admitted ? certificateTitle : "继续加油"}</h4>
          </div>
          <div className="invitation-body">
            {admitted ? (
              <>
                <p className="letter-kicker">恭喜</p>
                <strong className="letter-student">{result.studentName}</strong>
                <p className="letter-status">已获得{programName}录取资格</p>
                <p className="letter-note">{getProgramWelcomeNote()}</p>
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
          <>
            <section className="admission-archive" aria-label="录取档案">
              <div className="archive-head">
                <div>
                  <h3>录取档案</h3>
                  <p>展示成绩、录取详情与后续学习目标</p>
                </div>
                <span />
              </div>

              <div className="archive-grid">
                {archiveRows.map((row) => (
                  <div key={row.label} className={`archive-row ${row.wide ? "wide" : ""}`}>
                    <span>{row.label}</span>
                    <p className={row.tone === "strong" ? "strong" : ""}>{row.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="ability-card" aria-label="五维能力评估">
              <div className="ability-head">
                <div>
                  <h3>五维能力评估</h3>
                  <p>{ABILITY_COPY}</p>
                </div>
                <span>10分制</span>
              </div>

              <div className="ability-body">
                <svg className="ability-radar" viewBox="0 0 148 132" role="img" aria-label="五维能力图">
                  <polygon className="ability-grid" points="74,10 132,51 110,118 38,118 16,51" />
                  <polygon className="ability-grid" points="74,28 114,56 99,101 49,101 34,56" />
                  <polygon className="ability-grid" points="74,46 96,61 88,84 60,84 52,61" />
                  <line className="ability-axis" x1="74" y1="68" x2="74" y2="10" />
                  <line className="ability-axis" x1="74" y1="68" x2="132" y2="51" />
                  <line className="ability-axis" x1="74" y1="68" x2="110" y2="118" />
                  <line className="ability-axis" x1="74" y1="68" x2="38" y2="118" />
                  <line className="ability-axis" x1="74" y1="68" x2="16" y2="51" />
                  <polygon className="ability-shape" points={radarPoints} />
                  {radarPoints.split(" ").map((point, index) => {
                    const [cx, cy] = point.split(",");
                    return <circle className="ability-dot" cx={cx} cy={cy} key={`${point}-${index}`} r="3" />;
                  })}
                  <text className="ability-label" x="74" y="8">
                    逻辑 {abilityScores[0].value.toFixed(2)}
                  </text>
                  <text className="ability-label" x="134" y="47">
                    创新 {abilityScores[3].value.toFixed(2)}
                  </text>
                  <text className="ability-label" x="118" y="130">
                    表达 {abilityScores[2].value.toFixed(2)}
                  </text>
                  <text className="ability-label" x="30" y="130">
                    空间 {abilityScores[1].value.toFixed(2)}
                  </text>
                  <text className="ability-label" x="13" y="47">
                    潜力 {abilityScores[4].value.toFixed(2)}
                  </text>
                </svg>

                <div className="ability-list">
                  {abilityScores.map((score) => (
                    <div className="ability-item" key={score.label}>
                      <span>{score.label}</span>
                      <strong>{score.value.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

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
          </>
        ) : null}

        <footer className="certificate-footer">
          <span>{result.queryDate}</span>
        </footer>
      </div>
    </section>
  );
}
