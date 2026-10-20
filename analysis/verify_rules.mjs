// Independent model of the rules in RULES.md, replayed against reference_recording.jsonl.
// Usage: node analysis/verify_rules.mjs [path/to/recording.jsonl]
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const file = process.argv[2] ?? new URL("../reference_recording.jsonl", import.meta.url);
const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

const XP = { easy: 10, medium: 25, hard: 50 };
const BONUS_CAP = 14;

let quests = [];
let completions = [];
let tz = "Europe/Bucharest";
let qSeq = 0;
let cSeq = 0;

const dayIn = (date, zone) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const isValidTz = (zone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

const active = () => completions.filter((c) => !c.undone);

// Streak ending on `day`: number of consecutive days with a completion, ending on that day.
const streakEndingOn = (day, days) => {
  let n = 0;
  while (days.has(addDays(day, -n))) n++;
  return n;
};

function me(now) {
  const list = active();
  const days = new Set(list.map((c) => c.day));
  let xp = list.reduce((s, c) => s + c.base_xp, 0);
  for (const d of days) xp += Math.min(2 * streakEndingOn(d, days), BONUS_CAP);

  let level = 1;
  let into = xp;
  while (into >= 100 * level) {
    into -= 100 * level;
    level++;
  }

  const today = dayIn(now, tz);
  const streak = days.has(today)
    ? streakEndingOn(today, days)
    : streakEndingOn(addDays(today, -1), days);

  return { timezone: tz, xp, level, xp_into_level: into, xp_to_next_level: 100 * level - into, streak };
}

const questView = (q, now) => {
  const today = dayIn(now, tz);
  const done = active().some((c) => c.quest_id === q.id && (q.recurrence !== "daily" || c.day === today));
  return { id: q.id, title: q.title, difficulty: q.difficulty, due_date: q.due_date, recurrence: q.recurrence, done };
};
const completionView = ({ id, quest_id, day, base_xp, created_at }) => ({ id, quest_id, day, base_xp, created_at });

function handle({ method, path, body }, now) {
  if (method === "GET" && path === "/me") return [200, me(now)];
  if (method === "PUT" && path === "/me") {
    if (typeof body?.timezone !== "string" || !isValidTz(body.timezone)) return [400, { error: "invalid timezone" }];
    tz = body.timezone;
    return [200, me(now)];
  }
  if (method === "POST" && path === "/quests") {
    const { title, difficulty, due_date, recurrence } = body ?? {};
    if (typeof title !== "string" || title.trim().length < 1 || title.length > 100) return [400, { error: "invalid title" }];
    if (!(difficulty in XP)) return [400, { error: "invalid difficulty" }];
    if (due_date != null && recurrence != null) return [400, { error: "a quest cannot have both due_date and recurrence" }];
    if (due_date != null && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) return [400, { error: "invalid due_date" }];
    if (recurrence != null && recurrence !== "daily") return [400, { error: "invalid recurrence" }];
    const q = { id: `q${++qSeq}`, title, difficulty, due_date: due_date ?? null, recurrence: recurrence ?? null };
    quests.push(q);
    return [201, questView(q, now)];
  }
  if (method === "GET" && path === "/quests") return [200, [...quests].reverse().map((q) => questView(q, now))];
  let m = path.match(/^\/quests\/([^/]+)\/complete$/);
  if (method === "POST" && m) {
    const q = quests.find((x) => x.id === m[1]);
    if (!q) return [404, { error: "quest not found" }];
    const today = dayIn(now, tz);
    const existing = active().find((c) => c.quest_id === q.id && (q.recurrence !== "daily" || c.day === today));
    if (existing) return [200, { completion: completionView(existing), me: me(now) }];
    let base = XP[q.difficulty];
    if (q.due_date && today > q.due_date) base = Math.floor(base / 2);
    const c = {
      id: `c${++cSeq}`,
      quest_id: q.id,
      day: today,
      base_xp: base,
      created_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
      undone: false,
    };
    completions.push(c);
    return [201, { completion: completionView(c), me: me(now) }];
  }
  if (method === "GET" && path === "/completions") return [200, active().reverse().map(completionView)];
  m = path.match(/^\/completions\/([^/]+)$/);
  if (method === "DELETE" && m) {
    const c = active().find((x) => x.id === m[1]);
    if (!c) return [404, { error: "completion not found" }];
    c.undone = true;
    return [204, undefined];
  }
  if (method === "POST" && path === "/test/reset") {
    quests = []; completions = []; tz = "Europe/Bucharest"; qSeq = 0; cSeq = 0;
    return [204, undefined];
  }
  return [404, { error: "not found" }];
}

let failures = 0;
lines.forEach((req, i) => {
  const [status, response] = handle(req, new Date(req.x_now));
  if (status !== req.status || !isDeepStrictEqual(response, req.response)) {
    failures++;
    console.log(`line ${i + 1}: ${req.method} ${req.path}`);
    console.log(`  expected ${req.status} ${JSON.stringify(req.response)}`);
    console.log(`  got      ${status} ${JSON.stringify(response)}`);
  }
});
console.log(`${lines.length - failures}/${lines.length} lines match`);
process.exit(failures ? 1 : 0);
