# Architecture Feedback for Development

This is the architecture checkpoint for the fantasy-football agent before the
team opens implementation PRs. The current GitHub repository has no open PRs or
open issues, so this feedback should become the guardrail for upcoming work.

## Required Changes

1. Keep the first milestone focused on a Yahoo live-draft copilot.
   - Build live draft recommendations first.
   - Keep waivers, trades, dynasty, salary cap, best ball, and multi-platform
     support behind the first draft-copilot milestone unless they are explicitly
     pulled forward.

2. Do not build an auto-drafter until the Yahoo write path is verified.
   - Treat live Yahoo drafting as manual-assisted by default.
   - The app should recommend the pick, explain the reasoning, and let the user
     execute in Yahoo.
   - Any future write action must be behind approval and dry-run checks.

3. Make approval and audit logging core architecture, not a later feature.
   - Paid-league actions must require explicit approval.
   - Store the recommendation shown, alternatives considered, user decision,
     timestamp, league context, and any payload that would have been sent.
   - Mock mode and production should both write decision logs so behavior can be
     compared safely.

4. Separate the recommendation engine from platform connectors.
   - Ranking and recommendation code should not depend directly on Yahoo API
     objects.
   - Platform adapters should normalize league, roster, draft, and availability
     data into internal models.
   - This keeps Yahoo first without trapping the system inside Yahoo-specific
     data shapes.

5. Use a canonical internal player table.
   - Do not use Yahoo, Sleeper, ESPN, GSIS, or any vendor ID as the permanent
     player identity.
   - Keep vendor IDs in a source-ID mapping table.
   - Preserve raw source payloads and quarantine conflicts instead of silently
     merging questionable identities.

6. Make the scoring model explainable from day one.
   - Each recommendation should expose rank/value, roster need, tier drop-off,
     positional scarcity, risk, upside, bye/week fit, and source confidence.
   - The UI can hide detailed math behind a details panel, but the architecture
     needs to retain the explanation data.

7. Mock mode must run the same logic as production.
   - Mock mode should swap the connector, not the decision engine.
   - It should support replaying draft events, manual board corrections, and
     post-draft reports.

8. Define stable internal contracts before UI work expands.
   - Suggested contracts: `Player`, `ExternalPlayerId`, `LeagueSettings`,
     `RosterState`, `DraftState`, `Recommendation`,
     `RecommendationExplanation`, `ApprovalDecision`, `DecisionLogEntry`, and
     `SourceObservation`.

## Suggested Implementation Order

1. Create internal domain models and JSON fixtures.
2. Build mock draft event ingestion and replay.
3. Seed canonical player data plus external-ID mappings.
4. Implement the first explainable ranking/recommendation pass.
5. Build a local draft dashboard around top recommendations and manual board
   correction.
6. Add Yahoo read-only integration after mock mode is reliable.
7. Add approval and dry-run plumbing before any write-capable connector work.

## Architecture Readiness Criteria

- A developer can run a mock draft without Yahoo credentials.
- Recommendation output includes top five picks, pros/cons, and score
  components.
- Manual board corrections recalculate recommendations immediately.
- All recommendation and approval decisions are logged.
- Player identity is internal and canonical, with vendor IDs mapped separately.
- No code path assumes Yahoo live pick submission is available.
- Paid-league actions cannot execute without explicit approval.

PRs that add broad features before these boundaries are in place should be
narrowed or split.
