import type { ProgramType } from "./programs";

export type Role = "admin" | "teacher";
export type LearningCourseLine = "python" | "moon" | "rocket";

export type Student = {
  id: string;
  studentName: string;
  teacherName: string;
  score: string;
  overallScore: string | null;
  programType: ProgramType;
  courseLine: LearningCourseLine;
  warZone: string;
  admission: string;
  className: string;
  detail: string;
  advice: string;
  queried: boolean;
  queryCount: number;
  lastQuery: string | null;
  preferredCourseTime: string | null;
  homeworkLessonCount: number;
  videoCount: number;
  messageCount: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TeacherAccount = {
  id: string;
  teacherName: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: string;
};

export type PublicTeacher = Omit<TeacherAccount, "passwordHash">;

export type QueryLog = {
  id: string;
  inputStudentName: string;
  matchedStudentId: string | null;
  matchedStudentName: string | null;
  matchedTeacherName: string | null;
  resultStatus: "success" | "not_found" | "pending_review";
  queriedAt: string;
};

export type QueryReleaseSettings = {
  resultOpenAt: string | null;
};

export type SheetStudentRow = {
  studentName: string;
  score: string;
  overallScore?: string | null;
  teacherName: string;
  programType?: string;
  courseLine?: LearningCourseLine;
  homeworkLessonCount?: number;
  videoCount?: number;
  messageCount?: number;
  warZone?: string;
};

export type SheetTeacherRow = {
  teacherName: string;
  password: string;
};
