import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { resetStudentQuery } from "@/lib/store";
import { isUuid } from "@/lib/validation";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });

  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ message: "学生 ID 无效" }, { status: 400 });

  const student = await resetStudentQuery(id, session.role, session.teacherName);
  return student
    ? NextResponse.json(student)
    : NextResponse.json({ message: "学生不存在或无权限重置" }, { status: 404 });
}
