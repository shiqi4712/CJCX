import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getQueryReleaseSettings, updateQueryReleaseSettings } from "@/lib/store";

export async function GET() {
  const session = await requireSession("admin");
  if (!session) {
    return NextResponse.json({ message: "请先使用管理员账号登录" }, { status: 401 });
  }

  return NextResponse.json(await getQueryReleaseSettings());
}

export async function PATCH(request: Request) {
  const session = await requireSession("admin");
  if (!session) {
    return NextResponse.json({ message: "请先使用管理员账号登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { resultOpenAt?: string | null } | null;
  const value = body?.resultOpenAt?.trim() || null;
  if (value && Number.isNaN(new Date(value).getTime())) {
    return NextResponse.json({ message: "开放查询时间格式无效" }, { status: 400 });
  }

  return NextResponse.json(await updateQueryReleaseSettings({ resultOpenAt: value }));
}
