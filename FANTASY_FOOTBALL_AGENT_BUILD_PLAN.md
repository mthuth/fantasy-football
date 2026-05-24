# Fantasy Football Agent Build Plan

## Recommended Next Milestone

Build the first version as a Yahoo live draft copilot with mock mode.

This is the right first milestone because:
- Drafting is time-sensitive and high-value.
- Yahoo live draft pick submission does not appear to be officially supported through API, so recommendation mode is the safe product shape.
- Mock mode lets the scoring engine, board updates, and recommendation cards be tested before draft day.
- The same valuation foundation will later power waiver pickups, trade scoring, and lineup decisions.

## Milestone 1: Live Draft Copilot MVP

### User Experience

The user connects a Yahoo league, opens the draft assistant, and sees:
- League settings summary.
- Draft board.
- User roster needs.
- Available player rankings.
- Positional tiers.
- Top 5 recommended picks when it is the user's turn.
- Transparent score breakdown for each recommendation.
- Manual controls if Yahoo draft sync lags.
- Mock mode toggle.

The agent does not submit draft picks. The user manually drafts in Yahoo.

### MVP Capabilities

1. Import Yahoo league rules.
2. Normalize scoring settings.
3. Import or mock draft state.
4. Load player projections/rankings from at least one external source.
5. Calculate league-specific player values.
6. Recalculate after every drafted player.
7. Estimate user needs and opponent needs.
8. Recommend up to 5 picks.
9. Explain each recommendation.
10. Run the same flow in mock mode.

## Workstream 1: Project Foundation

Deliverables:
- Repository structure.
- Environment configuration.
- Data model definitions.
- Connector interface.
- Mock connector.
- Test runner.

Suggested modules:

```text
src/
  connectors/
    yahoo/
    mock/
  data/
  draft/
  valuation/
  recommendations/
  approvals/
  ui/
  tests/
```

Definition of done:
- App starts locally.
- Mock league can be loaded.
- Mock draft state can be read.
- No production Yahoo write path exists in the draft MVP.

## Workstream 2: League and Scoring Engine

Deliverables:
- `LeagueConfig` parser.
- Scoring calculator.
- Roster slot model.
- Flex eligibility model.
- Scoring validator.

Key rules to support first:
- Standard, half PPR, full PPR.
- QB/RB/WR/TE/FLEX/K/DST.
- Bench slots.
- Passing TD value.
- Turnover penalties.
- Yardage and touchdown scoring.

Later rules:
- Superflex.
- Two-QB.
- Tight-end premium.
- Bonuses.
- IDP.
- Return yards.

Definition of done:
- Given a league scoring config and stat line, the engine returns correct fantasy points.
- The engine can explain which rules affected a player's value.

## Workstream 3: Player Data and Rankings

Deliverables:
- Canonical player table.
- Source ID mapping.
- Projection import.
- Ranking import.
- ADP import.
- Source freshness tracking.

First source strategy:
- Yahoo for league/player context.
- One projection or ranking source for MVP.
- Mock/static projection data for development.

Source candidates:
- FantasyPros, if licensed.
- SportsDataIO, if licensed.
- Fantasy Nerds, if licensed.
- nflverse/ffverse for open historical/modeling support.

Definition of done:
- Players are matched across Yahoo and ranking/projection source.
- Each player has projection, rank, ADP, team, position, bye, and source trace.
- Ambiguous matches are flagged.

## Workstream 4: Draft State Engine

Deliverables:
- Draft board model.
- Pick history model.
- Team roster snapshots.
- Available player pool.
- User next-pick calculation.
- Manual override controls.

Required events:
- `player_drafted`
- `manual_player_drafted`
- `undo_manual_update`
- `refresh_from_yahoo`
- `user_turn_started`
- `user_turn_ended`

Definition of done:
- After every pick, the available player pool and all team rosters update correctly.
- Manual overrides trigger the same recalculation as synced picks.
- The engine can run from a mock draft transcript.
- The dashboard exposes compact league-wide roster state for the active league only.
- Yahoo draft-results polling records sync status and keeps manual correction controls available.

## Workstream 5: Draft Valuation Algorithm

