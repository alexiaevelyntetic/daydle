// Replays reference_recording.jsonl (and any extra recordings in $RECORDINGS, separated by the
// platform path delimiter) against the API in process, through Fastify's inject.
import assert from "node:assert/strict";
import { delimiter } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { injector, testApp } from "./helpers.js";
import { formatMismatches, loadRecording, replay } from "./replay-lib.js";

const reference = fileURLToPath(new URL("../../reference_recording.jsonl", import.meta.url));
const recordings = [reference, ...(process.env.RECORDINGS?.split(delimiter).filter(Boolean) ?? [])];

for (const file of recordings) {
  test(`replay matches ${file}`, async () => {
    const app = testApp();
    try {
      const mismatches = await replay(loadRecording(file), injector(app));
      assert.equal(mismatches.length, 0, `\n${formatMismatches(mismatches)}`);
    } finally {
      await app.close();
    }
  });
}

test("replay matches again after POST /test/reset", async () => {
  const app = testApp();
  try {
    const send = injector(app);
    const lines = loadRecording(reference);
    assert.deepEqual(await replay(lines, send), []);
    const reset = await send({ method: "POST", path: "/test/reset", headers: {} });
    assert.equal(reset.status, 204);
    assert.deepEqual(await replay(lines, send), []);
  } finally {
    await app.close();
  }
});
