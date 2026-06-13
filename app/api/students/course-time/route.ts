import { NextResponse } from "next/server";
import { COURSE_TIME_OPTIONS, isValidCourseTime } from "@/lib/course-times";
import { updateStudentCourseTime } from "@/lib/store";
import { isUuid } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { studentId?: string; courseTime?: string } | null;
  const studentId = body?.studentId ?? "";
  const courseTime = body?.courseTime ?? "";

  if (!isUuid(studentId)) {
    return NextResponse.json({ message: "学生 ID 无效" }, { status: 400 });
  }
  if (!isValidCourseTime(courseTime)) {
    return NextResponse.json(
      { message: "请选择有效的上课时间", options: COURSE_TIME_OPTIONS },
      { status: 400 }
    );
  }

  const student = await updateStudentCourseTime(studentId, courseTime);
  return student
    ? NextResponse.json({ preferredCourseTime: student.preferredCourseTime })
    : NextResponse.json({ message: "学生不存在或未发布" }, { status: 404 });
}