Deliverables:
- Value over replacement calculation.
- User roster need score.
- Opponent need model.
- Positional scarcity score.
- Tier drop-off detection.
- Survival probability estimate.
- Final player score.

Initial formula:

```text
final_score =
  0.35 * marginal_team_value
  + 0.20 * value_over_replacement
  + 0.15 * scarcity_urgency
  + 0.10 * market_value_edge
  + 0.10 * ceiling_adjustment
  + 0.05 * roster_construction_fit
  + 0.05 * opponent_blocking_value
  - risk_penalty
```

Definition of done:
- Every available player gets a score.
- Score components are stored separately.
- The top 5 recommendations can be explained without hand-written reasoning.

## Workstream 6: Recommendation Cards

Deliverables:
- Top 5 recommendation output.
- Score breakdown.
- Pros and cons.
- Why now.
- Why not wait.
- Source disagreement warning.
- Pick clock fallback.

Example actions:
- `Show next 10`
- `Why not this player?`
- `Refresh board`
- `I picked someone else`
- `Pause recommendations`

Definition of done:
- When it is the user's turn, the agent returns up to 5 draft options.
- Each option includes a transparent score breakdown and readable reasoning.
- Under short-clock mode, output compresses to top 3 or top 1 plus backup.

## Workstream 7: Mock Mode

Deliverables:
- Fake league fixture.
- Fake player pool.
- Fake draft transcript.
- Mock opponent strategies.
- Dry-run action logger.
- Simulation report.

Mock opponent strategies:
- Follows ADP.
- Needs-based drafter.
- Early QB drafter.
- RB-heavy drafter.
- Yahoo-rank follower.
- Random-within-tier drafter.

Definition of done:
- A full mock draft can run from pick 1 to the final pick.
- The user team gets recommendations at every user pick.
- Final roster review is generated.
- No production connector is called.

Current implementation notes:
- Static mock mode is the default.
- Generated current-player mock mode is available as an opt-in engineering path.
- Simulation reports are persisted under `data/simulations/`.
- Reports include post-draft review output: projected lineup, strengths, weaknesses, waiver watch, and trade-plan ideas.
- Manual board correction controls are available in the dashboard.
- Engine-level manual draft and undo behavior is covered by `npm run test:manual-controls`.
- Saved simulation reports are indexed in `data/simulations/index.json`.
- The dashboard can browse and inspect saved simulation reports.
- Report indexing is covered by `npm run test:reports`.
- Yahoo read-only connector scaffold is available under `src/connectors/yahoo/`.
- Yahoo connector read/write capability boundaries are covered by `npm run test:yahoo-connector`.
- Yahoo league settings normalization is available under `src/connectors/yahoo/yahooLeagueNormalizer.mjs`.
- Yahoo settings parsing is covered by `npm run test:yahoo-normalizer`.
- Yahoo league settings can now be imported into mock mode from the dashboard using the bundled sample, pasted JSON, or a local JSON file.
- Imported Yahoo league rules drive roster slots, draft rounds, scoring summary, recommendations, and manual draft actions.
- League import behavior is covered by `npm run test:league-import`.
- Imported Yahoo league settings are saved locally under `data/leagues/active_yahoo_settings.json` and reloaded on dashboard startup.
- League profile persistence is covered by `npm run test:league-profile-store`.
- Yahoo local dev OAuth endpoints are available in `scripts/serve_mock_draft.mjs`.
- Yahoo tokens are saved locally under ignored `data/auth/yahoo_tokens.json`.
- The dashboard includes a Yahoo Development panel for connect/status/games/teams reads.
- Yahoo token storage is covered by `npm run test:yahoo-token-store`.
- Yahoo setup notes are documented in `docs/YAHOO_DEV_SETUP.md`.
- Yahoo league discovery normalizes connected teams into selectable league options.
- The Yahoo Development panel can discover connected leagues and import selected league settings through the existing league normalizer.
- Saved league profiles now preserve selected Yahoo team metadata for reloads.
- Yahoo league discovery is covered by `npm run test:yahoo-league-discovery`.
- Yahoo draft results sync is available through `GET /api/yahoo/draft-results?leagueKey=...`.
- Yahoo draft result payloads are normalized into pick events with Yahoo player IDs, canonical player mappings, unmapped-player quarantine, and conflict summaries.
- The dashboard can load selected league draft results and apply mapped sequential picks to the local draft board.
- Manual board conflicts and unmapped Yahoo players stop sync with a visible manual-correction message.
- Yahoo draft result normalization and board application are covered by `npm run test:yahoo-draft-results`, `npm run test:yahoo-draft-results-sync`, and `npm run test:yahoo-draft-sync`.
- League-wide roster snapshots and the all-team dashboard roster view are covered by `npm run test:league-rosters`.
- Dashboard Yahoo draft-results polling controls show synced, stale, unavailable, and manual-required status while keeping manual board correction available.

