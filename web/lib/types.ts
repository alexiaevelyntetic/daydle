export type Difficulty = "easy" | "medium" | "hard";

export interface Quest {
  id: string;
  title: string;
  difficulty: Difficulty;
  due_date: string | null;
  recurrence: "daily" | null;
  done: boolean;
}

export interface Completion {
  id: string;
  quest_id: string;
  day: string;
  base_xp: number;
  created_at: string;
}

export interface Me {
  timezone: string;
  xp: number;
  level: number;
  xp_into_level: number;
  xp_to_next_level: number;
  streak: number;
}

/** Extension: a completed "Daydle of the day" challenge. */
export interface DailyCompletion {
  id: string;
  day: string;
  challenge: string;
  base_xp: number;
  created_at: string;
}

/** Extension: today's challenge, the same for everyone on a given day. */
export interface DailyChallenge {
  day: string;
  number: number;
  title: string;
  xp: number;
  completion: DailyCompletion | null;
}

export interface ServerState {
  quests: Quest[];
  completions: Completion[];
  me: Me;
  daily: DailyChallenge;
  dailyCompletions: DailyCompletion[];
}

export interface NewQuest {
  title: string;
  difficulty: Difficulty;
  due_date?: string;
  recurrence?: "daily";
}
