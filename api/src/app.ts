import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { HttpError } from "./errors.js";
import { baseXp, computeMe } from "./rules.js";
import { challengeFor } from "./challenges.js";
import { slotFor, slotKey, Store, type Completion, type DailyCompletion, type Quest } from "./store.js";
import { dayIn, normalizeTimeZone, parseNow, toTimestamp } from "./time.js";
import { parseQuestInput } from "./validation.js";

declare module "fastify" {
  interface FastifyRequest {
    /** The request's notion of "now": the X-Now header if present, else the real clock. */
    now: Date;
  }
}

export interface AppOptions {
  /** SQLite file path, or ":memory:" for tests. */
  dbPath: string;
  logger?: boolean;
}

export function buildApp({ dbPath, logger = false }: AppOptions): FastifyInstance {
  const store = new Store(dbPath);
  const app = Fastify({ logger });

  app.addHook("onClose", async () => store.close());
  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Now"],
  });

  // Accept an empty JSON body (e.g. a DELETE sent with Content-Type: application/json).
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (body === "") return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(new HttpError(400, "invalid JSON body"), undefined);
    }
  });

  app.decorateRequest("now", null as unknown as Date);
  app.addHook("onRequest", async (req) => {
    const header = req.headers["x-now"];
    if (header === undefined) {
      req.now = new Date();
      return;
    }
    const parsed = typeof header === "string" ? parseNow(header) : null;
    if (!parsed) throw new HttpError(400, "invalid X-Now header: expected ISO 8601 with an offset");
    req.now = parsed;
  });

  app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) req.log.error(err);
    reply.status(status).send({ error: status === 500 ? "internal server error" : err.message });
  });
  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: "not found" });
  });

  // Daily-challenge completions earn XP and count as activity for the streak, exactly like quest
  // completions. With none of them (as in the reference recording) this is the original rule.
  const me = (now: Date) =>
    computeMe([...store.activeCompletions(), ...store.activeDailyCompletions()], store.getTimezone(), now);

  const questView = (q: Quest, done: boolean) => ({
    id: q.id,
    title: q.title,
    difficulty: q.difficulty,
    due_date: q.due_date,
    recurrence: q.recurrence,
    done,
  });

  const completionView = (c: Completion) => ({
    id: c.id,
    quest_id: c.quest_id,
    day: c.day,
    base_xp: c.base_xp,
    created_at: c.created_at,
  });

  const dailyView = (c: DailyCompletion) => ({
    id: c.id,
    day: c.day,
    challenge: c.challenge,
    base_xp: c.base_xp,
    created_at: c.created_at,
  });

  app.post("/quests", async (req, reply) => {
    const input = parseQuestInput(req.body);
    const quest: Quest = { id: randomUUID(), ...input, created_at: toTimestamp(req.now) };
    store.insertQuest(quest);
    return reply.code(201).send(questView(quest, false));
  });

  app.get("/quests", async (req) => {
    const today = dayIn(req.now, store.getTimezone());
    const active = store.activeSlots();
    return store.listQuests().map((q) => questView(q, active.has(slotKey(q.id, slotFor(q, today)))));
  });

  // Everything between the lookup and the insert is synchronous, so two concurrent
  // requests cannot both create a completion; the unique index backs this up.
  app.post<{ Params: { id: string } }>("/quests/:id/complete", async (req, reply) => {
    const quest = store.getQuest(req.params.id);
    if (!quest) throw new HttpError(404, "quest not found");

    const today = dayIn(req.now, store.getTimezone());
    const slot = slotFor(quest, today);
    const existing = store.findActiveCompletion(quest.id, slot);
    if (existing) {
      return reply.code(200).send({ completion: completionView(existing), me: me(req.now) });
    }

    const completion: Completion = {
      id: randomUUID(),
      quest_id: quest.id,
      day: today,
      base_xp: baseXp(quest.difficulty, quest.due_date, today),
      created_at: toTimestamp(req.now),
    };
    store.insertCompletion(completion, slot);
    return reply.code(201).send({ completion: completionView(completion), me: me(req.now) });
  });

  app.get("/completions", async () => store.activeCompletions().map(completionView));

  app.delete<{ Params: { id: string } }>("/completions/:id", async (req, reply) => {
    if (!store.undoCompletion(req.params.id, toTimestamp(req.now))) {
      throw new HttpError(404, "completion not found");
    }
    return reply.code(204).send();
  });

  app.get("/me", async (req) => me(req.now));

  app.put("/me", async (req) => {
    const body = req.body as { timezone?: unknown } | undefined;
    const timezone = normalizeTimeZone(body?.timezone);
    if (!timezone) throw new HttpError(400, "invalid timezone");
    store.setTimezone(timezone);
    return me(req.now);
  });

  // --- Extension: "Daydle of the day" (not part of the old app's contract) ---

  app.get("/daily", async (req) => {
    const today = dayIn(req.now, store.getTimezone());
    const completion = store.findActiveDailyCompletion(today);
    return { ...challengeFor(today), completion: completion ? dailyView(completion) : null };
  });

  app.post("/daily/complete", async (req, reply) => {
    const today = dayIn(req.now, store.getTimezone());
    const existing = store.findActiveDailyCompletion(today);
    if (existing) return reply.code(200).send({ completion: dailyView(existing), me: me(req.now) });

    const challenge = challengeFor(today);
    const completion: DailyCompletion = {
      id: randomUUID(),
      day: today,
      challenge: challenge.title,
      base_xp: challenge.xp,
      created_at: toTimestamp(req.now),
    };
    store.insertDailyCompletion(completion);
    return reply.code(201).send({ completion: dailyView(completion), me: me(req.now) });
  });

  app.get("/daily/completions", async () => store.activeDailyCompletions().map(dailyView));

  app.delete<{ Params: { id: string } }>("/daily/completions/:id", async (req, reply) => {
    if (!store.undoDailyCompletion(req.params.id, toTimestamp(req.now))) {
      throw new HttpError(404, "daily completion not found");
    }
    return reply.code(204).send();
  });

  app.post("/test/reset", async (_req, reply) => {
    store.reset();
    return reply.code(204).send();
  });

  return app;
}
