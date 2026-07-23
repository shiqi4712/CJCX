export type PerformanceRating = {
  label: string;
  value: number;
};

function clampActivityStars(count: number | null | undefined) {
  const normalized = Math.max(0, Math.floor(Number(count ?? 0)));
  if (normalized >= 3) return 5;
  if (normalized >= 2) return 4;
  return 3;
}

export function buildPerformanceRatings(input: {
  homeworkLessonCount?: number | null;
  videoCount?: number | null;
}): PerformanceRating[] {
  return [
    { label: "上课表现", value: 4 },
    { label: "作业提交", value: clampActivityStars(input.homeworkLessonCount) },
    { label: "视频打卡", value: clampActivityStars(input.videoCount) }
  ];
}
