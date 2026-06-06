import { NextResponse } from "next/server";
import { buildSessionValue, serializeSessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { login } from "@/lib/store";
import { cleanName } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { account?: string; password?: string } | null;
  const account = cleanName(body?.account);
  const password = body?.password ?? "";

  if (!account || !password) {
    return NextResponse.json({ message: "请输入账号和密码" }, { status: 400 });
  }

  const limit = await checkRateLimit(`login:${getClientIp(request)}:${account}`, 5, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "登录尝试过多，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const user = await login(account, password);
  if (!user) {
    return NextResponse.json({ message: "账号或密码不正确" }, { status: 401 });
  }

  const response = NextResponse.json({ teacherName: user.teacherName, role: user.role });
  response.headers.append(
    "Set-Cookie",
    serializeSessionCookie(buildSessionValue({ teacherName: user.teacherName, role: user.role }))
  );
  return response;
}
