# Deployment — court-reserve-scheduler

No cloud host and no web frontend. This is a Python + Playwright system installed
on **one always-on Mac** as four launchd agents: a daily recommender, a daily
waitlist checker, a weekly history fetch, and a persistent Discord listener.
"Deploying" is `./setup.sh` on that machine. Pushing to `main` deploys nothing.

It has to be a real Mac: the Court Reserve client drives **non-headless Chrome**
against a saved browser profile, on the club's residential IP. Headless breaks
Cloudflare's bot check, and a datacenter IP gets challenged.

```yaml
# wmpc-deployment: v1
repo: court-reserve-scheduler
archetype: mac-mini-launchd
branches:
  main: n/a — pushing to main deploys NOTHING; a human runs ./setup.sh on the host
  production: n/a — this repo has no production branch
targets:
  - name: scheduler
    kind: mac-mini-launchd
    trigger: launchd com.whitemountain.scheduler — daily at 8:00 AM (installed/reloaded by ./setup.sh)
    source: scripts/run_scheduler.sh → recommender.py
    env: PROD
    url: n/a — posts recommendations to Discord for approval
    host: the machine ./setup.sh was run on (single install; not fleet-replicated)
    config_scope: .env in the repo root on that machine (CR credentials, Discord webhook, Anthropic API key) + policy.json + courts.json
    verify: ./check.sh, and the logs under ~/Library/Logs/court_reserve/
    rollback: git checkout an earlier commit and re-run ./setup.sh
  - name: check-waitlists
    kind: mac-mini-launchd
    trigger: launchd com.whitemountain.check-waitlists — 9:00, 11:00, 13:00, 15:00, 17:00 daily
    source: check_waitlists.py
    env: PROD
    url: n/a
    host: same machine
    config_scope: same .env
    verify: the job's log under ~/Library/Logs/court_reserve/
    rollback: launchctl unload the plist
  - name: fetch-history
    kind: mac-mini-launchd
    trigger: launchd com.whitemountain.fetch-history — weekly, Monday 7:00 AM
    source: scripts/run_fetch_history.sh → fetch_history.py
    env: PROD
    url: n/a — writes into history/
    host: same machine
    config_scope: same .env
    verify: a fresh dated file in history/
    rollback: launchctl unload the plist
  - name: listener
    kind: mac-mini-launchd
    trigger: launchd com.whitemountain.listener — persistent (RunAtLoad + KeepAlive)
    source: scripts/run_listener.sh → discord_listener.py
    env: PROD
    url: n/a — listens for approvals in Discord and books confirmed events
    host: same machine
    config_scope: same .env (Discord bot token / webhook)
    verify: launchctl list | grep com.whitemountain.listener; react in Discord and confirm it acts
    rollback: launchctl unload the plist
  - name: cr-browser-session
    kind: none
    trigger: MANUAL, interactive — step 7 of ./setup.sh opens a browser to log in
    source: cache/chrome_profile/
    env: PROD
    url: n/a
    host: same machine
    config_scope: the saved Chrome profile — NOT in the repo, NOT recreatable by a deploy
    verify: cache/chrome_profile/Default/Cookies exists and the scheduler can fetch a schedule
    rollback: delete the profile and re-run `python cr_client.py --login`
```

## What ships from this repo

| Target | Trigger | Runs |
|---|---|---|
| `scheduler` | launchd | daily 8:00 AM |
| `check-waitlists` | launchd | 9:00 · 11:00 · 13:00 · 15:00 · 17:00 daily |
| `fetch-history` | launchd | Mondays 7:00 AM |
| `listener` | launchd | persistent (`KeepAlive`) |
| `cr-browser-session` | hand-run, once | — |

## Targets

### Install / update — `./setup.sh`

```bash
cd ~/data/web/wmpc/projects/court-reserve-scheduler
git pull && ./setup.sh
```

It builds the venv, installs dependencies and Playwright's Chromium, creates
`.env`, **installs and reloads all four launchd agents**, and walks the
first-time Court Reserve login. `./setup.sh --restore <bundle.tar.gz>` restores a
prior install's `.env`, history, browser profile, and booking logs.

**The plists are templates, not literals.** `ops/*.plist` hardcode
`/Users/notronwest/data/court_reserve_scheduling` — an older path — and
`install_plist()` rewrites that prefix to the actual install directory (and
`$HOME/Library`) with `sed` as it copies each one into `~/Library/LaunchAgents`.
So the path in the committed plist is expected to look wrong; editing it to the
"correct" path would break nothing but would also change nothing. What matters is
that the substitution happens at install time — which is why a **moved repo needs
`./setup.sh` re-run**, not just a `git pull`.

Uninstall: `./uninstall.sh` — unloads the agents, removes the plists and the logs
under `~/Library/Logs/court_reserve/`, and offers to delete the project
directory. It does not touch Discord, the Anthropic key, or Court Reserve itself.

### cr-browser-session — the part no deploy can recreate

The saved Chrome profile in `cache/chrome_profile/` **is** the Court Reserve
session. It is created by a human logging in through a real browser window and is
not in the repo. If it's missing or expired, every scheduled job fails at login
and the system looks broken in a way no redeploy fixes:

```bash
python cr_client.py --login
```

## Environments & variable scopes

One environment, one machine. Everything is the repo-root `.env` on that machine,
plus two committed policy files:

- **`.env`** — Court Reserve credentials, Discord webhook / bot token, Anthropic
  API key. Gitignored; see [`.env.example`](./.env.example).
- **`policy.json`** — booking policy the recommender applies.
- **`courts.json`** — court inventory.

Both JSON files are **committed**, so changing them is a code change and takes
effect on the next scheduled run — no restart needed for the cron-style jobs, but
the persistent `listener` needs a reload to pick up code changes.

**This is a single install, not a fleet install.** Unlike the daemon agents, the
scheduler has no host gate — whichever machine you run `./setup.sh` on starts
running the jobs. Running it on a second machine would double-book.

## Verify a deploy

```bash
./check.sh
```

Plus:

```bash
python test_connections.py
launchctl list | grep com.whitemountain
```

Logs live under `~/Library/Logs/court_reserve/`.

## Roll back

`git checkout <earlier-commit>` and re-run `./setup.sh` — it reloads all four
agents. To stop a single job, `launchctl unload ~/Library/LaunchAgents/<label>.plist`.
To remove everything, `./uninstall.sh`.

## Does NOT deploy from here

- **Pushing to `main`.** No CI. Merged code is live only after `./setup.sh` on
  the host.
- **The Court Reserve HTTP service.** [`courtreserve-api`](../courtreserve-api)
  is the shared service other apps call; it's a separate repo with its own
  launchd jobs and its own CR session. This repo is the *booking brain*, not the
  API.
- **`session-manager`'s CR scraping.** It imports `cr_client` from this repo as a
  **sibling checkout on disk** — that's a code dependency, not a deploy.
- **The browser session.** Never recreated by a deploy; a human has to log in.

## Deeper docs

- [`README.md`](./README.md) — quick start, manual setup, and what each piece does.
- [`docs/`](./docs/) — the TS rewrite plan and design notes.
- [`MANIFESTO.md`](./MANIFESTO.md) — intent.
- `../wmpc-meta/conventions/deployment-doc.md` — why this file exists and its shape.
