# Daydle

Daydle (*Live it. Love it. Do it.*) is a habit tracker that turns everyday tasks into quests: finish a quest to earn XP, fill levels, and keep a daily streak.

- `api/`: Fastify + TypeScript API on port **3001**, storing data in SQLite.
- `web/`: Next.js UI on port **3000**. It talks to the API through its own `/api/*` proxy.
- [RULES.md](RULES.md): every rule recovered from `reference_recording.jsonl`, with line numbers.
- [SUBMISSION.md](SUBMISSION.md): evidence, decisions, weak spots, AI use and other notes.

## Run with Docker (recommended)

Requires Docker with Compose v2 (Docker Desktop on Windows/macOS).

```bash
docker compose up --build
```

- UI: http://localhost:3000
- API: http://localhost:3001

The first build takes a few minutes. Data lives in the `questlog-data` volume, so it survives `docker compose down` / `up`. `docker compose down -v` wipes it.

## Run without Docker

Requires **Node.js 22.13 or newer** (`node --version`). SQLite is built into Node (`node:sqlite`), so nothing native has to compile. From the repo root:

```bash
npm start
```

This installs dependencies, builds both apps and starts them (API on 3001, UI on 3000). Stop with Ctrl+C. Data is stored in `api/data/questlog.db`.

For development with hot reload, run `npm install` once, then:

```bash
npm run dev
```

## Tests

```bash
npm test
```

This runs the API test suite (Node's built-in test runner):

- **Replay of the reference recording**: every one of the 68 requests is sent with its `X-Now` and the status and body are compared with the recording. Recorded IDs (`q1`, `c1`) are mapped to ours on first sight and must stay consistent. Error messages are only checked for presence, because they are free text by contract.
- Rule unit tests: levels, late penalty, streak bonus and cap, streak, DST and time zones.
- Scenario tests the recording does not cover: validation, retroactive undo, midnight, lateness in the user's time zone, reset, and persistence across a restart.

To replay another recording in the test suite, list extra files in `RECORDINGS`, separated by `;` on Windows and `:` elsewhere:

```bash
RECORDINGS=path/to/other.jsonl npm test
```

To replay a recording against a **running** server (for example the Docker one), use the command below. It calls `POST /test/reset` first, so it wipes the data:

```bash
npm run replay -- http://localhost:3001 reference_recording.jsonl
```

`analysis/verify_rules.mjs` is a separate, dependency-free model of the rules that also reproduces the recording (`node analysis/verify_rules.mjs`). It was written first, to pin the rules down before building the API.

## Extension: the Daydle of the day

On top of the old app's contract there is one daily challenge, Wordle-style. Everyone gets the same challenge on a given calendar day, in their own time zone. It is numbered from `2026-01-01` (Daydle #1) and picked from a fixed list of 60 in `api/src/challenges.ts`.

| Method and path | Success | Errors |
| --- | --- | --- |
| `GET /daily` | 200 + `{ day, number, title, xp, completion }`, where `completion` is `null` until done today | — |
| `POST /daily/complete` | 201 + `{ completion, me }` for a new completion; 200 + the existing one | — |
| `GET /daily/completions` | 200 + daily completions not undone, newest first | — |
| `DELETE /daily/completions/:id` | 204 | 404 unknown or already undone |

A daily completion is `{ id, day, challenge, base_xp, created_at }` and is worth **40 XP**. It counts as activity for the streak: a day with only the daily challenge keeps the streak alive and earns the day's streak bonus once, like any quest completion.

**Why it cannot break the original contract:**

- It only uses its own routes and its own table. The original routes never return daily completions, so `GET /completions` is unchanged.
- The one shared effect is that daily completions are counted in `me` (XP and streak), and only once the user completes a challenge. A recording that never calls `/daily`, like the reference one, gets exactly the original numbers.
- `api/test/daily.test.ts` covers the extension and replays the reference recording with the extension in place.

## Configuration

| Variable | Default | Used by |
| --- | --- | --- |
| `API_PORT` | `3001` | API (deliberately not `PORT`, so a `PORT` meant for the UI can't move it) |
| `HOST` | `0.0.0.0` | API |
| `DB_PATH` | `data/questlog.db` (relative to `api/`) | API |
| `API_URL` | `http://localhost:3001` | UI proxy, read at request time |
