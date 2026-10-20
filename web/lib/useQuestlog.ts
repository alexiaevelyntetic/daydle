"use client";

// State model: what the server last told us, plus a list of operations (complete / undo) that
// are in flight or have succeeded but are not yet reflected in a fresh load.
//
// - The view applies those operations on top of the server state. Applying them is idempotent
//   (a completion whose slot is already taken is not added twice, a missing one is not removed
//   twice), so an out-of-order load can never double-count or resurrect anything.
// - With no operation pending, the view IS the server state: every number on screen is the
//   server's, not a client-side computation.
// - Every request, success or failure, is followed by a full reload. A failed operation is
//   dropped immediately, so the XP bar snaps back and a toast says why.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { baseXp, computeMe, dayIn, isDone } from "./rules";
import type { Completion, DailyChallenge, DailyCompletion, Me, NewQuest, Quest, ServerState } from "./types";

interface CompleteOp {
  id: string;
  kind: "complete";
  questId: string;
  at: number;
  settled: boolean;
  completion?: Completion;
}
interface UndoOp {
  id: string;
  kind: "undo";
  completionId: string;
  settled: boolean;
}
interface CompleteDailyOp {
  id: string;
  kind: "completeDaily";
  at: number;
  settled: boolean;
  completion?: DailyCompletion;
}
interface UndoDailyOp {
  id: string;
  kind: "undoDaily";
  completionId: string;
  settled: boolean;
}
type Op = CompleteOp | UndoOp | CompleteDailyOp | UndoDailyOp;

interface State {
  server: ServerState | null;
  ops: Op[];
  loadError: string | null;
  lastLoad: number;
}

type Action =
  | { type: "loaded"; server: ServerState; seq: number; settled: readonly string[] }
  | { type: "loadFailed"; message: string }
  | { type: "started"; op: Op }
  | { type: "settled"; id: string; completion?: Completion | DailyCompletion }
  | { type: "failed"; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loaded":
      // A load that started earlier than the one already applied carries older data.
      if (action.seq < state.lastLoad) return state;
      return {
        server: action.server,
        loadError: null,
        lastLoad: action.seq,
        ops: state.ops.filter((op) => !action.settled.includes(op.id)),
      };
    case "loadFailed":
      return { ...state, loadError: action.message };
    case "started":
      return { ...state, ops: [...state.ops, action.op] };
    case "settled":
      return {
        ...state,
        ops: state.ops.map((op): Op => {
          if (op.id !== action.id) return op;
          if (op.kind === "complete") return { ...op, settled: true, completion: action.completion as Completion | undefined };
          if (op.kind === "completeDaily") return { ...op, settled: true, completion: action.completion as DailyCompletion | undefined };
          return { ...op, settled: true };
        }),
      };
    case "failed":
      return { ...state, ops: state.ops.filter((op) => op.id !== action.id) };
  }
}

export interface View {
  quests: Quest[];
  completions: Completion[];
  me: Me;
  today: string;
  /** Quests with a completion request in flight. */
  pendingQuests: ReadonlySet<string>;
  /** Completions that are optimistic (not yet confirmed) and cannot be undone yet. */
  pendingCompletions: ReadonlySet<string>;
  /** Extension: today's challenge, with today's completion if any. */
  daily: DailyChallenge;
  dailyCompletions: DailyCompletion[];
  pendingDaily: boolean;
}

function deriveView(server: ServerState, ops: readonly Op[], now: number): View {
  const timezone = server.me.timezone;
  const today = dayIn(now, timezone);
  if (ops.length === 0) {
    return { ...server, today, pendingQuests: new Set(), pendingCompletions: new Set(), pendingDaily: false };
  }

  let completions = [...server.completions];
  let dailyCompletions = [...server.dailyCompletions];
  const pendingQuests = new Set<string>();
  const pendingCompletions = new Set<string>();
  let pendingDaily = false;

  for (const op of ops) {
    if (op.kind === "undo") {
      completions = completions.filter((c) => c.id !== op.completionId);
      continue;
    }
    if (op.kind === "undoDaily") {
      dailyCompletions = dailyCompletions.filter((c) => c.id !== op.completionId);
      continue;
    }
    if (op.kind === "completeDaily") {
      const day = op.completion?.day ?? dayIn(op.at, timezone);
      const completion: DailyCompletion = op.completion ?? {
        id: op.id,
        day,
        challenge: server.daily.day === day ? server.daily.title : "Daily challenge",
        base_xp: server.daily.xp,
        created_at: new Date(op.at).toISOString(),
      };
      if (!dailyCompletions.some((c) => c.day === day)) dailyCompletions.unshift(completion);
      if (!op.settled) {
        pendingDaily = true;
        pendingCompletions.add(completion.id);
      }
      continue;
    }
    const quest = server.quests.find((q) => q.id === op.questId);
    if (!quest) continue;
    const day = op.completion?.day ?? dayIn(op.at, timezone);
    const completion: Completion = op.completion ?? {
      id: op.id,
      quest_id: quest.id,
      day,
      base_xp: baseXp(quest.difficulty, quest.due_date, day),
      created_at: new Date(op.at).toISOString(),
    };
    const slotTaken = completions.some((c) => c.quest_id === quest.id && (quest.recurrence !== "daily" || c.day === day));
    if (!slotTaken) completions.unshift(completion);
    if (!op.settled) {
      pendingQuests.add(quest.id);
      pendingCompletions.add(completion.id);
    }
  }

  completions.sort((a, b) => b.created_at.localeCompare(a.created_at));
  dailyCompletions.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    quests: server.quests.map((q) => ({ ...q, done: isDone(q, completions, today) })),
    completions,
    me: computeMe([...completions, ...dailyCompletions], timezone, now),
    today,
    pendingQuests,
    pendingCompletions,
    daily: { ...server.daily, completion: dailyCompletions.find((c) => c.day === server.daily.day) ?? null },
    dailyCompletions,
    pendingDaily,
  };
}

