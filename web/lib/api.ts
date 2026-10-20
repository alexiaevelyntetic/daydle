import type { Completion, DailyChallenge, DailyCompletion, Me, NewQuest, Quest, ServerState } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Can't reach the server");
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  async load(): Promise<ServerState> {
    const [quests, completions, me, daily, dailyCompletions] = await Promise.all([
      request<Quest[]>("GET", "/quests"),
      request<Completion[]>("GET", "/completions"),
      request<Me>("GET", "/me"),
      request<DailyChallenge>("GET", "/daily"),
      request<DailyCompletion[]>("GET", "/daily/completions"),
    ]);
    return { quests, completions, me, daily, dailyCompletions };
  },
  completeDaily: () => request<{ completion: DailyCompletion; me: Me }>("POST", "/daily/complete"),
  undoDaily: (id: string) => request<void>("DELETE", `/daily/completions/${encodeURIComponent(id)}`),
  createQuest: (quest: NewQuest) => request<Quest>("POST", "/quests", quest),
  complete: (questId: string) =>
    request<{ completion: Completion; me: Me }>("POST", `/quests/${encodeURIComponent(questId)}/complete`),
  undo: (completionId: string) => request<void>("DELETE", `/completions/${encodeURIComponent(completionId)}`),
  setTimezone: (timezone: string) => request<Me>("PUT", "/me", { timezone }),
};
