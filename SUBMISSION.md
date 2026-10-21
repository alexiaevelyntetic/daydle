# Submission notes

How to install and run everything is in [README.md](README.md). This file covers the rest of what was asked for: evidence, the rules, a summary of the work, the weak spots, the use of AI, and what I noticed outside the task.

## 2. Evidence it works

| Check | How | Result |
| --- | --- | --- |
| Replay of the reference recording, in process | `npm test` (`api/test/replay.test.ts`) | 68/68 lines match status and body |
| Same replay after `POST /test/reset` | same file | 68/68 again (reset really wipes state) |
| Replay against a real running server over HTTP | `npm run replay -- http://localhost:3001` | 68/68 |
| Rules model written before the API | `node analysis/verify_rules.mjs` (no dependencies) | 68/68 |
| Rule unit tests and scenario tests | `api/test/rules.test.ts`, `api/test/api.test.ts` | all pass |
| Daily-challenge extension, plus the reference replay with it enabled | `api/test/daily.test.ts` | all pass |
| Persistence across a restart | test that closes and reopens the SQLite file; also a forced kill (`taskkill /F`) of the real server | data intact |
| The tests catch a wrong rule | changed the bonus cap from 14 to 16 on purpose | replay fails from line 24, as expected |
| `docker compose up --build` | both images built from scratch; API healthy, UI on 3000, UI proxy reaches `http://api:3001` | works |
| Replay against the API **in Docker** | `npm run replay -- http://localhost:3001` | 68/68 |
| Persistence in Docker | `docker compose down`, then `up`: compared `/me`, `/quests` and `/completions` | identical (data lives in the `questlog-data` volume) |

`npm test` runs **46 tests, all passing**. Other recordings can be replayed with `RECORDINGS=a.jsonl npm test`, or against a live server with `npm run replay -- <url> <file>`. IDs are mapped on first sight, and error messages are only checked for presence (they are free text by contract).

The UI was checked by hand in a browser at desktop and phone widths, in both themes. The checks:

- **Complete:** the bar moves instantly.
- **Level-up:** the bar wraps and the overlay shows.
- **Undo across a level boundary:** the bar runs backwards.
- **A failing request** (500 injected in the browser): the bar snaps back and a toast explains why.
- **At rest:** the screen equals `GET /me` exactly.

## 3. Rules found in the recording that the spec does not state

The full list with every supporting line is in [RULES.md](RULES.md). In short:

| # | Rule | Lines |
| --- | --- | --- |
| R1 | A late one-off earns `floor(xp / 2)`, however late | 17 (25 → 12), 25 (10 → 5, two days late) |
| R2 | Completing on the due day is not late; lateness uses the completion's `day` in the user's zone | 15, 57 |
| R3 | `base_xp` is the quest's XP after the late penalty only, without the bonus | 9 |
| R4 | Daily bonus = `min(2 × streak on that day, 14)`, once per active day | 9, 14, 16, 17, 20, 21, 23 (cap: 24, 27, 31); same-day extras: 15, 18, 25, 29, 36, 47, 66 |
| R5 | XP is recomputed from the active completions; undo removes later days' bonuses retroactively | 45–46 (−18, not −14), 38–40 (−10: the day keeps its bonus) |
| R6 | Level *n* needs `100 × n` XP | 1, 17, 31 |
| R7 | Streak = consecutive days ending today, or yesterday if nothing is done yet today; else 0 | 13, 33, 34, 35, 59, 61 |
| R8 | A completion's `day` is fixed at creation, in the zone in effect then | 57, 59–60 |
| R9 | "Today" (dailies, `done`, lateness, streak) uses the **current** zone | 51–52 |
| R10 | Days follow the IANA zone through DST | 62–64 |
| R11 | `done`: one-off = ever completed (not undone); daily = completed today | 12, 41, 53, 68 |
| R12 | A repeat completion returns 200, the existing completion and a fresh `me` | 10, 48 |
| R13 | After an undo the quest can be completed again, with a new id; ids are never reused | 38 → 47 |
| R14 | Undoing twice → 404 | 39 |
| R15 | Undone completions disappear from `GET /completions` | 60 |
| R16 | Formats: UTC `created_at` without milliseconds, `null` for absent fields, lists newest first | 9, 2–5, 12, 37 |
| R17 | Status codes and messages for each error | 6, 7, 8, 11, 39, 50 |
| R18 | Changing the time zone returns `me` and does not change XP | 51, 59 |

## 4. What I did, how I verified it, what I left out

**What I did.** I worked rules-first. Before writing any API code I wrote a small, dependency-free model of the rules (`analysis/verify_rules.mjs`) and iterated until it reproduced all 68 lines. Then I built the Fastify API around the same pure functions.

The API stores quests and completions in SQLite (`node:sqlite`, so nothing native has to compile on a clean machine). It never stores totals: XP, level and streak are derived from the active completions on every request. That makes undo exact, retroactive changes included, and makes restarts trivial. A partial unique index also enforces "one active completion per quest (per day for dailies)" in the database.

