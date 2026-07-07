import type { ProgramType } from "./programs";

export type Role = "admin" | "teacher";

export type Student = {
  id: string;
  studentName: string;
  teacherName: string;
  score: string;
  programType: ProgramType;
  admission: string;
  className: string;
  detail: string;
  advice: string;
  queried: boolean;
  queryCount: number;
  lastQuery: string | null;
  preferredCourseTime: string | null;
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
  resultStatus: "success" | "not_found";
  queriedAt: string;
};

export type SheetStudentRow = {
  studentName: string;
  score: string;
  teacherName: string;
  programType?: ProgramType;
};

export type SheetTeacherRow = {
  teacherName: string;
  password: string;
};
