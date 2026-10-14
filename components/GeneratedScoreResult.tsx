"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdmissionResult, type QueryResult } from "@/components/AdmissionResult";

function stableId(name: string, className: string) {
  let hash = 2166136261;
  for (const character of `${name}:${className}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `demo-${(hash >>> 0).toString(16)}`;
}

function generatedOverallScore(id: string, admitted: boolean) {
  const numeric = Number.parseInt(id.slice(-6), 16) || 0;
  const min = admitted ? 9700 : 8500;
  const max = admitted ? 9900 : 9500;
  return ((min + (numeric % (max - min + 1))) / 100).toFixed(2);
}

export function GeneratedScoreResult() {
  const params = useSearchParams();
  const studentName = params.get("name")?.trim() ?? "";
  const score = params.get("score")?.trim().toUpperCase() ?? "";
  const className = params.get("class")?.trim() ?? "";

  if (!studentName || !score || !className) {
    return (
      <main className="result-page">
        <section className="result-state">
          <p className="result-state-message">请先输入学生姓名和班级。</p>
          <Link href="/water-army">返回成绩生成</Link>
        </section>
      </main>
    );
  }

  const admitted = score === "A+";
  const studentId = stableId(studentName, className);
  const result: QueryResult = {
    studentId,
    studentName,
    score,
    overallScore: generatedOverallScore(studentId, admitted),
    programType: className,
    courseLine: "moon",
    admissionResult: admitted ? "已录取" : "未录取",
    recommendedClass: admitted ? className : "继续努力",
    admissionDetail: admitted
      ? "综合表现达到本次选拔要求。"
      : "编程猫希望你继续保持热爱，稳扎稳打提升基础能力，下一次选拔再向目标发起冲刺。",
    advice: admitted
      ? "期待你的加入，一起开启编程之旅！"
      : "这次结果不代表终点。建议巩固课堂基础、保持每周练习，并在老师指导下逐步提升。",
    preferredCourseTime: null,
    homeworkLessonCount: 3,
    videoCount: 3,
    messageCount: 24,
    queryDate: new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
  };

  return (
    <main className="result-page">
      <AdmissionResult result={result} />
      <nav className="result-actions">
        <Link href="/water-army">重新生成</Link>
      </nav>
    </main>
  );
}
