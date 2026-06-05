import { cookies } from "next/headers";
import type { Role } from "./types";

export type Session = {
  teacherName: string;
  role: Role;
};

const COOKIE_NAME = "admission_session";

export async function setSession(session: Session) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, Buffer.from(JSON.stringify(session), "utf8").toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Session;
  } catch {
    return null;
  }
}

export async function requireSession(role?: Role) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (role && session.role !== role) {
    return null;
  }

  return session;
}
