import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getQueryReleaseState, queryStudentByName, recordPendingReviewQuery } from "@/lib/store";
import { cleanName } from "@/lib/validation";

const QUERY_REVIEW_MESSAGE = "教学中心成绩审核进行中，请您耐心等待";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { studentName?: string } | null;
  const studentName = cleanName(body?.studentName);

  if (!studentName) {
    return NextResponse.json({ message: "请输入学员姓名" }, { status: 400 });
  }

  const limit = await checkRateLimit(`query:${getClientIp(request)}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "查询过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const releaseState = await getQueryReleaseState();
  const diagnosticHeaders = {
    "X-Query-Open": String(releaseState.open),
    "X-Result-Open-At": releaseState.resultOpenAt ?? "",
    "X-Server-Now": releaseState.serverNow
  };

  if (!releaseState.open) {
    await recordPendingReviewQuery(studentName);
    return NextResponse.json({ message: QUERY_REVIEW_MESSAGE }, { status: 423, headers: diagnosticHeaders });
  }

  const student = await queryStudentByName(studentName);

  if (!student) {
    return NextResponse.json({ message: QUERY_REVIEW_MESSAGE }, { status: 404, headers: diagnosticHeaders });
  }

  return NextResponse.json(
    {
      studentId: student.id,
      studentName: student.studentName,
      score: student.score,
      overallScore: student.overallScore,
      programType: student.programType,
      admissionResult: student.admission,
      recommendedClass: student.className,
      admissionDetail: student.detail,
      advice: student.advice,
      preferredCourseTime: student.preferredCourseTime,
      homeworkLessonCount: student.homeworkLessonCount,
      videoCount: student.videoCount,
      messageCount: student.messageCount,
      queryDate: new Date().toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    },
    { headers: diagnosticHeaders }
  );
}
