"use client";

import { Flame, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { addDays, dailyBonus } from "@/lib/rules";
import type { Me } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";
import { XpBar } from "./XpBar";

interface Props {
  me: Me;
  /** Every activity that counts for the streak (quest and daily-challenge completions). */
  completions: readonly { day: string }[];
  today: string;
}

export function XpHeader({ me, completions, today }: Props) {
  const days = new Set(completions.map((c) => c.day));
  const doneToday = days.has(today);

  return (
    <section className="relative overflow-clip rounded-3xl border border-fg/[0.07] bg-ink-850/80 p-5 shadow-2xl shadow-shade/40 backdrop-blur sm:p-7">
      <div className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full bg-xp-a/20 blur-3xl" />
      <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center md:gap-10">
        <LevelBlock me={me} />
        <StreakBlock streak={me.streak} days={days} today={today} doneToday={doneToday} />
      </div>
    </section>
  );
}

function LevelBlock({ me }: { me: Me }) {
  return (
    <div className="flex items-center gap-5">
      <LevelBadge level={me.level} />
      <div className="min-w-0 flex-1">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mist-500">Level {me.level}</p>
            <p className="whitespace-nowrap font-display text-2xl font-semibold leading-tight sm:text-3xl">
              <AnimatedNumber value={me.xp_into_level} />
              <span className="text-mist-500"> / {me.xp_into_level + me.xp_to_next_level} XP</span>
            </p>
          </div>
          <TotalXp xp={me.xp} />
        </div>
        <XpBar level={me.level} into={me.xp_into_level} toNext={me.xp_to_next_level} />
        <p className="mt-2 text-sm text-mist-400">
          <span className="font-medium text-mist-200 tabular-nums">{me.xp_to_next_level} XP</span> to level {me.level + 1}
        </p>
      </div>
    </div>
  );
}

function LevelBadge({ level }: { level: number }) {
  return (
    <div className="relative shrink-0">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-xp-a to-xp-b opacity-60 blur-lg" />
      <div className="relative grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-xp-a to-xp-b p-[2px] sm:h-24 sm:w-24">
        <div className="grid h-full w-full place-items-center rounded-[14px] bg-ink-900">
          <div className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-mist-400">Lvl</div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={level}
                initial={{ y: 18, opacity: 0, scale: 0.6 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -18, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                className="bg-gradient-to-br from-mist-50 to-mist-200 bg-clip-text font-display text-3xl font-bold leading-none text-transparent sm:text-4xl"
              >
                {level}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Total XP with a floating "+12" / "−12" whenever it changes. */
function TotalXp({ xp }: { xp: number }) {
  const prev = useRef(xp);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [deltas, setDeltas] = useState<{ id: number; value: number }[]>([]);

  // Timers are only cancelled on unmount: cancelling them when xp changes again would leave
  // the previous floater on screen forever.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const delta = xp - prev.current;
    prev.current = xp;
    if (delta === 0) return;
    const id = Date.now() + Math.random();
    setDeltas((d) => [...d, { id, value: delta }]);
    timers.current.push(setTimeout(() => setDeltas((d) => d.filter((x) => x.id !== id)), 1400));
  }, [xp]);

  return (
    <div className="relative">
      <p className="flex items-center gap-1.5 rounded-full bg-fg/[0.06] px-3 py-1 font-display text-sm font-semibold text-mist-200">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mist-500">Total</span>
        <Sparkles className="h-3.5 w-3.5 text-xp-b" aria-hidden />
        <AnimatedNumber value={xp} /> XP
      </p>
      <AnimatePresence>
        {deltas.map((d) => (
          <motion.span
            key={d.id}
            initial={{ opacity: 0, y: 6, scale: 0.8 }}
            animate={{ opacity: 1, y: -22, scale: 1 }}
            exit={{ opacity: 0, y: -38 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className={`pointer-events-none absolute right-0 top-0 font-display text-sm font-bold ${
              d.value > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
            }`}
          >
            {d.value > 0 ? `+${d.value}` : `−${-d.value}`} XP
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

function StreakBlock({
  streak,
  days,
  today,
  doneToday,
}: {
  streak: number;
  days: ReadonlySet<string>;
  today: string;
  doneToday: boolean;
}) {
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const hot = streak > 0;
  const hint = doneToday
    ? `Today's streak bonus claimed: +${dailyBonus(streak)} XP`
    : streak > 0
      ? `Complete a quest today to keep it going (+${dailyBonus(streak + 1)} XP bonus)`
      : "Complete a quest to start a streak (+2 XP bonus)";

  return (
    // Narrow screens: one row (flame + count | week + hint). From md up: a stacked side card.
    <div className="flex items-center gap-4 rounded-2xl border border-fg/[0.06] bg-ink-900/70 p-3.5 md:block md:w-72 md:p-4">
      <div className="flex shrink-0 items-center gap-3">
        <div className={`relative grid h-12 w-12 place-items-center rounded-xl ${hot ? "bg-flame/15" : "bg-fg/5"}`}>
          {hot && <div className="absolute inset-0 rounded-xl bg-flame/25 blur-md" />}
          <Flame
            className={`relative h-7 w-7 ${hot ? "animate-flicker fill-flame/40 text-flame" : "text-mist-500"}`}
            aria-hidden
          />
        </div>
        <div>
          <p className="font-display text-3xl font-bold leading-none">
            <AnimatedNumber value={streak} />
          </p>
          <p className="text-xs font-medium text-mist-400">day streak</p>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-1.5 md:mt-4" aria-label="Last 7 days">
          {week.map((day) => {
            const active = days.has(day);
            const isToday = day === today;
            return (
              <div key={day} className="flex flex-1 flex-col items-center gap-1.5">
                <motion.div
                  initial={false}
                  animate={{ scale: active ? 1 : 0.85 }}
                  className={`h-2.5 w-full rounded-full ${
                    active ? "bg-gradient-to-r from-flame to-amber-300 shadow-[0_0_10px_rgb(255_138_61/0.5)]" : "bg-fg/[0.07]"
                  } ${isToday && !active ? "ring-1 ring-flame/50" : ""}`}
                  title={day}
                />
                <span className={`text-[10px] ${isToday ? "font-semibold text-mist-200" : "text-mist-500"}`}>
                  {new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}
                </span>
              </div>
            );
          })}
        </div>
        <p className={`mt-2 text-xs leading-snug md:mt-3 ${doneToday ? "text-emerald-700 dark:text-emerald-300/90" : "text-mist-400"}`}>{hint}</p>
      </div>
    </div>
  );
}
