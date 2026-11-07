export type PerformanceRating = {
  label: string;
  value: number;
};

function normalizeCount(count: number | null | undefined) {
  return Math.max(0, Math.floor(Number(count ?? 0)));
}

function getHomeworkStars(count: number | null | undefined) {
  const normalized = normalizeCount(count);
  if (normalized >= 3) return 5;
  if (normalized >= 2) return 4;
  return 3;
}

function getVideoStars(count: number | null | undefined) {
  const normalized = normalizeCount(count);
  if (normalized >= 3) return 5;
  if (normalized >= 2) return 4;
  return 3;
}

export function buildPerformanceRatings(input: {
  overallScore?: string | null;
  homeworkLessonCount?: number | null;
  videoCount?: number | null;
}): PerformanceRating[] {
  const score = Number(input.overallScore);
  const classroomStars = input.overallScore?.trim() && Number.isFinite(score)
    ? score >= 98 ? 5 : score >= 97 ? 4 : 3
    : 4;
  return [
    { label: "上课表现", value: classroomStars },
    { label: "思维能力", value: getHomeworkStars(input.homeworkLessonCount) },
    { label: "创新能力", value: getVideoStars(input.videoCount) }
  ];
}
