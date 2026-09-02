# STATUS — CourtReserve Scheduler

> Append-only session front door. Newest entry on top. New entries supersede old;
> never rewrite history. Deeper detail lives in [`docs/TS-REWRITE-PLAN.md`](docs/TS-REWRITE-PLAN.md)
> and the GitHub issues/PRs linked below.

---
## 2026-09-01 (5) — Both women's events addressable; archiving behaviour documented

**State:** `f02ea5d` on `policy/intermediate-permanent-slots`. Typecheck clean,
75/75 pass, tree clean. **Still unpushed.**

### ✅ Done
- **Added `1717124` "Women's Advanced Intermediate Open Play"** (Wednesday 15:00–17:00)
  to `approved_events`. Both women's series are now addressable by `!book`/`!move`.
- **Guard re-verified with two `womens:true` entries present** — `AI_EVENT_ID` →
  `1672774`, `INT_EVENT_ID` → `1931656`. The level collision did not leak.
- **Documented Court Reserve event archiving** in `CLAUDE.md` → Book Event Technical
  Notes: an event with **no future instances is archived** and vanishes from the events
  list; it is only visible by widening the list's date range back to **1/15/2025**.
  That is how a dormant series' `event_id` is recovered. A "missing" event is usually
  archived, not deleted — check before creating a duplicate.

### ⚠️ Open risks
- **Both ids remain UNVERIFIED** (`1240908`, `1717124`) — supplied from the Events/Edit
  URL, not confirmed against Court Reserve.
- **Verification method changed by the archiving fact.** A schedule fetch for a given
  date only shows a series that has an instance *that day*; a dormant/archived series
  won't appear. Verify via the **events list widened to 1/15/2025**, not a day fetch.

### 🔜 Next
- Verify both ids the archived-safe way; push the branch / open a PR and get the file
  onto whichever machine runs the listener (no restart needed — `load_policy()` is
  called inside the handlers).
- Friday women's series still needs its 09:00 → 10:00 move **by hand** in Court Reserve.
- Carried over: four surgical `!book` backfills (Mon 9/7, Tue 9/8, Mon 9/14, Tue 9/15);
  Pass 0 `event_gap_ok()` + `event_id`-override fix (unblocks the held Thursday slot);
  write the missing `DEPLOYMENT.md`.

## 2026-09-01 (4) — Women's Intermediate wired into `approved_events`

**State:** `8c31942` on `policy/intermediate-permanent-slots`. TS typecheck clean,
75/75 tests pass, tree clean. **Still unpushed — the live listener has not got this.**

### ✅ Done
- **Added `1240908` "Women's Intermediate Open Play"** to `policy.json` →
  `approved_events`. `llm_parser` builds its whole event vocabulary from that block
  (`llm_parser.py:43`), so `!book`/`!move womens intermediate` now resolves to the real
  series instead of falling back to co-ed `1931656`.
- **Guarded the last-wins hazard this introduces.** The new entry shares level
  `"Intermediate"` with the co-ed event, and any `{level -> event_id}` map built by
  iteration resolves that level to whichever entry lands last. Both such maps now skip
  `womens:true`: `fix_imbalance.py` `_BY_LEVEL` (`INT_EVENT_ID`) and
  `ts/src/jobs/fixImbalance.ts` `buildCtx` (`intEventId`). Verified after the change —
  both still resolve Intermediate → `1931656`.
- `recommender.py` unaffected (hardcodes its own `APPROVED_EVENTS`, line 24).
- **No listener restart needed for policy-only changes**: `load_policy()` is called
  inside the handlers (`discord_listener.py:647/824/881`), not at import.

### ⚠️ Open risks
- **`1240908` is UNVERIFIED.** Supplied by Ron from the Court Reserve Events/Edit URL,
  not confirmed against Court Reserve. A wrong id books occurrences of some other
  event. Flagged in the entry's `note`. **Verify before confirming the first booking.**
- **Wednesday "Women's Advanced Intermediate Open Play" id still missing** — same
  defect, still unaddressable by `!book`/`!move`.
- **`DEPLOYMENT.md` does not exist**, though `CLAUDE.md` states the repo has one and
  requires reading it before anything that ships. Real doc/reality drift; no written
  answer for how this repo reaches the club mini.

### 🔜 Next
- Verify `1240908`; get the Wednesday women's id; push the branch / open a PR and get
  the file onto whichever machine runs the listener.
