"use client";

import { CalendarDays, Check, Repeat, Swords, Target, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { DIFFICULTY, formatDay } from "@/lib/format";
import { baseXp, daysBetween } from "@/lib/rules";
import type { Quest } from "@/lib/types";

interface Props {
  quests: readonly Quest[];
  today: string;
  pending: ReadonlySet<string>;
  onComplete: (quest: Quest) => void;
}

type Tab = "todo" | "done";

export function QuestList({ quests, today, pending, onComplete }: Props) {
  const [tab, setTab] = useState<Tab>("todo");
  const open = quests.filter((q) => !q.done);
  const done = quests.filter((q) => q.done);
  const shown = tab === "todo" ? open : done;

  if (quests.length === 0) {
    return (
      <div className="grid place-items-center rounded-3xl border border-dashed border-fg/10 px-6 py-14 text-center">
        <Swords className="mb-3 h-8 w-8 text-mist-500" aria-hidden />
        <p className="font-display text-lg font-semibold">Your quest log is empty</p>
        <p className="mt-1 max-w-xs text-sm text-mist-400">Add your first quest. Small daily ones are the fastest way to build a streak.</p>
      </div>
    );
  }

  // One list at a time: "Done" grows every day and would otherwise push everything down.
  return (
    <section aria-label="Quests">
      <div className="mb-3 flex items-center gap-3">
        <div role="tablist" aria-label="Quest lists" className="flex rounded-xl bg-ink-950/50 p-1 ring-1 ring-fg/[0.06]">
          {(
            [
              ["todo", "To do", open.length],
              ["done", "Done", done.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                tab === value ? "text-mist-50" : "text-mist-400 hover:text-mist-200"
              }`}
            >
              {tab === value && (
                <motion.span layoutId="quest-tab" className="absolute inset-0 rounded-lg bg-ink-700 shadow" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
              )}
              <span className="relative">{label}</span>
              <span className="relative rounded-full bg-fg/[0.08] px-1.5 text-[11px] tabular-nums text-mist-400">{count}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2" role="tabpanel">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.length === 0 ? (
            <motion.li
              key={`empty-${tab}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-fg/[0.03] px-4 py-6 text-center text-sm text-mist-400"
            >
              {tab === "todo" ? "All clear for today. Nice work. ✨" : "Nothing completed yet. Your first win is one click away."}
            </motion.li>
          ) : (
            shown.map((q) => <QuestCard key={q.id} quest={q} today={today} pending={pending.has(q.id)} onComplete={onComplete} />)
          )}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function QuestCard({
  quest,
  today,
  pending,
  onComplete,
}: {
  quest: Quest;
  today: string;
  pending: boolean;
  onComplete: (q: Quest) => void;
}) {
  const meta = DIFFICULTY[quest.difficulty];
  const overdue = quest.due_date !== null && quest.due_date < today && !quest.done;
  const reward = baseXp(quest.difficulty, quest.due_date, today);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border px-4 py-3 transition ${
        quest.done
          ? "border-fg/[0.04] bg-ink-850/40"
          : overdue
            ? "border-rose-500/35 bg-[color-mix(in_srgb,var(--ink-850)_90%,#f43f5e)] hover:border-rose-500/55"
            : "border-fg/[0.07] bg-ink-850/80 hover:border-fg/[0.14]"
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${meta.glow} to-transparent ${quest.done ? "opacity-30" : ""}`} />

      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] font-medium ${quest.done ? "text-mist-400" : "text-mist-50"}`}>{quest.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className={`rounded-md px-1.5 py-0.5 font-medium ring-1 ${meta.chip}`}>{meta.label}</span>
          <ScheduleTag quest={quest} today={today} overdue={overdue} />
        </div>
      </div>

      {quest.done ? (
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400/20"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
          {pending ? "Saving…" : quest.recurrence === "daily" ? "Done today" : "Done"}
        </motion.span>
      ) : (
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => onComplete(quest)}
          disabled={pending}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-fg/[0.06] py-2 pl-3 pr-2 text-sm font-semibold text-mist-50 ring-1 ring-fg/10 transition hover:bg-gradient-to-r hover:from-xp-a hover:to-xp-b hover:text-on-accent hover:ring-transparent hover:shadow-lg hover:shadow-xp-a/25 disabled:opacity-50"
          aria-label={`Complete ${quest.title} for ${reward} XP`}
        >
          Complete
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${overdue ? "bg-rose-400/15 text-rose-800 dark:text-rose-200" : "bg-fg/10 text-xp-b"}`}>
            +{reward}
          </span>
        </motion.button>
      )}
    </motion.li>
  );
}

function ScheduleTag({ quest, today, overdue }: { quest: Quest; today: string; overdue: boolean }) {
  if (quest.recurrence === "daily") {
    return (
      <span className="flex items-center gap-1 text-mist-400">
        <Repeat className="h-3.5 w-3.5" aria-hidden /> Daily
      </span>
    );
  }
  if (quest.due_date === null) {
    return (
      <span className="flex items-center gap-1 text-mist-400">
        <Target className="h-3.5 w-3.5" aria-hidden /> One-off
      </span>
    );
  }
  if (overdue) {
    const late = daysBetween(quest.due_date, today);
    return (
      <span className="flex items-center gap-1 rounded-md bg-rose-400/15 px-1.5 py-0.5 font-semibold text-rose-700 dark:text-rose-300 ring-1 ring-rose-400/25">
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
        Overdue · {late} {late === 1 ? "day" : "days"} · half XP
      </span>
    );
  }
  const dueToday = quest.due_date === today;
  return (
    <span className={`flex items-center gap-1 ${dueToday && !quest.done ? "font-medium text-amber-700 dark:text-amber-300" : "text-mist-400"}`}>
      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
      Due {formatDay(quest.due_date, today).replace(/^(Today|Tomorrow|Yesterday)$/, (m) => m.toLowerCase())}
    </span>
  );
}
