"use client";

import { CalendarDays, LoaderCircle, Plus, Repeat, Target } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { DIFFICULTY } from "@/lib/format";
import { addDays } from "@/lib/rules";
import type { Difficulty, NewQuest } from "@/lib/types";

type Schedule = "once" | "due" | "daily";

const SCHEDULES: { value: Schedule; label: string; icon: typeof Target }[] = [
  { value: "once", label: "One-off", icon: Target },
  { value: "due", label: "Due date", icon: CalendarDays },
  { value: "daily", label: "Daily", icon: Repeat },
];

export function QuestForm({ today, onCreate }: { today: string; onCreate: (q: NewQuest) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [schedule, setSchedule] = useState<Schedule>("once");
  const [dueDate, setDueDate] = useState(() => addDays(today, 1));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const length = [...title].length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim() === "") return setError("Give your quest a name.");
    if (length > 100) return setError("Keep the title to 100 characters.");
    if (schedule === "due" && !dueDate) return setError("Pick a due date.");

    const quest: NewQuest = { title, difficulty };
    if (schedule === "due") quest.due_date = dueDate;
    if (schedule === "daily") quest.recurrence = "daily";

    setSaving(true);
    setError(null);
    try {
      await onCreate(quest);
      setTitle("");
    } catch (err) {
      setError(err instanceof ApiError ? capitalize(err.message) : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  // Collapsed to just the title field until the user starts on it; closes again when focus
  // leaves an empty form. Enter in the title field still works with the defaults.
  const expanded = open || title !== "" || error !== null;

  return (
    <form
      onSubmit={submit}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && title.trim() === "") setOpen(false);
      }}
      className="rounded-3xl border border-fg/[0.07] bg-ink-850/70 p-5 backdrop-blur"
      noValidate
    >
      <h2 className="mb-3 font-display text-lg font-semibold">New quest</h2>

      <label className="relative block">
        <span className="sr-only">Title</span>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder="Drink 2 litres of water…"
          className="w-full rounded-xl border border-fg/[0.08] bg-ink-950/60 px-4 py-3 pr-16 text-[15px] text-mist-50 placeholder:text-mist-500 outline-none transition focus:border-xp-a/60 focus:ring-4 focus:ring-xp-a/15"
          aria-invalid={error !== null}
        />
        <span
          className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs tabular-nums ${length > 100 ? "text-rose-700 dark:text-rose-300" : "text-mist-500"}`}
        >
          {length}/100
        </span>
      </label>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="-mx-1 overflow-hidden px-1 pb-1"
          >
            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-mist-500">Difficulty</legend>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => {
                  const meta = DIFFICULTY[d];
                  const active = difficulty === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      aria-pressed={active}
                      className={`rounded-xl px-3 py-2.5 text-left ring-1 transition ${
                        active ? `${meta.chip} ring-2` : "bg-fg/[0.03] text-mist-400 ring-fg/[0.06] hover:bg-fg/[0.06]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      <span className="mt-0.5 block text-xs opacity-80">+{meta.xp} XP</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-mist-500">Schedule</legend>
              <div className="flex rounded-xl bg-ink-950/60 p-1 ring-1 ring-fg/[0.06]">
                {SCHEDULES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSchedule(value)}
                    aria-pressed={schedule === value}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition ${
                      schedule === value ? "bg-ink-700 text-mist-50 shadow" : "text-mist-400 hover:text-mist-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
              {schedule === "due" && (
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-fg/[0.08] bg-ink-950/60 px-4 py-2.5 text-sm text-mist-50 outline-none focus:border-xp-a/60 focus:ring-4 focus:ring-xp-a/15"
                  aria-label="Due date"
                />
              )}
              {schedule === "daily" && (
                <p className="mt-2 text-xs text-mist-500">Can be completed once every day. Feeds your streak.</p>
              )}
              {schedule === "due" && (
                <p className="mt-2 text-xs text-mist-500">Completing it after this day earns half the XP.</p>
              )}
            </fieldset>

            {error && (
              <p className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-xp-a to-xp-b px-4 py-3 font-semibold text-on-accent shadow-lg shadow-xp-a/25 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 transition group-hover:rotate-90" />}
              Add quest
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1) + (s.endsWith(".") ? "" : ".");
}
