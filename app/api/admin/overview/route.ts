import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getOverview } from "@/lib/store";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ message: "请先登录" }, { status: 401 });
  }

  return NextResponse.json(await getOverview(session.role, session.teacherName));
}