The Next.js UI talks to the API through a same-origin proxy. Completing and undoing are optimistic. The client applies the pending operation on top of the last server state using a copy of the rules, then reloads everything after every request, success or failure. Applying operations is idempotent, so out-of-order responses cannot double-count. With nothing pending, the screen shows the server's numbers verbatim, so the UI always ends up truthful.

**How I verified it.** See §2: the replay in process and over HTTP, a deliberate rule break to prove the tests can fail, scenario tests for the cases the recording does not reach, and manual browser checks, including an injected server failure.

**What I deliberately did not do.** No auth, multiple users or deployment (as asked), no pagination, no end-to-end browser test suite, no editing or deleting of quests (not in the contract).

**Choices where neither source was clear:**

- **Validation order:** title → difficulty → due date and daily together → due-date format → recurrence.
- **Titles:**
  - a whitespace-only title is invalid;
  - length is counted in characters (code points);
  - titles are stored as sent.
- **`due_date`:** must be a real calendar day (`2026-02-30` → 400). A past due date is accepted at creation.
- **`recurrence`:** only `"daily"`; `null` or a missing field means one-off.
- **Very late quests:** still earn exactly half (R1 shows the same factor at 1 and 2 days late).
- **`X-Now`:** without an offset it is rejected with 400, because the instant would be ambiguous.
- **Time zones:**
  - stored in canonical spelling (`asia/tokyo` → `Asia/Tokyo`);
  - raw offsets such as `+03:00` are rejected, since they are not IANA zones.
- **Ordering:** lists are sorted by `created_at`, then insertion order on ties.
- **`POST /test/reset`:** also restores `Europe/Bucharest`.
- **Undoing a past daily completion** gives back its XP but does not reopen that past day; only today can be completed.
- **Request bodies:** an empty JSON body is accepted, so `DELETE` works with `Content-Type: application/json`. Malformed JSON → 400 `{error}`. Unknown route → 404 `{error}`.
- **Port:** the API reads `API_PORT`, not `PORT`, so a `PORT` meant for the UI can't move it off 3001 (this happened during development).
- **UI:**
  - creating a quest waits for the server, so validation errors appear inline;
  - the UI re-syncs on tab focus and at the user's midnight;
  - an undo that gets a 404 (already undone elsewhere) counts as success.
- **Extension, beyond the brief: the "Daydle of the day".**
  - One Wordle-style challenge per day, worth 40 XP, counting toward the streak.
  - It lives on its own `/daily` routes and table, so the original endpoints are unchanged.
  - A recording that never calls it gets exactly the original numbers (tested). See the README.

## 5. Where the solution is weakest

- **Docker was tested on one machine only** (Windows 11, Docker Desktop with WSL 2, Linux containers). The build depends on two network downloads: npm packages, and the Fraunces font, which `next/font` fetches from Google Fonts at build time. A build behind a restrictive proxy or offline would fail at that step.
- **The rules exist twice.** `web/lib/rules.ts` copies `api/src/rules.ts` so the UI can predict a pending result. If they drift, the prediction is wrong for a moment and then corrected by the server, but it would still be a visible flicker.
- **Guessed edge cases.** Every "choice" in §4 is a guess the recording cannot confirm. The most likely to differ from the old app: the validation order, ordering when `X-Now` goes backwards in time, and how completions dated after "now" (possible with `X-Now`) affect the streak.
- **Cost of recomputing.** Every request recomputes XP from the full history. That is fine for one user and years of data, but it would not scale to many users without caching.
- **No automated UI tests.** The UI was verified by hand.
- **`node:sqlite`** still prints an experimental warning in Node 22/24 (silenced in the start scripts).

## 6. AI use

I used Claude (Claude Code) for parts of the code, tests, analysis and docs. I checked by hand the rules in RULES.md against the recording lines, the replay results, and the UI behaviour in a browser, including failure and level-up cases.

## 7. Noticed outside the task, not fixed

- **The time-zone rules can be gamed** (they come from the recording, so I kept them):
  - "Today" is evaluated in the current zone (R9). Switching to a zone that is already on the next day lets a daily quest be completed twice within one real day, earning a second bonus day.
  - Switching to a zone that is still on the due day avoids the late penalty.
- **`X-Now` is trusted from any client.** That is fine for testing, but in production anyone could backdate or forward-date completions. In a real deployment it should be accepted only in test mode, like `POST /test/reset`, which is unauthenticated and wipes everything.
- **No pagination:** `GET /quests` and `GET /completions` return everything.
- **Field inconsistency:** quests have no `created_at` in the API even though the lists are ordered by it, so a client cannot reproduce the order on its own.
- **Unbounded `day` values:** with `X-Now` set to a far past date, completions can be created for any day, and the streak logic then treats those days as real history.
