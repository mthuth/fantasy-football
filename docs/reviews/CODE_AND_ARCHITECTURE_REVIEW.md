# Code and Architecture Review

Repository reviewed: `mthuth/fantasy-football`

Review date: 2026-05-23

## Executive Summary

The GitHub repository is currently empty, and the local checkout only contains
planning documents. There is no implementation code to approve, test, or review
for correctness yet.

The main development feedback is therefore architectural: the team should not
start by building broad fantasy-football features or a Yahoo auto-drafter. The
first build should establish the internal contracts, mock draft flow,
explainable recommendation engine, canonical player identity model, and
approval/audit trail.

## Code Review Findings

### Blocking: there is no implementation code to review

GitHub returned `This repository is empty` when checking the expected entry
points (`README.md`, `package.json`, and `pyproject.toml`). The local workspace
contains only:

- `DECISIONS.md`
- `DEV_ARCHITECTURE_FEEDBACK.md`
- `CODE_AND_ARCHITECTURE_REVIEW.md`

Because there are no source files, tests, build configuration, fixtures, or
runtime entry points, development has not yet reached a reviewable code state.

Required developer action:

1. Add a project scaffold with a clear runtime choice.
2. Add source folders, fixtures, and tests.
3. Add a `README.md` with setup and mock-run instructions.
4. Add CI or at least a local test command before submitting PRs.

## Architecture Findings

### 1. MVP scope needs to be locked before code starts

The first release should be a Yahoo live-draft copilot with mock mode. Avoid
starting with waivers, trades, dynasty, best ball, multi-platform support, or
fully autonomous actions.

Developer feedback:

- Build live draft recommendations first.
- Show top recommendations, score components, and pros/cons.
- Add manual board correction and immediate recalculation.
- Defer non-draft features until the draft loop is stable.

### 2. Do not assume Yahoo live pick submission exists

No code path should assume that Yahoo exposes a supported live draft write API.
Until that is verified, the product should help the user make the pick manually.

Developer feedback:

- Treat Yahoo as read-only plus manual execution for the first milestone.
- Build dry-run payload generation separately from execution.
- Require explicit approval before any future write-capable action.

### 3. Recommendation logic must be platform-independent

The recommendation engine should not consume Yahoo API objects directly. It
should work from internal models so mock mode, Yahoo integration, and future
platforms can all share the same decision logic.

Developer feedback:

- Create adapters that normalize platform data.
- Keep the scoring engine pure and testable.
- Use fixtures to test draft states without credentials.

Suggested core contracts:

- `Player`
- `ExternalPlayerId`
- `LeagueSettings`
- `RosterState`
- `DraftState`
- `Recommendation`
- `RecommendationExplanation`
- `ApprovalDecision`
- `DecisionLogEntry`
- `SourceObservation`

### 4. Canonical player identity must be internal

The system should not use Yahoo, Sleeper, ESPN, GSIS, or any other vendor ID as
the permanent player ID. Vendor IDs should live in a mapping table.

Developer feedback:

- Use deterministic internal player IDs.
- Store source-specific IDs separately.
- Preserve raw source payloads.
- Quarantine identity conflicts instead of silently merging them.

### 5. Approval and audit logging are core system requirements

Paid-league actions and future write actions need explicit approval and durable
records. This should not be added after the fact.

Developer feedback:

- Log every recommendation shown to the user.
- Log alternatives considered, score components, and explanation text.
- Log user approvals, rejections, manual overrides, and timestamps.
- Use the same logging path in mock mode and production.

### 6. Mock mode should use production decision logic

Mock mode should swap connectors, not the recommendation engine. Otherwise, the
team will test a different system than the one used in real drafts.

Developer feedback:

- Support replayable draft events.
- Support manual board corrections.
- Generate post-draft reports.
- Keep mock and production recommendation outputs structurally identical.

## Recommended First PRs

1. `PR 1: Project scaffold and domain contracts`
   - Add runtime, folder structure, README, test command, and core domain types.

2. `PR 2: Mock draft fixtures and replay engine`
   - Add sample league settings, players, draft events, and replay logic.

3. `PR 3: Canonical player table and external ID mappings`
   - Add player seed format, source mapping format, and conflict quarantine
     shape.

4. `PR 4: Explainable recommendation engine`
   - Add top-five recommendations with score breakdowns, pros/cons, and tests.

5. `PR 5: Local draft dashboard`
   - Add a focused UI for board state, recommendations, explanations, and manual
     correction.

6. `PR 6: Yahoo read-only adapter`
   - Normalize Yahoo league, roster, and draft state into internal contracts.

## Review Gate for Future PRs

Future PRs should be sent back for changes if they:

- Add autonomous Yahoo actions before a verified write path exists.
- Couple recommendation logic directly to Yahoo API shapes.
- Use vendor player IDs as canonical identities.
- Skip approval or audit logging for paid-league actions.
- Add broad non-MVP features before the live draft loop works.
- Lack fixtures or tests for recommendation behavior.
- Cannot run in mock mode without credentials.

