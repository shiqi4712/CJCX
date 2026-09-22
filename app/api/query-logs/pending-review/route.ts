import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPendingReviewLogs } from "@/lib/store";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ message: "请先登录" }, { status: 401 });
  }

  const requestedPage = Number(new URL(request.url).searchParams.get("page") ?? 1);
  return NextResponse.json(
    await getPendingReviewLogs(session.role, session.teacherName, Number.isFinite(requestedPage) ? requestedPage : 1)
  );
}
