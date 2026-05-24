# PR #1 Quality Review

PR: https://github.com/mthuth/fantasy-football/pull/1

Status: Changes requested before this draft PR should be marked ready.

## Summary

This is a strong first implementation direction. The PR keeps Yahoo read-only,
blocks write actions, includes mock mode, separates the recommendation engine
from the Yahoo connector, and adds a meaningful regression-test surface.

Do not merge yet. The issues below affect recommendation quality, live Yahoo
sync correctness, OAuth safety, and UI data handling.

## Findings

### 1. ADP value scoring is inverted

File: `src/draft/draftEngine.mjs`

`marketValueEdge` is calculated as `player.adp - state.currentPick`, and
`buildPros` treats `player.adp > state.currentPick + 5` as a market edge. That
appears backwards.

Expected behavior:

- A player with ADP 20 falling to pick 35 should receive a positive value edge.
- A player with ADP 90 recommended at pick 35 should usually receive a reach
  penalty.

Current risk:

The engine can reward reaches and penalize falling value, which undermines the
core draft recommendation quality.

Required change:

- Reverse the ADP edge logic.
- Add a regression test with two otherwise similar players proving that a
  falling ADP bargain scores above a reach.

### 2. Yahoo team IDs are treated as draft slots

Files:

- `src/league/leagueImport.mjs`
- `src/connectors/yahoo/yahooDraftResultsNormalizer.mjs`
- `src/draft/yahooDraftSync.mjs`

`buildLeagueFromYahooSettings` keeps the base mock league's `teams` and
`userDraftSlot`, while `normalizeYahooDraftResults` maps Yahoo `.t.N` team keys
directly to internal `team_N`.

Current risk:

Yahoo team IDs are not guaranteed to equal draft slots. A real Yahoo import can
use the wrong team count, wrong user turn, and wrong roster attribution,
especially outside the bundled mock defaults.

Required change:

- Derive and persist the real Yahoo league team count.
- Derive and persist the selected user's real draft slot.
- Introduce an explicit `teamKeyToTeamId` or draft-order mapping before applying
  Yahoo draft results to the internal board.
- Add coverage for a league where the user's Yahoo team id is not draft slot 1.

### 3. OAuth state is generated but not validated

File: `scripts/serve_mock_draft.mjs`

`/api/yahoo/auth-url` generates a `state`, but `/oauth/yahoo/callback` does not
verify that state before exchanging the authorization code and saving tokens.

Current risk:

Even with read-only Yahoo access, this can expose private league data or save a
token from an unexpected authorization callback.

Required change:

- Persist a short-lived local OAuth state value.
- Reject callbacks with missing or mismatched `state`.
- Add coverage for valid, missing, and mismatched callback state.

### 4. External values are rendered through `innerHTML` without consistent escaping

File: `public/app.js`

Several render paths interpolate player, league, team, report, and imported
settings values directly into HTML. Some paths use `escapeHtml`, but many do
not.

Current risk:

Yahoo names, imported league settings, and pasted JSON can inject markup into
the local dashboard.

Required change:

- Escape all externally sourced values before interpolating into `innerHTML`, or
  render dynamic values through DOM text nodes.
- Add a UI contract test using a league or player name with markup and verify it
  renders as text.

## Recommendation

Keep the PR in draft and request developer changes. Once these issues are fixed,
the PR will be much closer to a safe first merge.
