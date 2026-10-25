export const COURSE_DAYS = ["周一", "周四", "周五", "周六", "周日"] as const;

export const COURSE_SLOTS = [
  "14:00-15:00",
  "15:00-16:00",
  "17:00-18:00",
  "18:00-19:00",
  "19:00-20:00",
  "20:00-21:00"
] as const;

export const COURSE_TIME_OPTIONS = COURSE_DAYS.flatMap((day) =>
  COURSE_SLOTS.map((slot) => `${day} ${slot}`)
);

export function isValidCourseTime(value: string) {
  return COURSE_TIME_OPTIONS.includes(value);
}
