// Scenario tests for behaviour the reference recording does not exercise.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { client, testApp } from "./helpers.js";

const T = "2026-10-05T09:00:00+03:00";

let app: FastifyInstance;
let api: ReturnType<typeof client>;
beforeEach(() => {
  app = testApp();
  api = client(app);
});
afterEach(() => app.close());

describe("validation", () => {
  const invalid: [string, unknown][] = [
    ["missing title", { difficulty: "easy" }],
    ["whitespace title", { title: "   ", difficulty: "easy" }],
    ["101-character title", { title: "x".repeat(101), difficulty: "easy" }],
    ["non-string title", { title: 42, difficulty: "easy" }],
    ["unknown difficulty", { title: "a", difficulty: "extreme" }],
    ["impossible due date", { title: "a", difficulty: "easy", due_date: "2026-02-30" }],
    ["badly formatted due date", { title: "a", difficulty: "easy", due_date: "05/10/2026" }],
    ["weekly recurrence", { title: "a", difficulty: "easy", recurrence: "weekly" }],
    ["both due date and daily", { title: "a", difficulty: "easy", due_date: "2026-10-09", recurrence: "daily" }],
    ["array body", [1, 2]],
  ];
  for (const [name, body] of invalid) {
    test(`rejects ${name}`, async () => {
      const res = await api.createQuest(T, body);
      assert.equal(res.status, 400);
      assert.equal(typeof res.body.error, "string");
    });
  }

  test("accepts a 100-character title and explicit nulls", async () => {
    const res = await api.createQuest(T, { title: "x".repeat(100), difficulty: "hard", due_date: null, recurrence: null });
    assert.equal(res.status, 201);
    assert.deepEqual({ ...res.body, id: "?" }, {
      id: "?", title: "x".repeat(100), difficulty: "hard", due_date: null, recurrence: null, done: false,
    });
  });

  test("malformed JSON is a 400 with an error message", async () => {
    const res = await app.inject({
      method: "POST", url: "/quests", headers: { "content-type": "application/json" }, payload: "{nope",
    });
    assert.equal(res.statusCode, 400);
    assert.equal(typeof res.json().error, "string");
  });

  test("invalid X-Now is rejected", async () => {
    const res = await api.me("2026-10-05 09:00");
    assert.equal(res.status, 400);
  });

  test("unknown routes return the error shape", async () => {
    const res = await api.call("GET", "/nope", T);
    assert.equal(res.status, 404);
    assert.equal(typeof res.body.error, "string");
  });
});

describe("completions", () => {
  test("DELETE with a JSON content type and empty body still works", async () => {
    const q = await api.createQuest(T, { title: "a", difficulty: "easy" });
    const c = await api.complete(T, q.body.id);
    const res = await app.inject({
      method: "DELETE", url: `/completions/${c.body.completion.id}`, headers: { "content-type": "application/json" },
    });
    assert.equal(res.statusCode, 204);
    assert.equal(res.body, "");
  });

  test("a daily quest is not done on the next day, and can be completed again", async () => {
    const q = await api.createQuest(T, { title: "water", difficulty: "easy", recurrence: "daily" });
    await api.complete(T, q.body.id);
    const next = "2026-10-06T00:00:00+03:00";
    assert.equal((await api.quests(next)).body[0].done, false);
    assert.equal((await api.complete(next, q.body.id)).status, 201);
  });

  test("a completion one second before midnight belongs to that day", async () => {
    const q = await api.createQuest(T, { title: "late", difficulty: "easy", due_date: "2026-10-05" });
    const c = await api.complete("2026-10-05T23:59:59+03:00", q.body.id);
    assert.equal(c.body.completion.day, "2026-10-05");
    assert.equal(c.body.completion.base_xp, 10);
  });

  test("lateness is judged in the user's time zone", async () => {
    await api.setTimezone(T, "America/New_York");
    const q = await api.createQuest(T, { title: "x", difficulty: "hard", due_date: "2026-10-05" });
    // 2026-10-06 02:00 in Bucharest is still 10-05 in New York: not late.
    const c = await api.complete("2026-10-06T02:00:00+03:00", q.body.id);
    assert.equal(c.body.completion.day, "2026-10-05");
    assert.equal(c.body.completion.base_xp, 50);
  });

  test("undoing the middle of a streak removes later bonuses too", async () => {
    const q = await api.createQuest(T, { title: "water", difficulty: "easy", recurrence: "daily" });
    const days = ["2026-10-05", "2026-10-06", "2026-10-07"].map((d) => `${d}T09:00:00+03:00`);
    const ids: string[] = [];
    for (const d of days) ids.push((await api.complete(d, q.body.id)).body.completion.id);
    // 3 * 10 + 2 + 4 + 6
    assert.equal((await api.me(days[2]!)).body.xp, 42);
    await api.undo(days[2]!, ids[1]!);
    // 2 * 10 + 2 + 2: day 3 is now a streak of 1
    const me = (await api.me(days[2]!)).body;
    assert.equal(me.xp, 24);
    assert.equal(me.streak, 1);
  });

  test("XP at the level boundary", async () => {
    // hard (50) + bonus 2 = 52, then hard 50 on the same day = 102 → level 2
    const a = await api.createQuest(T, { title: "a", difficulty: "hard" });
    const b = await api.createQuest(T, { title: "b", difficulty: "hard" });
    await api.complete(T, a.body.id);
    const res = await api.complete(T, b.body.id);
    assert.deepEqual(res.body.me, {
      timezone: "Europe/Bucharest", xp: 102, level: 2, xp_into_level: 2, xp_to_next_level: 198, streak: 1,
    });
  });

  test("reset deletes everything and restores the default time zone", async () => {
    await api.setTimezone(T, "Asia/Tokyo");
    await api.createQuest(T, { title: "a", difficulty: "easy" });
    assert.equal((await api.call("POST", "/test/reset", T)).status, 204);
    assert.deepEqual((await api.quests(T)).body, []);
    assert.deepEqual((await api.completions(T)).body, []);
    assert.equal((await api.me(T)).body.timezone, "Europe/Bucharest");
  });

  test("time zone names are stored in canonical spelling", async () => {
    const res = await api.setTimezone(T, "asia/tokyo");
    assert.equal(res.status, 200);
    assert.equal(res.body.timezone, "Asia/Tokyo");
  });
});

describe("persistence", () => {
  test("data survives a restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "questlog-"));
    const dbPath = join(dir, "questlog.db");
    try {
      const first = testApp(dbPath);
      const a = client(first);
      await a.setTimezone(T, "America/New_York");
      const q = await a.createQuest(T, { title: "persist me", difficulty: "medium" });
      await a.complete(T, q.body.id);
      const before = { me: (await a.me(T)).body, quests: (await a.quests(T)).body, completions: (await a.completions(T)).body };
      await first.close();

      const second = testApp(dbPath);
      const b = client(second);
      const after = { me: (await b.me(T)).body, quests: (await b.quests(T)).body, completions: (await b.completions(T)).body };
      assert.deepEqual(after, before);
      // and it still refuses to award the same quest twice
      assert.equal((await b.complete(T, q.body.id)).status, 200);
      await second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
