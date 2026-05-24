# Fantasy Football Agent Decisions

This document tracks product and data-source decisions that need owner input. Defaults are chosen so development can continue without blocking, but any "Pending" item should be answered before production use.

## Decisions Needed

### 1. First Fantasy Platform

Status: Decided

Decision: Yahoo.

Why it matters:
- Determines the first league connector.
- Determines OAuth work.
- Determines player availability, roster, and league-settings imports.

Options:
- Yahoo
- Sleeper
- ESPN
- MyFantasyLeague
- Other

Your answer: Yahoo

### 2. First App Shape

Status: Decided

Decision: local web dashboard.

Why it matters:
- Draft boards and recommendation explanations need screen space.
- Local dashboard is faster than hosted auth/security work.

Options:
- Local web dashboard
- Hosted web app
- CLI plus generated reports
- Slack/Teams bot first

Your answer: local web dashboard

### 3. First League Format

Status: Decided

Decision: redraft, half PPR, snake draft.

Why it matters:
- Sets the first scoring calculator scope.
- Sets draft valuation defaults.
- Keeps MVP narrow enough to test.

Options:
- Redraft standard
- Redraft half PPR
- Redraft full PPR
- Keeper
- Dynasty
- Best ball
- Superflex / two-QB

Your answer: redraft, half PPR, snake draft

### 4. First Projection/Ranking Provider

Status: Decided

Decision: mock/static projections first.

Why it matters:
- Draft recommendations require projections, rankings, or ADP.
- Paid providers may have licensing/API requirements.

Options:
- Mock/static first
- FantasyPros
- SportsDataIO
- Fantasy Nerds
- nflverse/open modeling first
- Other

Your answer: mock/static first

### 5. Paid Data Budget

Status: Decided

Decision: no paid sources yet.

Why it matters:
- Projection, injury, and media/news data quality improves with paid sources.
- We should avoid building against a source we will not license.

Options:
- No paid sources yet
- Low budget
- Moderate budget
- Best available data regardless of cost

Your answer: no paid sources yet

### 6. Media Monitoring Scope

Status: Decided

Decision: national plus local beat writers, include X/social posts, and add podcasts/newsletters later.

Why it matters:
- X/social monitoring can become noisy and may require paid API access.
- We need source trust scoring before media affects recommendations.

Options:
- National fantasy/news only
- National plus local beat writers
- Include X/social posts
- Include podcasts/newsletters later

Your answer: national plus local beat writers; include X/social posts; include podcasts/newsletters later

### 7. Draft Execution Policy

Status: Decided

Decision: recommendation-only.

Why it matters:
- Yahoo live draft pick submission is not a safe first automation target.
- Recommendation-only avoids account/platform risk.

Options:
- Recommendation-only
- Assisted execution where supported
- Autonomous only for low-risk non-draft actions later

Your answer: recommendation-only

### 8. Dashboard Recommendation Detail

Status: Decided

Decision: show full score breakdown by default.

Why it matters:
- Draft decisions happen quickly.
- Too much math can slow you down, but hidden reasoning makes the agent harder to trust.

Options:
- Show full score breakdown by default
- Show compact cards by default with expandable details
- Show only the best pick under clock pressure

Your answer: show full score breakdown by default

### 9. Mock Mode Player Pool

Status: Decided

Decision: fake/static players only for now.

Why it matters:
- Static data makes bugs easier to reproduce.
- Real player data makes mock drafts feel closer to the actual Yahoo draft room.

Options:
- Fake/static players only for now
- Real current players only
- Both fake fixtures and real current players

Your answer: fake/static players only for now

### 10. Simulation Reports

Status: Decided

Decision: save every simulation report.

Why it matters:
- Lets us compare recommendation quality across algorithm changes.
- Gives us evidence when a ranking tweak helps or hurts.

Options:
- Save every simulation report
- Save only named simulations
- Do not save reports yet

Your answer: save every simulation report

### 11. First Waiver and Trade Scope

Status: Decided

Decision: post-draft watch lists only.

Why it matters:
- Waiver and trade scoring should reuse the draft valuation engine.
- Full Yahoo write actions should wait until mock and dry-run safety is solid.

Options:
- Post-draft watch lists only
- Full waiver recommendations in MVP
- Full trade scoring in MVP
- Full waiver and trade workflows in MVP

Your answer: post-draft watch lists only

### 12. Generated Current-Player Mock Pool

Status: Decided

Decision: keep generated current-player mock pool as an optional engineering mode, while static fixtures remain the default.

Why it matters:
- You decided fake/static players should be the default for now.
- The generated pool is useful for testing real player identity mapping and larger draft boards, but its projections are synthetic and should not be treated as real advice.

Options:
- Keep generated pool as opt-in engineering mode
- Make generated current-player pool the default mock mode
- Remove generated pool until a real projection provider is connected

Your answer: keep generated pool as opt-in engineering mode

### 13. Synthetic Kicker and Defense Handling

Status: Decided

Decision: keep synthetic team kickers and defenses in generated mock mode until real Yahoo/source records are mapped.

Why it matters:
- The normalized player database does not always provide clean, draftable K/DST records.
- Mock drafts need K/DST availability to validate roster-completion logic.

Options:
- Keep synthetic K/DST for generated mock mode
- Hide K/DST until real provider data is connected
- Build real K/DST mapping now

Your answer: keep synthetic K/DST for generated mock mode

## Defaults I Will Use Until You Decide

