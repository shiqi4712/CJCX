import assert from "node:assert/strict";
import test from "node:test";
import { QUERY_ENTRIES, queryScopeForHost, queryScopeForEntry, queryEntryPath, queryResultPath } from "../lib/query-scope";
import JSZip from "jszip";
import { decodeSession, encodeSession } from "../lib/auth";
import { buildCoursePlanZip } from "../lib/documents";
import { hashPassword, verifyPassword } from "../lib/passwords";
import { buildPerformanceRatings } from "../lib/performance-ratings";
import {
  getProgramDisplayName,
  getProgramIntro,
  getProgramLearningGoal,
  getProgramLandingName,
  getProgramQueryTitle,
  getProgramResultName,
  normalizeProgramType
} from "../lib/programs";
import { checkRateLimit, resetRateLimits } from "../lib/rate-limit";
import { getAbilityRankByOverallScore } from "../lib/result-scoring";
import { parseSheetFile, toStudentRows } from "../lib/sheets";
import {
  getOverview,
  getConsoleSummary,
  getConsoleStudents,
  getConsoleTeachers,
  importStudents,
  importTeachers,
  login,
  getPendingReviewLogs,
  recordPendingReviewQuery,
  queryStudentByName,
  deleteAllStudents,
  deleteStudents,
  deleteTeachers,
  resetStudentQuery,
  resetMemoryStoreForTests
} from "../lib/store";
import { buildCoursePlanData, getCoursePlanLine, getCoursePlanLineForPayload, normalizeCoursePlanLine, parseCoursePlanLine } from "../lib/course-plan-config";

process.env.SESSION_SECRET = "test-session-secret-with-sufficient-entropy";
delete process.env.DATABASE_URL;

test("console summary and server pages retain full counts and teacher isolation", async () => {
  resetMemoryStoreForTests();
  await importStudents(Array.from({ length: 45 }, (_, index) => ({
    studentName: `分页学生${String(index).padStart(2, "0")}`, score: index % 2 ? "B" : "A+",
    teacherName: index < 30 ? "分页老师甲" : "分页老师乙", warZone: index < 25 ? "东区" : ""
  })));
  await queryStudentByName("分页学生00");
  const summary = await getConsoleSummary("admin");
  const full = await getOverview("admin");
  for (const key of ["studentCount", "teacherCount", "admittedCount", "queriedCount", "pendingCount"] as const) {
    assert.equal(summary.stats[key], full.stats[key]);
  }
  assert.equal(summary.stats.queryCount, 1);
  assert.equal(summary.warZones.find((zone) => zone.value === "东区")?.studentCount, 25);
  assert.equal(summary.warZones.find((zone) => zone.value === "__empty_war_zone__")?.studentCount, 20);
  assert.equal("students" in summary, false);
  assert.equal("teachers" in summary, false);
  const pages = await Promise.all([1, 2, 3].map((page) => getConsoleStudents("admin", undefined, page)));
  assert.deepEqual(pages.map((page) => page.rows.length), [20, 20, 5]);
  assert.equal(new Set(pages.flatMap((page) => page.rows.map((student) => student.id))).size, 45);
  assert.equal(pages[0].total, 45);
  assert.equal("detail" in pages[0].rows[0], false);
  assert.equal("advice" in pages[0].rows[0], false);
  assert.equal((await getConsoleStudents("admin", undefined, 999)).page, 3);
  assert.equal((await getConsoleStudents("admin", undefined, NaN)).page, 1);
  assert.equal((await getConsoleStudents("admin", undefined, 1, "分页学生44")).total, 1);
  assert.equal((await getConsoleStudents("admin", undefined, 1, "", "东区")).total, 25);
  assert.equal((await getConsoleStudents("admin", undefined, 1, "", "__empty_war_zone__")).total, 20);
  assert.equal((await getConsoleSummary("teacher", "分页老师乙")).stats.studentCount, 15);
  assert.equal((await getConsoleStudents("teacher", "分页老师乙", 1, "分页学生00")).total, 0);
  assert.equal((await getConsoleStudents("teacher", "分页老师乙", 1, "", "东区")).total, 0);
  assert.equal((await getConsoleStudents("teacher", "分页老师乙")).rows.length, 15);
});

