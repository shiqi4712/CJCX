import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { decodeSession, encodeSession } from "../lib/auth";
import { buildCoursePlanZip } from "../lib/documents";
import { hashPassword, verifyPassword } from "../lib/passwords";
import { checkRateLimit, resetRateLimits } from "../lib/rate-limit";
import { parseSheetFile, toStudentRows } from "../lib/sheets";
import {
  getOverview,
  importStudents,
  importTeachers,
  login,
  queryStudentByName,
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

test("CSV import supports quoted fields and teacher assignment", async () => {
  const csv = new File(
    [['学生姓名,成绩,老师姓名', '"张,小明",A,王老师'].join("\n")],
    "students.csv",
    { type: "text/csv" }
  );
  const rows = toStudentRows(await parseSheetFile(csv));
  assert.deepEqual(rows, [{ studentName: "张,小明", score: "A", teacherName: "王老师" }]);
});

test("duplicate imports update records and teachers only see assigned students", async () => {
  resetMemoryStoreForTests();
  await importTeachers([
    { teacherName: "王老师", password: "abc123" },
    { teacherName: "李老师", password: "abc123" }
  ]);
  const first = await importStudents([
    { studentName: "张小明", score: "A", teacherName: "王老师" },
    { studentName: "张小明", score: "B", teacherName: "李老师" }
  ]);
  assert.equal(first.importedCount, 2);

  const duplicate = await importStudents([{ studentName: "张小明", score: "A+", teacherName: "王老师" }]);
  assert.equal(duplicate.updatedCount, 1);

  const teacherOverview = await getOverview("teacher", "王老师");
  assert.equal(teacherOverview.students.length, 1);
  assert.equal(teacherOverview.students[0].score, "A+");
  assert.equal((await getOverview("teacher", "李老师")).students.length, 1);
  assert.equal(await login("王老师", "abc123").then(Boolean), true);
});

test("same-name query returns the earliest published record and records status", async () => {
  const result = await queryStudentByName("张小明");
  assert.equal(result?.teacherName, "王老师");
  assert.equal(result?.queryCount, 1);
  const overview = await getOverview("admin");
  assert.equal(overview.queryLogs[0].resultStatus, "success");

  assert.equal(await queryStudentByName("不存在"), null);
  assert.equal((await getOverview("admin")).queryLogs[0].resultStatus, "not_found");
});

test("course-plan export creates one personalized document per student", async () => {
  const archive = await buildCoursePlanZip(null, [
    { studentName: "张小明", score: "A+", teacherName: "王老师" },
    { studentName: "李小红", score: "B", teacherName: "李老师" }
  ]);
  const zip = await JSZip.loadAsync(archive);
  const names = Object.keys(zip.files);
  assert.equal(names.length, 2);
  const first = await zip.file("张小明个性化学习方案.doc")?.async("string");
  assert.match(first ?? "", /张小明/);
  assert.match(first ?? "", /王老师/);
});
