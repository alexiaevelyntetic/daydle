import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { baseXp, currentStreak, dailyBonus, levelProgress, totalXp } from "../src/rules.js";
import { addDays, dayIn, isValidDay, normalizeTimeZone, parseNow } from "../src/time.js";

describe("levels", () => {
  test("level n needs 100 * n XP", () => {
    assert.deepEqual(levelProgress(0), { level: 1, xp_into_level: 0, xp_to_next_level: 100 });
    assert.deepEqual(levelProgress(99), { level: 1, xp_into_level: 99, xp_to_next_level: 1 });
    assert.deepEqual(levelProgress(100), { level: 2, xp_into_level: 0, xp_to_next_level: 200 });
    assert.deepEqual(levelProgress(299), { level: 2, xp_into_level: 199, xp_to_next_level: 1 });
    assert.deepEqual(levelProgress(300), { level: 3, xp_into_level: 0, xp_to_next_level: 300 });
    assert.deepEqual(levelProgress(600), { level: 4, xp_into_level: 0, xp_to_next_level: 400 });
  });
});

describe("XP", () => {
  test("late one-offs earn half, rounded down, however late", () => {
    assert.equal(baseXp("medium", "2026-10-07", "2026-10-07"), 25);
    assert.equal(baseXp("medium", "2026-10-07", "2026-10-08"), 12);
    assert.equal(baseXp("easy", "2026-10-10", "2026-10-12"), 5);
    assert.equal(baseXp("hard", "2026-10-01", "2027-01-01"), 25);
    assert.equal(baseXp("hard", null, "2027-01-01"), 50);
  });

  test("daily bonus is 2 per streak day, capped at 14", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 30].map(dailyBonus), [2, 4, 6, 8, 10, 12, 14, 14, 14]);
  });

  test("bonus counts once per day and depends on the streak ending that day", () => {
    const c = (day: string, base_xp = 10) => ({ day, base_xp });
    assert.equal(totalXp([c("2026-10-05"), c("2026-10-05", 50)]), 62);
    // 10-05 (streak 1: +2), 10-06 (streak 2: +4)
    assert.equal(totalXp([c("2026-10-05"), c("2026-10-06")]), 26);
    // a gap resets the streak: 10-05 (+2), 10-07 (+2)
    assert.equal(totalXp([c("2026-10-05"), c("2026-10-07")]), 24);
  });
});

describe("streak", () => {
  const days = new Set(["2026-10-12", "2026-10-13", "2026-10-14"]);
  test("ends today when today has a completion", () => assert.equal(currentStreak(days, "2026-10-14"), 3));
  test("still alive the day after, before anything is done", () => assert.equal(currentStreak(days, "2026-10-15"), 3));
  test("broken after a full missed day", () => assert.equal(currentStreak(days, "2026-10-16"), 0));
  test("empty", () => assert.equal(currentStreak(new Set(), "2026-10-16"), 0));
});

describe("time", () => {
  test("day follows the zone, including the DST change", () => {
    assert.equal(dayIn(new Date("2026-10-05T20:59:59Z"), "Europe/Bucharest"), "2026-10-05");
    assert.equal(dayIn(new Date("2026-10-05T21:00:00Z"), "Europe/Bucharest"), "2026-10-06");
    // After the 2026-10-25 switch Bucharest is UTC+2, so midnight is 22:00Z.
    assert.equal(dayIn(new Date("2026-10-25T21:59:59Z"), "Europe/Bucharest"), "2026-10-25");
    assert.equal(dayIn(new Date("2026-10-25T22:00:00Z"), "Europe/Bucharest"), "2026-10-26");
    assert.equal(dayIn(new Date("2026-10-22T02:30:00Z"), "America/New_York"), "2026-10-21");
  });

  test("addDays crosses months and years", () => {
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2027-01-01", -1), "2026-12-31");
  });

  test("calendar validation", () => {
    assert.equal(isValidDay("2026-02-28"), true);
    assert.equal(isValidDay("2026-02-30"), false);
    assert.equal(isValidDay("2026-2-3"), false);
    assert.equal(isValidDay(20261005), false);
  });

  test("time zone validation", () => {
    assert.equal(normalizeTimeZone("America/New_York"), "America/New_York");
    assert.equal(normalizeTimeZone("europe/bucharest"), "Europe/Bucharest");
    assert.equal(normalizeTimeZone("UTC"), "UTC");
    assert.equal(normalizeTimeZone("Mars/Olympus_Mons"), null);
    assert.equal(normalizeTimeZone("+03:00"), null);
    assert.equal(normalizeTimeZone(""), null);
    assert.equal(normalizeTimeZone(3), null);
  });

  test("X-Now requires an offset", () => {
    assert.equal(parseNow("2026-10-05T09:15:00+03:00")?.toISOString(), "2026-10-05T06:15:00.000Z");
    assert.equal(parseNow("2026-10-05T06:15:00Z")?.toISOString(), "2026-10-05T06:15:00.000Z");
    assert.equal(parseNow("2026-10-05T09:15:00"), null);
    assert.equal(parseNow("yesterday"), null);
  });
});