test("teacher pages exclude administrators and password hashes, and clamp after deletion", async () => {
  resetMemoryStoreForTests();
  await importTeachers(Array.from({ length: 12 }, (_, i) => ({ teacherName: `分页老师${String(i).padStart(2, "0")}`, password: "testpass123" })));
  const first = await getConsoleTeachers(1);
  const second = await getConsoleTeachers(2);
  assert.equal(first.total, 12);
  assert.equal(first.rows.length, 10);
  assert.equal(second.rows.length, 2);
  assert.equal("passwordHash" in first.rows[0], false);
  assert.ok(first.rows.every((teacher) => teacher.role === "teacher"));
  await deleteTeachers(second.rows.map((teacher) => teacher.id));
  assert.equal((await getConsoleTeachers(2)).page, 1);
});

test("subdomain queries and reimports isolate the original five course groups", async () => {
  resetMemoryStoreForTests();
  const groups = Object.entries(QUERY_ENTRIES).filter(([host]) => !host.startsWith("b"));
  for (const [, scope] of groups) {
    await importStudents([{ studentName: "同名测试", score: "A+", teacherName: "未分配老师", courseLine: scope.courseLine, programType: scope.yingcai ? "英才班" : "科特班" }]);
  }
  const ids = new Set<string>();
  for (const [host, scope] of groups) {
    const entry = host.split(".")[0];
    assert.deepEqual(queryScopeForEntry(entry), queryScopeForHost(host));
    const resultUrl = new URL(queryResultPath("同名测试", entry), "https://bcmty.cn");
    assert.equal(queryEntryPath(resultUrl.searchParams.get("entry")!), `/entry/${entry}`);
    const student = await queryStudentByName(resultUrl.searchParams.get("name")!, queryScopeForEntry(resultUrl.searchParams.get("entry")!));
    assert.ok(student);
    assert.equal(student.courseLine, scope.courseLine);
    ids.add(student.id);
    await recordPendingReviewQuery("同名测试", scope);
  }
  assert.equal(ids.size, 5);
  const update = await importStudents([{ studentName: "同名测试", score: "A", teacherName: "未分配老师", courseLine: "preschool", programType: "英才班" }]);
  assert.equal(update.updatedCount, 1);
  assert.equal((await queryStudentByName("同名测试", QUERY_ENTRIES["pykete.bcmty.cn"]))?.score, "A+");
  assert.equal((await queryStudentByName("不存在", QUERY_ENTRIES["tykete.bcmty.cn"])), null);
  const logs = await getPendingReviewLogs("admin", undefined);
  assert.equal(new Set(logs.rows.map((log) => log.matchedStudentId)).size, 5);
  assert.throws(() => queryScopeForHost("unknown.bcmty.cn"));
  assert.throws(() => queryScopeForEntry("unknown"));
  assert.throws(() => queryScopeForEntry(""));
  assert.equal(queryEntryPath("https://example.com"), "/");
  assert.equal(queryScopeForHost("bcmty.cn"), undefined);
});

test("rejected Python and preschool students remain queryable in their imported class", async () => {
  resetMemoryStoreForTests();
  await importStudents([
    { studentName: "未录取同名", score: "B", teacherName: "未分配老师", courseLine: "python", programType: "科特班" },
    { studentName: "未录取同名", score: "B", teacherName: "未分配老师", courseLine: "python", programType: "英才班" },
    { studentName: "未录取低龄", score: "B", teacherName: "未分配老师", courseLine: "preschool", programType: "英才班" }
  ]);
  const python = await queryStudentByName("未录取同名", queryScopeForEntry("pyyingcai"));
  const kete = await queryStudentByName("未录取同名", queryScopeForEntry("pykete"));
  const preschool = await queryStudentByName("未录取低龄", queryScopeForEntry("yeyingcai"));
  assert.equal(python?.admission, "未录取");
  assert.equal(python?.programType, "英才特训营");
  assert.equal(kete?.programType, "科特班");
  assert.equal(preschool?.admission, "未录取");
  assert.equal((await queryStudentByName("未录取低龄", queryScopeForEntry("bpreschool")))?.id, preschool?.id);
  assert.equal(await queryStudentByName("未录取低龄", queryScopeForEntry("pyyingcai")), null);
});

