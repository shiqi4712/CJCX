import { NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { login } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { account?: string; password?: string } | null;
  const account = body?.account?.trim();
  const password = body?.password ?? "";

  if (!account || !password) {
    return NextResponse.json({ message: "请输入账号和密码" }, { status: 400 });
  }

  const user = login(account, password);
  if (!user) {
    return NextResponse.json({ message: "账号或密码不正确" }, { status: 401 });
  }

  await setSession({ teacherName: user.teacherName, role: user.role });
  return NextResponse.json({ teacherName: user.teacherName, role: user.role });
}
