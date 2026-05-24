# Fantasy Football Agent Requirements

## 1. Product Goal

Build a fantasy football agent that helps manage a Yahoo fantasy football team through a local web dashboard. The first product milestone is a recommendation-only live draft copilot with mock mode.

The product should help the user draft better by understanding league settings, roster needs, player value, positional scarcity, and source confidence. It should explain recommendations clearly and preserve enough data to audit why a recommendation was made.

The product does not guarantee winning a league. Its practical goal is to improve expected draft quality, roster construction, and future weekly decision-making.

## 2. Decided Scope

- First platform: Yahoo.
- First app shape: local web dashboard.
- First league format: redraft, half PPR, snake draft.
- First projection/ranking source: mock/static projections.
- Paid data: no paid sources yet.
- Media scope: national plus local beat writers, include X/social posts, add podcasts/newsletters later.
- Draft execution: recommendation-only.
- Dashboard recommendation detail: show full score breakdown by default.
- Mock mode player pool: fake/static players only for now.
- Simulation reports: save every simulation report.
- First waiver/trade scope: post-draft watch lists only.
- Generated current-player mock pool: opt-in engineering mode.
- Synthetic K/DST records: allowed in generated mock mode until real Yahoo/source records are mapped.

## 3. MVP Summary

The MVP is a local browser-based Yahoo live draft copilot in mock mode.

The MVP must:
- Load a mock Yahoo-style league.
- Use redraft half-PPR snake-draft defaults.
- Load a fake/static player pool.
- Run a full mock draft from pick 1 to final pick.
- Generate top draft recommendations when it is the user's turn.
- Show full score breakdowns for each recommendation.
- Let the user manually draft players.
- Update draft board, available players, and roster needs after every pick.
- Save every completed simulation report.
- Generate post-draft waiver and trade watch lists only.

The MVP must not:
- Submit draft picks to Yahoo.
- Perform browser automation against Yahoo.
- Require paid data providers.
- Treat synthetic/mock projections as real fantasy advice.
- Execute waivers, trades, lineup moves, or FAAB bids.
- Expose Yahoo write capabilities before explicit approval-mode implementation.

## 4. Functional Requirements

### 4.1 Local Dashboard

The system must provide a local web dashboard.

The dashboard must show:
- League setup summary.
- Draft board.
- User roster.
- Available player pool.
- Recommendation panel.
- Full score breakdown for recommended picks.
- Mock mode controls.
- Simulation report summary.

The dashboard must support:
- Starting or resetting a mock draft.
- Importing Yahoo league settings from the bundled sample.
- Importing Yahoo league settings from pasted JSON.
- Importing Yahoo league settings from a local JSON file.
- Discovering connected Yahoo leagues from the authorized user's NFL teams.
- Selecting a Yahoo league and importing its live settings.
- Saving the active imported Yahoo league settings locally.
- Reloading saved Yahoo league settings on dashboard startup.
- Manually marking a player as drafted.
- Pausing and resuming mock draft recommendations.
- Undoing the last manual pick.
- Advancing draft picks.
- Viewing top recommendations on the user's turn.
- Viewing final roster review after a draft.
- Browsing saved simulation reports.
- Opening a saved simulation report from the dashboard.
- Viewing compact league-wide rosters for all teams during a draft.
- Starting and stopping read-only Yahoo draft-results polling when a Yahoo league is selected.

### 4.2 Mock Draft Mode

Mock mode must use fake/static players by default.

Mock mode must:
- Use deterministic fixture data unless deliberately randomized.
- Simulate opponent picks.
- Support a snake draft order.
- Track every pick.
- Maintain team rosters.
- Remove drafted players from the available pool.
- Generate recommendations on every user pick.
- Complete a full draft without production Yahoo access.

Generated current-player mock mode may exist as an opt-in engineering mode. It must not become the default mock mode until explicitly decided later.

Generated current-player mock mode may use synthetic kicker and defense records until real Yahoo/source records are mapped. Synthetic records must be labeled or source-traced so they are not mistaken for real provider data.

Mock mode must show a visible mock/dry-run state in the UI.

### 4.3 Draft State Engine

The draft state engine must track:
- Draft order.
- Current pick number.
- Current round.
- Current team on the clock.
- Pick history.
- Available players.
- Team rosters.
- League-wide roster snapshots scoped to the active league.
- User roster needs.
- Manual draft events.

The engine must support these events:
- `player_drafted`
- `manual_player_drafted`
- `undo_manual_update`
- `pause_recommendations`
- `resume_recommendations`
- `user_turn_started`
- `user_turn_ended`
- `draft_completed`

After every pick, the system must recalculate:
- Available players.
- Team roster state.
- User roster needs.
- Recommendation scores.

