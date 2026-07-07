import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { normalizeProgramType } from "@/lib/programs";
import { deleteStudent, updateStudent } from "@/lib/store";
import { cleanName, cleanScore, isUuid } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ message: "无管理员权限" }, { status: 403 });

  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ message: "学生 ID 无效" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "请求内容无效" }, { status: 400 });

  const input = {
    ...(body.studentName !== undefined ? { studentName: cleanName(body.studentName) } : {}),
    ...(body.score !== undefined ? { score: cleanScore(body.score) } : {}),
    ...(body.overallScore !== undefined ? { overallScore: cleanScore(body.overallScore) || null } : {}),
    ...(body.teacherName !== undefined ? { teacherName: cleanName(body.teacherName) || "未分配老师" } : {}),
    ...(body.programType !== undefined ? { programType: normalizeProgramType(String(body.programType)) } : {}),
    ...(typeof body.published === "boolean" ? { published: body.published } : {})
  };
  if ("studentName" in input && !input.studentName) {
    return NextResponse.json({ message: "学生姓名不能为空" }, { status: 400 });
  }
  if ("score" in input && !input.score) {
    return NextResponse.json({ message: "成绩不能为空" }, { status: 400 });
  }

  const student = await updateStudent(id, input);
  return student
    ? NextResponse.json(student)
    : NextResponse.json({ message: "学生不存在" }, { status: 404 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ message: "无管理员权限" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ message: "学生 ID 无效" }, { status: 400 });
  return (await deleteStudent(id))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ message: "学生不存在" }, { status: 404 });
}
