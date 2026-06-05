export type Role = "admin" | "teacher";

export type Student = {
  id: string;
  studentName: string;
  teacherName: string;
  score: string;
  admission: string;
  className: string;
  detail: string;
  advice: string;
  queried: boolean;
  queryCount: number;
  lastQuery: string | null;
  published: boolean;
};

export type TeacherAccount = {
  id: string;
  teacherName: string;
  password: string;
  role: Role;
  active: boolean;
};

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
};

export type SheetTeacherRow = {
  teacherName: string;
  password: string;
};
