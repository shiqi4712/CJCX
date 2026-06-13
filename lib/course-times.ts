export const COURSE_TIME_OPTIONS = [
  "周六 09:00-11:00",
  "周六 14:00-16:00",
  "周日 09:00-11:00",
  "周日 14:00-16:00"
] as const;

export function isValidCourseTime(value: string) {
  return COURSE_TIME_OPTIONS.includes(value as (typeof COURSE_TIME_OPTIONS)[number]);
}
