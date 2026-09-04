import type { LearningCourseLine } from "./types";

export type CoursePlanLineId = LearningCourseLine;
export const DEFAULT_COURSE_PLAN_LINE: CoursePlanLineId = "moon";

export type CoursePlanPayload = {
  studentId?: string;
  student: string;
  score?: string;
  courseLine: CoursePlanLineId;
  targetClass?: string;
  preferredCourseTime?: string | null;
  focus?: string;
  goal?: string;
  showPrice?: boolean;
  price?: string;
  priceNote?: string;
};

export type CoursePlanLine = {
  id: CoursePlanLineId;
  name: string;
  targetClass: string;
  period: string;
  weekly: string;
  officialHours: string;
  giftHours: string;
  totalHours: string;
  examTarget: string;
  price: string;
  priceNote: string;
  focusDefault: string;
  goalDefault: string;
  scheduleText: string;
  coursePromise: string;
  classPromise: string;
  pathPromise: string;
  goalImage: string;
  planDetailImage: string;
  scheduleImage: string;
};

export const COURSE_PLAN_LINES: Record<CoursePlanLineId, CoursePlanLine> = {
  python: {
    id: "python",
    name: "Python",
    targetClass: "英才班",
    period: "6个月",
    weekly: "每周1次",
    officialHours: "60课时",
    giftHours: "73课时",
    totalHours: "133课时",
    examTarget: "NCT2级",
    price: "3180元",
    priceNote: "英才特训营享大额教育补贴减免，具体方案以正式通知为准。",
    focusDefault: "Python 编程、算法思维、赛考能力",
    goalDefault: "系统掌握 Python 编程，冲刺编程考级与白名单赛事成果",
    scheduleText: "定制化上课时间，可提前预约老师直播辅导。",
    coursePromise: "正式课一周一次，一次两课时。可根据孩子周末或晚间时间灵活安排。",
    classPromise: "围绕孩子进度安排学习节奏，避免大班跟不上、问题没人接的断点。",
    pathPromise: "课程大纲对标 Python 编程考级与白名单赛事，半年内形成可展示成果。",
    goalImage: "/images/course-plan/python-goal.jpg",
    planDetailImage: "/images/course-plan/python-plan-detail.jpg",
    scheduleImage: "/images/course-plan/python-schedule.png"
  },
  moon: {
    id: "moon",
    name: "探月",
    targetClass: "英才班",
    period: "6个月",
    weekly: "每周1次",
    officialHours: "72课时",
    giftHours: "12次课前辅导",
    totalHours: "84课时",
    examTarget: "NCT1级",
    price: "以顾问报价为准",
    priceNote: "适合基础薄弱或首次系统学习编程的孩子，可按阶段安排学习节奏。",
    focusDefault: "图形化编程、逻辑思维、项目表达",
    goalDefault: "提升图形化编程与项目能力，逐步完成考级和赛事目标",
    scheduleText: "定制化上课时间，可提前预约老师直播辅导。",
    coursePromise: "每周稳定学习，配合课前预习和课后巩固，帮助孩子把基础补扎实。",
    classPromise: "小班节奏更适合基础提升，老师可以及时发现孩子的理解断点。",
    pathPromise: "先完成基础知识和项目表达，再逐步过渡到考级和赛事目标。",
    goalImage: "/images/course-plan/moon-goal.jpg",
    planDetailImage: "/images/course-plan/moon-plan-detail.jpg",
    scheduleImage: "/images/course-plan/moon-schedule.png"
  },
  rocket: {
    id: "rocket",
    name: "小火箭",
    targetClass: "育才班",
    period: "6个月",
    weekly: "每周1次",
    officialHours: "60课时",
    giftHours: "阶段辅导",
    totalHours: "按规划安排",
    examTarget: "图形化编程能力认证",
    price: "以顾问报价为准",
    priceNote: "适合已有一定基础、希望冲刺证书或赛事成果的孩子。",
    focusDefault: "编程启蒙、逻辑思维、创造表达",
    goalDefault: "建立编程兴趣与思维基础，完成阶段项目和能力认证",
    scheduleText: "根据赛考节点安排学习时间，可提前预约老师直播辅导。",
    coursePromise: "结合阶段测评安排训练强度，赛考前可增加专题辅导。",
    classPromise: "小班制便于老师盯进度、盯作业、盯赛考薄弱项。",
    pathPromise: "围绕兴趣、能力与阶段成果设计学习路径，让成长更容易被看见。",
    goalImage: "/images/course-plan/rocket-goal.jpg",
    planDetailImage: "/images/course-plan/rocket-plan-detail.jpg",
    scheduleImage: "/images/course-plan/rocket-schedule.png"
  }
};

export function normalizeCoursePlanLine(value?: string | null): CoursePlanLineId {
  const text = (value ?? "").trim().toLowerCase();
  if (text === "python" || text === "py" || text.includes("python")) return "python";
  if (text === "moon" || text.includes("探月")) return "moon";
  if (text === "rocket" || text.includes("小火箭")) return "rocket";
  // Legacy links used class-plan ids; keep them opening with the former graphical curriculum default.
  if (["talent", "kete", "yucai"].includes(text)) return "moon";
  return DEFAULT_COURSE_PLAN_LINE;
}

export function parseCoursePlanLine(value?: string | null): CoursePlanLineId {
  const text = (value ?? "").trim();
  if (!text) return DEFAULT_COURSE_PLAN_LINE;
  const normalized = normalizeCoursePlanLine(text);
  const key = text.toLowerCase();
  const recognized = key in COURSE_PLAN_LINES || key === "py" || text.includes("探月") || text.includes("小火箭");
  if (!recognized) {
    throw new Error(`课线“${text}”无效，请填写 Python、探月或小火箭`);
  }
  return normalized;
}

export function getCoursePlanLine(value?: string | null) {
  return COURSE_PLAN_LINES[normalizeCoursePlanLine(value)];
}

export function buildCoursePlanData(input: CoursePlanPayload) {
  const line = getCoursePlanLine(input.courseLine);
  return {
    ...line,
    student: input.student.trim() || "学生",
    score: input.score?.trim() || "A+",
    targetClass: input.targetClass?.trim() || line.targetClass,
    focus: input.focus?.trim() || line.focusDefault,
    goal: input.goal?.trim() || line.goalDefault,
    showPrice: input.showPrice !== false,
    price: input.price?.trim() || line.price,
    priceNote: input.priceNote?.trim() || line.priceNote
  };
}
