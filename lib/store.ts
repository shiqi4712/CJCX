import { randomUUID } from "node:crypto";
import { ensureSchema, getSql, hasDatabase, requireDatabaseInProduction } from "./database";
import { hashPassword, verifyPassword } from "./passwords";
import { getProgramAdmissionDetail, normalizeProgramType } from "./programs";
import type {
  PublicTeacher,
  QueryLog,
  QueryReleaseSettings,
  Role,
  SheetStudentRow,
  SheetTeacherRow,
  Student,
  TeacherAccount
} from "./types";

const normalizeName = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
    .toLowerCase();
const nowText = () => new Date().toISOString();

function generateOverallScore(admissionStatus: string) {
  const admitted = admissionStatus === "已录取";
  const minCents = admitted ? 9700 : 8500;
  const maxCents = admitted ? 9900 : 9500;
  const cents = Math.floor(Math.random() * (maxCents - minCents + 1)) + minCents;
  return (cents / 100).toFixed(2);
}

function buildAdmissionByScore(score: string, inputProgramType?: string | null, importedClassName?: string | null) {
  const programType = normalizeProgramType(inputProgramType);
  const className = String(importedClassName ?? inputProgramType ?? "").trim() || programType;
  const normalizedScore = score.trim().replace(/\s+/g, "").toUpperCase();
  if (!["S", "A", "A+", "前10%"].includes(normalizedScore)) {
    return {
      programType,
      admission: "未录取",
      className: "继续努力",
      detail: "编程猫希望你继续保持热爱，稳扎稳打提升基础能力，下一次选拔再向目标发起冲刺。",
      advice: "这次结果不代表终点。建议巩固课堂基础、保持每周练习，并在老师指导下逐步提升。"
    };
  }

  return {
    programType,
    admission: "已录取",
    className,
    detail: getProgramAdmissionDetail(programType),
    advice: "期待你的加入，一起开启编程之旅！"
  };
}

type MemoryState = {
  students: Student[];
  teachers: TeacherAccount[];
  queryLogs: QueryLog[];
  settings: QueryReleaseSettings;
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
  settings: { resultOpenAt: null },
  initialized: false
});

