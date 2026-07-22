import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { decodeSession, encodeSession } from "../lib/auth";
import { buildCoursePlanZip } from "../lib/documents";
import { hashPassword, verifyPassword } from "../lib/passwords";
import {
  getProgramDisplayName,
  getProgramIntro,
  getProgramLearningGoal,
  getProgramLandingName,
  getProgramQueryTitle,
  normalizeProgramType
} from "../lib/programs";
import { checkRateLimit, resetRateLimits } from "../lib/rate-limit";
import { parseSheetFile, toStudentRows } from "../lib/sheets";
import {
  getOverview,
  importStudents,
  importTeachers,
  login,
  queryStudentByName,
  deleteStudents,
  deleteTeachers,
  resetStudentQuery,
  resetMemoryStoreForTests
} from "../lib/store";

process.env.SESSION_SECRET = "test-session-secret-with-sufficient-entropy";
delete process.env.DATABASE_URL;

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

test("CSV import supports quoted fields, teacher assignment and program type", async () => {
  const csv = new File(
    [
      [
        "学生姓名,成绩,老师姓名,班级类型,提交作业课次数,录制视频次数,学生消息数",
        '"张小明",A,王老师,育才班,3,1,45',
        '"李小明",A+,李老师,特训营,0,2,8'
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
      homeworkLessonCount: 3,
      videoCount: 1,
      messageCount: 45
    },
    {
      studentName: "李小明",
      score: "A+",
      overallScore: null,
      teacherName: "李老师",
      programType: "科特特训营",
      homeworkLessonCount: 0,
      videoCount: 2,
      messageCount: 8
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
    { studentName: "张小明", score: "A", overallScore: "96.5", teacherName: "王老师" },
    { studentName: "张小明", score: "B", teacherName: "李老师" }
  ]);
  assert.equal(first.importedCount, 2);

  const duplicate = await importStudents([{ studentName: "张小明", score: "A+", teacherName: "王老师" }]);
  assert.equal(duplicate.updatedCount, 1);

  const teacherOverview = await getOverview("teacher", "王老师");
  assert.equal(teacherOverview.students.length, 1);
  assert.equal(teacherOverview.students[0].score, "A+");
  assert.equal(teacherOverview.students[0].homeworkLessonCount, 0);
  assert.equal(teacherOverview.students[0].videoCount, 0);
  assert.equal(teacherOverview.students[0].messageCount, 0);
  assertScoreInRange(teacherOverview.students[0].overallScore, 97, 99);
  assert.equal((await getOverview("teacher", "李老师")).students.length, 1);
  assert.equal(await login("王老师", "abc123").then(Boolean), true);
  assert.equal(await login("jiangxiao", "df666").then((user) => user?.role), "admin");
  assert.equal(await login("shiqi", "shiqi123").then((user) => user?.role), "admin");
  assert.equal(await login("yangxu", "cz666").then((user) => user?.role), "admin");
});

test("student program type controls admitted class display", async () => {
  await importStudents([
    { studentName: "英才学生", score: "A+", teacherName: "未分配老师", programType: "英才特训营" },
    { studentName: "科特学生", score: "A+", teacherName: "未分配老师", programType: "科特班" },
    { studentName: "育才学生", score: "A+", teacherName: "未分配老师", programType: "育才班" },
    { studentName: "特训学生", score: "A+", teacherName: "未分配老师", programType: "科特特训营" }
  ]);

  const overview = await getOverview("admin");
  assert.equal(overview.students.find((student) => student.studentName === "英才学生")?.className, "英才特训营");
  assert.equal(overview.students.find((student) => student.studentName === "科特学生")?.className, "科特班");
  assert.equal(overview.students.find((student) => student.studentName === "育才学生")?.className, "育才班");
  assert.equal(overview.students.find((student) => student.studentName === "特训学生")?.className, "科特特训营");
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
