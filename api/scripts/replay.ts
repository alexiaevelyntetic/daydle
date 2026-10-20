// Replays a recording against a running API.
// Usage: npm run replay -- [base-url] [recording.jsonl]
// Defaults: http://localhost:3001 and ../reference_recording.jsonl. Resets all data first.
import { fileURLToPath } from "node:url";
import { formatMismatches, loadRecording, replay } from "../test/replay-lib.js";

const baseUrl = (process.argv[2] ?? "http://localhost:3001").replace(/\/$/, "");
const file = process.argv[3] ?? fileURLToPath(new URL("../../reference_recording.jsonl", import.meta.url));

const reset = await fetch(`${baseUrl}/test/reset`, { method: "POST" });
if (reset.status !== 204) {
  console.error(`POST /test/reset returned ${reset.status}`);
  process.exit(1);
}

const lines = loadRecording(file);
const mismatches = await replay(lines, async ({ method, path, headers, body }) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text === "" ? undefined : JSON.parse(text) };
});

if (mismatches.length > 0) console.log(formatMismatches(mismatches));
console.log(`${lines.length - mismatches.length}/${lines.length} lines match (${file})`);
process.exit(mismatches.length > 0 ? 1 : 0);
