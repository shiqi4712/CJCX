import type { QueryLog, Role, SheetStudentRow, SheetTeacherRow, Student, TeacherAccount } from "./types";

const nowText = () => new Date().toLocaleString("zh-CN", { hour12: false });

const normalizeName = (value: string) => value.trim().replace(/\s+/g, "").toLowerCase();

const isRejectedScore = (score: string) => score.trim().toUpperCase() === "B";

function buildAdmissionByScore(score: string) {
  if (isRejectedScore(score)) {
    return {
      admission: "未录取",
      className: "继续努力",
      detail: "编程猫希望你可以继续保持热爱，稳扎稳打提升基础能力，下一次选拔再向目标发起冲刺。",
      advice: "这次结果不代表终点。建议先巩固课堂基础、保持每周练习，并在老师指导下逐步提升专注力、表达能力和项目完成度。"
    };
  }

  return {
    admission: "已录取",
    className: "英才班",
    detail: "恭喜你在编程猫英才班选拔中获得英才班录取资格。",
    advice: "期待你的加入，一起开启编程之旅！"
  };
}

type StoreState = {
  students: Student[];
  teachers: TeacherAccount[];
  queryLogs: QueryLog[];
};

declare global {
  // eslint-disable-next-line no-var
  var admissionStoreState: StoreState | undefined;
  // eslint-disable-next-line no-var
  var admissionStoreVersion: string | undefined;
}

const STORE_VERSION = "clean-data-2026-06-05-03";

const initialState: StoreState = {
  students: [],
  teachers: [
    {
      id: "usr_admin_xiaohong",
      teacherName: "xiaohong",
      password: "bdsz666",
      role: "admin",
      active: true
    },
    {
      id: "usr_admin_zhiyang",
      teacherName: "zhiyang",
      password: "tt666",
      role: "admin",
      active: true
    },
    {
      id: "usr_admin_zeyu",
      teacherName: "zeyu",
      password: "ty666",
      role: "admin",
      active: true
    }
  ],
  queryLogs: []
};

if (globalThis.admissionStoreVersion !== STORE_VERSION) {
  globalThis.admissionStoreState = structuredClone(initialState);
  globalThis.admissionStoreVersion = STORE_VERSION;
}

const state = (globalThis.admissionStoreState ??= structuredClone(initialState));

syncBuiltInAccounts();

function syncBuiltInAccounts() {
  const builtInAccounts: TeacherAccount[] = [
    {
      id: "usr_admin_xiaohong",
      teacherName: "xiaohong",
      password: "bdsz666",
      role: "admin",
      active: true
    },
    {
      id: "usr_admin_zhiyang",
      teacherName: "zhiyang",
      password: "tt666",
      role: "admin",
      active: true
    },
    {
      id: "usr_admin_zeyu",
      teacherName: "zeyu",
      password: "ty666",
      role: "admin",
      active: true
    }
  ];

  state.teachers = state.teachers.filter(
    (teacher) =>
      teacher.teacherName !== "admin" &&
      teacher.teacherName !== "择一老师" &&
      teacher.teacherName !== "周老师" &&
      !teacher.teacherName.includes("测试")
  );

  for (const account of builtInAccounts) {
    const index = state.teachers.findIndex((teacher) => teacher.teacherName === account.teacherName);
    if (index >= 0) {
      state.teachers[index] = account;
    } else {
      state.teachers.unshift(account);
    }
  }
}

export function queryStudentByName(studentName: string) {
  const normalized = normalizeName(studentName);
  const student = state.students.find(
    (item) => item.published && normalizeName(item.studentName) === normalized
  );

  if (!student) {
    return null;
  }

  student.queried = true;
  student.queryCount += 1;
  student.lastQuery = nowText();
  state.queryLogs.unshift({
    id: crypto.randomUUID(),
    inputStudentName: studentName,
    matchedStudentId: student.id,
    resultStatus: "success",
    queriedAt: student.lastQuery
  });

  return {
    ...student,
    ...buildAdmissionByScore(student.score)
  };
}

export function login(account: string, password: string) {
  return state.teachers.find(
    (teacher) => teacher.active && teacher.teacherName === account.trim() && teacher.password === password
  );
}

export function getOverview(role: Role, teacherName?: string) {
  const visibleStudents =
    role === "admin" ? state.students : state.students.filter((student) => student.teacherName === teacherName);
  const teacherCount = new Set(state.students.map((student) => student.teacherName)).size;
  const queriedCount = visibleStudents.filter((student) => student.queried).length;

  return {
    stats: {
      studentCount: visibleStudents.length,
      teacherCount,
      admittedCount: visibleStudents.filter((student) => student.admission === "已录取").length,
      queriedCount,
      pendingCount: visibleStudents.length - queriedCount
    },
    students: visibleStudents,
    teachers: state.teachers.map(({ password, ...teacher }) => teacher),
    queryLogs: role === "admin" ? state.queryLogs.slice(0, 50) : []
  };
}

export function importStudents(rows: SheetStudentRow[], teacherName = "未分配老师") {
  for (const row of rows) {
    const admissionInfo = buildAdmissionByScore(row.score);

    state.students.push({
      id: crypto.randomUUID(),
      studentName: row.studentName,
      teacherName,
      score: row.score,
      admission: admissionInfo.admission,
      className: admissionInfo.className,
      detail: admissionInfo.detail,
      advice: admissionInfo.advice,
      queried: false,
      queryCount: 0,
      lastQuery: null,
      published: true
    });
  }

  return { importedCount: rows.length, totalCount: state.students.length };
}

export function importTeachers(rows: SheetTeacherRow[]) {
  for (const row of rows) {
    state.teachers.push({
      id: crypto.randomUUID(),
      teacherName: row.teacherName,
      password: row.password || "bcm666",
      role: "teacher",
      active: true
    });
  }

  return { importedCount: rows.length, totalCount: state.teachers.length };
}
