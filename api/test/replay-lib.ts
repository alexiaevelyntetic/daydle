// Replays a recording (one JSON request per line) and compares every response with the recorded one.
// IDs differ between implementations, so recorded IDs are mapped to ours the first time each appears
// in an `id` / `quest_id` field, and the mapping must stay consistent afterwards.
// Error messages are free text by contract: only their presence is checked.
import { readFileSync } from "node:fs";

export interface RecordedRequest {
  x_now: string;
  method: string;
  path: string;
  body?: unknown;
  status: number;
  response?: unknown;
}

export interface SentRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}

export type Send = (req: SentRequest) => Promise<{ status: number; body: unknown }>;

export interface Mismatch {
  line: number;
  request: string;
  diffs: string[];
}

const ID_FIELDS = new Set(["id", "quest_id"]);

export function loadRecording(path: string): RecordedRequest[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as RecordedRequest);
}

export async function replay(lines: RecordedRequest[], send: Send): Promise<Mismatch[]> {
  const ids = new Map<string, string>(); // recorded id -> our id
  const ours = new Set<string>(); // our ids already claimed by a mapping
  const mismatches: Mismatch[] = [];

  for (const [index, line] of lines.entries()) {
    const path = line.path
      .split("/")
      .map((segment) => ids.get(segment) ?? segment)
      .join("/");
    const headers: Record<string, string> = { "x-now": line.x_now };
    if (line.body !== undefined) headers["content-type"] = "application/json";

    const res = await send({ method: line.method, path, headers, body: line.body });

    const diffs: string[] = [];
    if (res.status !== line.status) diffs.push(`status: expected ${line.status}, got ${res.status}`);
    compare(line.response, res.body, "$", null, diffs, ids, ours);
    if (diffs.length > 0) mismatches.push({ line: index + 1, request: `${line.method} ${line.path}`, diffs });
  }
  return mismatches;
}

function compare(
  expected: unknown,
  actual: unknown,
  at: string,
  key: string | null,
  diffs: string[],
  ids: Map<string, string>,
  ours: Set<string>,
): void {
  if (expected === undefined) {
    if (actual !== undefined) diffs.push(`${at}: expected no body, got ${JSON.stringify(actual)}`);
    return;
  }
  if (key === "error") {
    if (typeof actual !== "string" || actual === "") diffs.push(`${at}: expected an error message`);
    return;
  }
  if (key !== null && ID_FIELDS.has(key) && typeof expected === "string") {
    const mapped = ids.get(expected);
    if (mapped !== undefined) {
      if (actual !== mapped) diffs.push(`${at}: expected id of ${expected} (${mapped}), got ${JSON.stringify(actual)}`);
    } else if (typeof actual === "string" && !ours.has(actual)) {
      ids.set(expected, actual);
      ours.add(actual);
    } else {
      diffs.push(`${at}: ${JSON.stringify(actual)} cannot be a new id for ${expected}`);
    }
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      diffs.push(`${at}: expected array of ${expected.length}, got ${describe(actual)}`);
      return;
    }
    expected.forEach((e, i) => compare(e, actual[i], `${at}[${i}]`, null, diffs, ids, ours));
    return;
  }
  if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null || Array.isArray(actual)) {
      diffs.push(`${at}: expected object, got ${describe(actual)}`);
      return;
    }
    const a = actual as Record<string, unknown>;
    const e = expected as Record<string, unknown>;
    for (const k of Object.keys(e)) {
      if (!(k in a)) diffs.push(`${at}.${k}: missing`);
      else compare(e[k], a[k], `${at}.${k}`, k, diffs, ids, ours);
    }
    for (const k of Object.keys(a)) if (!(k in e)) diffs.push(`${at}.${k}: unexpected field`);
    return;
  }
  if (expected !== actual) diffs.push(`${at}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function describe(value: unknown): string {
  return Array.isArray(value) ? `array of ${value.length}` : JSON.stringify(value);
}

export function formatMismatches(mismatches: Mismatch[]): string {
  return mismatches.map((m) => `line ${m.line} ${m.request}\n  ${m.diffs.join("\n  ")}`).join("\n");
}
