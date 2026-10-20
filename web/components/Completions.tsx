"use client";

import { History, Sparkles, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { DIFFICULTY, formatDay, formatTime } from "@/lib/format";
import { DIFFICULTY_XP } from "@/lib/rules";
import type { Completion, DailyCompletion, Quest } from "@/lib/types";

const VISIBLE = 5;

type Row =
  | { kind: "quest"; completion: Completion; createdAt: string }
  | { kind: "daily"; completion: DailyCompletion; createdAt: string };

interface Props {
  completions: readonly Completion[];
  dailyCompletions: readonly DailyCompletion[];
  quests: readonly Quest[];
  today: string;
  timezone: string;
  pending: ReadonlySet<string>;
  onUndo: (completion: Completion, title: string) => void;
  onUndoDaily: (completion: DailyCompletion) => void;
}

/** Quest completions and daily-challenge completions in one timeline, newest first. */
export function Completions({ completions, dailyCompletions, quests, today, timezone, pending, onUndo, onUndoDaily }: Props) {
  const [showAll, setShowAll] = useState(false);
  const byId = new Map(quests.map((q) => [q.id, q]));
  const rows: Row[] = [
    ...completions.map((c): Row => ({ kind: "quest", completion: c, createdAt: c.created_at })),
    ...dailyCompletions.map((c): Row => ({ kind: "daily", completion: c, createdAt: c.created_at })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visible = showAll ? rows : rows.slice(0, VISIBLE);

  return (
    <section className="rounded-3xl border border-fg/[0.07] bg-ink-850/70 p-5 backdrop-blur">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
        <History className="h-4.5 w-4.5 text-mist-400" aria-hidden />
        Recent completions
      </h2>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-mist-400">Completed quests show up here. You can undo any of them.</p>
      ) : (
        <ul className="space-y-1">
          <AnimatePresence initial={false}>
            {visible.map((row) => {
              const c = row.completion;
              const quest = row.kind === "quest" ? byId.get(row.completion.quest_id) : undefined;
              const title = row.kind === "daily" ? row.completion.challenge : (quest?.title ?? "Unknown quest");
              const isPending = pending.has(c.id);
              const late = quest !== undefined && c.base_xp < DIFFICULTY_XP[quest.difficulty];
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="flex items-center gap-3 overflow-hidden rounded-xl px-2 py-2.5 hover:bg-fg/[0.03]"
                >
                  {row.kind === "daily" ? (
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-xp-a" aria-label="Daily challenge" />
                  ) : (
                    <span className={`mx-[3px] h-2 w-2 shrink-0 rounded-full ${quest ? DIFFICULTY[quest.difficulty].dot : "bg-mist-500"}`} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{title}</p>
                    <p className="text-xs text-mist-500">
                      {row.kind === "daily" && <span className="font-semibold text-xp-a">Daydle · </span>}
                      {formatDay(c.day, today)} · {isPending ? "just now" : formatTime(c.created_at, timezone)}
                    </p>
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${late ? "text-rose-700 dark:text-rose-300" : "text-xp-b"}`} title={late ? "Late: half XP" : undefined}>
                    +{c.base_xp}
                  </span>
                  <button
                    onClick={() => (row.kind === "daily" ? onUndoDaily(row.completion) : onUndo(row.completion, title))}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-mist-400 ring-1 ring-fg/[0.08] transition hover:bg-rose-400/10 hover:text-rose-700 dark:hover:text-rose-200 hover:ring-rose-400/30 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-mist-400"
                    aria-label={`Undo ${title}`}
                  >
                    <Undo2 className="h-3.5 w-3.5" aria-hidden />
                    Undo
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {rows.length > VISIBLE && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="mt-3 w-full rounded-xl py-2 text-xs font-medium text-mist-400 transition hover:bg-fg/[0.04] hover:text-mist-200"
        >
          {showAll ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
