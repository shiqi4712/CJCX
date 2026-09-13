import type { CoursePlanLineId } from "./course-plan-config";

export type PlanImage = { src: string; alt: string; width: number; height: number };
type Stat = { value: string; label: string };
type Milestone = { month: string; title: string; description: string };
export type CoursePlanProfile = {
  id: string;
  name: string;
  className: "育才班" | "科特班" | "英才班";
  courseLine: CoursePlanLineId;
  syllabus: { title: string; stats: Stat[]; image: PlanImage };
  goals: {
    title: "学习目标" | "赛考目标";
    subtitle: string;
    headline: string;
    description: string;
    milestones: Milestone[];
    outputs: Stat[];
    images: PlanImage[];
  };
  schedule: { image: PlanImage; unlockTime: string; liveTime: string };
};

function material(profile: string, asset: string, width: number, height: number, alt: string): PlanImage {
  return { src: `/images/course-plan/${profile}/${asset}.webp`, width, height, alt };
}

const pythonMilestones: Milestone[] = [
  { month: "02", title: "NCT 一级", description: "建立 Python 编程基础" },
  { month: "05", title: "NCT 二级", description: "提升程序应用与算法思维" },
  { month: "06", title: "白名单赛事", description: "冲刺 AILD、ICC、WRC" }
];
const examCopy = {
  title: "赛考目标" as const,
  subtitle: "半年进阶，冲刺考级与白名单赛事三项成果",
  headline: "学编程 · 做项目 · 冲赛考",
  description: "从基础能力认证到赛事挑战，让每个阶段都有明确方向，让编程实力转化为成长成果。",
  milestones: pythonMilestones
};
const learningCopy = {
  title: "学习目标" as const,
  subtitle: "从主动探索到独立创作，让思维成长看得见",
  headline: "启思维 · 会表达 · 能创造",
  description: "把学习目标融入作品与生活，在动手实践中学会观察、拆解问题、尝试修改，逐步建立独立解决问题的能力。"
};
const rocketSchedule = {
  image: material("yucai-rocket", "schedule", 1600, 865, "育才班主课学习时间安排表"),
  unlockTime: "19:15", liveTime: "19:00"
};

