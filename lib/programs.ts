export const PROGRAM_TYPES = ["英才特训营", "科特班", "育才班", "科特特训营"] as const;

export type ProgramType = (typeof PROGRAM_TYPES)[number];

export function normalizeProgramType(value?: string | null): ProgramType {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/·?英才计划/g, "");

  if (normalized.includes("英才") || normalized.includes("yingcai")) return "英才特训营";
  if (
    normalized === "特训营" ||
    normalized.includes("科特训练营") ||
    normalized.includes("科特特训营") ||
    normalized.includes("texun") ||
    normalized.includes("bootcamp")
  ) {
    return "科特特训营";
  }
  if (normalized.includes("科特") || normalized.includes("kete")) return "科特班";
  if (normalized.includes("育才") || normalized.includes("yucai")) return "育才班";
  return "英才特训营";
}

export function getProgramLandingName(programType: ProgramType) {
  if (programType === "科特特训营") return "科特训练营";
  if (programType === "英才特训营") return "英才特训营";
  return `${programType}·英才计划`;
}

export function getProgramQueryTitle(programType: ProgramType) {
  return "英才计划录取结果查询";
}

export function getProgramDisplayName(programType: ProgramType) {
  return programType === "科特特训营" ? "科特训练营" : programType;
}

export function getProgramWelcomeNote() {
  return "期待你的加入，一起开启编程之旅！";
}

export function getProgramIntro(programType: ProgramType) {
  switch (programType) {
    case "科特班":
      return "科特班是编程猫依托“北京大学与点猫科技联合共建人工智能实验室”背景，全新设立的人才选拔与专项培养班型。该班面向在编程学习中展现出较强思维能力、探索兴趣与学习潜力的学员，通过专项能力评估后择优入班。后续课程将围绕学科成绩提升、逻辑思维训练与科特升学规划展开，帮助孩子在兴趣驱动中建立更系统的学习能力与发展路径。";
    case "科特特训营":
      return "科特训练营是编程猫依托北大共建 AI 实验室开办，面向深圳全市学员招生，由前 5% 金牌教师授课。专为热爱科创、编程竞赛的孩子教学，学员享有教研及竞赛资源，提升语数英素养；前期打磨思维，后期冲刺赛事，助力升学。";
    case "育才班":
      return "育才班是编程猫依托“北京大学与点猫科技联合共建人工智能实验室”背景，全新设立的人才选拔与专项培养班型。该班专为幼小衔接和一年级孩子打造，由编程猫优秀师资带教，定制培养思维、专注力和表达力三大能力，并融入教育部白名单赛事、NCT 考级等实战机会，帮助孩子积累特长升学证明，开拓视野、建立自信。编程猫在等级考试、白名单赛事与信奥赛等方向保持行业领先表现，被誉为少儿编程行业的“黄埔军校”。";
    default:
      return "英才特训营是编程猫依托北大共建 AI 实验室开设的重点培养项目。入选学员可优先使用实验室研发、教研资源与竞赛通道，同步提升语数英创新学习能力。前期侧重思维训练、保护学习兴趣，后期主攻竞赛，助力孩子科创发展与升学。学员需通过审核评估后入营。";
  }
}

export function getProgramAdmissionDetail(programType: ProgramType) {
  const displayName = getProgramDisplayName(programType);
  return `恭喜你在编程猫${getProgramLandingName(programType)}选拔中获得${displayName}录取资格。`;
}

export function getProgramLearningGoal(programType: ProgramType) {
  if (programType === "科特班") {
    return "半年冲刺三张国家级证书，提供赛事与考级辅导支持，在锻炼思维能力、提升学习成绩的同时，帮助孩子持续积累科技特长。";
  }
  return "半年冲刺三项成长成果，提供赛事与考级辅导支持，在锻炼思维能力、提升学习成绩的同时，帮助孩子持续积累科技特长。";
}