- Friday women's recurring series still needs its 09:00 → 10:00 move **by hand** in
  Court Reserve (`!move` shifts single occurrences only).
- Carried over: four surgical `!book` backfills (Mon 9/7, Tue 9/8, Mon 9/14, Tue 9/15);
  the Pass 0 `event_gap_ok()` + `event_id`-override fix that unblocks the held Thursday
  slot; write `DEPLOYMENT.md`.

## 2026-09-01 (3) — `!book`/`!move` can't address women's events; fix identified

**State:** Analysis only, no code or policy changes since `58ab413`+. Working tree
clean. Ron tried `!book womens intermediate 9/4 10am` in Discord; the preview came
back as **Co-ed Intermediate Open Play, Fri 9/4 10:00–12:00, Court #1** — told him to
reply `cancel`, since confirming would book a co-ed session competing with the real
women's one.

### ✅ Root cause (verified)
- **Not a parsing bug.** `llm_parser.py:43` builds the parser's entire event
  vocabulary from `policy["approved_events"]` — only the 5 co-ed Open Play events —
  and the prompt instructs *"If the request is ambiguous about level, pick the closest
  match."* So "womens intermediate" → `1931656` Co-ed Intermediate. Working as written.
- **`!move` is equally blocked.** `_execute_move` (`discord_listener.py:648`) matches
  the live schedule on the `event_id` that same parser returns, so it searches for the
  co-ed id, misses the real women's series, and reports "couldn't find."
- **`recommender.py` hardcodes `APPROVED_EVENTS` at line 24** and never reads
  `policy["approved_events"]`. This **contradicts
  `governance.eventid_whitelist_change_policy`**, which says ids live in policy.json
  and must not be hardcoded in recommender.py. Editing policy alone does not change
  recommender behavior — a real trap for a later session.
- Consumers of `policy["approved_events"]`: `llm_parser`, `discord_listener` (level
  emoji), `fix_imbalance`, `check_waitlists`, `checkin_past`, and the TS mirrors.
  **Not** `recommender.py`.

### 🔜 Next — blocked on two event ids from Ron
- **Add the women's events to `policy.json` → `approved_events`.** Safe *because* the
  recommender hardcodes its own dict: the addition reaches `llm_parser` (the goal)
  without touching Pass 0 or `LEVEL_TO_EVENT_ID`. ⚠️ That map is
  `{v["level"]: k for ...}` — **last-wins** — so a second "Intermediate" entry added to
  *recommender.py* would silently hijack the co-ed booking id. Do not mirror it there.
- **Need the real Court Reserve event ids** for "Women's Intermediate Open Play" and
  "Women's Advanced Intermediate Open Play" (Wednesday, same defect). No `history/` or
  `logs/` on this machine — it is not the club mini. Either Ron reads them from
  `app.courtreserve.com/Events/Edit/{event_id}`, or a read-only schedule fetch grabs
  them (takes `logs/browser.lock`, contends with the listener).
- Friday women's recurring series still needs its 09:00 → 10:00 move done **by hand**
  in Court Reserve; `!move` only shifts single occurrences.
- Still open from prior entries: the four surgical `!book` backfills (Mon 9/7, Tue 9/8,
  Mon 9/14, Tue 9/15), the Pass 0 `event_gap_ok()` fix + `event_id` override that would
  unblock the held Thursday slot, and pushing `policy/intermediate-permanent-slots`.

## 2026-09-01 (later) — Backfill decided: do NOT re-run `--book` on booked days

**State:** Analysis only, no code or policy changes since `b0ba403`. Working tree
clean. The open "decide the backfill" question from the entry below is now
**answered: a full `run.py <date> --book` re-run is off the table.**

### ✅ Findings (verified, not inferred)
- **`--book` is non-destructive.** `run.py` imports only `book_event`,
  `fix_event_court`, `edit_occurrence_multi_court` — never `cancel_occurrence` or
  `move_occurrence`. It only *adds* occurrences; hard constraint 1 stops it booking
  over an existing event on the same court. **Existing sessions and their
  registrants are never cancelled, moved, or modified.**
- **But it does not skip already-booked days.** The recommender has *no concept of
  registrants* — only `checkin_past.py` reads registrant counts. It sees court/time
  occupancy only, so it books *around* a full session onto a different court at the
  same hour.