export interface Toast {
  id: number;
  tone: "error" | "info";
  text: string;
}

let opCounter = 0;
let toastCounter = 0;

export function useQuestlog() {
  const [state, dispatch] = useReducer(reducer, { server: null, ops: [], loadError: null, lastLoad: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const loadSeq = useRef(0);
  // Ids of operations whose request has succeeded; read synchronously when a load starts.
  const settledIds = useRef(new Set<string>());

  const notify = useCallback((text: string, tone: Toast["tone"] = "error") => {
    const id = ++toastCounter;
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const refresh = useCallback(async () => {
    const seq = ++loadSeq.current;
    const settled = [...settledIds.current];
    try {
      const server = await api.load();
      dispatch({ type: "loaded", server, seq, settled });
      for (const id of settled) settledIds.current.delete(id);
    } catch (e) {
      dispatch({ type: "loadFailed", message: e instanceof Error ? e.message : "Failed to load" });
    }
  }, []);

  const settle = useCallback((id: string, completion?: Completion | DailyCompletion) => {
    settledIds.current.add(id);
    dispatch({ type: "settled", id, completion });
  }, []);

  const complete = useCallback(
    async (quest: Quest) => {
      const id = `pending-${++opCounter}`;
      dispatch({ type: "started", op: { id, kind: "complete", questId: quest.id, at: Date.now(), settled: false } });
      try {
        const res = await api.complete(quest.id);
        settle(id, res.completion);
      } catch (e) {
        dispatch({ type: "failed", id });
        notify(`Couldn't complete “${quest.title}”: ${message(e)}. Your XP is back to what the server says.`);
      } finally {
        void refresh();
      }
    },
    [notify, refresh, settle],
  );

  const undo = useCallback(
    async (completion: Completion, title: string) => {
      const id = `pending-${++opCounter}`;
      dispatch({ type: "started", op: { id, kind: "undo", completionId: completion.id, settled: false } });
      try {
        await api.undo(completion.id);
        settle(id);
      } catch (e) {
        // 404: already undone elsewhere. The end state is the one we wanted.
        if (e instanceof ApiError && e.status === 404) settle(id);
        else {
          dispatch({ type: "failed", id });
          notify(`Couldn't undo “${title}”: ${message(e)}.`);
        }
      } finally {
        void refresh();
      }
    },
    [notify, refresh, settle],
  );

  const completeDaily = useCallback(async () => {
    const id = `pending-${++opCounter}`;
    dispatch({ type: "started", op: { id, kind: "completeDaily", at: Date.now(), settled: false } });
    try {
      const res = await api.completeDaily();
      settle(id, res.completion);
    } catch (e) {
      dispatch({ type: "failed", id });
      notify(`Couldn't complete today's Daydle: ${message(e)}. Your XP is back to what the server says.`);
    } finally {
      void refresh();
    }
  }, [notify, refresh, settle]);

  const undoDaily = useCallback(
    async (completion: DailyCompletion) => {
      const id = `pending-${++opCounter}`;
      dispatch({ type: "started", op: { id, kind: "undoDaily", completionId: completion.id, settled: false } });
      try {
        await api.undoDaily(completion.id);
        settle(id);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) settle(id);
        else {
          dispatch({ type: "failed", id });
          notify(`Couldn't undo the Daydle: ${message(e)}.`);
        }
      } finally {
        void refresh();
      }
    },
    [notify, refresh, settle],
  );

  const createQuest = useCallback(
    async (quest: NewQuest) => {
      try {
        await api.createQuest(quest);
      } finally {
        void refresh();
      }
    },
    [refresh],
  );

  const setTimezone = useCallback(
    async (timezone: string) => {
      try {
        await api.setTimezone(timezone);
      } catch (e) {
        notify(`Couldn't change the time zone: ${message(e)}.`);
      } finally {
        void refresh();
      }
    },
    [notify, refresh],
  );

  // Initial load, plus re-sync whenever the tab comes back into view.
  useEffect(() => {
    void refresh();
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  // Tick so "today", overdue flags and the streak roll over at midnight; reload when the day changes.
  const timezone = state.server?.me.timezone;
  useEffect(() => {
    if (!timezone) return;
    let lastDay = dayIn(Date.now(), timezone);
    const timer = setInterval(() => {
      const next = Date.now();
      setNow(next);
      const day = dayIn(next, timezone);
      if (day !== lastDay) void refresh();
      lastDay = day;
    }, 30_000);
    return () => clearInterval(timer);
  }, [timezone, refresh]);

  const view = useMemo(() => (state.server ? deriveView(state.server, state.ops, now) : null), [state.server, state.ops, now]);

  return {
    view,
    loadError: state.loadError,
    syncing: state.ops.length > 0,
    toasts,
    dismissToast,
    refresh,
    complete,
    undo,
    completeDaily,
    undoDaily,
    createQuest,
    setTimezone,
  };
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "unknown error";
}