### 4.4 Scoring Engine

The initial scoring engine must support redraft half-PPR scoring.

The scoring engine must support:
- Passing yards.
- Passing touchdowns.
- Interceptions.
- Rushing yards.
- Rushing touchdowns.
- Receptions.
- Receiving yards.
- Receiving touchdowns.
- Fumbles lost.
- Kicker scoring in mock mode.
- Defense/special teams scoring in mock mode.

The scoring engine must be able to explain how a projected point total was calculated.

### 4.5 Player Valuation

Every available player must receive a draft score.

The draft score must include separate components for:
- Marginal team value.
- Value over replacement.
- Positional scarcity.
- Market value edge.
- Ceiling adjustment.
- Roster construction fit.
- Opponent blocking value.
- Risk penalty.

The system must store or return each score component separately so the dashboard can show the full score breakdown.

### 4.6 Recommendations

On the user's turn, the system must recommend up to 5 players.

Each recommendation must include:
- Player name.
- Team.
- Position.
- Overall score.
- Full score breakdown.
- Why this player now.
- Main risk.
- Roster fit note.
- Source trace.

Recommendation cards must be generated from score data, not manually written one-off text.

### 4.7 Simulation Reports

Every completed mock draft simulation must save a report.

Each report must include:
- Timestamp.
- League settings.
- Draft slot.
- Full pick transcript.
- User roster.
- User recommendations per pick.
- Final roster review.
- Waiver watch list.
- Trade watch list.
- Summary of model settings used.

Simulation reports must be saved under `data/simulations/`.

The system must maintain a report index so saved reports can be listed and opened from the dashboard.

### 4.8 Post-Draft Watch Lists

After a mock draft, the system must generate post-draft watch lists only.

The initial post-draft outputs must include:
- Waiver watch list.
- Trade target watch list.
- Roster weakness summary.
- Drop-candidate scoring in mock/dry-run mode.
- Trade proposal scoring in mock/dry-run mode.

The system must not generate production waiver claims or trade offers in the MVP.

### 4.9 Yahoo Read-Only Connector

The initial Yahoo connector must be read-only.

The connector may support:
- OAuth authorization URL generation.
- Token exchange.
- Refresh-token exchange.
- Local development token storage.
- Reading user NFL fantasy games.
- Reading user NFL fantasy teams.
- Reading league settings.
- Reading league teams.
- Reading league players.
- Reading league draft results.
- Reading team rosters.
- Reading league transactions.

The connector must block:
- Setting lineups.
- Adding players.
- Dropping players.
- Submitting waiver claims.
- Proposing trades.
- Accepting trades.
- Submitting draft picks.

Write actions can only be added later behind explicit approval and dry-run controls.

Yahoo league settings import must normalize:
- League ID and key.
- League name.
- Season.
- Draft type and draft status.
- Roster positions into internal roster slots.
- Stat modifiers into internal scoring keys.
- Warnings for missing roster or scoring data.

The dashboard must apply imported Yahoo league settings to:
- Draft rounds.
- Roster slots.
- Scoring summary.
- Recommendation calculations.
- Manual draft actions.

If imported league rules request more picks than the active mock player pool supports, the dashboard must show a visible warning instead of silently pretending the draft can fully complete.

The local dashboard must show Yahoo development status:
- Whether Yahoo app credentials are configured.
- Whether a local read-only token is saved.
- Whether a refresh token is available.
- Token expiry where available.
- Connected Yahoo league options after discovery.
- Draft-results sync status after loading Yahoo draft results.
- Manual correction requirements for unmatched players or conflicts.

Yahoo tokens must be stored in a git-ignored local path.

Saved league profiles must preserve selected Yahoo team metadata when a league is imported from connected Yahoo discovery.

Yahoo draft-results sync must:
- Read selected league draft results through the read-only Yahoo connector.
- Normalize Yahoo draft result rows into internal draft events.
- Match Yahoo player IDs through the canonical external ID map.
- Quarantine unmapped Yahoo players instead of forcing a match.
- Apply mapped sequential picks to the local draft board.
- Stop and show a manual-correction message when a pick conflicts with manual board state.

## 5. Data Requirements

### 5.1 Canonical Player Data

The system must maintain its own canonical player table.

The canonical player table must include:
- Internal `player_id`.
- Display name.
- Team.
- Positions.
- Eligible positions.
- Fantasy relevance flag.
- Current status.
- Injury status where available.
- Source player ID.
- Last verified timestamp.

### 5.2 External ID Mapping

The system must maintain external ID mappings for multiple sources.

