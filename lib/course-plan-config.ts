import type { LearningCourseLine } from "./types";

export type CoursePlanLineId = LearningCourseLine;
export const DEFAULT_COURSE_PLAN_LINE: CoursePlanLineId = "moon";

export type CoursePlanPayload = {
  entry?: string;
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

const PYTHON_YINGCAI_MATERIALS = {
  goalImage: "/images/course-plan/python-yingcai-goal.png",
  planDetailImage: "/images/course-plan/python-yingcai-plan-detail.jpg",
  scheduleImage: "/images/course-plan/python-yingcai-schedule.jpg"
} as const;

const pythonCourseLine: CoursePlanLine = {
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
};

const preschoolCourseLine: CoursePlanLine = {
  id: "preschool",
  name: "幼儿",
  targetClass: "英才班",
  period: "6个月",
  weekly: "每周1次",
  officialHours: "按规划安排",
  giftHours: "阶段辅导",
  totalHours: "按规划安排",
  examTarget: "全国性幼儿编程创赛展",
  price: "以顾问报价为准",
  priceNote: "适合幼儿阶段建立编程兴趣、逻辑思维与表达能力。",
  focusDefault: "编程启蒙、逻辑思维、创造表达",
  goalDefault: "通过项目实践与互动训练，建立幼儿阶段的编程思维基础",
  scheduleText: "根据幼儿作息安排学习时间，可提前预约老师直播辅导。",
  coursePromise: "以趣味项目和互动任务建立稳定学习兴趣。",
  classPromise: "英才班小班带教，老师持续关注孩子的理解与表达。",
  pathPromise: "围绕思维、知识和生活迁移设计六个月成长路径。",
  goalImage: "/images/course-plan/preschool-yingcai-goal.png",
  planDetailImage: "/images/course-plan/preschool-yingcai-plan-detail.jpeg",
  scheduleImage: "/images/course-plan/preschool-yingcai-schedule.png"
};

export const COURSE_PLAN_LINES: Record<CoursePlanLineId, CoursePlanLine> = {
  python: pythonCourseLine,
  highage: {
    ...pythonCourseLine,
    ...PYTHON_YINGCAI_MATERIALS,
    id: "highage",
    name: "高龄"
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
  },
  preschool: preschoolCourseLine,
  lowage: {
    ...preschoolCourseLine,
    id: "lowage",
    name: "低龄",
    goalImage: "/images/course-plan/b-new/preschool-outline.png",
    planDetailImage: "/images/course-plan/b-new/preschool-outline.png",
    scheduleImage: "/images/course-plan/b-new/preschool-schedule.png"
  },
  cpp: {
    id: "cpp",
    name: "C++",
    targetClass: "科特班",
    period: "6个月",
    weekly: "每周1次",
    officialHours: "按规划安排",
    giftHours: "阶段辅导",
    totalHours: "按规划安排",
    examTarget: "CSP / NCT",
    price: "以顾问报价为准",
    priceNote: "具体方案以正式通知为准。",
    focusDefault: "C++ 编程、算法思维、赛考能力",
    goalDefault: "掌握 C++ 基础与算法思维，逐步完成考级和竞赛目标",
    scheduleText: "根据课程安排选择上课时间，可提前预约老师直播辅导。",
    coursePromise: "每周稳定学习，配合课前预习和课后巩固。",
    classPromise: "小班带教，老师关注孩子的学习进度与薄弱项。",
    pathPromise: "从语言基础到算法应用，逐步积累赛考能力。",
    goalImage: "/images/course-plan/b-new/cpp-outline.png",
    planDetailImage: "/images/course-plan/b-new/cpp-outline.png",
    scheduleImage: "/images/course-plan/b-new/cpp-schedule.png"
  }
};

export function normalizeCoursePlanLine(value?: string | null): CoursePlanLineId {
  const text = (value ?? "").trim().toLowerCase();
  if (text === "python" || text === "py" || text.includes("python")) return "python";
  if (text === "moon" || text.includes("探月")) return "moon";
  if (text === "rocket" || text.includes("小火箭")) return "rocket";
  if (text === "lowage" || text.includes("低龄")) return "lowage";
  if (text === "highage" || text.includes("高龄")) return "highage";
  if (text === "preschool" || text.includes("幼儿")) return "preschool";
  if (text === "cpp" || text.includes("c++") || text.includes("c＋＋")) return "cpp";
  // Legacy links used class-plan ids; keep them opening with the former graphical curriculum default.
  if (["talent", "kete", "yucai"].includes(text)) return "moon";
  return DEFAULT_COURSE_PLAN_LINE;
}

export function parseCoursePlanLine(value?: string | null): CoursePlanLineId {
  const text = (value ?? "").trim();
  if (!text) return DEFAULT_COURSE_PLAN_LINE;
  const normalized = normalizeCoursePlanLine(text);
  const key = text.toLowerCase();
  const recognized =
    key in COURSE_PLAN_LINES ||
    key === "py" ||
    text.includes("探月") ||
    text.includes("小火箭") ||
    text.includes("低龄") ||
    text.includes("高龄") ||
    text.includes("幼儿") ||
    normalized === "cpp";
  if (!recognized) {
    throw new Error(`课线“${text}”无效，请填写 Python、探月、小火箭、幼儿、低龄、高龄或 C++`);
  }
  return normalized;
}

export function getCoursePlanLine(value?: string | null) {
  return COURSE_PLAN_LINES[normalizeCoursePlanLine(value)];
}

const B_YINGCAI_MATERIALS = {
  bpython: {
    goalImage: "/images/course-plan/b-yingcai/python-goal.jpg",
    planDetailImage: "/images/course-plan/b-yingcai/python-plan.jpg",
    scheduleImage: "/images/course-plan/b-yingcai/python-schedule.jpg"
  },
  bmoon: {
    goalImage: "/images/course-plan/b-yingcai/moon-goal.jpg",
    planDetailImage: "/images/course-plan/b-yingcai/moon-plan.jpg",
    scheduleImage: "/images/course-plan/b-yingcai/moon-schedule.jpg"
  },
  brocket: {
    goalImage: "/images/course-plan/b-yingcai/rocket-plan.png",
    planDetailImage: "/images/course-plan/b-yingcai/rocket-goal.png",
    scheduleImage: "/images/course-plan/b-yingcai/rocket-schedule.png"
  },
  bpreschool: {
    goalImage: "/images/course-plan/b-new/preschool-outline.png",
    planDetailImage: "/images/course-plan/b-new/preschool-outline.png",
    scheduleImage: "/images/course-plan/b-new/preschool-schedule.png"
  }
} as const;

export function isYingcaiClass(value?: string | null) {
  const text = String(value ?? "").trim().toLowerCase();
  return text.includes("英才") || text.includes("yingcai");
}

export function getCoursePlanLineForPayload(payload: Pick<CoursePlanPayload, "courseLine" | "targetClass" | "entry">) {
  const line = getCoursePlanLine(payload.courseLine);
  const bMaterials = payload.entry ? B_YINGCAI_MATERIALS[payload.entry as keyof typeof B_YINGCAI_MATERIALS] : undefined;
  if (bMaterials) return { ...line, ...bMaterials };
  if (line.id === "python" && isYingcaiClass(payload.targetClass)) {
    return { ...line, ...PYTHON_YINGCAI_MATERIALS };
  }
  return line;
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
