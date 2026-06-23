import { randomUUID } from "node:crypto";
import { ensureSchema, getSql, hasDatabase, requireDatabaseInProduction } from "./database";
import { hashPassword, verifyPassword } from "./passwords";
import type {
  PublicTeacher,
  QueryLog,
  Role,
  SheetStudentRow,
  SheetTeacherRow,
  Student,
  TeacherAccount
} from "./types";

const normalizeName = (value: string) => value.trim().replace(/\s+/g, "").toLowerCase();
const nowText = () => new Date().toISOString();
export const ALREADY_QUERIED_RESULT = "already_queried" as const;

function buildAdmissionByScore(score: string) {
  if (score.trim().toUpperCase() === "B") {
    return {
      admission: "未录取",
      className: "继续努力",
      detail: "编程猫希望你继续保持热爱，稳扎稳打提升基础能力，下一次选拔再向目标发起冲刺。",
      advice: "这次结果不代表终点。建议巩固课堂基础、保持每周练习，并在老师指导下逐步提升。"
    };
  }

  return {
    admission: "已录取",
    className: "英才班",
    detail: "恭喜你在编程猫英才班选拔中获得英才班录取资格。",
    advice: "期待你的加入，一起开启编程之旅！"
  };
}

type MemoryState = {
  students: Student[];
  teachers: TeacherAccount[];
  queryLogs: QueryLog[];
  initialized: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var admissionMemoryState: MemoryState | undefined;
}

const memory = (globalThis.admissionMemoryState ??= {
  students: [],
  teachers: [],
  queryLogs: [],
  initialized: false
});

async function ensureReady() {
  requireDatabaseInProduction();
  if (hasDatabase()) {
    await ensureSchema();
    return;
  }

  if (!memory.initialized) {
    memory.teachers = await Promise.all(
      [
        ["00000000-0000-4000-8000-000000000001", "xiaohong", "bdsz666"],
        ["00000000-0000-4000-8000-000000000002", "zhiyang", "tt666"],
        ["00000000-0000-4000-8000-000000000003", "zeyu", "ty666"]
      ].map(async ([id, teacherName, password]) => ({
        id,
        teacherName,
        passwordHash: await hashPassword(password),
        role: "admin" as const,
        active: true,
        createdAt: nowText()
      }))
    );
    memory.initialized = true;
  }
}

