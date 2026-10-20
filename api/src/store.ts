import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Difficulty } from "./rules.js";

export const DEFAULT_TIMEZONE = "Europe/Bucharest";

export interface Quest {
  id: string;
  title: string;
  difficulty: Difficulty;
  due_date: string | null;
  recurrence: "daily" | null;
  created_at: string;
}

export interface Completion {
  id: string;
  quest_id: string;
  day: string;
  base_xp: number;
  created_at: string;
}

// `slot` is the day for a daily quest and '' for a one-off, so the partial unique index
// enforces "at most one active completion per quest (per day, for dailies)" in the database too.
// `seq` breaks ties between rows with the same timestamp: newest inserted wins.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS quests (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  due_date   TEXT,
  recurrence TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS completions (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,
  quest_id   TEXT NOT NULL REFERENCES quests(id),
  day        TEXT NOT NULL,
  slot       TEXT NOT NULL,
  base_xp    INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  undone_at  TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS completions_one_active_per_slot
  ON completions (quest_id, slot) WHERE undone_at IS NULL;
CREATE TABLE IF NOT EXISTS daily_completions (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,
  day        TEXT NOT NULL,
  challenge  TEXT NOT NULL,
  base_xp    INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  undone_at  TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_completions_one_active_per_day
  ON daily_completions (day) WHERE undone_at IS NULL;
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/** A completed daily challenge. The title is stored so history survives changes to the list. */
export interface DailyCompletion {
  id: string;
  day: string;
  challenge: string;
  base_xp: number;
  created_at: string;
}

const COMPLETION_COLUMNS = "id, quest_id, day, base_xp, created_at";
const DAILY_COLUMNS = "id, day, challenge, base_xp, created_at";

export class Store {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  getTimezone(): string {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'timezone'").get() as
      | { value: string }
      | undefined;
    return row?.value ?? DEFAULT_TIMEZONE;
  }

  setTimezone(timezone: string): void {
    this.db
      .prepare("INSERT INTO settings (key, value) VALUES ('timezone', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
      .run(timezone);
  }

  insertQuest(q: Quest): void {
    this.db
      .prepare("INSERT INTO quests (id, title, difficulty, due_date, recurrence, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(q.id, q.title, q.difficulty, q.due_date, q.recurrence, q.created_at);
  }

  getQuest(id: string): Quest | undefined {
    return this.db
      .prepare("SELECT id, title, difficulty, due_date, recurrence, created_at FROM quests WHERE id = ?")
      .get(id) as Quest | undefined;
  }

  listQuests(): Quest[] {
    return this.db
      .prepare("SELECT id, title, difficulty, due_date, recurrence, created_at FROM quests ORDER BY created_at DESC, seq DESC")
      .all() as unknown as Quest[];
  }

  /** Completions that have not been undone, newest first. */
  activeCompletions(): Completion[] {
    return this.db
      .prepare(`SELECT ${COMPLETION_COLUMNS} FROM completions WHERE undone_at IS NULL ORDER BY created_at DESC, seq DESC`)
      .all() as unknown as Completion[];
  }

  /** Active (quest_id, slot) pairs, used to compute `done`. */
  activeSlots(): Set<string> {
    const rows = this.db.prepare("SELECT quest_id, slot FROM completions WHERE undone_at IS NULL").all() as {
      quest_id: string;
      slot: string;
    }[];
    return new Set(rows.map((r) => slotKey(r.quest_id, r.slot)));
  }

  findActiveCompletion(questId: string, slot: string): Completion | undefined {
    return this.db
      .prepare(`SELECT ${COMPLETION_COLUMNS} FROM completions WHERE quest_id = ? AND slot = ? AND undone_at IS NULL`)
      .get(questId, slot) as Completion | undefined;
  }

  insertCompletion(c: Completion, slot: string): void {
    this.db
      .prepare("INSERT INTO completions (id, quest_id, day, slot, base_xp, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(c.id, c.quest_id, c.day, slot, c.base_xp, c.created_at);
  }

  /** Marks a completion undone. Returns false if it does not exist or was already undone. */
  undoCompletion(id: string, at: string): boolean {
    const result = this.db
      .prepare("UPDATE completions SET undone_at = ? WHERE id = ? AND undone_at IS NULL")
      .run(at, id);
    return Number(result.changes) > 0;
  }

  /** Daily-challenge completions that have not been undone, newest first. */
  activeDailyCompletions(): DailyCompletion[] {
    return this.db
      .prepare(`SELECT ${DAILY_COLUMNS} FROM daily_completions WHERE undone_at IS NULL ORDER BY created_at DESC, seq DESC`)
      .all() as unknown as DailyCompletion[];
  }

  findActiveDailyCompletion(day: string): DailyCompletion | undefined {
    return this.db
      .prepare(`SELECT ${DAILY_COLUMNS} FROM daily_completions WHERE day = ? AND undone_at IS NULL`)
      .get(day) as DailyCompletion | undefined;
  }

  insertDailyCompletion(c: DailyCompletion): void {
    this.db
      .prepare("INSERT INTO daily_completions (id, day, challenge, base_xp, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(c.id, c.day, c.challenge, c.base_xp, c.created_at);
  }

  undoDailyCompletion(id: string, at: string): boolean {
    const result = this.db
      .prepare("UPDATE daily_completions SET undone_at = ? WHERE id = ? AND undone_at IS NULL")
      .run(at, id);
    return Number(result.changes) > 0;
  }

  reset(): void {
    this.db.exec("DELETE FROM completions; DELETE FROM daily_completions; DELETE FROM quests; DELETE FROM settings;");
  }
}

export function slotKey(questId: string, slot: string): string {
  return `${questId}\u0000${slot}`;
}

/** Which slot a completion of `quest` made on `today` occupies. */
export function slotFor(quest: Pick<Quest, "recurrence">, today: string): string {
  return quest.recurrence === "daily" ? today : "";
}
