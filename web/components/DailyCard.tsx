"use client";

import { Check, Hourglass, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { DailyChallenge } from "@/lib/types";

/** Seconds left until midnight in `timeZone` (display only). */
function secondsToMidnight(timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((p) => [p.type, Number(p.value)]),
  );
  return 86_400 - ((parts.hour ?? 0) * 3600 + (parts.minute ?? 0) * 60 + (parts.second ?? 0));
}

function Countdown({ timeZone }: { timeZone: string }) {
  const [left, setLeft] = useState(() => secondsToMidnight(timeZone));
  useEffect(() => {
    const t = setInterval(() => setLeft(secondsToMidnight(timeZone)), 1000);
    return () => clearInterval(t);
  }, [timeZone]);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="tabular-nums">
      {pad(Math.floor(left / 3600))}:{pad(Math.floor((left % 3600) / 60))}:{pad(left % 60)}
    </span>
  );
}

interface Props {
  daily: DailyChallenge;
  timezone: string;
  pending: boolean;
  onComplete: () => void;
}

/** "Daydle of the day": one challenge per day, the same for everyone, worth 40 XP. */
export function DailyCard({ daily, timezone, pending, onComplete }: Props) {
  const done = daily.completion !== null;

  return (
    <section aria-label={`Daydle #${daily.number}`} className="relative rounded-3xl bg-gradient-to-r from-xp-a to-xp-b p-[1.5px] shadow-lg shadow-[var(--glow)]">
      <div className="relative overflow-clip rounded-[calc(1.5rem-1.5px)] bg-ink-850 px-5 py-4 sm:px-6 sm:py-5">
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-xp-b/15 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-serif text-[11px] font-black uppercase tracking-[0.25em] text-xp-a">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Daydle #{daily.number}
              <span className="font-sans font-medium normal-case tracking-normal text-mist-500">· today&apos;s challenge</span>
            </p>
            <p className={`mt-1.5 font-display text-xl font-semibold leading-snug sm:text-2xl ${done ? "text-mist-400" : "text-mist-50"}`}>
              {daily.title}
            </p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div
                key="done"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 20 }}
                className="flex shrink-0 flex-col items-start gap-1 sm:items-end"
              >
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300">
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                  {pending ? "Saving…" : `Done · +${daily.completion?.base_xp ?? daily.xp} XP`}
                </span>
                <span className="flex items-center gap-1 text-xs text-mist-500">
                  <Hourglass className="h-3 w-3" aria-hidden />
                  Next Daydle in <Countdown timeZone={timezone} />
                </span>
              </motion.div>
            ) : (
              <motion.button
                key="todo"
                whileTap={{ scale: 0.95 }}
                onClick={onComplete}
                disabled={pending}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-xp-a to-xp-b px-5 py-3 font-semibold text-on-accent shadow-lg shadow-[var(--glow)] transition hover:brightness-110 disabled:opacity-60"
                aria-label={`Complete today's Daydle for ${daily.xp} XP`}
              >
                Complete
                <span className="rounded-md bg-black/15 px-1.5 py-0.5 text-xs font-bold">+{daily.xp} XP</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