function normalizeOpenAt(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function getQueryReleaseSettings(): Promise<QueryReleaseSettings> {
  await ensureReady();
  if (!hasDatabase()) return memory.settings;

  const rows = (await getSql().query(
    "SELECT setting_value FROM system_settings WHERE setting_key = 'result_open_at' LIMIT 1"
  )) as unknown as Array<{ setting_value: string | null }>;
  return { resultOpenAt: normalizeOpenAt(rows[0]?.setting_value) };
}

export async function updateQueryReleaseSettings(input: QueryReleaseSettings) {
  await ensureReady();
  const resultOpenAt = normalizeOpenAt(input.resultOpenAt);

  if (!hasDatabase()) {
    memory.settings = { resultOpenAt };
    return memory.settings;
  }

  const sql = getSql();
  if (resultOpenAt) {
    if (sql.dialect === "mysql") {
      await sql.query(
        `INSERT INTO system_settings (setting_key, setting_value)
         VALUES ('result_open_at', $1)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [resultOpenAt]
      );
    } else {
      await sql.query(
        `INSERT INTO system_settings (setting_key, setting_value)
         VALUES ('result_open_at', $1)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()`,
        [resultOpenAt]
      );
    }
  } else {
    await sql.query("DELETE FROM system_settings WHERE setting_key = 'result_open_at'");
  }

  return { resultOpenAt };
}

export async function isResultQueryOpen() {
  return (await getQueryReleaseState()).open;
}

export async function getQueryReleaseState() {
  const settings = await getQueryReleaseSettings();
  const serverNow = new Date();
  return {
    open: !settings.resultOpenAt || serverNow.getTime() >= new Date(settings.resultOpenAt).getTime(),
    resultOpenAt: settings.resultOpenAt,
    serverNow: serverNow.toISOString()
  };
}

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
        ["00000000-0000-4000-8000-000000000003", "zeyu", "ty666"],
        ["00000000-0000-4000-8000-000000000004", "jiangxiao", "df666"],
        ["00000000-0000-4000-8000-000000000005", "shiqi", "shiqi123"],
        ["00000000-0000-4000-8000-000000000006", "yangxu", "cz666"],
        ["00000000-0000-4000-8000-000000000007", "huanglei", "huanglei666"]
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
  const className = String(row.class_name);
  return {
    id: String(row.id),
    studentName: String(row.student_name),
    teacherName: row.teacher_name ? String(row.teacher_name) : "未分配老师",
    score: String(row.score),
    overallScore: row.overall_score ? String(row.overall_score) : null,
    programType: normalizeProgramType(String(row.program_type ?? "")),
    warZone: row.war_zone ? String(row.war_zone) : "",
    admission: String(row.admission),
    className,
    detail: String(row.detail),
    advice: String(row.advice),
    queried: Boolean(row.queried),
    queryCount: Number(row.query_count),
    lastQuery: row.last_query ? new Date(String(row.last_query)).toISOString() : null,
    preferredCourseTime: row.preferred_course_time ? String(row.preferred_course_time) : null,
    homeworkLessonCount: Number(row.homework_lesson_count ?? 0),
    videoCount: Number(row.video_count ?? 0),
    messageCount: Number(row.message_count ?? 0),
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

function mapQueryLog(row: Record<string, unknown>): QueryLog {
  return {
    id: String(row.id),
    inputStudentName: String(row.input_student_name),
    matchedStudentId: row.matched_student_id ? String(row.matched_student_id) : null,
    matchedStudentName: row.matched_student_name ? String(row.matched_student_name) : null,
    matchedTeacherName: row.matched_teacher_name ? String(row.matched_teacher_name) : null,
    resultStatus: row.result_status as QueryLog["resultStatus"],
    queriedAt: new Date(String(row.queried_at)).toISOString()
  };
}

export async function recordPendingReviewQuery(studentName: string) {
  await ensureReady();
  const normalized = normalizeName(studentName);
  const queriedAt = nowText();

  if (!hasDatabase()) {
    const student = memory.students.find((item) => item.published && normalizeName(item.studentName) === normalized);
    memory.queryLogs.unshift({
      id: randomUUID(),
      inputStudentName: studentName,
      matchedStudentId: student?.id ?? null,
      matchedStudentName: student?.studentName ?? null,
      matchedTeacherName: student?.teacherName ?? null,
      resultStatus: "pending_review",
      queriedAt
    });
    return;
  }

  const sql = getSql();
  const rows = (await sql.query(
    `SELECT id, student_name, teacher_name FROM students
     WHERE (normalized_name = $1 OR student_name = $2) AND published = true
     ORDER BY created_at ASC, id ASC LIMIT 1`,
    [normalized, studentName.trim()]
  )) as unknown as Record<string, unknown>[];
  const row = rows[0];
  await sql.query(
    `INSERT INTO query_logs (
       id, input_student_name, matched_student_id, matched_student_name, matched_teacher_name, result_status
     ) VALUES ($1, $2, $3, $4, $5, 'pending_review')`,
    [
      randomUUID(),
      studentName,
      row?.id ?? null,
      row?.student_name ? String(row.student_name) : null,
      row?.teacher_name ? String(row.teacher_name) : null
    ]
  );
}

const PENDING_REVIEW_PAGE_SIZE = 10;

function filterMemoryPendingReviewLogs(role: Role, teacherName?: string) {
  return memory.queryLogs.filter(
    (log) =>
      log.resultStatus === "pending_review" &&
      (role === "admin" || log.matchedTeacherName === teacherName)
  );
}

export async function getPendingReviewLogs(role: Role, teacherName: string | undefined, requestedPage = 1) {
  await ensureReady();
  const page = Math.max(1, Math.trunc(requestedPage) || 1);

  if (!hasDatabase()) {
    const allRows = filterMemoryPendingReviewLogs(role, teacherName);
    const total = allRows.length;
    const pageCount = Math.max(1, Math.ceil(total / PENDING_REVIEW_PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const offset = (currentPage - 1) * PENDING_REVIEW_PAGE_SIZE;
    return {
      rows: allRows.slice(offset, offset + PENDING_REVIEW_PAGE_SIZE),
      total,
      page: currentPage,
      pageSize: PENDING_REVIEW_PAGE_SIZE,
      pageCount
    };
  }

  const sql = getSql();
  const teacherFilter = role === "teacher" ? " AND matched_teacher_name = $1" : "";
  const params = role === "teacher" ? [teacherName] : [];
  const countRows = (await sql.query(
    `SELECT COUNT(*) AS total_count FROM query_logs WHERE result_status = 'pending_review'${teacherFilter}`,
    params
  )) as unknown as Record<string, unknown>[];
  const total = Number(countRows[0]?.total_count ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PENDING_REVIEW_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * PENDING_REVIEW_PAGE_SIZE;
  const rows = (await sql.query(
    `SELECT * FROM query_logs
     WHERE result_status = 'pending_review'${teacherFilter}
     ORDER BY queried_at DESC, id DESC
     LIMIT ${PENDING_REVIEW_PAGE_SIZE} OFFSET ${offset}`,
    params
  )) as unknown as Record<string, unknown>[];

  return {
    rows: rows.map(mapQueryLog),
    total,
    page: currentPage,
    pageSize: PENDING_REVIEW_PAGE_SIZE,
    pageCount
  };
}

export async function getPendingReviewLogsForExport(role: Role, teacherName?: string) {
  await ensureReady();

  if (!hasDatabase()) {
    return filterMemoryPendingReviewLogs(role, teacherName);
  }

  const teacherFilter = role === "teacher" ? " AND matched_teacher_name = $1" : "";
  const params = role === "teacher" ? [teacherName] : [];
  const rows = (await getSql().query(
    `SELECT * FROM query_logs
     WHERE result_status = 'pending_review'${teacherFilter}
     ORDER BY queried_at DESC, id DESC`,
    params
  )) as unknown as Record<string, unknown>[];
  return rows.map(mapQueryLog);
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
      matchedStudentName: student?.studentName ?? null,
      matchedTeacherName: student?.teacherName ?? null,
      resultStatus: student ? "success" : "not_found",
      queriedAt
    });
    if (!student) return null;
    student.queryCount = 1;
    student.queried = true;
    student.lastQuery = queriedAt;
    return student;
  }

  const sql = getSql();
  const rows = (await sql.query(
    `SELECT * FROM students
     WHERE (normalized_name = $1 OR student_name = $2) AND published = true
     ORDER BY created_at ASC, id ASC LIMIT 1`,
    [normalized, studentName.trim()]
  )) as unknown as Record<string, unknown>[];
  const row = rows[0];
  const logId = randomUUID();

  if (!row) {
    await sql.query(
      `INSERT INTO query_logs (
         id, input_student_name, matched_student_id, matched_student_name, matched_teacher_name, result_status
       ) VALUES ($1, $2, NULL, NULL, NULL, 'not_found')`,
      [logId, studentName]
    );
    return null;
  }
  if (sql.dialect === "mysql") {
    await sql.query(
      `UPDATE students SET
         queried = true,
         query_count = 1,
         last_query = now(), updated_at = now()
       WHERE id = $1`,
      [row.id]
    );
    const mysqlUpdated = (await sql.query("SELECT * FROM students WHERE id = $1 LIMIT 1", [row.id])) as unknown as Record<
      string,
      unknown
    >[];
    await sql.query(
      `INSERT INTO query_logs (
         id, input_student_name, matched_student_id, matched_student_name, matched_teacher_name, result_status
       ) VALUES ($1, $2, $3, $4, $5, 'success')`,
      [logId, studentName, row.id, row.student_name, row.teacher_name]
    );
    return mapStudent(mysqlUpdated[0]);
  }

  const updated = (await sql.query(
    `UPDATE students SET query_count = 1,
       queried = true,
       last_query = now(), updated_at = now() WHERE id = $1 RETURNING *`,
    [row.id]
  )) as unknown as Record<string, unknown>[];
  await sql.query(
    `INSERT INTO query_logs (
       id, input_student_name, matched_student_id, matched_student_name, matched_teacher_name, result_status
     ) VALUES ($1, $2, $3, $4, $5, 'success')`,
    [logId, studentName, row.id, row.student_name, row.teacher_name]
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
      matchedStudentName: row.matched_student_name ? String(row.matched_student_name) : null,
      matchedTeacherName: row.matched_teacher_name ? String(row.matched_teacher_name) : null,
      resultStatus: row.result_status as QueryLog["resultStatus"],
      queriedAt: new Date(String(row.queried_at)).toISOString()
    }));
  } else {
    students =
      role === "admin" ? [...memory.students] : memory.students.filter((item) => item.teacherName === teacherName);
    teachers = memory.teachers.map(({ passwordHash: _passwordHash, ...teacher }) => teacher);
    queryLogs =
      role === "admin"
        ? memory.queryLogs.slice(0, 50)
        : memory.queryLogs.filter((log) => log.matchedTeacherName === teacherName).slice(0, 50);
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
    settings: await getQueryReleaseSettings(),
    storageMode: hasDatabase() ? getSql().dialect : "memory"
  };
}

export async function importStudents(rows: SheetStudentRow[]) {
  await ensureReady();
  let importedCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    const importedClassName = String(row.programType ?? "").trim();
    const programType = normalizeProgramType(importedClassName);
    const admission = buildAdmissionByScore(row.score, programType, importedClassName);
    const overallScore = generateOverallScore(admission.admission);
    const teacherName = row.teacherName && row.teacherName !== "未分配老师" ? row.teacherName : null;
    const homeworkLessonCount = row.homeworkLessonCount ?? 0;
    const videoCount = row.videoCount ?? 0;
    const messageCount = row.messageCount ?? 0;
    const warZone = String(row.warZone ?? "").trim();

    if (!hasDatabase()) {
      const existing = memory.students.find(
        (student) =>
          normalizeName(student.studentName) === normalizeName(row.studentName) &&
          student.teacherName === (teacherName ?? "未分配老师")
      );
      if (existing) {
        Object.assign(existing, {
          score: row.score,
          overallScore,
          homeworkLessonCount,
          videoCount,
          messageCount,
          warZone,
          ...admission,
          updatedAt: nowText()
        });
        updatedCount += 1;
      } else {
        const time = nowText();
        memory.students.push({
          id: randomUUID(),
          studentName: row.studentName,
          teacherName: teacherName ?? "未分配老师",
          score: row.score,
          overallScore,
          ...admission,
          queried: false,
          queryCount: 0,
          lastQuery: null,
          preferredCourseTime: null,
          warZone,
          homeworkLessonCount,
          videoCount,
          messageCount,
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
          `UPDATE students SET student_name=$2, score=$3, overall_score=$4, program_type=$5, war_zone=$6, admission=$7,
             class_name=$8, detail=$9, advice=$10, homework_lesson_count=$11, video_count=$12,
             message_count=$13, updated_at=now() WHERE id=$1`,
          [
            existing[0].id,
            row.studentName,
            row.score,
            overallScore,
            programType,
            warZone,
            admission.admission,
            admission.className,
            admission.detail,
            admission.advice,
            homeworkLessonCount,
            videoCount,
            messageCount
          ]
        );
        updatedCount += 1;
        continue;
      }
    }

    if (sql.dialect === "mysql") {
      const normalizedName = normalizeName(row.studentName);
      const existing = (await sql.query(
        `SELECT id FROM students
         WHERE normalized_name = $1 AND (teacher_name = $2 OR (teacher_name IS NULL AND $2 IS NULL))
         LIMIT 1`,
        [normalizedName, teacherName]
      )) as unknown as Array<{ id: string }>;

      if (existing[0]) {
        await sql.query(
          `UPDATE students SET student_name=$2, score=$3, overall_score=$4, program_type=$5, war_zone=$6, admission=$7,
             class_name=$8, detail=$9, advice=$10, homework_lesson_count=$11, video_count=$12,
             message_count=$13, updated_at=now() WHERE id=$1`,
          [
            existing[0].id,
            row.studentName,
            row.score,
            overallScore,
            programType,
            warZone,
            admission.admission,
            admission.className,
            admission.detail,
            admission.advice,
            homeworkLessonCount,
            videoCount,
            messageCount
          ]
        );
        updatedCount += 1;
      } else {
        await sql.query(
          `INSERT INTO students (
             id, student_name, normalized_name, teacher_name, score, overall_score, program_type, war_zone, admission, class_name,
             detail, advice, homework_lesson_count, video_count, message_count
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            randomUUID(),
            row.studentName,
            normalizedName,
            teacherName,
            row.score,
            overallScore,
            programType,
            warZone,
            admission.admission,
            admission.className,
            admission.detail,
            admission.advice,
            homeworkLessonCount,
            videoCount,
            messageCount
          ]
        );
        importedCount += 1;
      }
      continue;
    }

    const result = (await sql.query(
      `INSERT INTO students (
         id, student_name, normalized_name, teacher_name, score, overall_score, program_type, war_zone, admission, class_name,
         detail, advice, homework_lesson_count, video_count, message_count
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (normalized_name, teacher_name) DO UPDATE SET
         student_name = EXCLUDED.student_name, score = EXCLUDED.score, overall_score = EXCLUDED.overall_score,
         program_type = EXCLUDED.program_type,
         war_zone = EXCLUDED.war_zone,
         admission = EXCLUDED.admission, class_name = EXCLUDED.class_name,
         detail = EXCLUDED.detail, advice = EXCLUDED.advice,
         homework_lesson_count = EXCLUDED.homework_lesson_count,
         video_count = EXCLUDED.video_count,
         message_count = EXCLUDED.message_count,
         updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [
        randomUUID(),
        row.studentName,
        normalizeName(row.studentName),
        teacherName,
        row.score,
        overallScore,
        programType,
        warZone,
        admission.admission,
        admission.className,
        admission.detail,
        admission.advice,
        homeworkLessonCount,
        videoCount,
        messageCount
      ]
    )) as unknown as Array<{ inserted: boolean }>;
    result[0]?.inserted ? (importedCount += 1) : (updatedCount += 1);
  }

  return { importedCount, updatedCount, totalCount: (await getOverview("admin")).stats.studentCount };
}

export async function importTeachers(rows: SheetTeacherRow[]) {
  await ensureReady();
  const uniqueRows = Array.from(
    rows.reduce((byName, row) => byName.set(row.teacherName, row), new Map<string, SheetTeacherRow>()).values()
  );
  const preparedRows = await mapWithConcurrency(uniqueRows, 4, async (row) => ({
    ...row,
    id: randomUUID(),
    passwordHash: await hashPassword(row.password || "bcm666")
  }));
  let importedCount = 0;
  let updatedCount = 0;

  if (!hasDatabase()) {
    for (const row of preparedRows) {
      const existing = memory.teachers.find((teacher) => teacher.teacherName === row.teacherName);
      if (existing) {
        if (existing.role === "teacher") {
          existing.passwordHash = row.passwordHash;
          existing.active = true;
        }
        updatedCount += 1;
      } else {
        memory.teachers.push({
          id: row.id,
          teacherName: row.teacherName,
          passwordHash: row.passwordHash,
          role: "teacher",
          active: true,
          createdAt: nowText()
        });
        importedCount += 1;
      }
    }
  } else {
    const sql = getSql();
    const existingRows = await getExistingTeacherRoles(sql, preparedRows.map((row) => row.teacherName));
    const existingRoles = new Map(
      existingRows.map((row) => [String(row.teacher_name), String(row.role) as Role])
    );
    const writableRows = preparedRows.filter((row) => existingRoles.get(row.teacherName) !== "admin");

    for (const row of preparedRows) {
      if (existingRoles.has(row.teacherName)) {
        updatedCount += 1;
      } else {
        importedCount += 1;
      }
    }

    for (let start = 0; start < writableRows.length; start += 100) {
      await upsertTeacherBatch(sql, writableRows.slice(start, start + 100));
    }
  }

  const totalCount = (await getOverview("admin")).teachers.filter((teacher) => teacher.role === "teacher").length;
  return { importedCount, updatedCount, totalCount };
}

async function getExistingTeacherRoles(sql: ReturnType<typeof getSql>, teacherNames: string[]) {
  if (teacherNames.length === 0) return [];
  const placeholders = teacherNames.map((_, index) => `$${index + 1}`).join(",");
  return (await sql.query(
    `SELECT teacher_name, role FROM teacher_accounts WHERE teacher_name IN (${placeholders})`,
    teacherNames
  )) as unknown as Array<{ teacher_name: string; role: Role }>;
}

async function upsertTeacherBatch(
  sql: ReturnType<typeof getSql>,
  rows: Array<SheetTeacherRow & { id: string; passwordHash: string }>
) {
  if (rows.length === 0) return;
  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const offset = values.length;
    values.push(row.id, row.teacherName, row.passwordHash);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, 'teacher', true)`;
  });

  if (sql.dialect === "mysql") {
    await sql.query(
      `INSERT INTO teacher_accounts (id, teacher_name, password_hash, role, active)
       VALUES ${tuples.join(",")}
       ON DUPLICATE KEY UPDATE
         password_hash = IF(role = 'teacher', VALUES(password_hash), password_hash),
         active = IF(role = 'teacher', true, active)`,
      values
    );
    return;
  }

  await sql.query(
    `INSERT INTO teacher_accounts (id, teacher_name, password_hash, role, active)
     VALUES ${tuples.join(",")}
     ON CONFLICT (teacher_name) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = true
     WHERE teacher_accounts.role = 'teacher'`,
    values
  );
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index]);
      }
    })
  );

  return results;
}

