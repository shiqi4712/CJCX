import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getConsoleTeachers } from "@/lib/store";

export async function GET(request: Request) {
  if (!await requireSession("admin")) return NextResponse.json({ message: "无管理员权限" }, { status: 403 });
  const started = performance.now();
  const result = await getConsoleTeachers(Number(new URL(request.url).searchParams.get("page") || 1));
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store",
    "Server-Timing": `teachers;dur=${(performance.now() - started).toFixed(1)}` } });
}