Supported external ID sources should include, where available:
- Sleeper.
- Yahoo.
- ESPN.
- GSIS.
- Sportradar.
- FantasyData.
- FantasyPros.
- MyFantasyLeague.
- Fleaflicker.
- Rotowire.
- Rotoworld.
- PFF.
- Pro Football Reference.
- CBS.

External source IDs that map to multiple canonical players must be quarantined, not used as active mappings.

### 5.3 Data Sources

The initial player data pipeline must support:
- Sleeper player import.
- DynastyProcess/nflverse player ID crosswalk import.
- SQLite database loading from normalized player data.

The initial projection/ranking pipeline must use mock/static projections.

### 5.4 Database

The system must load player identity data into SQLite.

The SQLite database must include:
- `players`.
- `player_external_ids`.
- `import_runs`.
- `sleeper_external_id_conflicts`.
- `dynastyprocess_unmatched_playerids`.
- `dynastyprocess_match_conflicts`.
- `skipped_external_id_conflicts`.

The database load must pass SQLite integrity checks.

## 6. Yahoo Requirements

Yahoo is the first production fantasy platform.

The MVP must be designed so Yahoo can later provide:
- User's full list of current Yahoo fantasy football leagues.
- Draft-capable Yahoo leagues and teams connected to the user's Yahoo account.
- League settings.
- Roster positions.
- Teams.
- User team identity.
- Player context.
- Draft results polling if reliable.

The MVP must not:
- Submit Yahoo draft picks.
- Automate Yahoo's browser draft room.
- Depend on hidden Yahoo endpoints.
- Require Yahoo OAuth for fully fake mock scenarios.

When Yahoo read integration is added, the system must still support manual correction if sync is delayed or unavailable.

### 6.1 Yahoo League Settings Import

Yahoo league settings must be imported through the Yahoo Fantasy Sports API as the primary path, not by user file upload.

Feasibility finding:
- Yahoo's official Fantasy Sports API documents a league settings endpoint shaped like `/fantasy/v2/league/{league_key}/settings`.
- The settings response includes draft type, scoring type, playoff settings, FAAB/trade settings, roster positions, stat categories, and stat modifiers.

The system must import and normalize:
- Draft type.
- Scoring type.
- Roster positions and counts.
- Bench slots.
- Flex positions.
- Kicker and defense slots.
- Stat categories.
- Stat modifiers/scoring values.
- FAAB usage where available.
- Trade deadline and trade review settings where available.
- Playoff settings where available.

The system must store:
- Raw Yahoo settings response for audit.
- Normalized `LeagueConfig`.
- Import timestamp.
- Source status and warnings.

The dashboard must show:
- League settings summary.
- Roster slot summary.
- Scoring summary.
- Any unsupported settings or parsing warnings.

Manual entry or upload may exist only as a fallback when Yahoo settings cannot be fetched or parsed.

### 6.2 Yahoo Multi-Draft Connection

When the user connects Yahoo, the agent should connect to all of the user's Yahoo fantasy football drafts that are accessible through the approved Yahoo API scope.

The system must:
- Discover the user's current Yahoo fantasy football leagues and teams.
- Identify which leagues have upcoming, active, or recently completed drafts.
- Show all connected drafts in the dashboard.
- Keep each league's draft board, roster, scoring rules, recommendations, and sync status separate.
- Allow the user to switch between drafts without losing state.
- Warn when two drafts are active or upcoming at overlapping times.
- Avoid applying a recommendation, manual pick, or draft-board update from one league to another league.
- Store draft state by Yahoo `league_key` and `team_key`.
- Store Yahoo sync status separately for each connected draft.

The dashboard should make clear:
- League name.
- Team name.
- Draft status.
- Draft time if available.
- Sync status.
- Whether the draft is mock/manual/live-read mode.

If Yahoo API access only returns some leagues or cannot expose draft timing/status reliably, the dashboard must allow manual league/draft setup as a fallback.

### 6.3 League-Wide Roster Tracking

For each connected Yahoo league, the agent must track rosters for every fantasy team in the league, not only the user's team.

The system must track for each team:
- Yahoo `team_key`.
- Team name.
- Manager name or nickname where available.
- Rostered players.
- Drafted players.
- Starting lineup slots where available.
- Bench slots where available.
- Open roster slots.
- Position counts.
- Bye-week exposure when available.
- Team needs by position.

During a draft, the system must update every team roster after each observed or manually entered pick.

League-wide roster tracking must support:
- Opponent need modeling.
- Positional run detection.
- Scarcity and tier-drop decisions.
- Opponent blocking value.
- Trade target discovery after the draft.
- Waiver watch-list context after the draft.

The dashboard should expose opponent rosters in a compact league roster view so the user can inspect what each manager has drafted.

The system must never mix roster state across leagues. All roster data must be scoped by Yahoo `league_key` and `team_key`.

