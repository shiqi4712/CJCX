import { NextResponse } from "next/server";
import { serializeClearedSessionCookie } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", serializeClearedSessionCookie());
  return response;
}
