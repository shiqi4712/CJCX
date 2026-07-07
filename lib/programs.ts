export const PROGRAM_TYPES = ["英才班", "科特班", "育才班"] as const;

export type ProgramType = (typeof PROGRAM_TYPES)[number];

export function normalizeProgramType(value?: string | null): ProgramType {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/·?英才计划/g, "");

  if (normalized.includes("科特") || normalized.includes("kete")) return "科特班";
  if (normalized.includes("育才") || normalized.includes("yucai")) return "育才班";
  return "英才班";
}

export function getProgramLandingName(programType: ProgramType) {
  return programType === "英才班" ? "英才班" : `${programType}·英才计划`;
}

export function getProgramIntro(programType: ProgramType) {
  switch (programType) {
    case "科特班":
      return "科特班聚焦科创素养与编程能力提升，帮助学员形成项目实践、算法思维与表达能力。";
    case "育才班":
      return "育才班重在兴趣保护、基础能力夯实与持续学习习惯培养，为后续进阶学习建立稳定基础。";
    default:
      return "英才班面向综合表现突出的学员，侧重思维训练、竞赛能力与长期学习规划。";
  }
}

export function getProgramAdmissionDetail(programType: ProgramType) {
  return `恭喜你在编程猫${getProgramLandingName(programType)}选拔中获得${programType}录取资格。`;
}

export function getProgramLearningGoal(programType: ProgramType) {
  switch (programType) {
    case "科特班":
      return "围绕科创项目、算法思维与表达展示建立阶段性成长目标。";
    case "育才班":
      return "夯实编程基础、保持学习兴趣，建立稳定练习习惯。";
    default:
      return "半年三证，达到编程NCT考级二级水平，可参加教育部白名单赛事。";
  }
}
