export function getAbilityRankByOverallScore(overallScore: string | number | null | undefined) {
  if (overallScore === null || overallScore === undefined || overallScore === "") return null;
  const score = Number(overallScore);
  if (!Number.isFinite(score)) return null;

  const clampedScore = Math.min(99, Math.max(97, score));
  return Math.round(10 - ((clampedScore - 97) / 2) * 8);
}
