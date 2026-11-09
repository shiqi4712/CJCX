import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteTeachers } from "@/lib/store";
import { isUuid } from "@/lib/validation";

export async function POST(request: Request) {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ message: "无管理员权限" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) {
    return NextResponse.json({ message: "请选择要删除的老师" }, { status: 400 });
  }
  if (uniqueIds.some((id) => !isUuid(id))) {
    return NextResponse.json({ message: "老师 ID 无效" }, { status: 400 });
  }

  const deletedCount = await deleteTeachers(uniqueIds);
  return NextResponse.json({ ok: true, deletedCount });
}