test("B-side elite entries use only their three course materials", () => {
  assert.equal(getCoursePlanLineForPayload({ courseLine: "python", targetClass: "英才班", entry: "bpython" }).goalImage, "/images/course-plan/b-yingcai/python-goal.jpg");
  assert.equal(getCoursePlanLineForPayload({ courseLine: "moon", targetClass: "英才班", entry: "bmoon" }).planDetailImage, "/images/course-plan/b-yingcai/moon-plan.jpg");
  assert.equal(getCoursePlanLineForPayload({ courseLine: "rocket", targetClass: "英才班", entry: "brocket" }).planDetailImage, "/images/course-plan/b-yingcai/rocket-goal.png");
  assert.equal(getCoursePlanLineForPayload({ courseLine: "rocket", targetClass: "英才班", entry: "brocket" }).scheduleImage, "/images/course-plan/b-yingcai/rocket-schedule.png");
  assert.equal(getCoursePlanLineForPayload({ courseLine: "python", targetClass: "英才班", entry: "pyyingcai" }).goalImage, "/images/course-plan/python-yingcai-goal.png");
});

test("new B-side entries isolate low-age elite and C++ kete students", async () => {
  resetMemoryStoreForTests();
  assert.deepEqual(queryScopeForEntry("bpreschool"), { courseLine: "preschool", yingcai: true });
  assert.deepEqual(queryScopeForEntry("bcpp"), { courseLine: "cpp", yingcai: false });
  assert.equal(queryEntryPath("bcpp"), "/entry/bcpp");
  assert.equal(parseCoursePlanLine("C++"), "cpp");
  assert.equal(parseCoursePlanLine("cpp"), "cpp");
  await importStudents([
    { studentName: "同名新入口", score: "A+", teacherName: "测试老师", courseLine: "preschool", programType: "英才班" },
    { studentName: "同名新入口", score: "A", teacherName: "测试老师", courseLine: "cpp", programType: "科特班" },
    { studentName: "同名新入口", score: "B", teacherName: "测试老师", courseLine: "cpp", programType: "英才班" }
  ]);
  assert.equal((await queryStudentByName("同名新入口", queryScopeForEntry("bpreschool")))?.score, "A+");
  assert.equal((await queryStudentByName("同名新入口", queryScopeForEntry("bcpp")))?.score, "A");
  assert.equal(getCoursePlanLineForPayload({ courseLine: "preschool", targetClass: "英才班", entry: "bpreschool" }).goalImage, "/images/course-plan/b-new/preschool-outline.png");
  assert.equal(getCoursePlanLineForPayload({ courseLine: "cpp", targetClass: "科特班", entry: "bcpp" }).scheduleImage, "/images/course-plan/b-new/cpp-schedule.png");
  assert.equal(getCoursePlanLineForPayload({ courseLine: "preschool", targetClass: "英才班", entry: "yeyingcai" }).goalImage, "/images/course-plan/preschool-yingcai-goal.png");
});