- **Simulated re-run on 9/7, 9/8, 9/14, 9/15** (old-policy output replayed as the
  live calendar): each day already holds ~5 events and the re-run **adds 4 more**,
  including a same-hour duplicate of `Co-ed Advanced Open Play` (17:00–19:00 Mondays,
  16:00–18:00 Tuesdays) plus re-added Beginner / Advanced Beginner at 09:00.
- **The new Intermediate slots themselves break constraint 3b** against existing
  Intermediate sessions: 1.0h gap on Mondays, 0.0h on Tuesdays (2h required).
- Root cause is the already-recorded `fixed_events.pass0_min_gap_caveat`: the
  existing event sits on a *different court* so `already_on_schedule` doesn't fire,
  and Pass 0 never calls `event_gap_ok()`. Net effect is a second competing session
  at the same hour, splitting attendance on events that already have registrants.

### 🔜 Next (unchanged targets, new preferred route)
- **Backfill via four surgical `!book` commands** — Mon 9/7, Tue 9/8, Mon 9/14,
  Tue 9/15 — which book only the named slot. **Precede with a read-only schedule
  fetch** for those days to confirm the new slot isn't back-to-back with a real
  existing Intermediate session (the table above replays old-policy output, not the
  real calendar). That fetch takes `logs/browser.lock` and will contend with the
  always-on listener.
- **Or fix Pass 0 first** — call `event_gap_ok()` in Pass 0 and add an `event_id`
  override field on fixed events. That makes re-runs safe *and* unblocks the held
  Thursday 17:00–19:00 slot. Awaiting Ron's pick between the two.
- Friday women's series still needs a manual move (09:00 → 10:00) in Court Reserve.
- Branch `policy/intermediate-permanent-slots` still unpushed, no PR.

## 2026-09-01 — Permanent Intermediate slots (policy change, partly blocked)

**State:** `policy.json` `fixed_events` updated on branch
`policy/intermediate-permanent-slots` (commit `5d1ef90`) with explicit business
approval from club management. **Not pushed, no PR, nothing booked on Court
Reserve yet.** Two of four requested slots are blocked on a Pass 0 defect.

### ✅ Done
- **Monday 16:00–18:00** Co-ed Intermediate Open Play — added.
- **Tuesday 11:00–13:00** Co-ed Intermediate Open Play — added.
- **Friday Women's Intermediate 09:00–11:00 → 10:00–12:00** — moved in policy.
- Verified offline via `recommender.recommend()` with an empty schedule: Mon/Tue/Fri
  emit exactly the requested slots. TS shares this `policy.json` — typecheck clean,
  75/75 tests pass.

