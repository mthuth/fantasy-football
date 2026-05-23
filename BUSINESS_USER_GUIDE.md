# Fantasy Football Agent Business User Guide

## Purpose

The Fantasy Football Agent is a local web dashboard that helps a Yahoo fantasy football manager make better draft decisions. It works as a draft copilot: it watches the draft board, understands league settings, tracks roster needs across the league, and recommends players with a clear score breakdown.

The first version is recommendation-only. The agent does not draft players for the user, does not automate the Yahoo draft room, and does not submit waivers or trades.

## Who Uses It

The primary user is a fantasy football manager who participates in one or more Yahoo redraft leagues and wants a disciplined assistant during draft preparation and live drafts.

The agent is especially useful for managers who:
- Have multiple Yahoo drafts.
- Want recommendations tailored to league settings.
- Want to understand why one player is recommended over another.
- Want to track every team's draft behavior.
- Want post-draft watch lists for roster cleanup.

## What The Agent Does

The agent helps the user:
- Connect to Yahoo leagues.
- Import Yahoo league settings through the Yahoo API.
- See all connected Yahoo drafts in one dashboard.
- Track the user's roster and every opponent roster.
- Follow the draft board as players are selected.
- Recommend up to 5 draft options on the user's turn.
- Show the full score breakdown for each recommendation.
- Explain roster fit, scarcity, risk, and value.
- Save every mock draft simulation report.
- Produce post-draft waiver and trade watch lists.

## What The Agent Does Not Do

The agent does not:
- Submit draft picks.
- Click buttons in Yahoo.
- Scrape hidden Yahoo draft-room endpoints.
- Execute waiver claims.
- Submit trades.
- Make autonomous roster changes.
- Require paid data sources for the first version.
- Replace the user's judgment.

The user remains responsible for making final decisions and manually drafting players in Yahoo.

## Basic Workflow

### 1. Open The Local Dashboard

The user starts the local web dashboard on their computer and opens it in a browser.

The dashboard is the main operating screen. It shows league setup, draft board, available players, recommendations, rosters, and simulation reports.

### 2. Connect Yahoo

The user connects their Yahoo account through the approved Yahoo OAuth flow.

After connection, the agent should discover the user's Yahoo fantasy football leagues and teams. If the user has multiple Yahoo drafts, the dashboard should list each draft separately.

For each draft, the dashboard should show:
- League name.
- Team name.
- Draft status.
- Draft time if available.
- Sync status.
- Whether the draft is mock, manual, or live-read mode.

### 3. Import League Settings

The agent imports league settings through the Yahoo API.

The agent should pull:
- Draft type.
- Scoring type.
- Roster positions.
- Bench slots.
- Flex positions.
- Kicker and defense slots.
- Stat categories.
- Scoring values.
- FAAB settings where available.
- Trade deadline where available.
- Playoff settings where available.

The dashboard summarizes the settings so the user can confirm the agent understands the league correctly.

If Yahoo settings cannot be fetched or parsed, the user can fall back to manual setup or uploaded/pasted settings.

### 4. Review Drafts

The user reviews all connected drafts.

Each draft should have its own state. The agent must not mix rosters, scoring, draft boards, or recommendations between leagues.

If two drafts overlap, the dashboard should warn the user so they can plan ahead.

### 5. Practice In Mock Mode

Before using the agent with a real draft, the user can run mock drafts.

Mock mode uses fake/static player data by default so results are repeatable. This helps test the recommendation model, roster strategy, and dashboard workflow.

Mock mode can also support an optional engineering mode with generated current-player data. That mode is for testing identity mapping and larger player pools, not for real advice until real projections are connected.

### 6. Use The Agent During A Draft

During a live Yahoo draft, the agent tries to understand picks in two ways:

1. Yahoo draft results polling, if reliable.
2. Manual board controls if Yahoo sync is delayed or unavailable.

When another manager drafts a player, the agent updates:
- Draft board.
- Available players.
- That manager's roster.
- Position scarcity.
- Team needs.
- Future recommendations.

When it is the user's turn, the agent recommends up to 5 players.

Each recommendation includes:
- Player.
- Position.
- Team.
- Overall score.
- Full score breakdown.
- Roster fit.
- Positional scarcity.
- Risk.
- Why now.
- Source trace.

The user reviews the recommendation, then manually drafts the selected player in Yahoo.

### 7. Correct The Board If Needed

If Yahoo sync is slow or wrong, the user can manually correct the draft board.

Manual controls should support:
- Marking a player as drafted by another team.
- Marking a player as the user's pick.
- Undoing the last manual pick.
- Pausing recommendations.
- Resuming recommendations.
- Refreshing from Yahoo when available.

Manual corrections should trigger the same recalculation as synced Yahoo picks.

### 8. Review Opponent Rosters

The agent tracks every fantasy team's roster in each connected league.

This helps the user understand:
- Which teams need running backs.
- Which teams are likely to draft quarterbacks soon.
- Whether a positional run is happening.
- Whether blocking an opponent has value.
- Which teams may become trade partners later.

Opponent roster tracking is also useful after the draft for trade and waiver planning.

### 9. Finish The Draft

After the draft ends, the agent generates a post-draft review.

The review should include:
- Final user roster.
- Projected starting lineup.
- Bench review.
- Roster strengths.
- Roster weaknesses.
- Waiver watch list.
- Trade target watch list.
- Draft transcript.
- Recommendations made during the draft.

The agent saves every completed simulation or mock draft report.

## Example User Journey

1. The user opens the dashboard before draft day.
2. The user connects Yahoo.
3. The agent finds three Yahoo leagues.
4. The user selects League A and imports settings.
5. The agent shows that League A is half PPR with QB, RB, RB, WR, WR, TE, FLEX, K, DST, and bench slots.
6. The user runs a mock draft to practice.
7. The agent recommends players at each user pick and shows score breakdowns.
8. On draft day, the user opens League A in the agent and Yahoo in another browser tab.
9. The agent follows the board through Yahoo polling or manual corrections.
10. The agent recommends the best options when the user's pick comes up.
11. The user manually drafts in Yahoo.
12. After the draft, the user reviews roster strengths, weaknesses, waiver targets, and trade ideas.

## Recommendation Philosophy

The agent should not simply say "take the highest ranked player."

It should consider:
- League scoring.
- Roster construction.
- Replacement value.
- Positional scarcity.
- Tier drop-offs.
- Opponent roster needs.
- Market value.
- Upside.
- Risk.
- Future picks.

The user should be able to see why the agent likes a player and decide whether they agree.

## Safety And Trust

The product should be designed so the user stays in control.

Important safety rules:
- Draft execution is recommendation-only.
- Yahoo writes are not part of the draft MVP.
- Manual user action is required in Yahoo.
- The agent must clearly label mock and dry-run states.
- The agent must show source and sync confidence.
- The agent must keep every league separate.
- The agent must never mix recommendations between leagues.

## Business Value

The agent creates value by helping the user:
- Prepare faster.
- Draft with more discipline.
- Avoid panic picks.
- Understand positional scarcity.
- Track all opponents.
- Manage multiple Yahoo drafts.
- Preserve a decision history.
- Review what worked after the draft.
- Build a stronger foundation for future waivers and trades.

## Future Use Cases

After the draft MVP, the same foundation can support:
- Weekly lineup recommendations.
- Waiver watch lists.
- FAAB recommendations.
- Trade target discovery.
- Trade package evaluation.
- Injury and availability monitoring.
- Media signal tracking.
- Playoff planning.

Those future capabilities should continue to use approval-first workflows and clear explanations.
