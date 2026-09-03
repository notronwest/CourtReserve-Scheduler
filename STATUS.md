# STATUS — CourtReserve Scheduler

> Append-only session front door. Newest entry on top. New entries supersede old;
> never rewrite history. Deeper detail lives in [`docs/TS-REWRITE-PLAN.md`](docs/TS-REWRITE-PLAN.md)
> and the GitHub issues/PRs linked below.

---
## 2026-09-03 — `setup.sh` was silently reverting the TS cutover

**State:** PR open against `main`. **Already fixed on the host by hand** —
`ts/ops/cutover.sh` re-run, TS listener live, 9/16 auto-booked 7/7.

### What broke
On 2026-09-01 at 23:25 a routine `git pull && ./setup.sh` on `wmpcMacMini1`
overwrote all four TS launchd plists with the Python ones from `ops/`. The labels
are identical (`com.whitemountain.*`), so `launchctl list` looked correct and
nothing surfaced an error. The next morning the 8:00 AM job was
`scripts/run_scheduler.sh` → `run.py --llm --book`, which **posts recommendations
for Discord approval instead of auto-booking**. Ron noticed only because the
approval embed appeared.

Evidence: the installed plists were byte-identical to the July 9 backups in
`~/Library/LaunchAgents/.python-plist-backup/`; `launchd_scheduler.log` shows
clean TS auto-book runs on 8/30, 8/31, 9/1 and nothing on 9/2, while
`scheduler_2026-09-02.log` (Python-only) shows "Pending approval saved". The TS-only
`checkin` plist survived — `setup.sh` didn't know about it.

### ✅ Done
- **`install_plist()` now reads `ts/ops/`**, not `ops/`, and installs the fifth
  agent (`com.whitemountain.checkin`). The `sed` prefix rewrite handles both the
  old and current repo-path spellings.
- **New setup step 4** installs the `ts/` node dependencies and warns when
  `ts/.env` is missing — without those the agents fail at load with a bare
  "cannot find module" in the launchd error log.
- **`check.sh` checks all five services** (was three — it never covered
  `check-waitlists` or `checkin`).
- **`DEPLOYMENT.md` rewritten to describe the TS deployment** it actually is:
  node/tsx sources, five agents, `ts/.env` as the config scope, CR reached through
  `courtreserve-api`, and rollback via `ts/ops/rollback.sh`.

### Trade-off
`./setup.sh` now *undoes* a deliberate `ts/ops/rollback.sh`, the mirror of the old
bug. That's the right default — TS is the live path — but a rollback holds only
until the next setup run. Documented in `DEPLOYMENT.md` under "Roll back".

### 🔜 Next
- Separate PR: `!book` has no same-court overlap check (see the entry below this
  one once filed) — `parseBookCommand` never sees the live schedule.

---
## 2026-09-01 — Permanent Intermediate slots + women's events made addressable

**State:** **MERGED to `main`** as `5341aa2` via PR
[#34](https://github.com/notronwest/CourtReserve-Scheduler/pull/34); branch deleted.
Main had moved 8 commits meanwhile — landing the `event_id` override
([#30](https://github.com/notronwest/CourtReserve-Scheduler/pull/30)), `DEPLOYMENT.md`
([#33](https://github.com/notronwest/CourtReserve-Scheduler/pull/33)), and the TS
launchd/cutover work — and conflicted on all three files this session touched.
Resolved by taking main's restructured `policy.json` / `CLAUDE.md` / `STATUS.md` and
re-applying this session's changes on top.

**⚠️ NOT DEPLOYED.** Per `DEPLOYMENT.md`, pushing to `main` deploys nothing — a human
runs `./setup.sh` on the club Mac. None of this is live yet.

### ✅ Done
- **New permanent Intermediate fixed events:** Monday **16:00–18:00**, Tuesday
  **11:00–13:00**.
- **Friday Women's Intermediate moved 09:00–11:00 → 10:00–12:00**, and pinned with
  `event_id: 1240908`.
- **Wednesday Women's Advanced Intermediate pinned** with `event_id: 1717124`.
  Both use the optional `event_id` field main added in
  [#30](https://github.com/notronwest/CourtReserve-Scheduler/pull/30).
- **Both women's series added to `approved_events`** so `!book`/`!move` can address
  them. `llm_parser` builds its entire event vocabulary from that block
  (`llm_parser.py:43`), so `!book womens intermediate` previously hit the prompt's
  "closest match" rule and silently resolved to co-ed `1931656`.
- **Guarded the level collision this creates.** Both women's entries share a `level`
  with a co-ed event, and `{level -> event_id}` maps built by iteration are last-wins.
  `fix_imbalance.py` `_BY_LEVEL` and `ts/src/jobs/fixImbalance.ts` `buildCtx` now skip
  `womens:true`. Verified with both entries present: Intermediate → `1931656`,
  Advanced Intermediate → `1672774`.
- **Documented Court Reserve event archiving** in `CLAUDE.md`: an event with no future
  instances is archived and vanishes from the events list; only visible by widening the
  range to **1/15/2025**. That is how a dormant series' `event_id` is recovered.

### ⚠️ Open risks
- **`event_id` is a TS-only fix.** `recommender.py` never reads it. Per `DEPLOYMENT.md`
  the live launchd agents still run the **Python** stack, so in production Pass 0 still
  books a **co-ed clone** of every distinct series at the same hour on a free court —
  verified: with the real Women's series live on Court #4, Pass 0 still books Co-ed
  Intermediate on Court #1. Recorded as `fixed_events.python_pass0_caveat`.
  **Port `event_id` to `recommender.py`, or finish the TS cutover.**
- **Both event ids are UNVERIFIED** (`1240908`, `1717124`) — read off the Events/Edit
  URL, not confirmed against Court Reserve. The `!book` preview renders the name from
  policy, so it will not catch a wrong id. Verify via the events list widened to
  1/15/2025 — a single-day schedule fetch won't show a dormant series.
- **Pushing to main deploys nothing.** A human runs `./setup.sh` on the club Mac.

### 🔜 Next
- Port the `event_id` override to `recommender.py` (or complete the cutover), then
  `./setup.sh` on the host.
- **Thursday 17:00–19:00 Intermediate is still held**: "Co-Ed 3.25-3.5 Level Play" has
  no `event_id` of its own and resolves to `1931656`, so adding a second entry produced
  two identical occurrences on courts 2 and 3 (Pass 0 never calls `event_gap_ok()` —
  `fixed_events.pass0_min_gap_caveat`). Supply that event's real id to unblock it.
- Friday women's **recurring series** still needs its 09:00 → 10:00 move by hand in
  Court Reserve; `!move` shifts single occurrences only.
- No backfill booked. A full `run.py --book` re-run on already-booked days adds ~4
  duplicate events per day rather than skipping them; four surgical `!book`s
  (Mon 9/7, Tue 9/8, Mon 9/14, Tue 9/15) are the route.

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
