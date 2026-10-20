// The "Daydle of the day" extension: its own routes, 40 XP, counts toward the streak, and it must
// leave the original contract untouched.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { CHALLENGES, challengeFor } from "../src/challenges.js";
import { client, injector, testApp } from "./helpers.js";
import { loadRecording, replay } from "./replay-lib.js";
import { fileURLToPath } from "node:url";

const T = "2026-10-05T09:00:00+03:00";

let app: FastifyInstance;
let api: ReturnType<typeof client>;
beforeEach(() => {
  app = testApp();
  api = client(app);
});
afterEach(() => app.close());

describe("challenge selection", () => {
  test("one challenge per day, numbered from 2026-01-01", () => {
    assert.equal(challengeFor("2026-01-01").number, 1);
    assert.equal(challengeFor("2026-10-21").number, 294);
    assert.equal(challengeFor("2026-10-21").title, challengeFor("2026-10-21").title);
  });

  test("every challenge appears once per cycle and neighbours differ", () => {
    const titles = Array.from({ length: CHALLENGES.length }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      return challengeFor(d).title;
    });
    assert.equal(new Set(titles).size, CHALLENGES.length);
    for (let i = 1; i < titles.length; i++) assert.notEqual(titles[i], titles[i - 1]);
  });
});

describe("/daily", () => {
  test("today's challenge follows the user's time zone", async () => {
    // 2026-10-05 23:30 in Bucharest is still 10-05; in New York it is 10-05 16:30.
    const res = await api.call("GET", "/daily", "2026-10-05T23:30:00+03:00");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ...challengeFor("2026-10-05"), completion: null });
    const next = await api.call("GET", "/daily", "2026-10-06T00:00:00+03:00");
    assert.equal(next.body.day, "2026-10-06");
  });

  test("completing earns 40 XP plus the streak bonus, once per day", async () => {
    const first = await api.call("POST", "/daily/complete", T);
    assert.equal(first.status, 201);
    assert.equal(first.body.completion.base_xp, 40);
    assert.equal(first.body.completion.challenge, challengeFor("2026-10-05").title);
    assert.equal(first.body.me.xp, 42);
    assert.equal(first.body.me.streak, 1);

    const again = await api.call("POST", "/daily/complete", T);
    assert.equal(again.status, 200);
    assert.deepEqual(again.body.completion, first.body.completion);
    assert.equal(again.body.me.xp, 42);

    const daily = await api.call("GET", "/daily", T);
    assert.deepEqual(daily.body.completion, first.body.completion);
  });

  test("a day with only the daily challenge keeps the streak alive", async () => {
    const q = await api.createQuest(T, { title: "water", difficulty: "easy", recurrence: "daily" });
    await api.complete("2026-10-05T09:00:00+03:00", q.body.id);
    await api.call("POST", "/daily/complete", "2026-10-06T09:00:00+03:00");
    const res = await api.complete("2026-10-07T09:00:00+03:00", q.body.id);
    // 10 + 2, then 40 + 4, then 10 + 6
    assert.equal(res.body.me.streak, 3);
    assert.equal(res.body.me.xp, 72);
  });

  test("daily completions stay out of /completions and can be undone", async () => {
    const done = await api.call("POST", "/daily/complete", T);
    assert.deepEqual((await api.completions(T)).body, []);
    assert.equal((await api.call("GET", "/daily/completions", T)).body.length, 1);

    const id = done.body.completion.id;
    assert.equal((await api.call("DELETE", `/daily/completions/${id}`, T)).status, 204);
    assert.equal((await api.call("DELETE", `/daily/completions/${id}`, T)).status, 404);
    assert.equal((await api.me(T)).body.xp, 0);
    assert.equal((await api.call("GET", "/daily", T)).body.completion, null);
    assert.equal((await api.call("POST", "/daily/complete", T)).status, 201);
  });

  test("reset clears daily completions too", async () => {
    await api.call("POST", "/daily/complete", T);
    await api.call("POST", "/test/reset", T);
    assert.deepEqual((await api.call("GET", "/daily/completions", T)).body, []);
    assert.equal((await api.me(T)).body.xp, 0);
  });
});

test("the reference recording still matches with the extension in place", async () => {
  const file = fileURLToPath(new URL("../../reference_recording.jsonl", import.meta.url));
  assert.deepEqual(await replay(loadRecording(file), injector(app)), []);
});
