import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getConsoleSummary } from "@/lib/store";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ message: "请先登录" }, { status: 401 });
  }

  const started = performance.now();
  const overview = await getConsoleSummary(session.role, session.teacherName);
  return NextResponse.json({
    ...overview,
    session: {
      teacherName: session.teacherName,
      role: session.role
    }
  }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `summary;dur=${(performance.now() - started).toFixed(1)}` } });
}
