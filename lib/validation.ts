const NAME_MAX_LENGTH = 50;
const SCORE_MAX_LENGTH = 30;

export function cleanName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, NAME_MAX_LENGTH);
}

export function cleanScore(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).trim().slice(0, SCORE_MAX_LENGTH);
}

export function isValidPassword(password: string) {
  return password.length >= 6 && password.length <= 128;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
