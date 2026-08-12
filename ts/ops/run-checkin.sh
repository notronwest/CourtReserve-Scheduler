#!/usr/bin/env bash
# launchd wrapper: weekly check-in (TS), Mondays 6 AM. Reconciles the prior
# week's registered players who weren't checked in. --days 8 covers a full
# Mon–Sun with a day of slack; --execute actually marks them checked in.
set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")/.."   # -> ts/
exec npx tsx src/jobs/checkinPast.ts --execute --days 8
