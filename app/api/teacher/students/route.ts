import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createAutomaticCoursePlanLinks } from "@/lib/course-plan-links";
import { getOverview, importStudents } from "@/lib/store";
import { cleanName, cleanScore } from "@/lib/validation";
import { parseCoursePlanLine } from "@/lib/course-plan-config";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ message: "请先登录" }, { status: 401 });
  }

  return NextResponse.json((await getOverview(session.role, session.teacherName)).students);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ message: "请先登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "请求内容无效" }, { status: 400 });

  const studentName = cleanName(body.studentName);
  const score = cleanScore(body.score);
  if (!studentName) return NextResponse.json({ message: "学生姓名不能为空" }, { status: 400 });
  if (!score) return NextResponse.json({ message: "学生成绩不能为空" }, { status: 400 });

  const teacherName = session.role === "teacher" ? session.teacherName : "未分配老师";
  const result = await importStudents([
    {
      studentName,
      score,
      teacherName,
      programType: String(body.programType ?? "").trim() || undefined,
      courseLine: parseCoursePlanLine(String(body.courseLine ?? "")),
      homeworkLessonCount: toNonNegativeInteger(body.homeworkLessonCount),
      videoCount: toNonNegativeInteger(body.videoCount),
      messageCount: toNonNegativeInteger(body.messageCount)
    }
  ]);
  const overview = await getOverview(session.role, session.teacherName);
  const generatedPlanCount = await createAutomaticCoursePlanLinks(
    result.affectedStudentIds,
    overview.students,
    new URL(request.url).origin,
    session.role,
    session.teacherName
  );
  return NextResponse.json({ ...result, generatedPlanCount });
}

function toNonNegativeInteger(value: unknown) {
  const numeric = Number(String(value ?? "").trim());
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}
