# Rules recovered from the recording

Line numbers refer to `reference_recording.jsonl` (1-based). Every rule below is checked by
`analysis/verify_rules.mjs`, an independent model that replays all 68 lines: **68/68 match**.

```
node analysis/verify_rules.mjs
```

## XP

### R1. Late completion earns half the base XP, rounded down, regardless of how late
`base_xp = floor(XP[difficulty] / 2)` when the completion day is after `due_date`.

- L17: medium (25), due 10-07, completed 10-08 (1 day late) → `base_xp: 12` (12.5 rounded down).
- L25: easy (10), due 10-10, completed 10-12 (2 days late) → `base_xp: 5`. A per-day decay would give less; it is a flat half.

### R2. Completing on the due date is not late
- L15: hard, due 10-06, completed 10-06 at 23:40 → `base_xp: 50`.
- L57: hard, due 10-21, completed 10-21 22:30 New York (already 10-22 in UTC and in Bucharest) → `base_xp: 50`. Lateness compares the completion's `day` (user time zone), not the UTC instant.

### R3. `base_xp` is the quest's XP after the late penalty only. The streak bonus is not part of it
- L9: `base_xp: 10` but `xp: 12`.

### R4. Daily bonus = `min(2 × streak_on_that_day, 14)`, once per calendar day with ≥ 1 completion
`streak_on_that_day` = number of consecutive days with a completion, ending on that day.

| streak | bonus | line (xp delta − base_xp) |
| --- | --- | --- |
| 1 | 2 | L9 (0→12, base 10) |
| 2 | 4 | L14 (12→26) |
| 3 | 6 | L16 (76→92) |
| 4 | 8 | L17 (92→112, base 12) |
| 5 | 10 | L20 (122→142) |
| 6 | 12 | L21 (142→164) |
| 7 | 14 | L23 (164→188) |
| 8, 9, 10 | 14 (capped) | L24 (188→212), L27 (217→241), L31 (291→315) |

A second completion on the same day adds only its base XP: L15 (+50), L18 (+10), L25 (+5), L29 (+50), L36 (+10), L47 (+10), L66 (+50).

### R5. XP is a pure function of the completions that are not undone, and bonuses are recomputed retroactively
Undoing a completion can change the bonus of **later** days, because it can break the streak they were counted on.

- L45–46: undo c17 (10-17). XP goes from 357 to 339, a drop of 18: c17's own 10 + its bonus 4, **plus** 10-18's bonus falls from 6 (streak 3) to 2 (streak 1).
- L38–40: undo c15 (first completion of 10-16, 12 XP including the bonus). XP drops only by 10 (337 → 327): c16 is still on 10-16, so the day keeps its bonus.

## Levels

### R6. Level *n* needs `100 × n` XP; `xp_into_level` / `xp_to_next_level` are relative to the current level
Level *n* starts at a cumulative `50 × n × (n − 1)`: 0, 100, 300, 600, …

- L1: 0 XP → level 1, `xp_to_next_level: 100`.
- L17: 112 XP → level 2, into 12, to next 188 (level 2 needs 200).
- L31: 315 XP → level 3, into 15, to next 285 (level 3 needs 300).

## Streak

### R7. The current streak counts consecutive days ending today, or ending yesterday if there is no completion today yet; otherwise 0
- L13: 10-06 07:30, nothing yet today, last completion 10-05 → `streak: 1`.
- L33: 10-15 22:00, nothing on 10-15, last completion 10-14 → still `10`.
- L34: 10-16 07:00, no completion on 10-15 → `0`.
- L35: first completion after the gap → `1`.
- L59: 10-22, nothing yet that day, run 10-18..10-21 → `4`. L61: 10-23, 10-22 was missed → `1`.

## Days and time zones

### R8. A completion's `day` is fixed when it is created, in the time zone in effect at that moment
Changing the time zone later does not move it.

- L57: created `2026-10-22T02:30:00Z` while in New York → `day: 2026-10-21`.
- L59–60: after switching back to Bucharest (where that instant is 10-22), c22 still has `day: 2026-10-21`.

### R9. "Today" (for daily repeats, `done`, lateness and streak) is computed in the **current** time zone
- L51–52: switched to New York at 2026-10-19 20:30 UTC. Completing the daily quest at 20:30 New York (10-19 there, already 10-20 in Bucharest) returns the existing c20 (day 10-19) with **200**.

### R10. Day boundaries follow the IANA zone, including DST, not a fixed offset
- L62–64: Bucharest moves from +03:00 to +02:00 on 2026-10-25. Days 10-24, 10-25 and 10-26 are each counted once and the streak continues (2, 3, 4).

## Completions and quest state

### R11. `done`
For a one-off quest, `done` means it has a completion that is not undone. For a daily quest, it means it has one whose `day` is today in the current time zone.

- L12: daily q1 completed today → `true`.
- L41: one-off q4 after its only completion was undone → `false`.
- L53, L68: daily q1 → `true` on a day it was completed.

### R12. A completed one-off quest returns the existing completion with 200 and an up-to-date `me`
- L10, L48.

### R13. After an undo the quest can be completed again; the new completion gets a new id (ids are never reused)
- L38 → L47: q4 gets c19, not c15.

### R14. Undoing twice returns 404
- L39: `{"error": "completion not found"}`.

### R15. Undone completions disappear from `GET /completions`
- L60: no c15 or c17.

## Shapes and formats

### R16. Output format
- `created_at` is UTC, `Z` suffix, no milliseconds (L9: `2026-10-05T06:15:00Z`).
- `due_date` and `recurrence` are `null` when absent (L2, L3, L5).
- `GET /quests` is newest first by creation (L12, L41).
- `GET /completions` is newest first by `created_at` (L37, L60).

### R17. Error messages and statuses as observed
| case | status | message | line |
| --- | --- | --- | --- |
| unknown difficulty | 400 | `invalid difficulty` | L6 |
| both `due_date` and `recurrence` | 400 | `a quest cannot have both due_date and recurrence` | L7 |
| empty title | 400 | `invalid title` | L8 |
| unknown quest on complete | 404 | `quest not found` | L11 |
| unknown or undone completion | 404 | `completion not found` | L39 |
| invalid time zone | 400 | `invalid timezone` | L50 |

### R18. Changing the time zone returns the updated `me` and does not change XP
- L51, L59.

## Choices where the recording is silent (to confirm or document)

- **Validation order** (when several fields are invalid): title → difficulty → both-set → `due_date` format → recurrence.
- **Titles:** a title that is only whitespace is invalid. Length is checked on the raw string (1–100). Titles are stored as sent, not trimmed.
- **`due_date`:** must be a real calendar date (`2026-02-30` is rejected).
- **Past due date:** a `due_date` in the past at creation is accepted (nothing forbids it).
- **`recurrence`:** only `"daily"` is accepted. `null` or a missing field means one-off.
- **Late penalty on very late completions:** still a flat half (R1 shows 1 and 2 days late give the same factor).
- **Ties in ordering:** two items with the same timestamp are ordered by insertion, newest first.
- **`POST /test/reset`:** also resets the time zone to `Europe/Bucharest`.
- **Undoing a past daily completion:** does not let the user complete that past day again, only today.

## Not from the recording: the "Daydle of the day" extension

Everything above was recovered from the recording. The daily challenge is a deliberate addition, documented in the README. It reuses R4 and R7 unchanged: a daily-challenge completion (40 XP) is one more activity on its day for the streak and the once-a-day bonus. It never appears in the original endpoints' lists. With no daily completions, as in every recording, all rules above give exactly the recorded numbers (checked in `api/test/daily.test.ts`).
