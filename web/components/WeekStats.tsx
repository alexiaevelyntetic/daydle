"use client";

import { BarChart3, CheckCheck, Flame, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { addDays, dailyBonus, streakEndingOn } from "@/lib/rules";

interface Props {
  /** Every activity: quest completions and daily-challenge completions. */
  completions: readonly { day: string; base_xp: number }[];
  today: string;
}

/**
 * XP earned per day over the last 7 days, using the same rules as the server:
 * the completions' base XP plus that day's streak bonus.
 */
export function WeekStats({ completions, today }: Props) {
  const days = new Set(completions.map((c) => c.day));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((day) => {
    const base = completions.filter((c) => c.day === day).reduce((s, c) => s + c.base_xp, 0);
    const xp = days.has(day) ? base + dailyBonus(streakEndingOn(day, days)) : 0;
    return { day, xp };
  });
  const max = Math.max(1, ...week.map((d) => d.xp));
  const weekXp = week.reduce((s, d) => s + d.xp, 0);
  const bestStreak = Math.max(0, ...[...days].map((d) => streakEndingOn(d, days)));

  return (
    <section className="rounded-3xl border border-fg/[0.07] bg-ink-850/70 p-5 backdrop-blur">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <BarChart3 className="h-4.5 w-4.5 text-mist-400" aria-hidden />
          This week
        </h2>
        <p className="font-display text-sm font-semibold text-xp-b tabular-nums">{weekXp} XP</p>
      </div>

      <div className="flex h-28 items-end gap-2" role="img" aria-label={`XP per day this week: ${week.map((d) => d.xp).join(", ")}`}>
        {week.map(({ day, xp }, i) => {
          const isToday = day === today;
          return (
            <div key={day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className={`text-[10px] tabular-nums transition ${xp ? "text-mist-400" : "text-transparent"} group-hover:text-mist-200`}>
                {xp}
              </span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(xp ? 8 : 4, (xp / max) * 100)}%` }}
                transition={{ type: "spring", stiffness: 220, damping: 26, delay: i * 0.03 }}
                className={`w-full rounded-lg ${
                  xp
                    ? `bg-gradient-to-t from-xp-a to-xp-b ${isToday ? "shadow-[0_0_14px_var(--glow)]" : "opacity-80"}`
                    : "bg-fg/[0.07]"
                }`}
                title={`${day}: ${xp} XP`}
              />
              <span className={`text-[10px] ${isToday ? "font-semibold text-mist-200" : "text-mist-500"}`}>
                {new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}
              </span>
            </div>
          );
        })}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-fg/[0.07] pt-4">
        <Stat icon={<Sparkles className="h-3.5 w-3.5 text-xp-b" aria-hidden />} label="Today" value={`${week[6]?.xp ?? 0} XP`} />
        <Stat icon={<Flame className="h-3.5 w-3.5 text-flame" aria-hidden />} label="Best streak" value={`${bestStreak} d`} />
        <Stat icon={<CheckCheck className="h-3.5 w-3.5 text-mist-400" aria-hidden />} label="Completed" value={String(completions.length)} />
      </dl>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-fg/[0.03] px-3 py-2">
      <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-mist-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
