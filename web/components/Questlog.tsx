"use client";

import { LoaderCircle, RefreshCw, WifiOff } from "lucide-react";
import { MotionConfig } from "motion/react";
import { formatLongDate } from "@/lib/format";
import { useQuestlog } from "@/lib/useQuestlog";
import { Completions } from "./Completions";
import { DailyCard } from "./DailyCard";
import { LevelUp } from "./LevelUp";
import { Logo } from "./Logo";
import { QuestForm } from "./QuestForm";
import { QuestList } from "./QuestList";
import { ThemeToggle } from "./ThemeToggle";
import { TimezonePicker } from "./TimezonePicker";
import { Toasts } from "./Toasts";
import { WeekStats } from "./WeekStats";
import { XpHeader } from "./XpHeader";

export function Questlog() {
  const q = useQuestlog();
  const { view } = q;

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h1 className="m-0">
              <Logo className="h-14 drop-shadow-[0_2px_10px_var(--glow)] sm:h-16" />
            </h1>
            <div className="border-l border-fg/15 pl-4">
              <p className="font-serif text-[10px] font-black uppercase tracking-[0.3em] text-xp-a sm:text-[11px]">
                Live it. Love it. Do it.
              </p>
              {view && <p className="mt-1 text-xs text-mist-400">{formatLongDate(view.today)}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {q.syncing && (
              <span className="flex items-center gap-1.5 text-xs text-mist-400">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving
              </span>
            )}
            {view && <TimezonePicker value={view.me.timezone} onChange={(tz) => void q.setTimezone(tz)} />}
            <ThemeToggle />
          </div>
        </header>

        {!view ? (
          q.loadError ? (
            <ErrorState message={q.loadError} onRetry={() => void q.refresh()} />
          ) : (
            <Skeleton />
          )
        ) : (
          <>
            {q.loadError && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">Lost contact with the server. Showing the last data it sent.</span>
                <button onClick={() => void q.refresh()} className="font-semibold hover:underline">
                  Retry
                </button>
              </div>
            )}

            <XpHeader me={view.me} completions={[...view.completions, ...view.dailyCompletions]} today={view.today} />

            {/*
              Desktop: two columns (the day's flow on the left, tools and progress on the right, sticky).
              Mobile: the column wrappers become `contents`, so every card is its own grid row and the
              `order-*` classes put the form right after the quests.
            */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="contents lg:block lg:min-w-0 lg:space-y-6">
                <div className="order-1 min-w-0">
                  <DailyCard
                    daily={view.daily}
                    timezone={view.me.timezone}
                    pending={view.pendingDaily}
                    onComplete={() => void q.completeDaily()}
                  />
                </div>
                <div className="order-2 min-w-0">
                  <QuestList quests={view.quests} today={view.today} pending={view.pendingQuests} onComplete={(quest) => void q.complete(quest)} />
                </div>
                {/* History sits under the quests it belongs to, so the left column never ends early. */}
                <div className="order-4 min-w-0">
                  <Completions
                    completions={view.completions}
                    dailyCompletions={view.dailyCompletions}
                    onUndoDaily={(c) => void q.undoDaily(c)}
                    quests={view.quests}
                    today={view.today}
                    timezone={view.me.timezone}
                    pending={view.pendingCompletions}
                    onUndo={(c, title) => void q.undo(c, title)}
                  />
                </div>
              </div>
              <aside className="contents lg:sticky lg:top-6 lg:block lg:space-y-6 lg:self-start">
                <div className="order-3 min-w-0">
                  <QuestForm today={view.today} onCreate={q.createQuest} />
                </div>
                {/* Desktop only: on phones the streak card already shows the week. */}
                <div className="order-5 hidden min-w-0 lg:block">
                  <WeekStats completions={[...view.completions, ...view.dailyCompletions]} today={view.today} />
                </div>
              </aside>
            </div>

            <LevelUp level={view.me.level} />
          </>
        )}
      </div>
      <Toasts toasts={q.toasts} onDismiss={q.dismissToast} />
    </MotionConfig>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Loading">
      <div className="h-44 rounded-3xl bg-fg/[0.04]" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[70px] rounded-2xl bg-fg/[0.04]" />
          ))}
        </div>
        <div className="h-80 rounded-3xl bg-fg/[0.04]" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-fg/[0.07] bg-ink-850/70 px-6 py-16 text-center">
      <WifiOff className="mb-3 h-8 w-8 text-mist-500" aria-hidden />
      <p className="font-display text-lg font-semibold">Can&apos;t reach the quest server</p>
      <p className="mt-1 max-w-sm text-sm text-mist-400">{message}. Is the API running on port 3001?</p>
      <button
        onClick={onRetry}
        className="mt-5 flex items-center gap-2 rounded-xl bg-fg/[0.06] px-4 py-2 text-sm font-semibold ring-1 ring-fg/10 hover:bg-fg/10"
      >
        <RefreshCw className="h-4 w-4" aria-hidden /> Try again
      </button>
    </div>
  );
}
