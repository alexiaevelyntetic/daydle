import { HttpError } from "./errors.js";
import { isDifficulty, type Difficulty } from "./rules.js";
import { isValidDay } from "./time.js";

export interface QuestInput {
  title: string;
  difficulty: Difficulty;
  due_date: string | null;
  recurrence: "daily" | null;
}

/** Checks run in this order; the first failure wins (a documented choice, the recording only shows one at a time). */
export function parseQuestInput(body: unknown): QuestInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "body must be a JSON object");
  }
  const { title, difficulty, due_date, recurrence } = body as Record<string, unknown>;

  // Length is counted in characters (code points), not UTF-16 units, so emoji count as one.
  if (typeof title !== "string" || title.trim() === "" || [...title].length > 100) {
    throw new HttpError(400, "invalid title");
  }
  if (!isDifficulty(difficulty)) throw new HttpError(400, "invalid difficulty");
  if (due_date != null && recurrence != null) {
    throw new HttpError(400, "a quest cannot have both due_date and recurrence");
  }
  if (due_date != null && !isValidDay(due_date)) throw new HttpError(400, "invalid due_date");
  if (recurrence != null && recurrence !== "daily") throw new HttpError(400, "invalid recurrence");

  return {
    title,
    difficulty,
    due_date: (due_date as string | undefined) ?? null,
    recurrence: (recurrence as "daily" | undefined) ?? null,
  };
}
