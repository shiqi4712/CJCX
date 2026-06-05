import { NextResponse } from "next/server";
import { queryStudentByName } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { studentName?: string } | null;
  const studentName = body?.studentName?.trim();

  if (!studentName) {
    return NextResponse.json({ message: "请输入学员姓名" }, { status: 400 });
  }

  const student = queryStudentByName(studentName);

  if (!student) {
    return NextResponse.json({ message: "未查询到相关结果" }, { status: 404 });
  }

  return NextResponse.json({
    studentName: student.studentName,
    score: student.score,
    admissionResult: student.admission,
    recommendedClass: student.className,
    admissionDetail: student.detail,
    advice: student.advice,
    queryDate: new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  });
}
