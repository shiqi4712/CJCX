import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { queryStudentByName } from "@/lib/store";
import { cleanName } from "@/lib/validation";

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

  const student = await queryStudentByName(studentName);

  if (!student) {
    return NextResponse.json({ message: "未查询到相关结果" }, { status: 404 });
  }

  return NextResponse.json({
    studentId: student.id,
    studentName: student.studentName,
    score: student.score,
    admissionResult: student.admission,
    recommendedClass: student.className,
    admissionDetail: student.detail,
    advice: student.advice,
    preferredCourseTime: student.preferredCourseTime,
    queryDate: new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  });
}