### 6.4 Yahoo Draft Results Polling

The system should attempt Yahoo draft results polling as the preferred way to learn what other teams have drafted during a Yahoo draft.

Feasibility finding:
- Yahoo's official Fantasy Sports API supports authenticated league reads and exposes league metadata such as `draft_status`.
- Mature community wrappers use a Yahoo Fantasy API endpoint shaped like `/fantasy/v2/league/{league_key}/draftresults` and parse returned `pick`, `round`, `team_key`, and `player_key` values.
- The currently accessible official Yahoo guide does not clearly document `draftresults` in the League sub-resource list, so live draft polling must be treated as available-but-unverified until tested against a real Yahoo league.

Implementation requirements:
- Build Yahoo draft polling as read-only.
- Poll only through OAuth-authorized Yahoo API requests.
- Store each poll timestamp, response status, and highest observed pick.
- Convert returned Yahoo `player_key` values to canonical players through `player_external_ids`.
- Update the draft board only when new picks are observed.
- Mark Yahoo draft sync with a confidence/status value such as `synced`, `stale`, `unavailable`, or `manual_required`.
- If polling fails, lags, or returns incomplete data, the dashboard must keep manual controls available.

The agent must not:
- Submit draft picks through this path.
- Scrape hidden Yahoo draft-room endpoints.
- Depend on browser automation for Yahoo draft sync.
- Treat Yahoo draft polling as production-ready until validated during an actual draft or controlled Yahoo mock draft.

## 7. Media Requirements

The planned media layer must support:
- National fantasy news.
- Local beat writer reporting.
- X/social posts.
- Podcasts/newsletters later.

Media signals must be scored by:
- Source type.
- Source trust.
- Recency.
- Corroboration.
- Player relevance.
- Signal type.
- Severity.

Media-only availability changes must require stronger corroboration before they materially change player recommendations.

Media monitoring is not required for the first mock draft MVP.

## 8. Safety and Compliance Requirements

The system must be approval-first.

For the draft MVP:
- Recommendations are allowed.
- Draft pick submission is not allowed.
- Yahoo browser automation is not allowed.
- Paid data sources are not required.
- Production Yahoo writes are not allowed.

For future production modes:
- Write actions must be capability-gated.
- Write actions must be approval-gated.
- Approval and alert channels must support dashboard, email, and Slack.
- Paid-league actions must require a separate paid-league confirmation.
- Payment and league entry actions must remain outside agent execution.
- Paid leagues must require stronger confirmation.
- The system must not deposit funds, withdraw funds, enter paid contests, or modify payment settings.
- The system must not collect or store Yahoo passwords.
- OAuth must be used for Yahoo access when needed.

## 9. Non-Goals

The MVP will not include:
- Production draft pick submission.
- Production waiver submission.
- Production trade submission.
- Full Yahoo OAuth connector.
- Paid projection provider integration.
- Dynasty modeling.
- Best ball modeling.
- Auction/salary cap draft support.
- Autonomous moves.
- Production email or Slack approval flows.
- Teams, Messenger, SMS, or mobile approval flows.
- Mobile app.

## 10. Acceptance Criteria

The MVP is acceptable when:
- The local dashboard starts successfully.
- A mock league can be loaded.
- A fake/static player pool can be loaded.
- A full snake mock draft can run to completion.
- The user receives up to 5 recommendations at each user pick.
- Each recommendation shows full score breakdown by default.
- Manual draft picks update board state and recommendations.
- Pause/resume and undo controls work in mock mode.
- Every completed simulation saves a report under `data/simulations/`.
- Saved simulation reports are indexed and viewable from the dashboard.
- A post-draft waiver watch list and trade watch list are generated.
- No production Yahoo write path exists.
- Player data can be loaded into SQLite.
- SQLite integrity check returns `ok`.

## 11. Current Implementation Status

Completed:
- Created canonical player import from Sleeper.
- Created DynastyProcess/nflverse external ID merge.
- Quarantined conflicting source IDs.
- Created SQLite schema and player database loader.
- Created a mock-mode local draft dashboard.
- Created scoring, draft state, reporting, and mock draft modules.
- Saved simulation reports.

Current data load:
- `12,188` canonical players.
- `133,002` active external ID mappings.
- `4,395` fantasy-relevant players after crosswalk enrichment.
- `3,302` active fantasy-relevant players after crosswalk enrichment.

## 12. Open Questions

The core decision set is complete.

Additional engineering decisions decided:
- Generated current-player mock pool should remain an opt-in engineering mode while static fixtures remain the default.
- Synthetic kicker and defense records should remain in generated mock mode until real Yahoo/source records are mapped.
