import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createCoursePlanLink } from "@/lib/store";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ message: "请先登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "请求内容无效" }, { status: 400 });

  const studentId = String(body.studentId ?? "").trim();
  const courseLine = String(body.courseLine ?? "").trim();
  const targetClass = String(body.targetClass ?? "").trim();
  const planUrl = String(body.planUrl ?? "").trim();

  if (!studentId) return NextResponse.json({ message: "请选择学生" }, { status: 400 });
  if (!planUrl) return NextResponse.json({ message: "方案链接不能为空" }, { status: 400 });

  const link = await createCoursePlanLink(
    {
      studentId,
      courseLine,
      targetClass,
      planUrl
    },
    session.role,
    session.teacherName
  );

  if (!link) {
    return NextResponse.json({ message: "没有权限为该学生生成方案" }, { status: 403 });
  }

  return NextResponse.json(link);
}