export const COURSE_PLAN_PROFILES: Record<string, CoursePlanProfile> = {
  "yucai-rocket": {
    id: "yucai-rocket", name: "育才班·火箭", className: "育才班", courseLine: "rocket",
    syllabus: {
      title: "火箭编程思维课程大纲",
      stats: [{ value: "25", label: "编程创作项目" }, { value: "10", label: "创意搭建作品" }, { value: "500+", label: "互动思考" }],
      image: material("yucai-rocket", "syllabus", 1600, 5524, "育才班火箭编程思维系统课课程大纲")
    },
    goals: {
      ...learningCopy,
      milestones: [
        { month: "2.5", title: "L1–L2 思维启航", description: "建立有序思考，发现与运用规律" },
        { month: "05", title: "L3–L4 能力进阶", description: "分析因果关系，学习拆解问题" },
        { month: "06", title: "L5 综合实践", description: "融合算法与搭建，解决实际问题" }
      ],
      outputs: [{ value: "35", label: "项目实践" }, { value: "150+", label: "思维训练" }, { value: "8大", label: "思维能力" }],
      images: [material("yucai-rocket", "goals", 1600, 1736, "育才班火箭阶段学习规划与目标")]
    },
    schedule: rocketSchedule
  },
  "yucai-preschool": {
    id: "yucai-preschool", name: "育才班·幼儿", className: "育才班", courseLine: "preschool",
    syllabus: {
      title: "幼儿编程思维课程大纲",
      stats: [{ value: "500+", label: "互动思考" }, { value: "25", label: "编创作品" }, { value: "25", label: "动口演讲表达" }],
      image: material("yucai-preschool", "syllabus", 1600, 5527, "育才班幼儿编程思维系统课课程大纲")
    },
    goals: {
      ...learningCopy,
      milestones: [
        { month: "2.5", title: "L1–L2 愿意探索", description: "认识图标与方向，建立路线目标" },
        { month: "05", title: "L3–L4 有序表达", description: "讲清先后顺序，理解简单因果" },
        { month: "06", title: "L5 发现规律", description: "观察运行结果，主动尝试修改" }
      ],
      outputs: [{ value: "50", label: "项目实践" }, { value: "150+", label: "思维训练" }, { value: "8大", label: "思维能力" }],
      images: [
        material("yucai-preschool", "goals", 1600, 1736, "幼儿编程阶段学习规划与目标"),
        material("yucai-preschool", "goals-outcomes", 1600, 2922, "育才班学习效果：独立创作、逻辑思维、问题解决与学科应用")
      ]
    },
    // Confirmed by the user: both Yucai courses share this timetable.
    schedule: rocketSchedule
  },
  "yingcai-preschool": {
    id: "yingcai-preschool", name: "英才班·幼儿", className: "英才班", courseLine: "preschool",
    syllabus: {
      title: "幼儿编程思维课程大纲",
      stats: [{ value: "50", label: "项目实践" }, { value: "500+", label: "互动问答" }, { value: "8大", label: "思维能力" }],
      image: { src: "/images/course-plan/yingcai-preschool/syllabus.jpeg", width: 2316, height: 8000, alt: "幼儿英才班编程思维系统课课程大纲" }
    },
    goals: {
      ...learningCopy,
      milestones: [
        { month: "2.5", title: "L1-L2 思维启航", description: "建立路线目标，愿意主动尝试" },
        { month: "05", title: "L3-L4 能力进阶", description: "讲清先后顺序，理解简单因果" },
        { month: "06", title: "L5 综合实践", description: "发现重复规律，观察并修改结果" }
      ],
      outputs: [{ value: "50", label: "项目实践" }, { value: "150+", label: "思维训练" }, { value: "50+", label: "科普知识" }],
      images: [{ src: "/images/course-plan/yingcai-preschool/goals.png", width: 6009, height: 6519, alt: "幼儿英才班阶段学习规划与目标" }]
    },
    schedule: {
      image: { src: "/images/course-plan/yingcai-preschool/schedule.png", width: 1651, height: 901, alt: "幼儿英才班上课时间安排表" },
      unlockTime: "19:15",
      liveTime: "19:00"
    }
  },
  "kete-moon": {
    id: "kete-moon", name: "科特班·探月", className: "科特班", courseLine: "moon",
    syllabus: {
      title: "探月进阶课程大纲",
      stats: [{ value: "120+", label: "阶段核心知识点" }, { value: "125+", label: "课中思维训练" }, { value: "全课程", label: "融合小学学科知识，侧面提升成绩" }],
      image: { src: "/images/course-plan/kete-syllabus-detail.png", width: 1450, height: 5571, alt: "探月图形化科特班进阶课程大纲" }
    },
    goals: {
      ...examCopy,
      subtitle: "半年构建赛考竞争力，冲刺 3 项国家级成果",
      description: "用清晰的月度目标，把每一次学习沉淀为可认证、可展示的科技特长成果。",
      milestones: [{ month: "03", title: "NCT 一级", description: "完成编程基础能力认证" }, ...pythonMilestones.slice(1)],
      outputs: [{ value: "50", label: "软件编程项目" }, { value: "6", label: "硬件实践项目" }, { value: "6课时", label: "白名单备赛直播" }],
      images: [{ src: "/images/course-plan/exam-goal-three-certificates.png", width: 852, height: 703, alt: "探月科特班半年赛考目标" }]
    },
    schedule: { image: { src: "/images/course-plan/class-schedule.png", width: 2620, height: 1417, alt: "探月科特班学习时间安排表" }, unlockTime: "19:00", liveTime: "18:40" }
  },
  "kete-python": {
    id: "kete-python", name: "科特班·Python", className: "科特班", courseLine: "python",
    syllabus: {
      title: "Python 科特班\n课程大纲",
      stats: [{ value: "42", label: "软件编程项目" }, { value: "4", label: "硬件创作项目" }, { value: "跨学科", label: "计算思维与数理应用" }],
      image: material("kete-python", "syllabus", 1415, 4748, "Python科特班课程大纲")
    },
    goals: {
      ...examCopy,
      outputs: [{ value: "42", label: "软件编程项目" }, { value: "4", label: "硬件创作项目" }, { value: "双级", label: "NCT 一级与二级" }],
      images: [material("kete-python", "goals", 856, 703, "Python科特班半年赛考规划")]
    },
    schedule: { image: material("kete-python", "schedule", 1600, 865, "Python科特班主课学习时间表"), unlockTime: "19:20", liveTime: "19:00" }
  },
  "yingcai-python": {
    id: "yingcai-python", name: "英才班·Python", className: "英才班", courseLine: "python",
    syllabus: {
      title: "Python 英才班\n课程大纲",
      stats: [{ value: "50", label: "编程创作项目" }, { value: "5大", label: "主题学习单元" }, { value: "跨学科", label: "数理知识融入实践" }],
      image: material("yingcai-python", "syllabus", 1415, 4752, "Python英才班课程大纲")
    },
    goals: {
      ...examCopy,
      outputs: [{ value: "50", label: "编程创作项目" }, { value: "双级", label: "NCT 一级与二级" }, { value: "白名单", label: "国家级赛事挑战" }],
      images: [material("yingcai-python", "goals", 1028, 719, "Python英才班半年赛考规划")]
    },
    schedule: { image: material("yingcai-python", "schedule", 1600, 920, "Python英才班主课学习时间安排表"), unlockTime: "19:20", liveTime: "19:00" }
  }
};

export function getCoursePlanProfile(id: string): CoursePlanProfile | undefined {
  return Object.hasOwn(COURSE_PLAN_PROFILES, id) ? COURSE_PLAN_PROFILES[id] : undefined;
}

export function resolveCoursePlanProfileId(courseLine: CoursePlanLineId, className?: string | null) {
  const normalizedClassName = String(className ?? "").trim().toLowerCase();
  const isYingcai = normalizedClassName.includes("英才") || normalizedClassName.includes("yingcai");

  if (courseLine === "preschool") return "yingcai-preschool";
  if (courseLine === "python") return isYingcai ? "yingcai-python" : "kete-python";
  if (courseLine === "rocket") return "yucai-rocket";
  return "kete-moon";
}

export function resolveCoursePlanProfile(courseLine: CoursePlanLineId, className?: string | null) {
  return COURSE_PLAN_PROFILES[resolveCoursePlanProfileId(courseLine, className)];
}
