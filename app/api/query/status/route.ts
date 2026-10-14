import { NextResponse } from "next/server";
import { getQueryReleaseState } from "@/lib/store";

export async function GET() {
  return NextResponse.json(await getQueryReleaseState(), {
    headers: { "Cache-Control": "no-store" }
  });
}
