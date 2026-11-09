import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getConsoleStudents } from "@/lib/store";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const started = performance.now();
  const result = await getConsoleStudents(session.role, session.teacherName, Number(params.get("page") || 1),
    params.get("search") || "", params.get("zone") || "all");
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store",
    "Server-Timing": `students;dur=${(performance.now() - started).toFixed(1)}` } });
}