export async function updateStudent(
  id: string,
  input: Partial<Pick<Student, "studentName" | "score" | "overallScore" | "teacherName" | "published" | "preferredCourseTime">> & {
    programType?: string;
  }
) {
  await ensureReady();
  const current = (await getOverview("admin")).students.find((student) => student.id === id);
  if (!current) return null;

  const studentName = input.studentName ?? current.studentName;
  const score = input.score ?? current.score;
  const teacherName = input.teacherName ?? current.teacherName;
  const importedClassName = String(input.programType ?? current.className).trim();
  const programType = normalizeProgramType(importedClassName);
  const published = input.published ?? current.published;
  const preferredCourseTime = input.preferredCourseTime ?? current.preferredCourseTime;
  const homeworkLessonCount = current.homeworkLessonCount;
  const videoCount = current.videoCount;
  const messageCount = current.messageCount;
  const admission = buildAdmissionByScore(score, programType, importedClassName);
  const overallScore = generateOverallScore(admission.admission);

  if (!hasDatabase()) {
    Object.assign(current, {
      studentName,
      score,
      overallScore,
      teacherName,
      published,
      preferredCourseTime,
      homeworkLessonCount,
      videoCount,
      messageCount,
      ...admission,
      updatedAt: nowText()
    });
    const index = memory.students.findIndex((student) => student.id === id);
    memory.students[index] = current;
    return current;
  }

  const sql = getSql();
  if (sql.dialect === "mysql") {
    await sql.query(
      `UPDATE students SET student_name=$2, normalized_name=$3, score=$4, overall_score=$5, teacher_name=$6,
         program_type=$7, published=$8, admission=$9, class_name=$10, detail=$11, advice=$12,
         preferred_course_time=$13, homework_lesson_count=$14, video_count=$15, message_count=$16, updated_at=now()
       WHERE id=$1`,
      [
        id,
        studentName,
        normalizeName(studentName),
        score,
        overallScore,
        teacherName === "未分配老师" ? null : teacherName,
        programType,
        published,
        admission.admission,
        admission.className,
        admission.detail,
        admission.advice,
        preferredCourseTime,
        homeworkLessonCount,
        videoCount,
        messageCount
      ]
    );
    const rows = (await sql.query("SELECT * FROM students WHERE id=$1 LIMIT 1", [id])) as unknown as Record<
      string,
      unknown
    >[];
    return rows[0] ? mapStudent(rows[0]) : null;
  }

  const rows = (await sql.query(
    `UPDATE students SET student_name=$2, normalized_name=$3, score=$4, overall_score=$5, teacher_name=$6,
       program_type=$7, published=$8, admission=$9, class_name=$10, detail=$11, advice=$12,
       preferred_course_time=$13, homework_lesson_count=$14, video_count=$15, message_count=$16, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      id,
      studentName,
      normalizeName(studentName),
      score,
      overallScore,
      teacherName === "未分配老师" ? null : teacherName,
      programType,
      published,
      admission.admission,
      admission.className,
      admission.detail,
      admission.advice,
      preferredCourseTime,
      homeworkLessonCount,
      videoCount,
      messageCount
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

  const sql = getSql();
  if (sql.dialect === "mysql") {
    await sql.query(
      `UPDATE students SET preferred_course_time=$2, updated_at=now()
       WHERE id=$1 AND published=true`,
      [id, preferredCourseTime]
    );
    const rows = (await sql.query("SELECT * FROM students WHERE id=$1 AND published=true LIMIT 1", [id])) as unknown as Record<
      string,
      unknown
    >[];
    return rows[0] ? mapStudent(rows[0]) : null;
  }

  const rows = (await sql.query(
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

  const sql = getSql();
  if (sql.dialect === "mysql") {
    await sql.query(
      `UPDATE students SET queried=false, query_count=0, last_query=NULL, updated_at=now()
       WHERE id=$1 AND ($2='admin' OR teacher_name=$3)`,
      [id, role, teacherName ?? null]
    );
    const rows = (await sql.query(
      "SELECT * FROM students WHERE id=$1 AND ($2='admin' OR teacher_name=$3) LIMIT 1",
      [id, role, teacherName ?? null]
    )) as unknown as Record<string, unknown>[];
    return rows[0] ? mapStudent(rows[0]) : null;
  }

  const rows = (await sql.query(
    `UPDATE students SET queried=false, query_count=0, last_query=NULL, updated_at=now()
     WHERE id=$1 AND ($2='admin' OR teacher_name=$3) RETURNING *`,
    [id, role, teacherName ?? null]
  )) as unknown as Record<string, unknown>[];
  return rows[0] ? mapStudent(rows[0]) : null;
}

export async function deleteStudent(id: string) {
  return (await deleteStudents([id])) > 0;
}

export async function deleteStudents(ids: string[]) {
  await ensureReady();
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return 0;

  if (!hasDatabase()) {
    const before = memory.students.length;
    memory.queryLogs = memory.queryLogs.filter(
      (log) => log.resultStatus !== "pending_review" || !log.matchedStudentId || !uniqueIds.includes(log.matchedStudentId)
    );
    memory.students = memory.students.filter((student) => !uniqueIds.includes(student.id));
    return before - memory.students.length;
  }

  const sql = getSql();
  if (sql.dialect === "mysql") {
    const placeholders = uniqueIds.map(() => "?").join(",");
    await sql.execute(
      `DELETE FROM query_logs WHERE result_status = 'pending_review' AND matched_student_id IN (${placeholders})`,
      uniqueIds
    );
    return (await sql.execute(`DELETE FROM students WHERE id IN (${placeholders})`, uniqueIds)).affectedRows;
  }

  await sql.query(
    "DELETE FROM query_logs WHERE result_status = 'pending_review' AND matched_student_id = ANY($1::uuid[])",
    [uniqueIds]
  );
  const rows = (await sql.query("DELETE FROM students WHERE id = ANY($1::uuid[]) RETURNING id", [uniqueIds])) as unknown[];
  return rows.length;
}

export async function deleteAllStudents() {
  await ensureReady();

  if (!hasDatabase()) {
    const deletedCount = memory.students.length;
    memory.students = [];
    memory.queryLogs = memory.queryLogs.filter((log) => log.resultStatus !== "pending_review");
    return deletedCount;
  }

  const sql = getSql();
  await sql.query("DELETE FROM query_logs WHERE result_status = 'pending_review'");
  if (sql.dialect === "mysql") {
    return (await sql.execute("DELETE FROM students")).affectedRows;
  }

  const rows = (await sql.query("DELETE FROM students RETURNING id")) as unknown[];
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
  const sql = getSql();
  if (sql.dialect === "mysql") {
    return (
      await sql.execute(
        `UPDATE teacher_accounts SET
           active = COALESCE($2, active),
           password_hash = COALESCE($3, password_hash)
         WHERE id=$1 AND role='teacher'`,
        [id, input.active ?? null, passwordHash]
      )
    ).affectedRows > 0;
  }

  const rows = (await sql.query(
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
  const sql = getSql();
  if (sql.dialect === "mysql") {
    return (await sql.execute("DELETE FROM teacher_accounts WHERE id=$1 AND role='teacher'", [id])).affectedRows > 0;
  }

  const rows = (await sql.query(
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

  const sql = getSql();
  if (sql.dialect === "mysql") {
    const placeholders = uniqueIds.map(() => "?").join(",");
    return (
      await sql.execute(`DELETE FROM teacher_accounts WHERE id IN (${placeholders}) AND role='teacher'`, uniqueIds)
    ).affectedRows;
  }

  const rows = (await sql.query("DELETE FROM teacher_accounts WHERE id = ANY($1::uuid[]) AND role='teacher' RETURNING id", [
    uniqueIds
  ])) as unknown[];
  return rows.length;
}

export function resetMemoryStoreForTests() {
  memory.students = [];
  memory.teachers = [];
  memory.queryLogs = [];
  memory.settings = { resultOpenAt: null };
  memory.initialized = false;
}