## Workstream 8: UI or Delivery Channel

Recommended first UI:
- Local web dashboard.

Reason:
- Draft boards and score breakdowns need more space than Slack.
- Slack or Teams can be added after the recommendation format is stable.

MVP dashboard views:
- League setup.
- Draft board.
- My roster.
- Available players.
- Recommendation panel.
- Mock mode controls.
- Simulation report.

Definition of done:
- The user can run a mock draft in the browser.
- The user can manually mark players drafted.
- The recommendation panel updates after each pick.

## Workstream 9: Yahoo Connector

Deliverables:
- OAuth setup.
- League discovery for all connected Yahoo fantasy football teams.
- Multi-draft dashboard list.
- League selection and draft switching.
- League settings import from Yahoo API `/league/{league_key}/settings`.
- Normalized `LeagueConfig` generation from Yahoo settings.
- Team/roster import.
- League-wide roster tracking for every fantasy team.
- Opponent roster need modeling.
- Player import.
- Draft results polling through Yahoo API `draftresults`, if validated as reliable.

Definition of done:
- The app can list all current Yahoo fantasy football leagues/teams accessible to the connected user.
- The app can read Yahoo league settings via API and display normalized rules.
- The app stores raw settings responses and parsing warnings for audit.
- The app can keep draft board, recommendations, manual actions, and sync status separate by league/team.
- The app can track and display every fantasy team's roster in each connected league.
- The app can use opponent rosters to estimate positional needs and opponent blocking value.
- The app can map Yahoo players to canonical players.
- Draft results polling is marked with sync confidence and falls back to manual controls when stale or unavailable.
- If sync fails, manual mode still works.

## Workstream 10: Waiver and Trade Foundation

Do not build full waiver/trade execution before the draft MVP works, but design the valuation engine so it can be reused.

Early deliverables:
- Reuse player values after draft.
- Generate post-draft waiver watch list.
- Generate post-draft trade target list.
- Store waiver and trade scores using the same source trace model.
- Score waiver pickups and drop candidates in mock/dry-run mode.
- Score proposed trades and identify likely partner teams from roster needs.
- Generate approval cards and audit entries for future Slack/Teams/Messenger review flows.
- Block production write actions unless future capability gates and explicit approvals are enabled.

Definition of done:
- After a mock draft, the agent can identify roster weaknesses and waiver watch targets.
- Waiver, drop, trade, approval, and guardrail foundations are covered by local tests.

## First Concrete Build Tasks

1. Scaffold the app.
2. Create mock league fixtures.
3. Implement scoring calculator.
4. Implement player value model.
5. Implement draft state updates.
6. Implement top 5 recommendation generation.
7. Build local draft dashboard.
8. Run full mock draft simulation.
9. Add Yahoo read connector.
10. Add Slack/Teams approval later.

## Product Decisions

The initial product decisions are captured in `DECISIONS.md`.

Current decided direction:
- Platform: Yahoo.
- App shape: local web dashboard.
- League format: redraft half PPR snake draft.
- Data: mock/static projections first.
- Paid data: no paid sources yet.
- Draft execution: recommendation-only.
- Mock player pool: fake/static players by default.
- Generated current-player mock pool: opt-in engineering mode.
- K/DST handling: synthetic K/DST allowed in generated mock mode until real records are mapped.
- Simulation reports: save every simulation report.
- Waiver/trade scope: post-draft watch lists only.
