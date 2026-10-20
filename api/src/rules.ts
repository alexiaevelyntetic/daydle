// Game rules. Everything here is pure; see RULES.md for where each number comes from.
import { addDays, dayIn } from "./time.js";

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_XP: Record<Difficulty, number> = { easy: 10, medium: 25, hard: 50 };
export const LEVEL_STEP = 100; // level n needs LEVEL_STEP * n XP (R6)
export const BONUS_PER_STREAK_DAY = 2; // R4
export const BONUS_CAP = 14; // R4

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && Object.hasOwn(DIFFICULTY_XP, value);
}

/** XP a completion on `day` earns before the streak bonus. Late one-offs earn half, rounded down (R1, R2). */
export function baseXp(difficulty: Difficulty, dueDate: string | null, day: string): number {
  const full = DIFFICULTY_XP[difficulty];
  return dueDate !== null && day > dueDate ? Math.floor(full / 2) : full;
}

/** Bonus earned once per day that has at least one completion (R4). */
export function dailyBonus(streak: number): number {
  return Math.min(BONUS_PER_STREAK_DAY * streak, BONUS_CAP);
}

/** Consecutive days with a completion, ending on `day` (0 if `day` itself has none). */
export function streakEndingOn(day: string, days: ReadonlySet<string>): number {
  let n = 0;
  while (days.has(addDays(day, -n))) n++;
  return n;
}

/** The current streak: ends today, or yesterday if nothing is done yet today (R7). */
export function currentStreak(days: ReadonlySet<string>, today: string): number {
  return days.has(today) ? streakEndingOn(today, days) : streakEndingOn(addDays(today, -1), days);
}

export interface LevelProgress {
  level: number;
  xp_into_level: number;
  xp_to_next_level: number;
}

export function levelProgress(xp: number): LevelProgress {
  let level = 1;
  let into = xp;
  while (into >= LEVEL_STEP * level) {
    into -= LEVEL_STEP * level;
    level++;
  }
  return { level, xp_into_level: into, xp_to_next_level: LEVEL_STEP * level - into };
}

/** Total XP is derived from the active completions every time, so undo is exact and retroactive (R5). */
export function totalXp(completions: ReadonlyArray<{ day: string; base_xp: number }>): number {
  const days = new Set(completions.map((c) => c.day));
  let xp = 0;
  for (const c of completions) xp += c.base_xp;
  for (const day of days) xp += dailyBonus(streakEndingOn(day, days));
  return xp;
}

export interface Me extends LevelProgress {
  timezone: string;
  xp: number;
  streak: number;
}

export function computeMe(
  completions: ReadonlyArray<{ day: string; base_xp: number }>,
  timezone: string,
  now: Date,
): Me {
  const xp = totalXp(completions);
  const days = new Set(completions.map((c) => c.day));
  return {
    timezone,
    xp,
    ...levelProgress(xp),
    streak: currentStreak(days, dayIn(now, timezone)),
  };
}
