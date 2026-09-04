import { COURSE_PLAN_LINES, normalizeCoursePlanLine, type CoursePlanPayload } from "./course-plan-config";
import { createCoursePlanLink } from "./store";
import type { Role, Student } from "./types";

export function encodeCoursePlanPayload(payload: CoursePlanPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function buildStudentCoursePlanLink(student: Student, origin: string) {
  const courseLine = normalizeCoursePlanLine(student.courseLine);
  const line = COURSE_PLAN_LINES[courseLine];
  const targetClass = student.className || line.targetClass;
  const payload: CoursePlanPayload = {
    studentId: student.id,
    student: student.studentName,
    score: student.score,
    courseLine,
    targetClass,
    focus: line.focusDefault,
    goal: line.goalDefault,
    preferredCourseTime: student.preferredCourseTime,
    showPrice: true,
    price: line.price
  };

  return {
    courseLine,
    targetClass,
    planUrl: `${origin.replace(/\/$/, "")}/course-plan#p=${encodeCoursePlanPayload(payload)}`
  };
}

export async function createAutomaticCoursePlanLinks(
  studentIds: string[],
  students: Student[],
  origin: string,
  role: Role,
  generatedBy: string
) {
  const uniqueIds = [...new Set(studentIds)];
  let generatedPlanCount = 0;

  for (const student of students.filter((item) => uniqueIds.includes(item.id))) {
    const built = buildStudentCoursePlanLink(student, origin);
    const link = await createCoursePlanLink(
      {
        studentId: student.id,
        courseLine: built.courseLine,
        targetClass: built.targetClass,
        planUrl: built.planUrl
      },
      role,
      generatedBy
    );
    if (link) generatedPlanCount += 1;
  }

  return generatedPlanCount;
}
