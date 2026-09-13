import assert from "node:assert/strict";
import test from "node:test";
import { access } from "node:fs/promises";
import path from "node:path";
import { COURSE_PLAN_PROFILES, getCoursePlanProfile } from "../lib/course-plan-profiles";

test("public course links are a fixed whitelist, including safe handling of prototype keys", () => {
  assert.deepEqual(Object.keys(COURSE_PLAN_PROFILES).sort(), [
    "kete-moon", "kete-python", "yingcai-preschool", "yingcai-python", "yucai-preschool", "yucai-rocket"
  ]);
  for (const id of ["unknown", "constructor", "__proto__", "toString"]) {
    assert.equal(getCoursePlanProfile(id), undefined);
  }
});

test("Yucai uses learning goals and keeps both preschool materials with the agreed shared schedule", () => {
  const preschool = COURSE_PLAN_PROFILES["yucai-preschool"];
  const rocket = COURSE_PLAN_PROFILES["yucai-rocket"];
  assert.equal(preschool.goals.title, "学习目标");
  assert.equal(rocket.goals.title, "学习目标");
  assert.equal(preschool.goals.images.length, 2);
  assert.equal(new Set(preschool.goals.images.map((image) => image.src)).size, 2);
  assert.deepEqual(preschool.schedule, rocket.schedule);
  assert.notEqual(preschool.syllabus.image.src, rocket.syllabus.image.src);
});

test("moon and Python versions keep their own course materials and milestone dates", () => {
  const moon = COURSE_PLAN_PROFILES["kete-moon"];
  const python = COURSE_PLAN_PROFILES["kete-python"];
  const yingcai = COURSE_PLAN_PROFILES["yingcai-python"];
  assert.equal(moon.courseLine, "moon");
  assert.equal(moon.goals.milestones[0].month, "03");
  assert.equal(python.goals.milestones[0].month, "02");
  assert.equal(python.syllabus.stats[0].value, "42");
  assert.equal(yingcai.syllabus.stats[0].value, "50");
  assert.equal(new Set([moon, python, yingcai].map((p) => p.syllabus.image.src)).size, 3);
  assert.equal(new Set([moon, python, yingcai].map((p) => p.schedule.image.src)).size, 3);
});

test("English-talent class and preschool imports resolve to their dedicated materials", async () => {
  const { resolveCoursePlanProfileId } = await import("../lib/course-plan-profiles");
  assert.equal(resolveCoursePlanProfileId("python", "英才班"), "yingcai-python");
  assert.equal(resolveCoursePlanProfileId("python", "科特班"), "kete-python");
  assert.equal(resolveCoursePlanProfileId("preschool", "英才班"), "yingcai-preschool");
  assert.equal(COURSE_PLAN_PROFILES["yingcai-preschool"].className, "英才班");
  assert.equal(COURSE_PLAN_PROFILES["yingcai-preschool"].courseLine, "preschool");
});

test("all configured posters are available locally for deployment", async () => {
  for (const profile of Object.values(COURSE_PLAN_PROFILES)) {
    for (const image of [profile.syllabus.image, ...profile.goals.images, profile.schedule.image]) {
      assert.ok(image.src.startsWith("/images/course-plan/"));
      assert.ok(image.width > 0 && image.height > 0 && image.alt);
      await access(path.join(process.cwd(), "public", image.src));
    }
  }
});