test("passwords are hashed and verified", async () => {
  const hash = await hashPassword("strong-password");
  assert.notEqual(hash, "strong-password");
  assert.equal(await verifyPassword("strong-password", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("signed sessions reject tampering and expiry", () => {
  const valid = encodeSession({ teacherName: "teacher-a", role: "teacher", expiresAt: Date.now() + 60_000 });
  assert.equal(decodeSession(valid)?.teacherName, "teacher-a");
  assert.equal(decodeSession(`${valid.slice(0, -1)}x`), null);

  const expired = encodeSession({ teacherName: "teacher-a", role: "teacher", expiresAt: Date.now() - 1 });
  assert.equal(decodeSession(expired), null);
});

test("rate limiting blocks requests after the configured allowance", async () => {
  resetRateLimits();
  assert.equal((await checkRateLimit("query:test", 2, 60_000)).allowed, true);
  assert.equal((await checkRateLimit("query:test", 2, 60_000)).allowed, true);
  assert.equal((await checkRateLimit("query:test", 2, 60_000)).allowed, false);
});

function assertScoreInRange(value: string | null | undefined, min: number, max: number) {
  assert.ok(value);
  assert.match(value, /^\d+\.\d{2}$/);
  const numeric = Number(value);
  assert.ok(numeric >= min && numeric <= max, `${value} should be in [${min}, ${max}]`);
}

test("ability rank follows the overall score", () => {
  assert.equal(getAbilityRankByOverallScore("97.00"), 10);
  assert.equal(getAbilityRankByOverallScore("98.62"), 4);
  assert.equal(getAbilityRankByOverallScore("99.00"), 2);
  assert.equal(getAbilityRankByOverallScore(null), null);
});

test("performance ratings follow imported homework and video counts", () => {
  assert.deepEqual(buildPerformanceRatings({ homeworkLessonCount: 0, videoCount: 0 }), [
    { label: "上课表现", value: 4 },
    { label: "思维能力", value: 3 },
    { label: "创新能力", value: 3 }
  ]);
  assert.deepEqual(buildPerformanceRatings({ homeworkLessonCount: 1, videoCount: 1 }), [
    { label: "上课表现", value: 4 },
    { label: "思维能力", value: 3 },
    { label: "创新能力", value: 3 }
  ]);
  assert.deepEqual(buildPerformanceRatings({ homeworkLessonCount: 2, videoCount: 2 }), [
    { label: "上课表现", value: 4 },
    { label: "思维能力", value: 4 },
    { label: "创新能力", value: 4 }
  ]);
  assert.deepEqual(buildPerformanceRatings({ homeworkLessonCount: 3, videoCount: 3 }), [
    { label: "上课表现", value: 4 },
    { label: "思维能力", value: 5 },
    { label: "创新能力", value: 5 }
  ]);
});

test("CSV import supports quoted fields, teacher assignment, program type and war zone", async () => {
  const csv = new File(
    [
      [
        "学生姓名,成绩,老师姓名,班级类型,课线,战区,作业次数,视频次数,学生消息数",
        '"张小明",A,王老师,育才班,Python,华东战区,3,1,45',
        '"李小明",A+,李老师,特训营,小火箭,华南战区,0,2,8'
      ].join("\n")
    ],
    "students.csv",
    {
      type: "text/csv"
    }
  );
  const rows = toStudentRows(await parseSheetFile(csv));
  assert.deepEqual(rows, [
    {
      studentName: "张小明",
      score: "A",
      overallScore: null,
      teacherName: "王老师",
      programType: "育才班",
      courseLine: "python",
      warZone: "华东战区",
      homeworkLessonCount: 3,
      videoCount: 1,
      messageCount: 45
    },
    {
      studentName: "李小明",
      score: "A+",
      overallScore: null,
      teacherName: "李老师",
      programType: "特训营",
      courseLine: "rocket",
      warZone: "华南战区",
      homeworkLessonCount: 0,
      videoCount: 2,
      messageCount: 8
    }
  ]);
});

test("student import accepts flexible behavior headers and values", async () => {
  const csv = new File(
    [
      [
        "姓名,成绩,老师,班型,作业次数,视频录制次数,消息条数",
        "灵活学生,A,王老师,科特班,3次,1次,45条"
      ].join("\n")
    ],
    "students-flexible.csv",
    {
      type: "text/csv"
    }
  );
  const rows = toStudentRows(await parseSheetFile(csv));
  assert.deepEqual(rows, [
    {
      studentName: "灵活学生",
      score: "A",
      overallScore: null,
      teacherName: "王老师",
      programType: "科特班",
      courseLine: "moon",
      homeworkLessonCount: 3,
      videoCount: 1,
      messageCount: 45
    }
  ]);
});

test("duplicate imports update records and teachers only see assigned students", async () => {
  resetMemoryStoreForTests();
  await importTeachers([
    { teacherName: "王老师", password: "abc123" },
    { teacherName: "李老师", password: "abc123" }
  ]);
  const first = await importStudents([
    { studentName: "张小明", score: "A", overallScore: "96.5", teacherName: "王老师", warZone: "华东战区" },
    { studentName: "张小明", score: "B", teacherName: "李老师" }
  ]);
  assert.equal(first.importedCount, 2);

  const duplicate = await importStudents([
    { studentName: "张小明", score: "A+", teacherName: "王老师", warZone: "华南战区" }
  ]);
  assert.equal(duplicate.updatedCount, 1);

  const teacherOverview = await getOverview("teacher", "王老师");
  assert.equal(teacherOverview.students.length, 1);
  assert.equal(teacherOverview.students[0].score, "A+");
  assert.equal(teacherOverview.students[0].warZone, "华南战区");
  assert.equal(teacherOverview.students[0].homeworkLessonCount, 0);
  assert.equal(teacherOverview.students[0].videoCount, 0);
  assert.equal(teacherOverview.students[0].messageCount, 0);
  assertScoreInRange(teacherOverview.students[0].overallScore, 97, 99);
  assert.equal((await getOverview("teacher", "李老师")).students.length, 1);
  assert.equal(await login("王老师", "abc123").then(Boolean), true);
  assert.equal(await login("jiangxiao", "df666").then((user) => user?.role), "admin");
  assert.equal(await login("shiqi", "shiqi123").then((user) => user?.role), "admin");
  assert.equal(await login("yangxu", "cz666").then((user) => user?.role), "admin");
  assert.equal(await login("huanglei", "huanglei666").then((user) => user?.role), "admin");
});

test("student course-line import normalizes supported values and rejects unknown lines", () => {
  assert.deepEqual(["python", "moon", "rocket", "preschool", "cpp"].map((line) => parseCoursePlanLine(line)), ["python", "moon", "rocket", "preschool", "cpp"]);
  const rows = toStudentRows([
    { 学生姓名: "课线Python", 成绩: "A+", 课线: "PYTHON" },
    { 学生姓名: "课线探月", 成绩: "A+", 课程线: "探月" },
    { 学生姓名: "课线火箭", 成绩: "A+", 课程课线: "小火箭" },
    { 学生姓名: "课线幼儿", 成绩: "A+", 课线: "幼儿", 班级类型: "英才班" },
    { 学生姓名: "课线C++", 成绩: "A+", 课线: "C++", 班级类型: "科特班" }
  ]);
  assert.deepEqual(rows.map((row) => row.courseLine), ["python", "moon", "rocket", "preschool", "cpp"]);
  assert.throws(
    () => toStudentRows([{ 学生姓名: "未知课线", 成绩: "A+", 课线: "Java" }]),
    /请填写 Python、探月、小火箭、幼儿或 C\+\+/
  );
});

test("course plan keeps the original page and swaps only new-line materials", () => {
  const pythonYingcai = getCoursePlanLineForPayload({ courseLine: "python", targetClass: "英才班" });
  const pythonKete = getCoursePlanLineForPayload({ courseLine: "python", targetClass: "科特班" });
  const preschool = getCoursePlanLineForPayload({ courseLine: "preschool", targetClass: "英才班" });
  assert.match(pythonYingcai.goalImage, /python-yingcai-goal/);
  assert.match(pythonYingcai.planDetailImage, /python-yingcai-plan-detail/);
  assert.match(pythonYingcai.scheduleImage, /python-yingcai-schedule/);
  assert.equal(pythonKete.goalImage, getCoursePlanLine("python").goalImage);
  assert.match(preschool.goalImage, /preschool-yingcai-goal/);
  assert.match(preschool.planDetailImage, /preschool-yingcai-plan-detail/);
  assert.match(preschool.scheduleImage, /preschool-yingcai-schedule/);
});

test("student program type controls admitted class display", async () => {
  await importStudents([
    { studentName: "英才学生", score: "A+", teacherName: "未分配老师", programType: "英才班" },
    { studentName: "科特学生", score: "A+", teacherName: "未分配老师", programType: "科特班" },
    { studentName: "育才学生", score: "A+", teacherName: "未分配老师", programType: "育才班" },
    { studentName: "特训学生", score: "A+", teacherName: "未分配老师", programType: "特训营" }
  ]);

  const overview = await getOverview("admin");
  assert.equal(overview.students.find((student) => student.studentName === "英才学生")?.programType, "英才特训营");
  assert.equal(overview.students.find((student) => student.studentName === "英才学生")?.className, "英才班");
  assert.equal(overview.students.find((student) => student.studentName === "科特学生")?.className, "科特班");
  assert.equal(overview.students.find((student) => student.studentName === "育才学生")?.className, "育才班");
  assert.equal(overview.students.find((student) => student.studentName === "特训学生")?.programType, "英才特训营");
  assert.equal(overview.students.find((student) => student.studentName === "特训学生")?.className, "特训营");
});

test("special training program uses parent-facing display copy", () => {
  assert.equal(getProgramLandingName("科特特训营"), "科特训练营");
  assert.equal(getProgramDisplayName("科特特训营"), "科特训练营");
  assert.match(getProgramIntro("科特特训营"), /^科特训练营是编程猫依托北大共建 AI 实验室开办/);
});

test("kete class has dedicated learning goal", () => {
  assert.equal(
    getProgramLearningGoal("科特班"),
    "半年冲刺三张国家级证书，提供赛事与考级辅导支持，在锻炼思维能力、提升学习成绩的同时，帮助孩子持续积累科技特长。"
  );
});

test("old elite class label maps to elite training camp", () => {
  assert.equal(normalizeProgramType("英才班"), "英才特训营");
  assert.equal(normalizeProgramType("特训营"), "英才特训营");
  assert.equal(getProgramResultName("特训营", "英才特训营"), "英才特训营");
  assert.equal(getProgramLandingName("英才特训营"), "英才特训营");
  assert.equal(getProgramQueryTitle("英才特训营"), "英才计划录取结果查询");
  assert.equal(getProgramQueryTitle("科特班"), "英才计划录取结果查询");
  assert.equal(getProgramDisplayName("英才特训营"), "英才特训营");
  assert.match(getProgramIntro("英才特训营"), /^英才特训营是编程猫依托北大共建 AI 实验室开设/);
});

test("only S A A+ and 前10% scores are admitted", async () => {
  await importStudents([
    { studentName: "等级S学生", score: "S", teacherName: "未分配老师" },
    { studentName: "等级A+学生", score: "A+", teacherName: "未分配老师" },
    { studentName: "前十学生", score: "前10%", teacherName: "未分配老师" },
    { studentName: "等级B学生", score: "B", teacherName: "未分配老师" },
    { studentName: "等级C学生", score: "C", teacherName: "未分配老师" },
    { studentName: "综合学生", score: "综合20%", teacherName: "未分配老师" },
    { studentName: "等级A学生", score: "A", teacherName: "未分配老师" },
    { studentName: "未知学生", score: "优秀", teacherName: "未分配老师" }
  ]);

  const overview = await getOverview("admin");
  assert.equal(overview.students.find((student) => student.studentName === "等级S学生")?.admission, "已录取");
  assert.equal(overview.students.find((student) => student.studentName === "等级A学生")?.admission, "已录取");
  assert.equal(overview.students.find((student) => student.studentName === "等级A+学生")?.admission, "已录取");
  assert.equal(overview.students.find((student) => student.studentName === "前十学生")?.admission, "已录取");
  assert.equal(overview.students.find((student) => student.studentName === "等级B学生")?.admission, "未录取");
  assert.equal(overview.students.find((student) => student.studentName === "等级C学生")?.admission, "未录取");
  assert.equal(overview.students.find((student) => student.studentName === "综合学生")?.admission, "未录取");
  assert.equal(overview.students.find((student) => student.studentName === "未知学生")?.admission, "未录取");
  assertScoreInRange(overview.students.find((student) => student.studentName === "等级A+学生")?.overallScore, 97, 99);
  assertScoreInRange(overview.students.find((student) => student.studentName === "等级B学生")?.overallScore, 85, 95);
});

test("same-name query returns the earliest published record and records status", async () => {
  const result = await queryStudentByName("张小明");
  assert.equal(result?.teacherName, "王老师");
  assert.equal(result?.queryCount, 1);
  const overview = await getOverview("admin");
  assert.equal(overview.queryLogs[0].resultStatus, "success");
  assert.equal(overview.students.find((student) => student.studentName === "张小明")?.queried, true);

  for (let attempt = 2; attempt <= 9; attempt += 1) {
    const nextQuery = await queryStudentByName("张小明");
    assert.equal(nextQuery?.queryCount, 1);
  }

  assert.equal(await queryStudentByName("不存在"), null);
  assert.equal((await getOverview("admin")).queryLogs[0].resultStatus, "not_found");
});

test("teacher can reset assigned student query eligibility", async () => {
  const overview = await getOverview("teacher", "王老师");
  const student = overview.students.find((item) => item.studentName === "张小明");
  assert.ok(student);

  const reset = await resetStudentQuery(student.id, "teacher", "王老师");
  assert.equal(reset?.queried, false);
  assert.equal(reset?.queryCount, 0);

  const result = await queryStudentByName("张小明");
  assert.equal(result?.queryCount, 1);
  for (let count = 2; count <= 8; count += 1) {
    assert.equal((await queryStudentByName("张小明"))?.queryCount, 1);
  }
});

test("teacher batch import deduplicates rows and preserves administrator accounts", async () => {
  resetMemoryStoreForTests();
  const rows = Array.from({ length: 24 }, (_, index) => ({
    teacherName: `批量老师${index + 1}`,
    password: "abc123"
  }));
  rows.push({ teacherName: "批量老师1", password: "final123" });
  rows.push({ teacherName: "shiqi", password: "replace123" });

  const result = await importTeachers(rows);
  assert.equal(result.importedCount, 24);
  assert.equal(result.updatedCount, 1);
  assert.equal(await login("批量老师1", "final123").then(Boolean), true);
  assert.equal(await login("shiqi", "shiqi123").then((user) => user?.role), "admin");
  assert.equal(await login("shiqi", "replace123").then(Boolean), false);
});

test("pending review visits remain available after release and paginate by ten", async () => {
  resetMemoryStoreForTests();
  await importTeachers([{ teacherName: "审核老师", password: "abc123" }]);
  await importStudents([{ studentName: "审核学生", score: "A+", teacherName: "审核老师" }]);

  for (let index = 0; index < 12; index += 1) {
    await recordPendingReviewQuery("审核学生");
  }

  await queryStudentByName("审核学生");

  const firstPage = await getPendingReviewLogs("admin", undefined, 1);
  assert.equal(firstPage.total, 12);
  assert.equal(firstPage.pageSize, 10);
  assert.equal(firstPage.pageCount, 2);
  assert.equal(firstPage.rows.length, 10);
  assert.ok(firstPage.rows.every((log) => log.resultStatus === "pending_review"));

  const secondPage = await getPendingReviewLogs("admin", undefined, 2);
  assert.equal(secondPage.rows.length, 2);

  const teacherPage = await getPendingReviewLogs("teacher", "审核老师", 1);
  assert.equal(teacherPage.total, 12);
});

test("deleting students also deletes their pending review visits", async () => {
  resetMemoryStoreForTests();
  await importTeachers([{ teacherName: "审核老师", password: "abc123" }]);
  await importStudents([
    { studentName: "待删学生", score: "A+", teacherName: "审核老师" },
    { studentName: "保留学生", score: "A", teacherName: "审核老师" }
  ]);

  await recordPendingReviewQuery("待删学生");
  await recordPendingReviewQuery("保留学生");
  await recordPendingReviewQuery("未录入学生");

  const overview = await getOverview("admin");
  const studentToDelete = overview.students.find((student) => student.studentName === "待删学生");
  assert.ok(studentToDelete);
  assert.equal(await deleteStudents([studentToDelete.id]), 1);

  const afterSingleDelete = await getPendingReviewLogs("admin", undefined, 1);
  assert.equal(afterSingleDelete.total, 2);
  assert.deepEqual(
    new Set(afterSingleDelete.rows.map((log) => log.inputStudentName)),
    new Set(["保留学生", "未录入学生"])
  );

  assert.equal(await deleteAllStudents(), 1);
  const afterDeleteAll = await getPendingReviewLogs("admin", undefined, 1);
  assert.equal(afterDeleteAll.total, 0);
  assert.equal(afterDeleteAll.rows.length, 0);
});

test("bulk delete removes selected teachers and students", async () => {
  resetMemoryStoreForTests();
  await importTeachers([
    { teacherName: "批量王老师", password: "abc123" },
    { teacherName: "批量李老师", password: "abc123" }
  ]);
  await importStudents([
    { studentName: "批量学生一", score: "A", teacherName: "批量王老师" },
    { studentName: "批量学生二", score: "A+", teacherName: "批量李老师" }
  ]);

  const before = await getOverview("admin");
  const teacherId = before.teachers.find((teacher) => teacher.teacherName === "批量王老师")?.id;
  const studentId = before.students.find((student) => student.studentName === "批量学生二")?.id;
  assert.ok(teacherId);
  assert.ok(studentId);

  assert.equal(await deleteTeachers([teacherId]), 1);
  assert.equal(await deleteStudents([studentId]), 1);

  const after = await getOverview("admin");
  assert.equal(after.teachers.some((teacher) => teacher.teacherName === "批量王老师"), false);
  assert.equal(after.students.some((student) => student.studentName === "批量学生二"), false);
  assert.equal(after.students.find((student) => student.studentName === "批量学生一")?.teacherName, "未分配老师");
});

test("single student import can add one assigned student", async () => {
  resetMemoryStoreForTests();
  await importTeachers([{ teacherName: "单个老师", password: "abc123" }]);
  const result = await importStudents([
    {
      studentName: "单个学生",
      score: "A+",
      teacherName: "单个老师",
      homeworkLessonCount: 2,
      videoCount: 1,
      messageCount: 31
    }
  ]);
  assert.equal(result.importedCount, 1);

  const overview = await getOverview("teacher", "单个老师");
  assert.equal(overview.students.length, 1);
  assert.equal(overview.students[0].studentName, "单个学生");
  assert.equal(overview.students[0].queryCount, 0);
  assert.equal(overview.students[0].homeworkLessonCount, 2);
  assert.equal(overview.students[0].videoCount, 1);
  assert.equal(overview.students[0].messageCount, 31);
});

test("course plan content follows the student's imported course line", async () => {
  resetMemoryStoreForTests();
  await importTeachers([
    { teacherName: "方案王老师", password: "abc123" },
    { teacherName: "方案李老师", password: "abc123" }
  ]);
  await importStudents([
    { studentName: "方案学生一", score: "A+", teacherName: "方案王老师", programType: "科特班", courseLine: "python" },
    { studentName: "方案学生二", score: "A", teacherName: "方案李老师", programType: "育才班", courseLine: "rocket" }
  ]);

  const teacherOverview = await getOverview("teacher", "方案王老师");
  const student = teacherOverview.students[0];
  assert.equal(student.courseLine, "python");
  assert.equal(normalizeCoursePlanLine(student.courseLine), "python");
  assert.equal(buildCoursePlanData({ student: student.studentName, courseLine: "python", targetClass: student.className }).targetClass, "科特班");
  assert.equal(getCoursePlanLine("python").goalImage, "/images/course-plan/python-goal.jpg");
  assert.equal(getCoursePlanLine("moon").planDetailImage, "/images/course-plan/moon-plan-detail.jpg");
  assert.equal(getCoursePlanLine("rocket").scheduleImage, "/images/course-plan/rocket-schedule.png");

});

test("course-plan export creates one personalized PDF per student", async () => {
  const archive = await buildCoursePlanZip(null, [
    { studentName: "张小明", score: "A+", teacherName: "王老师" },
    { studentName: "李小红", score: "B", teacherName: "李老师" }
  ]);
  const zip = await JSZip.loadAsync(archive);
  const names = Object.keys(zip.files);
  assert.equal(names.length, 2);
  assert.equal(names.every((name) => name.endsWith(".pdf")), true);
  const first = await zip.file("张小明个性化学习方案.pdf")?.async("nodebuffer");
  assert.equal(first?.subarray(0, 4).toString("utf8"), "%PDF");
});
