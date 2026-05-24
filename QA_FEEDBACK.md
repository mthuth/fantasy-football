# Fantasy Football Agent QA Feedback

Test date: 2026-05-23

## Summary

The mock draft engine is working from the command line and the browser dashboard can load, advance to the user pick, show recommendations, accept picks, and reset. The current CLI simulation completed an 80-pick mock draft with 10 user recommendations and saved a simulation report.

## What Passed

- `npm run mock:draft` builds a 292-player mock pool.
- The CLI mock draft completes with `picksMade: 80` and `recommendationTurns: 10`.
- The final CLI roster includes required positions: QB, RB, WR, TE, DST, and K.
- The browser dashboard loads on a local server.
- The browser dashboard can advance to the user's pick, show top-5 recommendations, draft the top recommendation, and reset.
- No browser console errors were observed during the main desktop pass.

## Issues and Recommendations

## Resolution Status

- Fixed: server startup now falls back to the next available local port and binds to `127.0.0.1` by default.
- Fixed: disabled draft buttons now use muted styling and a `not-allowed` cursor.
- Fixed: `mock:draft` fails when required roster slots are missing.
- Fixed: generated ADP/ranking sanity is covered so kickers, defenses, and non-elite QBs do not leak into the early board.
- Fixed: added `scripts/test_dashboard_full_draft_flow.mjs` to cover the dashboard draft flow from initial load semantics through user recommendations, full draft completion, final roster validation, post-draft review, and reset.

### 1. Server startup crashes when the default port is occupied

File: `scripts/serve_mock_draft.mjs`

Observed: running `npm start` on the default `3001` port failed with an unhandled `EADDRINUSE` error.

Recommendation: add a friendly startup error or automatic fallback port. Also consider binding explicitly to `127.0.0.1` for local-only testing.

### 2. Disabled draft button still looks active

File: `public/styles.css`

Observed: after draft completion, `Draft Top Recommendation` is disabled but still looks like an active green primary button.

Recommendation: add visible disabled styling, such as muted background, lower opacity, and `cursor: not-allowed`.

### 3. Full browser draft needs an automated regression test

Observed: the CLI engine completed a full draft, but a fresh-origin browser click-through hit an automation timeout while repeatedly clicking through the full draft.

Recommendation: add a browser/UI test that verifies:

- initial load
- advance to user pick
- recommendation cards render
- all user turns can be drafted
- final status is `Draft complete`
- final roster satisfies required positions
- reset returns to pick 1

### 4. Roster validity should be asserted in the CLI simulation

File: `scripts/run_mock_draft.mjs`

Observed: an earlier test run exposed a missing-required-position risk. The current run now produced a valid roster, but the script does not appear to fail if required roster slots are missing.

Recommendation: make `mock:draft` fail if the final roster is invalid for the league settings. This protects the recommendation engine from silently regressing.

### 5. Generated ADP/ranking realism needs tightening

File: `src/draft/playerPoolBuilder.mjs`

Observed: the generated available-player list placed some mid-tier QBs very high in ADP, such as Baker Mayfield near the first round. This makes mock draft behavior less realistic.

Recommendation: tune generated source ranks and ADP by position, or add a small curated baseline for early-round player ordering until real projection/ranking imports are wired in.

## Verification Commands Used

```sh
node --check src/draft/draftEngine.mjs
node --check src/draft/mockData.mjs
node --check src/valuation/scoring.mjs
node --check public/app.js
node --check scripts/run_mock_draft.mjs
node --check scripts/serve_mock_draft.mjs
npm run mock:draft
PORT=3002 npm start
```

## Latest CLI Result

The latest successful CLI run produced:

- `players: 292`
- `positions: RB 70, WR 80, QB 36, TE 42, DST 32, K 32`
- `picksMade: 80`
- `recommendationTurns: 10`
- final user picks included WR, RB, QB, DST, TE, and K