### ⚠️ Two Pass 0 defects found while verifying (recorded in `policy.json`)
- **`fixed_events.womens_only_caveat`** — Pass 0 books via `LEVEL_TO_EVENT_ID`
  (level → approved co-ed event id) and `add()` uses `APPROVED_EVENTS[eid]["name"]`,
  discarding the entry's own name. Any fixed event whose real Court Reserve series
  has its own event id (both Women's entries, all three "Level Play" entries) gets a
  **co-ed clone booked at the same hour on a different free court** — the real series'
  id is not in `approved_events`, so it never increments `event_counts`. Verified: with
  the real Women's series live on Court #4, Pass 0 still books Co-ed Intermediate on
  Court #1 at 09:00–11:00. **This is live in production today, every Friday.**
- **`fixed_events.pass0_min_gap_caveat`** — Pass 0 checks only `_max_occ_for(eid)`,
  never `event_gap_ok()`, so two same-level entries at one hour double-book the same
  event id with zero gap, violating hard constraint 3b.

### ⛔ Not done
- **Thursday 17:00–19:00 Intermediate** — requested as a *separate* event alongside
  "Co-Ed 3.25-3.5 Level Play", but that entry already maps to the same event id
  (1931656). Adding it produced two identical `Co-ed Intermediate Open Play`
  occurrences at 17:00–19:00 on courts 2 and 3. Held.
- **Friday women's slot is policy-only.** The move keeps the recommender's model
  honest, but Pass 0 cannot *book* a women's-only event. The real recurring series
  must be moved in Court Reserve by hand.

### 🔜 Next
- **Decide the backfill.** Days 9/2–9/14 were already booked under the old policy;
  the daily job picks up the new policy from 9/16. Gap needing new bookings:
  **Mon 9/7, Tue 9/8, Mon 9/14, Tue 9/15**. Friday moves (9/4, 9/11) are Court
  Reserve series edits, not bookings.
- **Fix Pass 0** before adding any further named/gendered fixed events: add an
  `event_id` override field and a `booked` vs `informational` flag on fixed events,
  and call `event_gap_ok()` in Pass 0.
- Push the branch and open a PR.

## 2026-07-08 — TS rewrite through Phase 5 (all jobs ported)

**State:** The Python → TypeScript rewrite (`ts/`) is **functionally complete through
Phase 5**. The scheduler brain, Discord listener, daily scheduler CLI, and all 5 jobs
are ported to TS and route Court Reserve access through the `courtreserve-api` HTTP
service (no Playwright in this repo). **The live Python is still the system of record —
nothing has been cut over yet.** Only **Phase 6** (launchd → node, shadow-run, delete
Python) remains. Plan: [`docs/TS-REWRITE-PLAN.md`](docs/TS-REWRITE-PLAN.md).

### ✅ Done (merged to `main`)
- Phases 0–3: scaffold, CR HTTP client, recommender/policy/history (parity-tested), LLM
  ranker + `!book`/`!move` parser.
- **Phase 4** — Discord listener (`ts/src/discord/`). Live-verified in test channel
  `1511935694107312179`: `!help`, `!book`→preview, `!move`→preview, `cancel`, approval
  routing. REST polling (no privileged `MESSAGE_CONTENT` intent); no browser lock.
- **Phase 5** — scheduler CLI + all jobs (`ts/src/scheduler.ts`, `ts/src/jobs/`):
  `runScheduler` (recommendLlm→post→pending), `fetchHistory`, `fixImbalance`,
  `checkWaitlists`, `checkinPast`. `!schedule` spawns the TS CLI now.
- **courtreserve-api** endpoints added + merged: `GET /waitlists`, `GET /checkin/scan`,
  `POST /checkin`. Service runs as launchd `com.wmpc.courtreserve-api` on `:8787`.
- All TS: **75/75 tests, typecheck clean.** Each piece verified live against the running
  service, EXCEPT the two deliberate mutations (below).

### ⏳ In flight
- (nothing mid-merge — all session PRs are merged)

### 🔜 Next
- **Phase 6 — cutover (the only remaining phase).** Point `ops/*.plist` at `node`,
  shadow-run TS `--dry-run` beside the live Python for a week and diff daily recs
  (`npm run recommend <date> --llm` is the diff tool), then cut launchd over job-by-job
  and **delete the Python** + venv + requirements.txt.
- **Court-aware `/move`** — the last endpoint gap ([#21](https://github.com/notronwest/CourtReserve-Scheduler/issues/21),
  open). TS `!move` changes time only; a requested court change is surfaced, not applied.
- **Manual mutation tests** (never auto-run — they hit real Court Reserve):
  - `!book … confirm` in the test channel → a real booking (use a throwaway slot).
  - `cd ts && npm run checkin-past -- --event <id> --execute` → first live check-in.
- **Housekeeping:** close superseded PR
  [#12](https://github.com/notronwest/CourtReserve-Scheduler/pull/12) (import-based extraction,
  superseded by the rewrite) and stale docs PR
  [#1](https://github.com/notronwest/CourtReserve-Scheduler/pull/1).

### 🖥️ Picking up on another machine
1. `cd ts && npm install`. Copy `ts/.env.template` → `ts/.env` and fill in: `CRAPI_URL`
   (+`CRAPI_KEY` from the `courtreserve-api` service `.env`), `ANTHROPIC_API_KEY`, and the
   Discord bot token + a **webhook bound to the channel you poll** (they must match —
   `DISCORD_CHANNEL_ID` == the webhook's channel).
2. `npm test` (mocked — no services needed). `npm run health` checks the CR service.
3. Read-only smoke: `npm run recommend <date> --llm`, `npm run checkin-past -- --dry-run`,
   `npm run check-waitlists -- --dry-run`.
4. The `courtreserve-api` service must be running (launchd `com.wmpc.courtreserve-api`,
   `:8787`) for anything hitting Court Reserve. Restart it with
   `launchctl kickstart -k gui/$(id -u)/com.wmpc.courtreserve-api`.
