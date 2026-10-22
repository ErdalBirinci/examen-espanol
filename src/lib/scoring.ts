import type { Attempt } from "./types";

export const TOTAL_WEIGHTS = { test: 0.4, listening: 0.2, writing: 0.2, speaking: 0.2 };

export function testPercent(attempt: Attempt): number | null {
  if (!attempt.mc_total || attempt.mc_total <= 0) return null;
  return Math.round(((attempt.mc_correct ?? 0) / attempt.mc_total) * 100);
}

/**
 * Weighted result across all four sections. Returns null until every section
 * has a score, so a partially graded exam never looks complete.
 */
export function attemptTotal(attempt: Attempt): number | null {
  const test = testPercent(attempt);
  const parts = [test, attempt.listening_score, attempt.writing_score, attempt.speaking_score];
  if (parts.some((part) => part === null)) return null;
  const [testScore, listening, writing, speaking] = parts as number[];
  return Math.round(
    testScore * TOTAL_WEIGHTS.test +
      listening * TOTAL_WEIGHTS.listening +
      writing * TOTAL_WEIGHTS.writing +
      speaking * TOTAL_WEIGHTS.speaking,
  );
}