function mapStudent(row: Record<string, unknown>): Student {
  return {
    id: String(row.id),
    studentName: String(row.student_name),
    teacherName: row.teacher_name ? String(row.teacher_name) : "未分配老师",
    score: String(row.score),
    admission: String(row.admission),
    className: String(row.class_name),
    detail: String(row.detail),
    advice: String(row.advice),
    queried: Boolean(row.queried),
    queryCount: Number(row.query_count),
    lastQuery: row.last_query ? new Date(String(row.last_query)).toISOString() : null,
    preferredCourseTime: row.preferred_course_time ? String(row.preferred_course_time) : null,
    published: Boolean(row.published),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function mapTeacher(row: Record<string, unknown>): TeacherAccount {
  return {
    id: String(row.id),
    teacherName: String(row.teacher_name),
    passwordHash: String(row.password_hash),
    role: row.role as Role,
    active: Boolean(row.active),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

export async function queryStudentByName(studentName: string) {
  await ensureReady();
  const normalized = normalizeName(studentName);

  if (!hasDatabase()) {
    const student = memory.students.find((item) => item.published && normalizeName(item.studentName) === normalized);
    const queriedAt = nowText();
    memory.queryLogs.unshift({
      id: randomUUID(),
      inputStudentName: studentName,
      matchedStudentId: student?.id ?? null,
      resultStatus: student ? "success" : "not_found",
      queriedAt
    });
    if (!student) return null;
    if (student.queried) return ALREADY_QUERIED_RESULT;
    student.queried = true;
    student.queryCount += 1;
    student.lastQuery = queriedAt;
    return student;
  }

  const sql = getSql();
  const rows = (await sql.query(
    `SELECT * FROM students
     WHERE normalized_name = $1 AND published = true
     ORDER BY created_at ASC, id ASC LIMIT 1`,
    [normalized]
  )) as unknown as Record<string, unknown>[];
  const row = rows[0];
  const logId = randomUUID();

  if (!row) {
    await sql.query(
      `INSERT INTO query_logs (id, input_student_name, matched_student_id, result_status)
       VALUES ($1, $2, NULL, 'not_found')`,
      [logId, studentName]
    );
    return null;
  }
  if (Boolean(row.queried)) {
    await sql.query(
      `INSERT INTO query_logs (id, input_student_name, matched_student_id, result_status)
       VALUES ($1, $2, $3, 'success')`,
      [logId, studentName, row.id]
    );
    return ALREADY_QUERIED_RESULT;
  }

  const updated = (await sql.query(
    `UPDATE students SET queried = true, query_count = query_count + 1,
       last_query = now(), updated_at = now() WHERE id = $1 RETURNING *`,
    [row.id]
  )) as unknown as Record<string, unknown>[];
  await sql.query(
    `INSERT INTO query_logs (id, input_student_name, matched_student_id, result_status)
     VALUES ($1, $2, $3, 'success')`,
    [logId, studentName, row.id]
  );
  return mapStudent(updated[0]);
}

export async function login(account: string, password: string) {
  await ensureReady();
  let teacher: TeacherAccount | undefined;

  if (hasDatabase()) {
    const rows = (await getSql().query(
      "SELECT * FROM teacher_accounts WHERE teacher_name = $1 AND active = true LIMIT 1",
      [account.trim()]
    )) as unknown as Record<string, unknown>[];
    teacher = rows[0] ? mapTeacher(rows[0]) : undefined;
  } else {
    teacher = memory.teachers.find((item) => item.active && item.teacherName === account.trim());
  }

  return teacher && (await verifyPassword(password, teacher.passwordHash)) ? teacher : null;
}

export async function getOverview(role: Role, teacherName?: string) {
  await ensureReady();
  let students: Student[];
  let teachers: PublicTeacher[];
  let queryLogs: QueryLog[];

  if (hasDatabase()) {
    const sql = getSql();
    const studentRows = (await sql.query(
      role === "admin"
        ? "SELECT * FROM students ORDER BY created_at DESC"
        : "SELECT * FROM students WHERE teacher_name = $1 ORDER BY created_at DESC",
      role === "admin" ? [] : [teacherName]
    )) as unknown as Record<string, unknown>[];
    students = studentRows.map(mapStudent);

    const teacherRows = (await sql.query(
      "SELECT id, teacher_name, role, active, created_at FROM teacher_accounts ORDER BY role, teacher_name"
    )) as unknown as Record<string, unknown>[];
    teachers = teacherRows.map((row) => ({
      id: String(row.id),
      teacherName: String(row.teacher_name),
      role: row.role as Role,
      active: Boolean(row.active),
      createdAt: new Date(String(row.created_at)).toISOString()
    }));

    const logRows =
      role === "admin"
        ? ((await sql.query("SELECT * FROM query_logs ORDER BY queried_at DESC LIMIT 50")) as unknown as Record<
            string,
            unknown
          >[])
        : [];
    queryLogs = logRows.map((row) => ({
      id: String(row.id),
      inputStudentName: String(row.input_student_name),
      matchedStudentId: row.matched_student_id ? String(row.matched_student_id) : null,
      resultStatus: row.result_status as QueryLog["resultStatus"],
      queriedAt: new Date(String(row.queried_at)).toISOString()
    }));
  } else {
    students =
      role === "admin" ? [...memory.students] : memory.students.filter((item) => item.teacherName === teacherName);
    teachers = memory.teachers.map(({ passwordHash: _passwordHash, ...teacher }) => teacher);
    queryLogs = role === "admin" ? memory.queryLogs.slice(0, 50) : [];
  }

  return {
    stats: {
      studentCount: students.length,
      teacherCount: teachers.filter((teacher) => teacher.role === "teacher" && teacher.active).length,
      admittedCount: students.filter((student) => student.admission === "已录取").length,
      queriedCount: students.filter((student) => student.queried).length,
      pendingCount: students.filter((student) => !student.queried).length
    },
    students,
    teachers,
    queryLogs,
    storageMode: hasDatabase() ? "postgres" : "memory"
  };
}

export async function importStudents(rows: SheetStudentRow[]) {
  await ensureReady();
  let importedCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    const admission = buildAdmissionByScore(row.score);
    const teacherName = row.teacherName && row.teacherName !== "未分配老师" ? row.teacherName : null;

    if (!hasDatabase()) {
      const existing = memory.students.find(
        (student) =>
          normalizeName(student.studentName) === normalizeName(row.studentName) &&
          student.teacherName === (teacherName ?? "未分配老师")
      );
      if (existing) {
        Object.assign(existing, { score: row.score, ...admission, updatedAt: nowText() });
        updatedCount += 1;
      } else {
        const time = nowText();
        memory.students.push({
          id: randomUUID(),
          studentName: row.studentName,
          teacherName: teacherName ?? "未分配老师",
          score: row.score,
          ...admission,
        queried: false,
        queryCount: 0,
        lastQuery: null,
        preferredCourseTime: null,
        published: true,
          createdAt: time,
          updatedAt: time
        });
        importedCount += 1;
      }
      continue;
    }

    const sql = getSql();
    if (teacherName) {
      const teacherRows = (await sql.query(
        "SELECT 1 FROM teacher_accounts WHERE teacher_name = $1 AND role = 'teacher'",
        [teacherName]
      )) as unknown[];
      if (teacherRows.length === 0) throw new Error(`老师账号不存在：${teacherName}`);
    }

    if (!teacherName) {
      const existing = (await sql.query(
        "SELECT id FROM students WHERE normalized_name=$1 AND teacher_name IS NULL LIMIT 1",
        [normalizeName(row.studentName)]
      )) as unknown as Array<{ id: string }>;
      if (existing[0]) {
        await sql.query(
          `UPDATE students SET student_name=$2, score=$3, admission=$4, class_name=$5,
             detail=$6, advice=$7, updated_at=now() WHERE id=$1`,
          [
            existing[0].id,
            row.studentName,
            row.score,
            admission.admission,
            admission.className,
            admission.detail,
            admission.advice
          ]
        );
        updatedCount += 1;
        continue;
      }
    }

    const result = (await sql.query(
      `INSERT INTO students (
         id, student_name, normalized_name, teacher_name, score, admission, class_name, detail, advice
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (normalized_name, teacher_name) DO UPDATE SET
         student_name = EXCLUDED.student_name, score = EXCLUDED.score,
         admission = EXCLUDED.admission, class_name = EXCLUDED.class_name,
         detail = EXCLUDED.detail, advice = EXCLUDED.advice, updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [
        randomUUID(),
        row.studentName,
        normalizeName(row.studentName),
        teacherName,
        row.score,
        admission.admission,
        admission.className,
        admission.detail,
        admission.advice
      ]
    )) as unknown as Array<{ inserted: boolean }>;
    result[0]?.inserted ? (importedCount += 1) : (updatedCount += 1);
  }

  return { importedCount, updatedCount, totalCount: (await getOverview("admin")).stats.studentCount };
}

export async function importTeachers(rows: SheetTeacherRow[]) {
  await ensureReady();
  let importedCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    const passwordHash = await hashPassword(row.password || "bcm666");
    if (!hasDatabase()) {
      const existing = memory.teachers.find((teacher) => teacher.teacherName === row.teacherName);
      if (existing) {
        existing.passwordHash = passwordHash;
        existing.active = true;
        updatedCount += 1;
      } else {
        memory.teachers.push({
          id: randomUUID(),
          teacherName: row.teacherName,
          passwordHash,
          role: "teacher",
          active: true,
          createdAt: nowText()
        });
        importedCount += 1;
      }
      continue;
    }

    const result = (await getSql().query(
      `INSERT INTO teacher_accounts (id, teacher_name, password_hash, role, active)
       VALUES ($1, $2, $3, 'teacher', true)
       ON CONFLICT (teacher_name) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = true
       WHERE teacher_accounts.role = 'teacher'
       RETURNING (xmax = 0) AS inserted`,
      [randomUUID(), row.teacherName, passwordHash]
    )) as unknown as Array<{ inserted: boolean }>;
    result[0]?.inserted ? (importedCount += 1) : (updatedCount += 1);
  }

  const totalCount = (await getOverview("admin")).teachers.filter((teacher) => teacher.role === "teacher").length;
  return { importedCount, updatedCount, totalCount };
}

export async function updateStudent(
  id: string,
  input: Partial<Pick<Student, "studentName" | "score" | "teacherName" | "published" | "preferredCourseTime">>
) {
  await ensureReady();
  const current = (await getOverview("admin")).students.find((student) => student.id === id);
  if (!current) return null;

  const studentName = input.studentName ?? current.studentName;
  const score = input.score ?? current.score;
  const teacherName = input.teacherName ?? current.teacherName;
  const published = input.published ?? current.published;
  const preferredCourseTime = input.preferredCourseTime ?? current.preferredCourseTime;
  const admission = buildAdmissionByScore(score);

  if (!hasDatabase()) {
    Object.assign(current, {
      studentName,
      score,
      teacherName,
      published,
      preferredCourseTime,
      ...admission,
      updatedAt: nowText()
    });
    const index = memory.students.findIndex((student) => student.id === id);
    memory.students[index] = current;
    return current;
  }

  const rows = (await getSql().query(
    `UPDATE students SET student_name=$2, normalized_name=$3, score=$4, teacher_name=$5,
       published=$6, admission=$7, class_name=$8, detail=$9, advice=$10,
       preferred_course_time=$11, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      id,
      studentName,
      normalizeName(studentName),
      score,
      teacherName === "未分配老师" ? null : teacherName,
      published,
      admission.admission,
      admission.className,
      admission.detail,
      admission.advice,
      preferredCourseTime
    ]
  )) as unknown as Record<string, unknown>[];
  return rows[0] ? mapStudent(rows[0]) : null;
}

export async function updateStudentCourseTime(id: string, preferredCourseTime: string) {
  await ensureReady();

  if (!hasDatabase()) {
    const student = memory.students.find((item) => item.id === id);
    if (!student) return null;
    student.preferredCourseTime = preferredCourseTime;
    student.updatedAt = nowText();
    return student;
  }

  const rows = (await getSql().query(
    `UPDATE students SET preferred_course_time=$2, updated_at=now()
     WHERE id=$1 AND published=true RETURNING *`,
    [id, preferredCourseTime]
  )) as unknown as Record<string, unknown>[];
  return rows[0] ? mapStudent(rows[0]) : null;
}

export async function resetStudentQuery(id: string, role: Role, teacherName?: string) {
  await ensureReady();

  if (!hasDatabase()) {
    const student = memory.students.find((item) => item.id === id);
    if (!student || (role !== "admin" && student.teacherName !== teacherName)) return null;
    student.queried = false;
    student.queryCount = 0;
    student.lastQuery = null;
    student.updatedAt = nowText();
    return student;
  }

  const rows = (await getSql().query(
    `UPDATE students SET queried=false, query_count=0, last_query=NULL, updated_at=now()
     WHERE id=$1 AND ($2='admin' OR teacher_name=$3) RETURNING *`,
    [id, role, teacherName ?? null]
  )) as unknown as Record<string, unknown>[];
  return rows[0] ? mapStudent(rows[0]) : null;
}

export async function deleteStudent(id: string) {
  await ensureReady();
  if (!hasDatabase()) {
    const index = memory.students.findIndex((student) => student.id === id);
    if (index < 0) return false;
    memory.students.splice(index, 1);
    return true;
  }
  const rows = (await getSql().query("DELETE FROM students WHERE id=$1 RETURNING id", [id])) as unknown[];
  return rows.length > 0;
}

export async function deleteStudents(ids: string[]) {
  await ensureReady();
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return 0;

  if (!hasDatabase()) {
    const before = memory.students.length;
    memory.students = memory.students.filter((student) => !uniqueIds.includes(student.id));
    return before - memory.students.length;
  }

  const rows = (await getSql().query("DELETE FROM students WHERE id = ANY($1::uuid[]) RETURNING id", [
    uniqueIds
  ])) as unknown[];
  return rows.length;
}

export async function updateTeacher(id: string, input: { active?: boolean; password?: string }) {
  await ensureReady();
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  if (!hasDatabase()) {
    const teacher = memory.teachers.find((item) => item.id === id && item.role === "teacher");
    if (!teacher) return false;
    if (typeof input.active === "boolean") teacher.active = input.active;
    if (passwordHash) teacher.passwordHash = passwordHash;
    return true;
  }
  const rows = (await getSql().query(
    `UPDATE teacher_accounts SET
       active = COALESCE($2, active),
       password_hash = COALESCE($3, password_hash)
     WHERE id=$1 AND role='teacher' RETURNING id`,
    [id, input.active ?? null, passwordHash]
  )) as unknown[];
  return rows.length > 0;
}

export async function deleteTeacher(id: string) {
  await ensureReady();
  if (!hasDatabase()) {
    const index = memory.teachers.findIndex((teacher) => teacher.id === id && teacher.role === "teacher");
    if (index < 0) return false;
    const name = memory.teachers[index].teacherName;
    memory.teachers.splice(index, 1);
    memory.students.forEach((student) => {
      if (student.teacherName === name) student.teacherName = "未分配老师";
    });
    return true;
  }
  const rows = (await getSql().query(
    "DELETE FROM teacher_accounts WHERE id=$1 AND role='teacher' RETURNING id",
    [id]
  )) as unknown[];
  return rows.length > 0;
}

export async function deleteTeachers(ids: string[]) {
  await ensureReady();
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return 0;

  if (!hasDatabase()) {
    const removedTeacherNames = memory.teachers
      .filter((teacher) => uniqueIds.includes(teacher.id) && teacher.role === "teacher")
      .map((teacher) => teacher.teacherName);
    memory.teachers = memory.teachers.filter(
      (teacher) => !(uniqueIds.includes(teacher.id) && teacher.role === "teacher")
    );
    memory.students.forEach((student) => {
      if (removedTeacherNames.includes(student.teacherName)) {
        student.teacherName = "未分配老师";
      }
    });
    return removedTeacherNames.length;
  }

  const rows = (await getSql().query(
    "DELETE FROM teacher_accounts WHERE id = ANY($1::uuid[]) AND role='teacher' RETURNING id",
    [uniqueIds]
  )) as unknown[];
  return rows.length;
}

export function resetMemoryStoreForTests() {
  memory.students = [];
  memory.teachers = [];
  memory.queryLogs = [];
  memory.initialized = false;
}