- Platform: Yahoo decided
- App shape: local web dashboard decided
- League format: redraft half PPR snake draft decided
- Data provider: mock/static projections first decided
- Paid data: no paid sources yet decided
- Media scope: national plus local beat writers, X/social posts, podcasts/newsletters later decided
- Draft execution: recommendation-only decided
- Recommendation detail: show full score breakdown by default decided
- Mock player pool: fake/static players only for now decided
- Simulation reports: save every simulation report decided
- Waiver/trade scope: post-draft watch lists only decided
- Generated current-player pool: opt-in engineering mode decided
- K/DST records: synthetic in generated mock mode decided

## Recently Executed

- Seeded canonical players from Sleeper.
- Added DynastyProcess/nflverse fantasy player ID crosswalk.
- Quarantined conflicting external IDs instead of using them as active mappings.
- Added SQLite database schema and loader for player identity data.
- Added a mock-mode live draft copilot dashboard.
- Added a reusable scoring engine, draft state engine, and top-5 recommendation model.
- Added a Node mock draft runner and local static server.
- Added optional generated current-player mock pools from normalized player data.
- Added synthetic K/DST records for generated mock-mode roster completion.
- Added persisted mock draft simulation reports under `data/simulations/`.
- Added roster-completion pressure so mock drafts fill required QB, TE, K, and DST slots.
- Added post-draft review output with projected lineup, bench, strengths, weaknesses, waiver watch, and trade-plan ideas.
- Expanded static mock fixtures so the default 8-team, 10-round mock draft completes.
- Added manual draft-board controls: pause/resume, undo last pick, draft selected player for current team, and mark selected player as the user's pick.
- Added manual-control smoke test coverage.
- Added simulation report index generation and dashboard report viewer.
- Added report index smoke test coverage.
- Added Yahoo read-only connector scaffold with OAuth URL generation, read endpoint helpers, and blocked write methods.
- Added Yahoo connector smoke test coverage.
- Added Yahoo league-settings normalizer for roster slots, scoring modifiers, and draft metadata.
- Added Yahoo settings fixture and normalizer smoke test coverage.
- Added dashboard league settings import from bundled Yahoo sample, pasted JSON, or local JSON file.
- Added league import smoke test coverage.
- Added dashboard warning when imported Yahoo draft rules exceed the active mock player pool size.
- Added local saved Yahoo league settings profile under `data/leagues/active_yahoo_settings.json`.
- Added server API endpoints to load and save the active league profile.
- Added league profile store smoke test coverage.
- Added Yahoo Development dashboard panel for local OAuth status, connect URL, user NFL games, and user NFL teams.
- Added local Yahoo token store under ignored `data/auth/yahoo_tokens.json`.
- Added refresh-token support to the Yahoo read-only connector.
- Added Yahoo token store smoke test coverage.
- Added `docs/YAHOO_DEV_SETUP.md` for local credential and callback setup.
- Added Yahoo league discovery normalizer for connected team payloads.
- Added Yahoo Development selector for discovered leagues and import of selected league settings.
- Preserved selected Yahoo team metadata in saved league profiles.
- Added Yahoo draft-results sync endpoint, normalizer, and dashboard control.
- Added Yahoo player ID matching through canonical external IDs with unmapped-player quarantine.
- Added manual conflict detection for Yahoo draft sync versus local board state.
- Added draft-results sync tests.
- Added league-scoped roster snapshot generation and a compact all-team roster view in the dashboard.
- Added read-only Yahoo draft-results polling controls with sync status, highest observed pick, stale/unavailable/manual-required states, and manual fallback.
- Added player pool data-quality audit scaffolding, including K/DST coverage checks and Yahoo external-ID gap detection.
- Added waiver pickup ranking, drop-candidate scoring, trade proposal scoring, and trade partner discovery foundations for mock/dry-run mode.
- Added approval card, approval audit, and production action guardrails for Slack/Teams/Messenger-style review flows.

## Open Strategy Decisions

These questions were carried forward from the older planning file in `/Users/matthuth/Documents/New project/DECISIONS.md`. They are not blockers for the current local mock/dashboard build, but they should be answered before real-season usage or broader automation.

### League Scope

- Should the product optimize for one Yahoo league first, or support multiple Yahoo leagues from day one?

### Automation Policy

- Can low-risk actions become auto-approved later, or should every paid Yahoo league action always require explicit approval?
- Should every production action require a successful dry run first?
- Should mock mode keep a full decision log?

### Draft Strategy Preferences

- Which draft strategy profile should the agent prefer by default: balanced, hero RB, zero RB, robust RB, elite QB, or best player available?
- How aggressive should the agent be by default: safe floor, balanced, or upside-heavy?
- Should the agent avoid specific players or NFL teams you personally dislike?
- Should the agent prefer QB/WR stacking when values are close?

### Recommendation Workflow

- Should draft alerts be dashboard-only, or should Slack/Teams alerts be added?
- Should manual draft-board corrections stay in the main dashboard, or move to a separate admin/debug panel?

### Waiver and Trade Strategy

- Should waiver recommendations include FAAB dollar ranges?
- Should trade scoring optimize weekly wins, playoff odds, long-term roster value, or a blended score?

## Production Blockers To Resolve Before Real-Season Use

- Test Yahoo OAuth and read-only draft-results polling against a real Yahoo league or controlled Yahoo mock draft.
- Choose and license or approve the first real projection/ranking/ADP source.
- Complete Yahoo player ID mappings for the active player pool, especially K/DST records.
- Decide the first approval channel implementation: Slack, Teams, Messenger, email, or dashboard-only.
- Keep all Yahoo write actions disabled until capability gating, user approval, and paid-league confirmation are verified end to end.
