"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  getProgramIntro,
  getProgramLearningGoal,
  getProgramResultName,
  getProgramWelcomeNote,
  normalizeProgramType
} from "@/lib/programs";
import { normalizeCoursePlanLine, type CoursePlanPayload } from "@/lib/course-plan-config";
import { buildPerformanceRatings as buildPerformanceRatingsFromCounts } from "@/lib/performance-ratings";
import { getAbilityRankByOverallScore } from "@/lib/result-scoring";

export type QueryResult = {
  studentId: string;
  studentName: string;
  score: string;
  overallScore?: string | null;
  programType?: string;
  courseLine?: string;
  admissionResult: string;
  recommendedClass: string;
  admissionDetail: string;
  advice: string;
  preferredCourseTime: string | null;
  homeworkLessonCount?: number;
  videoCount?: number;
  messageCount?: number;
  queryDate: string;
};

type AbilityScore = {
  label: string;
  value: number;
};

const RADAR_ORDER = [0, 3, 2, 1, 4] as const;

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildAbilityScores(result: QueryResult): AbilityScore[] {
  const homeworkBonus = (result.homeworkLessonCount ?? 0) * 0.3;
  const videoBonus = (result.videoCount ?? 0) * 0.2;
  const messageBonus = getMessageBonus(result.messageCount ?? 0);
  const spatialBonus = (hashText(`${result.studentId}:${result.studentName}:space`) % 31) / 100;
  const cap = (value: number) => Math.min(9.9, value);

  return [
    { label: "逻辑思维", value: cap(9 + homeworkBonus) },
    { label: "空间想象", value: cap(9 + spatialBonus) },
    { label: "专注表达", value: cap(9 + videoBonus + messageBonus) },
    { label: "创新应用", value: cap(9 + homeworkBonus) },
    { label: "学习潜力", value: cap(9 + messageBonus) }
  ];
}

function getMessageBonus(messageCount: number) {
  if (messageCount > 60) return 0.9;
  if (messageCount > 30) return 0.6;
  if (messageCount > 10) return 0.3;
  return 0.1;
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

function buildPerformanceRatings(result: QueryResult) {
  const homeworkCount = result.homeworkLessonCount ?? 0;
  return [
    { label: "上课表现", value: (result.videoCount ?? 0) > 2 ? 4 : 3 },
    {
      label: "作业提交",
      value: homeworkCount >= 3 ? 4 : 2 + (hashText(`${result.studentId}:${result.studentName}:homework-stars`) % 2)
    },
    { label: "课程打卡", value: 3 }
  ];
}

function encodePlanPayload(payload: CoursePlanPayload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function AdmissionResult({ result }: { result: QueryResult }) {
  const admitted = result.admissionResult === "已录取";
  const programType = normalizeProgramType(result.programType ?? result.recommendedClass);
  const programName = getProgramResultName(result.recommendedClass, programType);
  const certificateTitle = `${programName}录取通知书`;
  const abilityScores = buildAbilityScores(result);
  const radarPoints = buildRadarPoints(abilityScores);
  const abilityRank =
    getAbilityRankByOverallScore(result.overallScore) ??
    2 + (hashText(`${result.studentId}:${result.studentName}:ability-rank`) % 9);
  const performanceRatings = buildPerformanceRatingsFromCounts(result);
  const planPayload: CoursePlanPayload = {
    studentId: result.studentId,
    student: result.studentName,
    score: result.score,
    courseLine: normalizeCoursePlanLine(result.courseLine),
    targetClass: result.recommendedClass || result.programType,
    preferredCourseTime: result.preferredCourseTime,
    showPrice: true
  };

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
                <p className="letter-student-line">恭喜 <strong>{result.studentName}</strong> 同学</p>
                <p className="letter-status">已获得{programName}录取资格</p>
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
            <section className="result-summary" aria-label="录取成绩">
              <div className="summary-item">
                <strong>{result.overallScore || "--"}</strong>
                <span>综合得分</span>
              </div>
              <div className="summary-item">
                <strong>{result.score}</strong>
                <span>综合等级</span>
              </div>
              <div className="summary-item ability-rank">
                <strong>前{abilityRank}%</strong>
                <span>能力档位</span>
              </div>
            </section>

            <section className="ability-card" aria-label="五维能力评估">
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

                <div className="ability-copy">
                  <h3>课程表现</h3>
                  <div className="performance-ratings">
                    {performanceRatings.map((rating) => (
                      <div className="performance-rating" key={rating.label}>
                        <span>{rating.label}</span>
                        <strong aria-label={`${rating.value}颗星`}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <i className={star <= rating.value ? "active" : ""} key={star}>★</i>
                          ))}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="result-detail-card">
              <h3>孩子成长目标</h3>
              <p>{getProgramLearningGoal(programType)}</p>
            </section>

            <section className="result-detail-card">
              <h3>班级介绍</h3>
              <p>{getProgramIntro(programType)}</p>
            </section>

            <Link
              className="course-plan-button"
              href={`/course-plan#p=${encodePlanPayload(planPayload)}`}
              aria-label={`查看${result.studentName}专属学习规划`}
            >
              <span>查看专属学习规划</span>
              <ArrowRight aria-hidden="true" size={17} strokeWidth={2.4} />
            </Link>
          </>
        ) : null}

        <footer className="certificate-footer">
          <p>{getProgramWelcomeNote()}</p>
          <span>{result.queryDate}</span>
        </footer>
      </div>
    </section>
  );
}
