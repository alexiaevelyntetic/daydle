// Client copy of api/src/rules.ts, used ONLY to predict the result of a request that is still
// in flight. Whenever nothing is pending the UI shows the server's numbers verbatim.
import type { Completion, Difficulty, Me, Quest } from "./types";

export const DIFFICULTY_XP: Record<Difficulty, number> = { easy: 10, medium: 25, hard: 50 };
const LEVEL_STEP = 100;
const BONUS_PER_STREAK_DAY = 2;
const BONUS_CAP = 14;

const formatters = new Map<string, Intl.DateTimeFormat>();

export function dayIn(instant: Date | number, timeZone: string): string {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timeZone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(instant).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function baseXp(difficulty: Difficulty, dueDate: string | null, day: string): number {
  const full = DIFFICULTY_XP[difficulty];
  return dueDate !== null && day > dueDate ? Math.floor(full / 2) : full;
}

export function dailyBonus(streak: number): number {
  return Math.min(BONUS_PER_STREAK_DAY * streak, BONUS_CAP);
}

export function streakEndingOn(day: string, days: ReadonlySet<string>): number {
  let n = 0;
  while (days.has(addDays(day, -n))) n++;
  return n;
}

export function currentStreak(days: ReadonlySet<string>, today: string): number {
  return days.has(today) ? streakEndingOn(today, days) : streakEndingOn(addDays(today, -1), days);
}

export function levelProgress(xp: number) {
  let level = 1;
  let into = xp;
  while (into >= LEVEL_STEP * level) {
    into -= LEVEL_STEP * level;
    level++;
  }
  return { level, xp_into_level: into, xp_to_next_level: LEVEL_STEP * level - into };
}

/** `completions` is every activity that counts: quest completions and daily-challenge completions. */
export function computeMe(completions: readonly { day: string; base_xp: number }[], timezone: string, now: number): Me {
  const days = new Set(completions.map((c) => c.day));
  let xp = 0;
  for (const c of completions) xp += c.base_xp;
  for (const day of days) xp += dailyBonus(streakEndingOn(day, days));
  return { timezone, xp, ...levelProgress(xp), streak: currentStreak(days, dayIn(now, timezone)) };
}

/** Same rule as the server's `done`: one-offs are done once, dailies are done for today. */
export function isDone(quest: Pick<Quest, "id" | "recurrence">, completions: readonly Completion[], today: string) {
  return completions.some((c) => c.quest_id === quest.id && (quest.recurrence !== "daily" || c.day === today));
}
