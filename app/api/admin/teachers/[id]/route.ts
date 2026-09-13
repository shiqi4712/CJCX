import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteTeacher, updateTeacher } from "@/lib/store";
import { isUuid, isValidPassword } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ message: "无管理员权限" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ message: "老师 ID 无效" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { active?: boolean; password?: string } | null;
  if (!body) return NextResponse.json({ message: "请求内容无效" }, { status: 400 });
  if (body.password && !isValidPassword(body.password)) {
    return NextResponse.json({ message: "密码长度必须为 6-128 位" }, { status: 400 });
  }
  return (await updateTeacher(id, body))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ message: "老师不存在" }, { status: 404 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ message: "无管理员权限" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ message: "老师 ID 无效" }, { status: 400 });
  return (await deleteTeacher(id))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ message: "老师不存在" }, { status: 404 });
}
