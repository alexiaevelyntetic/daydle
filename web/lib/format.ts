import { addDays } from "./rules";
import type { Difficulty } from "./types";

export const DIFFICULTY: Record<Difficulty, { label: string; xp: number; chip: string; dot: string; glow: string }> = {
  // Easy is sky, not green, so it doesn't blend into the brand green.
  easy: {
    label: "Easy",
    xp: 10,
    chip: "bg-sky-500/10 text-sky-800 ring-sky-600/30 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25",
    dot: "bg-sky-500 dark:bg-sky-400",
    glow: "from-sky-500/70 dark:from-sky-400/70",
  },
  medium: {
    label: "Medium",
    xp: 25,
    chip: "bg-amber-500/15 text-amber-800 ring-amber-600/30 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25",
    dot: "bg-amber-500 dark:bg-amber-400",
    glow: "from-amber-500/70 dark:from-amber-400/70",
  },
  hard: {
    label: "Hard",
    xp: 50,
    chip: "bg-rose-500/10 text-rose-800 ring-rose-600/30 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/25",
    dot: "bg-rose-500 dark:bg-rose-400",
    glow: "from-rose-500/70 dark:from-rose-400/70",
  },
};

const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

/** "Today", "Yesterday", "Tomorrow" or "Mon, Oct 12" for a yyyy-mm-dd day. */
export function formatDay(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  if (day === addDays(today, 1)) return "Tomorrow";
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatLongDate(day: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}
