# Fantasy Football Agent Design

## Goal

Build an agent that manages a fantasy football team like a strong, disciplined human manager: it understands the league rules, watches news and projections, optimizes decisions, explains its reasoning, and takes action only within the user's approval and platform rules.

The goal is not to guarantee a championship. Fantasy football has injuries, variance, and opponent behavior. The agent's practical objective is to maximize expected playoff odds, weekly win probability, and roster value over the season.

## Core Jobs

1. Draft or auction well.
2. Set weekly lineups.
3. Manage waivers and free agents.
4. Optimize FAAB or waiver priority.
5. Stream volatile positions when useful.
6. Evaluate and propose trades.
7. React quickly to injury, weather, role, and depth chart changes.
8. Plan around bye weeks and playoff schedules.
9. Explain every recommendation in plain English.
10. Track what worked and adjust strategy over time.

## Operating Modes

### Advisory Mode

The agent recommends actions, shows reasoning, and waits for approval.

Best default for early versions because it avoids bad autonomous moves, platform rule issues, and overfitting.

### Assisted Execution Mode

The agent prepares moves for review: lineup changes, waiver claims, FAAB bids, trade offers, draft queue, and auction values.

The user approves before anything is submitted.

### Autonomous Mode

The agent can submit low-risk actions automatically under explicit rules.

Examples:
- Start the highest projected active player when a starter is ruled out.
- Submit waiver claims below a FAAB threshold.
- Add a defense or kicker streamer when the roster has an empty slot.

Autonomous mode should be gated by confidence, dollar/FAAB limits, move limits, and platform terms of service.

## Recommendation and Approval Workflow

The primary product loop is:

```text
Detect opportunity
  -> Generate recommendation
  -> Send approval card
  -> User approves, rejects, modifies, snoozes, or asks for more detail
  -> Agent records decision
  -> Agent submits approved Yahoo API action
  -> Agent confirms result
```

The agent should be designed as an approval-first system. It can do the analysis continuously, but it should not submit Yahoo actions until the user confirms them in a trusted channel.

### Approval Channels

The decided approval and alert channels are dashboard, email, and Slack. The dashboard is the primary control surface, while email and Slack provide timely review links and notifications when the user is away from the dashboard.

#### Dashboard

The dashboard should be the canonical approval surface.

Why:
- It already has the full league, roster, recommendation, and audit context.
- It can show richer explanations than a notification channel.
- It gives the safest place to confirm sensitive Yahoo actions.

Recommended dashboard actions:
- `Approve`
- `Reject`
- `Modify`
- `Explain`
- `Snooze`
- `Open audit trail`

#### Email

Email should be supported for approval requests and alerts.

Why:
- Reliable fallback when Slack is unavailable.
- Good for slower decisions, post-draft summaries, waiver plans, and audit-friendly approval records.
- Works well with secure dashboard approval links.

Recommended email actions:
- Send the recommendation summary.
- Include a secure approval link to the dashboard.
- Include deadline, league, and action risk details.
- Avoid approving sensitive actions by bare email reply.

#### Slack

Slack should be supported for quick approvals and urgent alerts.

Why:
- Strong bot and app ecosystem.
- Interactive messages with buttons and menus through Block Kit.
- Good mobile push notifications.
- Easy private channel or direct-message workflow.
- Good fit for quick approvals such as `Approve`, `Reject`, `Change FAAB`, and `Explain`.

Recommended Slack actions:
- `Approve`
- `Reject`
- `Modify`
- `Explain`
- `Snooze`
- `Open dashboard`

#### Microsoft Teams

Teams can be considered later, but it is not part of the decided first approval and alert channel set.

Why:
- Good fit if the user already lives in Microsoft 365.
- Bot messages can use Adaptive Cards.
- Cards can submit structured actions back to the agent.

Recommended Teams actions:
- `Approve`
- `Reject`
- `Modify`
- `Explain`
- `Snooze`
- `Open dashboard`

#### SMS or Push Notification

SMS or push notifications are useful for urgent Sunday inactives and lineup deadlines.

Use cases:
- Starter ruled out.
- Game starts in less than 30 minutes.
- Waiver deadline approaching.
- Trade deadline approaching.

Recommended action:
- Send a short alert with a secure approval link.
- Do not approve sensitive actions from a bare text reply unless identity verification is strong.

#### Messenger / WhatsApp

Messenger-style channels can be supported later, but they are less ideal as the first build unless the user has a business messaging setup.

Use cases:
- Personal notification fallback.
- Simple approve/reject flows.

Design note:
- Treat these as notification channels first and approval channels second.
- Prefer a secure web approval link for final confirmation.

### Approval Card Requirements

Every approval card should include:
- League name.
- Paid/free league badge.
- Action type.
- Exact proposed move.
- Deadline.
- Expected point or value gain.
- Confidence.
- Key reasoning.
- Main risk.
- Approval buttons.
- Link to full detail.

Example:

```text
Yahoo Public Prize League
Action: Start Jaylen Waddle over Courtland Sutton
Deadline: Sunday 12:55 PM ET
Expected gain: +2.1 projected points
Confidence: Medium
Reason: Waddle has stronger target share, better implied game total, and Sutton is questionable.
Risk: Sutton has a higher touchdown ceiling if fully active.

[Approve] [Reject] [Explain] [Modify]
```

### Approval State Machine

Recommendations should move through explicit states:

```text
drafted
  -> queued
  -> sent
  -> viewed
  -> approved
  -> rejected
  -> modified
  -> expired
  -> submitted
  -> confirmed
  -> failed
```

Rules:
- Approval links expire after the action deadline.
- The same recommendation cannot be submitted twice.
- A modified recommendation creates a new version.
- Paid-league actions require stronger confirmation.
- Expired recommendations cannot be revived without recalculation.

### Approval Security

Required controls:
- OAuth for Yahoo access.
- Separate OAuth or verified identity for Slack/Teams.
- Map each messaging identity to one authorized fantasy user.
- Sign every approval payload.
- Use single-use approval tokens.
- Store the full recommendation and user decision.
- Check that the Yahoo roster state has not changed before submitting.
- Recalculate if a player status, roster slot, or league deadline changed.
- Show a final confirmation after Yahoo accepts or rejects the action.

### Approval Policies

The user can choose policies by action type.

Default policy:

| Action type | Free league | Paid league |
| --- | --- | --- |
| Lineup change | Approval required | Approval required |
| Waiver claim | Approval required | Approval required |
| FAAB bid | Approval required | Approval required |
| Add/drop free agent | Approval required | Approval required |
| Trade proposal | Approval required | Approval required |
| Trade acceptance | Approval required | Approval required |
| Draft pick | Approval required | Approval required |
| Paid contest entry | Not supported | Not supported |
| Deposit/withdrawal | Not supported | Not supported |

Later, the user can enable narrow auto-approval policies such as:
- Free league lineup changes below a deadline.
- Start active backup if a starter is ruled out.
- Add a defense streamer from a pre-approved list.

Paid leagues should keep approval required unless the user explicitly opts into a very narrow policy.

## Decision Areas

### 1. League Understanding

The agent must ingest and normalize league settings before making any decisions.

Required league data:
- Platform and league ID.
- Scoring format: standard, half PPR, PPR, bonuses, penalties.
- Roster slots and bench size.
- Superflex, two-QB, tight-end premium, IDP, keepers, dynasty, taxi squad.
- Waiver rules: rolling priority, reverse standings, FAAB, continuous waivers.
- Trade deadline.
- Playoff weeks and number of teams.
- Draft mechanism: live standard, salary cap, autopick, offline, slow, rookie, linear, snake.
- League format overlays: redraft, keeper, dynasty, best ball, guillotine, IDP, superflex, two-QB, tight-end premium.

Output:
- A machine-readable `LeagueConfig`.
- A human-readable league summary.
- A warning list for unusual settings.

### 2. Player Valuation

The agent should value players relative to the exact league settings, not generic rankings.

Core valuation concepts:
- Expected points.
- Floor, median, and ceiling.
- Volatility.
- Injury risk.
- Role security.
- Strength of schedule.
- Replacement value by position.
- Roster fit.
- Bye week impact.
- Playoff schedule impact.
- Trade market value.

The main metric should be value over replacement, adjusted by roster context and timing.

### 3. Draft Agent

The draft agent should build the best roster, not simply take the top-ranked player.

Inputs:
- League settings.
- Draft slot or auction budget.
- Keepers if applicable.
- Current board.
- ADP and market behavior.
- Projection ensemble.
- Positional tiers.
- Roster construction targets.

Outputs:
- Pick recommendations.
- Draft queue.
- Tier warnings.
- Positional run alerts.
- Reach/pass explanations.
- Auction max bids and nomination strategy.

Draft strategy:
- Prefer value early.
- Track positional scarcity.
- Avoid filling low-leverage positions too early.
- Build upside on the bench.
- Adapt to the room instead of following static rankings.

### Draft Type and Rule Strategy Matrix

The draft agent must separate two ideas:

1. Draft mechanism: how players are acquired during the draft.
2. League format and rules: what makes those players valuable.

This matters because a salary cap draft in a superflex league needs different logic than a snake draft in a one-QB PPR league, even if the player pool is identical.

#### Supported Draft Mechanisms

| Draft mechanism | How it works | Agent logic |
| --- | --- | --- |
| Live standard snake draft | Managers take turns selecting players, usually reversing order each round | Pick optimizer, tier tracking, positional run detection, ADP leverage, roster construction |
| Live standard linear draft | Same order every round | Stronger early-pick advantage modeling, round-by-round scarcity adjustment |
| Live salary cap / auction draft | Managers nominate players and bid from a fixed budget | Dollar values, inflation tracking, nomination strategy, budget pacing, roster slot opportunity cost |
| Autopick draft | Platform drafts from pre-rankings or defaults | Pre-rank generation, do-not-draft list, positional balance, contingency rankings |
| Offline draft | Draft happens outside Yahoo and commissioner enters results | Manual board tracker, recommendation mode, import/export results |
| Slow draft | Long pick clocks, often hours or days | News-aware queues, timed alerts, pick-window monitoring |
| Rookie draft | Dynasty teams draft incoming rookies only | Rookie rankings, landing spot, draft capital, age curve, roster window, taxi squad value |
| Startup dynasty draft | Initial dynasty roster build | Multi-year value, age curves, position longevity, productive struggle vs win-now mode |
| Best ball draft | Lineups are automatically optimized after games; little or no weekly management | Correlation, spike-week upside, roster construction, injury fragility, bye distribution |

#### Yahoo-Specific Draft Support

Yahoo's football draft mechanisms to support first:
- Live Standard Draft.
- Live Salary Cap Draft.
- Autopick Draft.
- Offline Draft.

Yahoo Public Prize Football Leagues narrow the supported paid-league draft mechanisms:
- Head-to-head Public Prize Leagues use Live Standard or Salary Cap drafts.
- Autopick and Offline drafts are not available in Public Prize Leagues.
- Prestige Public Prize Leagues use Standard Draft.
- Guillotine Public Prize Leagues use Standard Draft.

Design implication:
- The MVP draft assistant should support Live Standard first, then Live Salary Cap.
- Autopick support should generate pre-draft rankings and exclusions rather than try to control the draft room.
- Offline support should be a board-tracking and recommendation mode.

#### Yahoo Live Draft API Reality

Current assumption: Yahoo does not expose an official Fantasy Sports API endpoint for submitting a live draft pick, live auction nomination, or live auction bid.

What the official API can support:
- OAuth access to the user's fantasy account.
- Reading league metadata, settings, roster positions, teams, players, and draft status.
- Reading roster and transaction data after the draft.
- Editing lineups after the draft through roster `PUT`.
- Adding/dropping players and proposing trades after the draft through transaction APIs.

What may be available for draft support:
- Draft results can be read from Yahoo draft results surfaces, and some community libraries expose draft results during a draft.
- The agent can use draft results as an input to keep its board synchronized, but this should be verified against the user's actual league before relying on it live.
- Community wrappers report that `draft_results` returns completed picks and, during a draft, the players drafted so far.
- For auction drafts, community wrappers report that draft results include completed auction prices but not the player currently being nominated.

What should not be in the default design:
- No direct API-based live pick submission.
- No direct API-based live auction bidding.
- No scraping or hidden draft-room endpoints.
- No browser automation for paid prize leagues unless Yahoo explicitly allows it in writing.

Live draft product design:
- The agent recommends the pick or bid in Slack/Teams/web dashboard.
- The user manually clicks `Draft` or enters the bid in Yahoo's draft room.
- The agent polls Yahoo draft results to watch for completed picks where supported.
- If the board cannot be read reliably, the user can mark the pick as made or paste/import the draft results.
- The user always has manual correction controls: `I drafted this player`, `Someone else drafted this player`, `Undo`, and `Refresh from Yahoo`.

This keeps the draft assistant useful without pretending Yahoo has an official draft execution API.

#### Rule-Based Strategy Modifiers

| Rule or format | Strategy shift |
| --- | --- |
| Standard scoring | Touchdowns and rushing workload become more important; pass-catching specialists lose some value |
| Half PPR | Balanced valuation between target volume and touchdown/rushing roles |
| Full PPR | Target earners, slot receivers, pass-catching RBs, and high-volume TEs rise |
| Tight-end premium | Elite and high-target TEs rise; replacement level must be recalculated separately |
| Superflex / two-QB | QBs become core assets; agent should draft QBs earlier and model positional scarcity aggressively |
| Four-point pass TD | Mobile QBs gain relative value; passing-only QB gaps compress |
| Six-point pass TD | Efficient high-volume passers gain value; QB scoring tiers widen |
| Negative interception/fumble settings | Volatile QBs and high-turnover players take a penalty |
| Big-play bonuses | Deep threats and explosive rushers gain ceiling value |
| First-down scoring | Volume and chain-moving roles become more stable than pure yardage profiles |
| Return-yard scoring | Return specialists with offensive roles can become draftable |
| IDP | Defensive positions need their own replacement values, scoring model, and roster construction |
| Large starting lineup | Depth and weekly usable starters rise in value |
| Shallow bench | Do not over-draft stash players; prioritize immediate usability and waiver flexibility |
| Deep bench | Upside stashes, handcuffs, rookies, and injury-away players rise |
| IR slots | Injured high-upside players become more draftable if eligible |
| Keeper league | Player cost matters more than raw value; preserve future surplus |
| Dynasty league | Age curves, contract windows, future picks, and roster direction matter |
| Best ball | Weekly ceiling and correlation matter more; safe floor-only players lose value |
| Guillotine | Early survival floor matters more; avoid fragile early-season injury risks |
| FAAB waivers | Draft can lean slightly more upside because replacement moves are budget-constrained |
| Waiver priority | Avoid planned early churn if priority is valuable |
| Trade-heavy league | Draft surplus value and scarce positions that trade well |
| No-trade or low-trade league | Draft for complete roster balance and injury coverage |
| Playoff weeks 15-17 | Late-season schedules matter for contenders, but should not override major value gaps |

#### Draft Recommendation Inputs

The draft engine should load:
- League rules and scoring settings.
- Draft mechanism.
- Draft order or nomination order.
- User roster state.
- Available players.
- Current pick number or auction budget.
- Platform ADP.
- External ADP.
- Projection blend.
- Positional tiers.
- Replacement values by position.
- Roster construction targets.
- Bye weeks.
- Injury statuses.
- News timestamps.
- User preferences.

#### Draft Recommendation Output

Every draft recommendation should include:
- Best pick or bid.
- Backup choices.
- Reasoning.
- Tier context.
- Roster construction impact.
- Scarcity warning.
- Expected value versus ADP.
- Rule-specific adjustment.
- Risk note.
- Pick deadline.
- Approval action.

Example:

```text
Pick recommendation: Anthony Richardson
Format: 12-team superflex, 6-point passing TD, half PPR
Reason: QB replacement value is much higher in this format. Richardson's rushing ceiling keeps him in the top tier, and only two comparable QBs remain before your next pick.
Rule adjustment: Superflex moves QB up; 6-point passing TD slightly narrows his edge versus pocket passers.
Backup: Jayden Daniels, Drake London, De'Von Achane
Risk: Injury volatility and passing efficiency.
```

#### Salary Cap Draft Logic

Salary cap drafts need a separate optimizer.

Core concepts:
- Pre-draft player dollar values.
- Live inflation or deflation.
- Remaining budget per team.
- Max bid per team.
- Roster slot constraints.
- Positional scarcity remaining.
- Nomination strategy.
- Stars-and-scrubs versus balanced build.
- Endgame dollar control.

The agent should maintain:
- `base_value`
- `inflation_adjusted_value`
- `max_bid`
- `walkaway_price`
- `nomination_score`
- `endgame_reserve`

Strategy examples:
- If top-tier players are going below value, spend aggressively.
- If the room is overspending early, preserve budget and attack tier-two values.
- Nominate players the agent does not want when opponents have obvious needs.
- Avoid being trapped with too much budget and too few impact players left.

#### Autopick Logic

Autopick strategy is mostly pre-draft preparation.

Agent outputs:
- Overall ranking list.
- Position-aware rankings.
- Do-not-draft list.
- Injury exclusions.
- Suspended player exclusions.
- Bye week warnings.
- Salary cap pre-draft values where applicable.

Important:
- The agent should not assume Yahoo autopick will follow the same strategy a live assistant would use.
- The goal is to make the autopick queue robust if the user misses a pick or draft.

#### Draft Architecture

```text
League rules
  -> Scoring model
  -> Player projections
  -> Replacement values
  -> Draft format adapter
  -> Roster construction model
  -> Pick or bid optimizer
  -> Recommendation card
  -> User approval
```

The draft format adapter is the part that changes behavior for snake, salary cap, autopick, keeper, dynasty, best ball, and rookie drafts.

#### Live Draft Data Sources

The live draft engine should support multiple data providers and keep source attribution for every ranking or projection.

Production-grade source candidates:

| Source | Useful data | Notes |
| --- | --- | --- |
| Yahoo Fantasy API | League settings, roster positions, teams, player IDs, draft status, post-draft rosters and transactions | Primary source for the user's actual Yahoo league rules and team state |
| Yahoo draft room / draft results | Draft board and selected players | Use only supported surfaces; do not rely on hidden endpoints for paid leagues |
| FantasyPros API | Expert consensus rankings, projections, ADP, rank ranges, player IDs | Strong rank/projection source if licensed; supports projections and ECR-style inputs |
| SportsDataIO | Season-long projections, ADP, auction values, injuries, depth charts, player news, player IDs | Strong commercial data backbone |
| Fantasy Nerds API | Draft rankings, projections, ADP, auction values, tiers, injury risk, dynasty, best ball, IDP, news | Useful because it exposes draft-specific services directly |
| RotoWire | Projections, rankings, depth charts, injuries, news, auction values | Good editorial/projection source; verify licensing/API access before automation |
| Sleeper API | Player metadata, public league/draft data, draft picks for Sleeper leagues | Useful for ID mapping and comparison; not a Yahoo draft execution source |
| nflverse / ffverse | Historical stats, scoring history, simulation tools, expected opportunity data | Best for model training, validation, and simulations |
| DynastyProcess data | Player ID mapping, dynasty values, pick values | More relevant for dynasty/keeper expansion than redraft MVP |

Avoid as first-class automated feeds unless terms are clear:
- Scraping public ranking pages.
- Hidden app endpoints.
- Browser automation against draft rooms.
- Data copied from paid tools without licensing.

The source strategy should be:
1. Use Yahoo as the authority for league rules, roster slots, teams, and draft state.
2. Use at least two projection/ranking providers for player quality.
3. Use an ADP/market source to estimate what the room may do.
4. Use historical data to test whether the model drafts strong rosters.
5. Store timestamps so stale rankings can be discounted.

#### Player Identity Resolution

Every source has different player IDs. The agent needs a canonical player table.

Required IDs where available:
- `agent_player_id`
- `yahoo_player_id`
- `yahoo_player_key`
- `fantasypros_id`
- `sportsdataio_id`
- `sleeper_id`
- `gsis_id`
- `espn_id`
- `team`
- `position`
- `birthdate`

Matching rules:
- Prefer exact source ID mapping.
- Fall back to normalized name, team, position, and birthdate.
- Flag ambiguous matches for manual review.
- Never merge two players solely by similar name.

#### Pre-Draft Valuation Algorithm

The pre-draft algorithm creates a league-specific value for every draftable player before the draft starts.

Step 1: Normalize league rules.

```text
LeagueConfig
  -> scoring weights
  -> roster slots
  -> flex eligibility
  -> bench depth
  -> position limits
  -> playoff weeks
  -> paid/free flag
```

Step 2: Convert stat projections into fantasy points.

```text
projected_points[player, source] =
  pass_yd * pass_yd_points
  + pass_td * pass_td_points
  + rush_yd * rush_yd_points
  + rush_td * rush_td_points
  + receptions * reception_points
  + rec_yd * rec_yd_points
  + rec_td * rec_td_points
  + bonuses
  - turnovers * turnover_penalty
```

Step 3: Blend projections and ranks.

```text
blended_projection =
  weighted_average(source_projection_points)

rank_signal =
  percentile_transform(consensus_rank, positional_rank, ADP)

source_confidence =
  freshness_weight
  * source_reliability_weight
  * agreement_weight
```

Use projections as the base when available. Use rankings as a secondary signal to capture expert context and market behavior.

Step 4: Calculate replacement values.

Replacement value must be league-specific.

```text
position_demand =
  required_starters_by_position
  + expected_flex_usage
  + bench_depth_adjustment

replacement_player[position] =
  available player at position_demand index

value_over_replacement =
  blended_projection - replacement_projection[position]
```

For flex slots, the agent should calculate replacement value by simulating the best legal starting lineup, not by using a fixed RB/WR/TE cutoff.

Step 5: Add ceiling, risk, and roster-construction signals.

```text
base_player_value =
  value_over_replacement
  + ceiling_bonus
  - injury_risk_penalty
  - role_uncertainty_penalty
  + rule_specific_adjustments
```

Rule-specific examples:
- Superflex increases QB replacement value.
- Tight-end premium boosts high-target tight ends.
- Full PPR boosts target earners.
- Shallow bench penalizes stash-only players.
- Deep bench boosts upside and contingent-value players.

#### Live Recalculation After Every Pick

After each drafted player, the engine should recalculate the board.

Inputs updated after every pick:
- Drafted player removed from available pool.
- Drafting team's roster updated.
- User roster needs updated.
- Opponent roster needs updated.
- Positional scarcity updated.
- Tier drop-offs updated.
- ADP value updated.
- Pick distance to user's next turn updated.
- Probability each player survives to user's next pick updated.

Core loop:

```text
onDraftPick(pick):
  mark player as drafted
  update team roster
  update available player pool
  recompute positional replacement values
  recompute tiers and scarcity
  recompute user roster needs
  recompute opponent roster needs
  estimate picks before user's next turn
  simulate likely opponent picks
  compute survival probability for each available player
  score every available player for user's team
  if user's turn:
    generate top 5 recommendation card
  else:
    update dashboard and watchlist
```

#### Opponent Need Model

The agent should estimate what other teams are likely to do before the user's next pick.

For each opponent:
- Current roster by position.
- Empty starter slots.
- Flex needs.
- Bench needs.
- Position limits.
- Bye week clusters.
- Team tendencies if observed.
- ADP/value available at their pick.

Opponent pick probability:

```text
P(opponent drafts player) =
  market_rank_weight
  + roster_need_weight
  + positional_scarcity_weight
  + tier_dropoff_weight
  + observed_tendency_weight
```

Then calculate player survival:

```text
survival_probability[player] =
  product(1 - P(each pick before user's next turn drafts player))
```

This lets the agent say things like:

```text
You can probably wait on Player A.
Estimated survival to your next pick: 72%.

Do not wait on Player B.
Estimated survival to your next pick: 18%, and the WR tier drops sharply after him.
```

#### User Team Need Model

The agent should score candidates by marginal value to the user's actual roster, not just global rank.

Roster need components:
- Empty starter slots.
- Flex slot pressure.
- Positional depth.
- Bye week conflicts.
- Injury fragility.
- Correlation or stack value where useful.
- Replacement level at each future pick.
- Draft phase.

Draft phases:
- Early: maximize elite value and scarce ceilings.
- Middle: fill high-value starter/flex slots and exploit tier drops.
- Late: upside, injury-away roles, rookies, contingent value, and streamable positions.

Marginal team value:

```text
team_value_if_drafted =
  optimize_projected_starting_lineup(user_roster + player)
  + bench_upside_value
  + future_pick_option_value
  - roster_fragility_penalty

marginal_team_value =
  team_value_if_drafted - current_team_value
```

#### Final Live Draft Score

Every available player receives a transparent score.

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

Where:
- `marginal_team_value` is the value to the user's roster.
- `value_over_replacement` is league-adjusted player value.
- `scarcity_urgency` measures tier drop-off and survival risk.
- `market_value_edge` compares agent value to ADP.
- `ceiling_adjustment` rewards upside based on draft phase.
- `roster_construction_fit` rewards legal, balanced roster builds.
- `opponent_blocking_value` rewards picks that prevent a direct opponent from capturing a major edge.
- `risk_penalty` includes injury, role, suspension, and severe bye-week concentration.

Weights should be configurable and backtested. The first implementation can start with these weights, then tune them with mock drafts and historical draft simulations.

#### Top 5 Recommendation Card

When it is the user's turn, the agent should recommend up to five options.

Each option includes:
- Player.
- Position/team/bye.
- Final score.
- Score breakdown.
- Projection.
- Value over replacement.
- Estimated survival to next pick.
- Why now.
- Pros.
- Cons.
- Best alternative if skipped.
- Rule-specific reasoning.

Example:

```text
Pick 1: Garrett Wilson, WR, NYJ
Final score: 91.4
Projection: 251.2 league-adjusted points
VORP: +62.8
Survival to next pick: 12%

Why now:
He is the last WR in this tier, your WR1 slot is open, and three teams before your next pick still need WR.

Pros:
- Strong target projection in full PPR.
- Clear starter fit.
- Tier drop after him is steep.

Cons:
- QB/offense uncertainty.
- RB value may dry up before your next pick.

Score breakdown:
- Team need: 31.0
- Replacement value: 24.5
- Scarcity urgency: 18.2
- Market edge: 7.0
- Ceiling: 8.4
- Risk penalty: -2.7
```

The card should also include:
- `Draft this player in Yahoo`
- `Show next 10`
- `Why not Player X?`
- `Refresh board`
- `I picked someone else`

#### Additional Live Draft Requirements

The live draft assistant needs more than rankings. It needs operational controls that keep the recommendations reliable under a short pick clock.

##### Pre-Draft Setup Wizard

Before draft day, the agent should walk through:
- Yahoo OAuth connection.
- League selection.
- League rule import.
- Scoring rule validation.
- Roster slot validation.
- Draft position and draft order import when available.
- Data source selection.
- User risk preference.
- User favorite/avoid player list.
- User favorite/avoid NFL team list.
- Strategy preference, if any.
- Paid-league confirmation and approval policy.

The setup should produce:
- League-specific cheat sheet.
- Tier sheet.
- Draft plan by round.
- Position targets.
- Late-round watch list.
- Do-not-draft list.
- Emergency autopick/pre-rank list if supported manually.

##### Scoring Validator

The agent should validate that scoring settings are interpreted correctly.

Method:
- Pull Yahoo league scoring settings.
- Calculate fantasy points for a few known historical stat lines.
- Compare against expected scoring rules.
- Warn if a setting cannot be mapped confidently.

This is important because one unusual bonus or tight-end premium setting can change draft strategy.

##### Source Quality and Disagreement Handling

Every data source should have:
- Freshness timestamp.
- Source reliability weight.
- Coverage completeness.
- Player ID match confidence.
- Projection/ranking variance.
- License/terms status.

When sources disagree, the recommendation should say so.

Example:

```text
Source disagreement: high
FantasyPros ranks Player A 18th overall, while SportsDataIO projection places him 31st.
The gap appears driven by touchdown projection and injury risk.
```

##### Strategy Profiles

The agent should support draft profiles but avoid locking into them blindly.

Possible profiles:
- Balanced value.
- Hero RB.
- Robust RB.
- Zero RB.
- Elite QB.
- Elite TE.
- Upside bench.
- Safe floor.
- Best player available.

Each profile should act as a soft weighting system, not a rigid script. If the board gives a major value, the agent should be allowed to deviate and explain why.

##### Pick Clock Behavior

The live draft assistant needs a timing model.

Rules:
- Keep the top 5 options precomputed before the user's turn.
- Refresh instantly when a player is drafted.
- If less than 20 seconds remain, collapse to a concise top 3.
- If less than 10 seconds remain, show one best pick and one backup.
- If board sync fails, fall back to last known board and warn the user.

Pick-clock fallback:

```text
Clock is under 10 seconds.
Best pick: Player A
Backup: Player B
Reason: Player A is highest team-adjusted value and fills your final WR starter slot.
```

##### Manual Override Flow

The user must be able to tell the agent what happened if Yahoo draft-room sync is delayed or unavailable.

Required controls:
- `I drafted this player`
- `Someone else drafted this player`
- `Undo last manual update`
- `Pause recommendations`
- `Resume recommendations`
- `Refresh from Yahoo`

Every manual override should trigger a recalculation.

##### Mock Draft and Backtesting Engine

Before relying on the draft assistant, the agent should test itself.

Mock draft simulation should vary:
- Draft slot.
- League size.
- Scoring rules.
- Opponent tendencies.
- ADP source.
- Risk settings.
- Strategy profiles.

Backtesting metrics:
- Projected starting lineup strength.
- Bench upside.
- Positional fragility.
- Bye week risk.
- Injury risk.
- Value captured versus ADP.
- Missed tier cliffs.
- Regret picks.
- Team rank versus simulated league.

The draft model should be tuned through repeated simulations, not just vibes.

##### Draft Mock Mode

Draft mock mode should run the live draft assistant without requiring a real Yahoo draft.

Modes:
- `recorded_replay`: replay a real historical or exported draft pick by pick.
- `adp_simulation`: simulate opponents using ADP plus roster needs.
- `tendency_simulation`: simulate opponents with specific behaviors, such as early QB, zero RB, Yahoo-rank follower, or homer picks.
- `manual_mock`: user manually enters picks while the agent reacts.

Mock mode should verify:
- Board updates after every pick.
- User roster needs update correctly.
- Opponent needs update correctly.
- Survival probabilities change as expected.
- Top 5 recommendations are generated on the user's turn.
- Pick-clock fallback works.
- Manual override works.
- Recommendation explanations match score breakdowns.

Mock draft outputs:
- Draft transcript.
- User recommendations per pick.
- Actual selected player per pick.
- Final roster grade.
- Missed value report.
- Strategy adherence report.
- Bugs or data mismatches.

##### Opponent Tendencies

During the draft, the agent should learn from the room.

Observed tendencies:
- Drafting QBs early.
- Ignoring TE.
- Hoarding RB.
- Following Yahoo rank closely.
- Reaching for rookies.
- Drafting favorite teams.
- Filling starters before bench.
- Taking defense/kicker early.

The opponent model should update after each pick and adjust survival probabilities.

##### Exposure and Portfolio Controls

If the user manages multiple paid Yahoo teams, the agent should avoid accidentally building the same fragile portfolio everywhere.

Controls:
- Max exposure to one player.
- Max exposure to one NFL offense.
- Min exposure to high-upside targets.
- Injury-risk cap.
- Stack limits.

This is a later feature, but it matters if the user enters many prize leagues.

##### Post-Draft Review

After the draft, the agent should generate a review.

Include:
- Final roster.
- Projected weekly starting lineup.
- Strengths.
- Weaknesses.
- Best value picks.
- Biggest reaches.
- Missed opportunities.
- Waiver watch list.
- Trade targets.
- Week 1 lineup recommendation.
- Immediate roster cleanup.

The post-draft review should compare the actual draft against the agent's recommendations so the system can learn.

##### Failure Modes

The draft assistant should explicitly handle:
- Data source outage.
- Yahoo sync delay.
- Player ID mismatch.
- Draft order unknown.
- Keeper player missing.
- Scoring rule unsupported.
- Pick clock too short.
- User picks someone else.
- Opponent makes unexpected run.
- News breaks mid-draft.
- Paid-league compliance warning.

Failure behavior should be calm and useful:
- Warn.
- Fall back.
- Recalculate.
- Preserve decision log.
- Avoid inventing certainty.

### 4. Weekly Lineup Agent

The lineup agent selects starters that maximize expected matchup value.

Inputs:
- Current roster.
- Opponent roster.
- Projected points.
- Injury status.
- Game times.
- Weather.
- Vegas implied totals if available.
- Team depth charts and usage trends.

Outputs:
- Recommended starters.
- Bench decisions.
- Confidence score.
- Late-swap alerts.
- Floor/ceiling mode option.

Strategy:
- If favored, prefer stable floor.
- If underdog, increase controlled upside.
- Preserve late-game flexibility where platform rules allow.
- Avoid starting inactive or severely limited players.
- Recheck lineups before each game window.

### 5. Waiver and FAAB Agent

The waiver agent finds adds before they become obvious and avoids wasting budget on short-lived hype.

Inputs:
- Free agent pool.
- Roster weaknesses.
- Drop candidates.
- Injury/news changes.
- Snap share, route share, targets, carries, red zone usage.
- Rest-of-season projections.
- Upcoming schedule.
- League mate needs and likely bids.

Outputs:
- Add/drop recommendations.
- Claim ordering.
- FAAB bid suggestions.
- Conservative/aggressive bid options.
- Expected roster impact.

FAAB strategy:
- Bid based on expected rest-of-season value, scarcity, team need, and remaining budget.
- Spend aggressively on true role changes.
- Discount one-week box-score spikes without usage support.
- Preserve budget when replacement depth is strong.

#### Waiver Wire Scoring

Every available player should receive a waiver score for the user's league and roster context.

```text
waiver_score =
  0.30 * marginal_roster_gain
  + 0.20 * rest_of_season_value
  + 0.15 * role_change_signal
  + 0.10 * short_term_start_value
  + 0.10 * scarcity_at_position
  + 0.05 * playoff_schedule_value
  + 0.05 * contingent_upside
  + 0.05 * market_urgency
  - drop_cost
  - risk_penalty
```

Where:
- `marginal_roster_gain` measures how much the add improves the user's optimized roster.
- `rest_of_season_value` measures projected season-long value.
- `role_change_signal` captures usage changes such as starter injury, snap jump, route jump, target jump, or depth chart promotion.
- `short_term_start_value` captures one-to-three-week usefulness.
- `scarcity_at_position` measures whether the position is thin in the league.
- `playoff_schedule_value` matters more later in the season.
- `contingent_upside` rewards handcuffs and injury-away players.
- `market_urgency` measures likely competition from other managers.
- `drop_cost` prevents cutting useful players for marginal adds.

#### Add/Drop Pairing

The agent should recommend complete moves, not just pickups.

For each add candidate, evaluate every legal drop candidate:

```text
net_move_value =
  waiver_score(add_player)
  - retained_value(drop_player)
  + roster_shape_improvement
  - transaction_cost
```

Drop candidate logic:
- Protect current starters.
- Protect scarce positions.
- Protect high-upside bench players when bench is deep.
- Prefer dropping replaceable, low-upside players.
- Consider bye-week and injury coverage.
- Avoid dropping recent role-gain players too early.

Recommendation example:

```text
Add: Tyjae Spears
Drop: Backup kicker
Net move score: 84.1
Reason: Spears gained routes and two-minute work, while your current drop candidate has no weekly lineup path.
Risk: Role may remain committee-based.
```

#### FAAB Bid Algorithm

FAAB bids should map value and urgency into dollars.

Inputs:
- Remaining user FAAB.
- League starting FAAB.
- Weeks remaining.
- Player net move value.
- Role-change confidence.
- Position scarcity.
- Other teams' needs.
- Other teams' remaining FAAB if visible.
- Number of likely bidders.
- User standings and playoff odds.
- Replacement options if claim fails.

Bid outputs:
- Conservative bid.
- Recommended bid.
- Aggressive bid.
- Max bid.

```text
recommended_faab_pct =
  base_value_pct
  * role_confidence_multiplier
  * scarcity_multiplier
  * team_need_multiplier
  * competition_multiplier
  * season_timing_multiplier
```

Rules:
- True rest-of-season starters can justify aggressive bids.
- One-week streamers should stay cheap unless they solve an urgent start.
- Early-season league-winning role changes deserve more budget.
- Late-season playoff difference-makers can justify remaining-budget aggression.
- Do not spend heavily when several similar alternatives are available.

#### Waiver Claim Ordering

When the league uses waiver priority instead of FAAB, the agent should recommend claim order and whether to spend priority.

Priority logic:
- Spend priority for major multi-week value.
- Hold priority for replaceable streamers.
- Consider league depth and scarcity.
- Consider user's standings and urgency.
- Consider upcoming bye or injury crisis.

#### Waiver Recommendation Card

Each waiver recommendation should show:
- Add player.
- Drop player.
- Net move score.
- Expected roster gain.
- Rest-of-season value.
- Short-term value.
- FAAB bid or waiver priority recommendation.
- Claim order.
- Pros.
- Cons.
- Main source signals.
- Deadline.
- Approval button.

Example:

```text
Waiver recommendation: Add Zach Charbonnet, drop WR6
Net move score: 88.3
Recommended FAAB: $18
Range: Conservative $12 / Aggressive $27 / Max $32

Why:
Charbonnet's path to high-value touches improved after injury news, and RB replacement value is thin in this league.

Pros:
- Immediate RB2/FLEX usability if starter misses time.
- Strong contingent upside.
- Your RB depth is weaker than WR depth.

Cons:
- Role may shrink if starter returns quickly.
- Two other RB-needy teams have more FAAB.
```

### 6. Trade Agent

The trade agent should improve playoff odds, not merely win a public trade calculator.

Inputs:
- User roster.
- Other team rosters.
- Standings.
- Positional needs.
- Player values.
- Bye weeks.
- Playoff schedule.
- Manager tendencies if known.

Outputs:
- Buy-low targets.
- Sell-high candidates.
- Fair packages.
- Opponent-specific offers.
- Accept/reject guidance for incoming trades.
- Negotiation notes.

Trade strategy:
- Identify teams with complementary needs.
- Offer deals that make sense for both rosters.
- Upgrade starters when the bench is deep.
- Trade short-term depth for playoff upside when already likely to qualify.
- Avoid creating bye week or injury fragility.

#### Trade Scoring

Trades should be scored by team outcome, not raw player value alone.

For the user's team:

```text
user_trade_score =
  0.35 * starting_lineup_gain
  + 0.20 * rest_of_season_value_gain
  + 0.15 * playoff_odds_gain
  + 0.10 * positional_scarcity_gain
  + 0.10 * roster_flexibility_gain
  + 0.05 * schedule_gain
  + 0.05 * risk_reduction
  - depth_loss_penalty
  - bye_week_penalty
```

For the other team:

```text
opponent_trade_score =
  opponent_starting_lineup_gain
  + opponent_roster_need_gain
  + opponent_depth_gain
  + perceived_market_value_gain
```

The agent should prefer trades that:
- Improve the user's team.
- Are plausible for the other manager.
- Do not rely on deception.
- Improve roster construction.
- Fit the user's competitive window.

#### Trade Package Generator

The trade agent should generate packages from both directions.

Package types:
- Buy low.
- Sell high.
- Two-for-one starter upgrade.
- Depth-for-depth need swap.
- Handcuff consolidation.
- Bye-week repair.
- Playoff schedule upgrade.
- Injury-risk rebalance.

Generation process:

```text
for each opponent:
  identify opponent needs
  identify user surplus
  identify user targets
  build candidate packages
  score user side
  score opponent side
  filter unfair or implausible offers
  rank by mutual fit and user gain
```

Package constraints:
- Respect roster limits.
- Avoid leaving illegal lineups.
- Include open roster spots created by uneven trades.
- Account for likely waiver replacement after trade.
- Account for trade deadline and review period.

#### Incoming Trade Evaluator

When the user receives a trade offer, the agent should produce:
- Accept/reject recommendation.
- User trade score.
- Opponent trade score.
- Starting lineup impact.
- Bench impact.
- Rest-of-season impact.
- Playoff impact.
- Risk change.
- Counteroffer options.

Example:

```text
Recommendation: Counter
Trade score: -6.8 for you

Why:
The offer is fair on raw value, but it downgrades your weekly WR2 slot and gives you bench RB points you cannot start.

Counter:
Ask for Player X instead of Player Y, or add your WR5 to request their TE upgrade.
```

#### Outgoing Trade Proposal Card

Each proposed trade should include:
- Give.
- Get.
- User trade score.
- Estimated opponent fit score.
- Why the opponent may accept.
- User roster impact.
- Opponent roster impact.
- Risks.
- Suggested message.
- Approval button.

Example:

```text
Trade proposal: Give Deebo Samuel + Brian Robinson, get A.J. Brown
User trade score: +12.4
Opponent fit score: +8.1

Why it helps you:
You consolidate two non-essential starters into a weekly WR1 and still have RB depth.

Why they may accept:
They are starting a replacement-level RB and have only three playable WRs during Week 9 byes.

Risk:
If your RB2 is injured, your bench gets thin.
```

#### Trade Market Monitoring

The agent should monitor:
- Teams with losing records that need immediate points.
- Teams with injured starters.
- Teams with bye-week problems.
- Teams overloaded at one position.
- Teams with playoff-safe records that may want upside.
- Teams with clear keeper/dynasty incentives in future versions.

It should surface weekly:
- Top three buy targets.
- Top three sell candidates.
- Best opponent match.
- Most realistic proposal.
- Best counteroffer if nothing is accepted.

### 7. Streaming Agent

The streaming agent handles positions where weekly matchups matter more than season-long value.

Typical stream positions:
- Defense/special teams.
- Kicker.
- Quarterback in one-QB leagues.
- Tight end outside the elite tier.

Inputs:
- Upcoming matchups.
- Opponent offensive/defensive quality.
- Weather.
- Implied point totals.
- Sack/turnover opportunity.
- Availability and waiver timing.

Outputs:
- This-week streamer.
- Two-week stash option.
- Drop recommendation.
- Confidence score.

### 8. News and Injury Monitor

The agent must react faster than a casual manager while avoiding panic.

Tracked events:
- Inactive reports.
- Practice status.
- Injury reports.
- Beat reporter updates.
- Depth chart changes.
- Trades and signings.
- Suspensions.
- Weather changes.
- Coach usage comments.

Response levels:
- Info only.
- Recalculate projections.
- Recommend lineup change.
- Recommend waiver move.
- Escalate urgent approval.
- Auto-execute if allowed by policy.

## System Architecture

### Components

1. Platform Connector
   - Reads league settings, rosters, free agents, schedules, transactions, standings, and matchups.
   - Writes lineup changes, claims, drops, and trade offers only when approved.

2. Data Ingestion
   - Pulls preseason baselines, weekly stats, projections, rankings, player news, injuries, practice reports, depth charts, usage metrics, game lines, weather, schedules, and media signals.
   - Separates raw source observations from normalized player state.
   - Keeps raw source data for auditing.

3. Normalization Layer
   - Maps player IDs across sources.
   - Normalizes team, position, injury, availability, media, and game identifiers.
   - Reconciles conflicting names, team changes, position eligibility, and duplicated player records.
   - Produces clean tables for modeling.

4. Projection Engine
   - Combines external projections with internal adjustments.
   - Produces rest-of-season and weekly projections.
   - Includes uncertainty ranges.

5. Valuation Engine
   - Converts projections into league-specific player values.
   - Computes replacement value by position.
   - Adjusts for roster state, schedule, scarcity, and upside.

6. Optimizers
   - Lineup optimizer.
   - Waiver optimizer.
   - FAAB bid optimizer.
   - Trade package generator.
   - Draft and auction optimizer.

7. Agent Orchestrator
   - Decides when to run each job.
   - Watches for events.
   - Produces recommendations.
   - Routes approval requests.

8. Explanation Layer
   - Turns model output into concise reasoning.
   - Shows key factors, risks, and alternatives.
   - Keeps a decision log.

9. User Interface
   - Dashboard for weekly plan.
   - Alerts for urgent decisions.
   - Draft room assistant.
   - Waiver/trade review queue.
   - Agent performance history.

10. Policy and Guardrails
   - Enforces user preferences.
   - Prevents high-risk or unauthorized moves.
   - Respects platform rules.
   - Requires approval above thresholds.

11. Mock Mode and Simulation Harness
   - Runs the same agent workflows against fake or recorded league states.
   - Simulates Yahoo API responses without submitting real actions.
   - Tests draft, lineup, waiver, FAAB, trade, and approval flows end to end.
   - Produces pass/fail results and recommendation quality metrics.

## Platform and API Strategy

The agent should only take actions through official, permitted APIs or user-approved platform workflows. Hidden endpoints, credential sharing, scraping, and browser automation should be treated as high-risk unless the platform explicitly allows them.

### Platform Capability Matrix

Each platform connector should declare exactly what it can do.

Example capabilities:
- `read_league_settings`
- `read_rosters`
- `read_matchups`
- `read_players`
- `read_transactions`
- `set_lineup`
- `add_player`
- `drop_player`
- `submit_waiver_claim`
- `propose_trade`
- `accept_trade`
- `draft_assist`

The agent should never assume write access. Write actions must be capability-gated and approval-gated.

### Mock Mode Strategy

Mock mode lets the user test every agent action before trusting it with a real league.

Core principle:
- Production mode and mock mode should use the same recommendation, approval, scoring, and explanation code.
- Only the platform connector changes.

Connectors:
- `YahooProductionConnector`: reads and writes through approved Yahoo APIs.
- `YahooReadOnlyConnector`: reads live Yahoo state but refuses all writes.
- `YahooMockConnector`: returns scripted or recorded Yahoo-like responses.
- `InMemoryLeagueConnector`: runs a fully fake league for unit and scenario tests.

Supported mock scenarios:
- Live snake draft.
- Salary cap draft.
- Weekly lineup changes.
- Waiver claims.
- FAAB bids.
- Add/drop free agents.
- Trade proposals.
- Incoming trade scoring.
- Approval through Slack/Teams mock callbacks.
- Yahoo API success/failure responses.

Action modes:

| Mode | Reads | Writes | Use case |
| --- | --- | --- | --- |
| `production` | Live Yahoo | Live Yahoo after approval | Real league management |
| `read_only` | Live Yahoo | Blocked | Safe recommendations against real league |
| `dry_run` | Live or recorded data | Simulated only | Verify exact action payloads |
| `mock` | Fake or recorded data | Simulated only | Test scenarios and demos |
| `replay` | Recorded historical state | Simulated only | Backtest decisions |

Dry-run actions should produce the exact Yahoo payload that would have been submitted, then stop before the API write.

Example:

```text
DRY RUN: Submit waiver claim
Add: Player A
Drop: Player B
FAAB: $17
Would POST to Yahoo transactions endpoint.
No real action submitted.
```

Mock mode pass criteria:
- Recommendation generated.
- Approval request generated.
- Approval accepted or rejected.
- Platform payload built.
- Mock connector returns expected response.
- Agent records submitted action as `dry_run` or `mock`.
- Final confirmation is sent to the user.
- No production connector is called.

Safety rules:
- Mock mode must show a visible `MOCK` or `DRY RUN` badge.
- Production OAuth tokens must not be required for fully fake mock scenarios.
- Dry-run against live Yahoo can read real state but must block writes at the connector boundary.
- Paid-league actions must be tested in dry run before enabling production execution.

### Best Initial Platform Targets

#### Yahoo Fantasy Sports

Yahoo is the strongest first candidate for a true API-action agent.

Why:
- Official Fantasy Sports API.
- OAuth-based user authorization.
- Supports reading fantasy data.
- Supports lineup edits.
- Supports add/drop transactions.
- Supports proposed trades.

Design implications:
- Build Yahoo first if the goal is API-based execution.
- Use OAuth, never stored user passwords.
- Default to user approval before writes.
- Log every write action and source recommendation.
- Respect Yahoo rate limits and API terms.

### Yahoo Prize League Scope

Yahoo supports paid fantasy football contests where users pay an entry fee and eligible finishers receive cash prizes.

Yahoo formats to account for:

1. Public Prize Leagues
   - Public Yahoo-managed leagues.
   - Entry fee is shown during registration.
   - Football Public Prize Leagues use standard settings.
   - Standard football Public Prize Leagues have 10 managers.
   - Prize payouts generally go to 1st, 2nd, and 3rd place.
   - Users may enter up to Yahoo's stated season/team limits.

2. Private Prize Leagues
   - Private leagues with a prize contest.
   - Commissioner defines entry fee and prize structure.
   - Yahoo states football Private Prize League entry fees can range from $10 to $250.
   - Prizes may be configured for up to the top 5 places.
   - Yahoo applies a management fee to Private Prize Leagues.

3. Cash Leagues / Paid Fantasy Terms
   - Yahoo treats these as contests of skill.
   - Eligibility depends on age, residence, physical location, and Yahoo's current restricted states.
   - Prize winners may need to provide tax information.
   - Withdrawals are handled through Yahoo-supported payment rails such as PayPal where available.

Design implications:
- The agent must track whether a league is paid.
- Paid leagues should default to advisory or assisted execution mode.
- The user must personally enter paid contests, accept Yahoo terms, and satisfy eligibility checks.
- The agent should not deposit funds, withdraw funds, enter paid contests, or change payment settings.
- The agent should not auto-submit paid-league actions unless the user explicitly enables a narrow policy.
- Recommended default: require approval for every roster, waiver, trade, and lineup action in paid leagues.
- The UI should display a paid-league badge and show a stronger confirmation before submitting any write action.
- Do not support account sharing, password collection, or another person playing under the user's Yahoo ID.
- Use only official OAuth/API access and avoid scraping, robots, hidden endpoints, or browser automation for paid contests.

#### Sleeper

Sleeper is a strong candidate for advisory mode, but not for automated actions through its public API.

Why:
- Official, free HTTP API.
- Easy league, draft, roster, user, and transaction reads.
- The public API is read-only and does not support modifying league contents.

Design implications:
- Good for a recommendation dashboard.
- Good for multi-league analysis.
- Not good for submitting lineups, waivers, or trades unless Sleeper later exposes a supported write API.

#### Fleaflicker

Fleaflicker publishes an HTTP API with useful league, roster, rules, transaction, player, and trade data.

Design implications:
- Treat as read-first until write support is confirmed.
- Useful for advisory mode and league-state ingestion.

#### ESPN

ESPN does not appear to offer a public, supported fantasy football API for third-party write actions.

Design implications:
- ESPN should not be the first platform for execution.
- Community wrappers and hidden endpoints may work for reads, but they are fragile and higher-risk.
- Use manual import or advisory-only mode unless official access is confirmed.

#### MyFantasyLeague

MyFantasyLeague has a long history of integrations and data access, and may be worth investigating for advanced dynasty leagues.

Design implications:
- Potentially useful for custom leagues.
- Verify current API and terms before building write actions.
- Good second-wave target if the user's league is already hosted there.

### Platforms to Avoid for Autonomous Actions

Daily fantasy and sportsbook platforms such as DraftKings and FanDuel should not be first-class autonomous execution targets.

Reasons:
- They are regulated gaming products.
- Automated scripts and bots are commonly prohibited.
- Account eligibility depends on physical location, age, product, and state law.
- Wagers, contest entries, and paid lineups create higher legal and compliance risk.

The safer design is to keep this agent focused on season-long fantasy team management, not placing bets or entering paid DFS contests.

## Legal and Compliance Notes

This product should not hold user funds, run contests, take a rake, process wagers, or place bets.

### Season-Long Fantasy

The agent can help manage a user's own season-long fantasy team on an existing platform, subject to that platform's rules.

Safe default:
- Give recommendations.
- Let the user approve moves.
- Execute only through official APIs where allowed.
- Do not automate around platform limits.

### Yahoo Paid Fantasy

Yahoo's paid fantasy products make this a money-involved product even though Yahoo frames the contests as games of skill. The agent should therefore treat Yahoo Public Prize Leagues, Private Prize Leagues, and Cash Leagues as compliance-sensitive.

Guardrails:
- Require the user to enter the league directly through Yahoo.
- Require the user to accept Yahoo's paid fantasy terms directly.
- Require the user to satisfy age, location, residence, and payment requirements directly.
- Never claim prize eligibility on the user's behalf.
- Never control deposits, withdrawals, refunds, tax forms, or payment instruments.
- Never bypass Yahoo eligibility, geolocation, or account rules.
- Keep a complete decision log for every recommendation and submitted action.

### Daily Fantasy Sports

Paid daily fantasy contests are available in many U.S. jurisdictions, but availability varies by state, parish, province, age, and product.

Design stance:
- The agent may provide general research.
- The agent should not automatically enter paid DFS contests.
- Any DFS integration must use platform-approved tools only.

### Sports Betting

Sports betting is legal only through licensed operators in jurisdictions where it is authorized and where the user is physically located.

Design stance:
- Do not build bet-placement automation.
- Do not hold balances or move money.
- If betting research is ever added, keep it separate from the season-long fantasy manager and require legal review.

### Responsible Use

If money is involved, the product should include:
- User-set spending limits.
- No auto-submit for paid contests or wagers.
- Clear legal eligibility checks.
- State/location warnings.
- Responsible gaming links.
- Decision logs and cool-off controls.

### High-Level Flow

```text
League Platform
    -> Platform Connector
    -> Normalized League State

External Data Sources
    -> Data Ingestion
    -> Player/Team/News Feature Store

League State + Feature Store
    -> Projection Engine
    -> Valuation Engine
    -> Decision Optimizers
    -> Agent Orchestrator
    -> Recommendation + Explanation
    -> User Approval
    -> Platform Action
```

## Player Intelligence Data Strategy

The agent should maintain its own canonical player table. External platforms and data vendors should be treated as sources of observations, not as the agent's permanent player identity.

This matters because player names, teams, position eligibility, injury tags, and source-specific IDs can drift. The agent needs a stable internal record so it can compare sources, explain disagreements, and evaluate players consistently across Yahoo, Sleeper, FantasyPros, nflverse, SportsDataIO, Sportradar, MyFantasyLeague, Fleaflicker, media feeds, and any future source.

### Canonical Player Table

The canonical player table stores stable identity and slow-changing profile data.

Example fields:
- `player_id`
- `display_name`
- `first_name`
- `last_name`
- `suffix`
- `team`
- `positions`
- `eligible_positions`
- `nfl_gsis_id`
- `external_ids`
- `birth_date`
- `height`
- `weight`
- `college`
- `draft_year`
- `draft_round`
- `draft_pick`
- `rookie_season`
- `current_status`
- `last_verified_at`

The canonical row should change carefully. For example, a team change or new eligibility should be updated, but a one-source typo should not rewrite the player identity.

### Source Observations

Every external pull should create source-specific observation records.

Example observation fields:
- `source_observation_id`
- `player_id`
- `source`
- `source_player_id`
- `observed_at`
- `season`
- `week`
- `data_type`
- `payload_hash`
- `raw_payload_ref`
- `normalized_fields`
- `source_confidence`

This lets the agent answer questions like:
- Which source changed first?
- Which sources agree?
- Which fields were stale?
- Did the recommendation depend on a rumor, an official injury tag, a projection, or real usage data?

### Required Player Feeds

#### Preseason Baseline

Preseason data should create the starting player value prior.

Inputs:
- Full player universe.
- Team, position, and platform eligibility.
- Prior-year and multi-year stats.
- Prior-year weekly usage.
- ADP, rankings, and projections.
- Age, draft capital, rookie status, and experience.
- Depth chart role.
- Injury history where licensed and available.

Outputs:
- Initial player rating.
- Draft and auction values.
- Replacement-level baselines by position.
- Player uncertainty score.

#### Weekly Stat Updates

Weekly stat updates should reset the agent's view of actual production and usage.

Inputs:
- Official or vendor weekly stat lines.
- Snaps, routes, targets, carries, touches, red-zone usage, air yards, and defensive matchup context where available.
- Fantasy points calculated against the user's exact league scoring.
- Team offensive environment and game script context.

Outputs:
- Updated weekly production.
- Usage trend.
- Role trend.
- Rest-of-season rating adjustment.
- Start/sit and waiver impact.

#### In-Week Availability

In-week availability should be handled separately from general player quality.

Inputs:
- Injury report status.
- Practice participation.
- Game status tags.
- Inactive lists.
- IR, PUP, suspension, personal absence, and roster transaction status.
- Depth chart changes.
- Weather and game-time risk where relevant.

Outputs:
- Availability probability.
- Expected workload adjustment.
- Backup/handcuff boost.
- Contingency alert.

#### Media Signals

Media should be treated as signals with source quality, recency, and corroboration, not as automatic facts.

Inputs:
- National fantasy news and analyst updates.
- Local beat writer reports.
- Team press conferences and coach quotes.
- Local market reporting.
- X/social posts through permitted APIs or approved aggregators.
- Podcast, newsletter, and article summaries where licensing permits.

Outputs:
- News severity.
- Confidence.
- Role-change signal.
- Injury-context signal.
- Trade, hold, drop, or watch-list trigger.
- Links or citations for the recommendation explanation.

### Player Rating Inputs

The player rating should be a blended output, not a single source ranking.

Core inputs:
- Preseason baseline value.
- Current weekly projection.
- Rest-of-season projection.
- Actual weekly production.
- Usage trend.
- Availability probability.
- Role security.
- Injury and re-injury risk.
- Team offensive environment.
- Schedule and playoff schedule.
- Market data such as ADP, roster percentage, adds, drops, and trade value.
- National and local media signal score.
- User roster fit and positional replacement value.

Every player rating should include a confidence score and a source trace.

## Data Model

### LeagueConfig

Stores scoring and roster rules.

Example fields:
- `platform`
- `league_id`
- `season`
- `scoring_rules`
- `roster_slots`
- `bench_slots`
- `waiver_type`
- `faab_budget`
- `trade_deadline`
- `playoff_weeks`

### Player

Canonical player identity controlled by our system.

Example fields:
- `player_id`
- `display_name`
- `first_name`
- `last_name`
- `suffix`
- `team`
- `positions`
- `eligible_positions`
- `external_ids`
- `current_status`
- `last_verified_at`

### PlayerExternalId

Maps the canonical player to each source-specific identifier.

Example fields:
- `player_id`
- `source`
- `source_player_id`
- `source_player_name`
- `matched_by`
- `match_confidence`
- `first_seen_at`
- `last_seen_at`

### PlayerSourceObservation

Raw or lightly normalized source data from a specific pull.

Example fields:
- `source_observation_id`
- `player_id`
- `source`
- `source_player_id`
- `data_type`
- `season`
- `week`
- `observed_at`
- `payload_hash`
- `raw_payload_ref`
- `normalized_fields`
- `source_confidence`

### PlayerProjection

Source-specific and blended projection data.

Example fields:
- `player_id`
- `week`
- `source`
- `projected_points`
- `floor`
- `ceiling`
- `injury_risk`
- `confidence`

### PlayerWeeklyStat

Weekly production and usage after a game window.

Example fields:
- `player_id`
- `season`
- `week`
- `team`
- `opponent`
- `source`
- `stat_line`
- `usage_metrics`
- `fantasy_points_by_scoring`
- `finalized_at`

### PlayerAvailabilitySnapshot

In-week availability and workload risk.

Example fields:
- `player_id`
- `season`
- `week`
- `source`
- `observed_at`
- `injury_status`
- `practice_status`
- `game_status`
- `transaction_status`
- `availability_probability`
- `expected_workload_factor`
- `notes`

### PlayerMediaSignal

National and local media intelligence.

Example fields:
- `media_signal_id`
- `player_id`
- `source`
- `source_type`
- `market`
- `author`
- `published_at`
- `observed_at`
- `headline`
- `url`
- `summary`
- `signal_type`
- `severity`
- `confidence`
- `corroborated_by`

### PlayerRating

The agent's current opinion of a player for a specific league context.

Example fields:
- `player_id`
- `league_id`
- `season`
- `week`
- `rating_type`
- `value_over_replacement`
- `weekly_value`
- `rest_of_season_value`
- `availability_adjusted_value`
- `risk_score`
- `confidence`
- `source_trace`
- `created_at`

### DraftState

Current state of a live draft.

Example fields:
- `draft_id`
- `league_id`
- `draft_type`
- `round`
- `pick_number`
- `current_team_id`
- `user_next_pick_number`
- `pick_seconds_remaining`
- `available_player_ids`
- `drafted_player_ids`
- `team_roster_snapshots`
- `last_synced_at`
- `sync_confidence`

### DraftPlayerScore

A transparent score for an available player at a specific draft moment.

Example fields:
- `draft_id`
- `pick_number`
- `player_id`
- `final_score`
- `marginal_team_value`
- `value_over_replacement`
- `scarcity_urgency`
- `market_value_edge`
- `ceiling_adjustment`
- `roster_construction_fit`
- `opponent_blocking_value`
- `risk_penalty`
- `survival_probability_next_pick`
- `tier_id`
- `tier_dropoff_after_player`
- `rule_adjustments`
- `source_trace`
- `created_at`

### DraftRecommendationOption

One of up to five options shown to the user when it is their turn.

Example fields:
- `recommendation_id`
- `option_rank`
- `player_id`
- `headline`
- `pros`
- `cons`
- `score_breakdown`
- `why_now`
- `why_not_wait`
- `backup_if_skipped`
- `requires_manual_yahoo_pick`

### WaiverPlayerScore

A transparent score for an available player in a specific league and week.

Example fields:
- `league_id`
- `team_id`
- `season`
- `week`
- `player_id`
- `waiver_score`
- `marginal_roster_gain`
- `rest_of_season_value`
- `role_change_signal`
- `short_term_start_value`
- `scarcity_at_position`
- `playoff_schedule_value`
- `contingent_upside`
- `market_urgency`
- `drop_cost`
- `risk_penalty`
- `source_trace`
- `created_at`

### WaiverMoveRecommendation

A complete add/drop recommendation.

Example fields:
- `recommendation_id`
- `add_player_id`
- `drop_player_id`
- `net_move_score`
- `recommended_faab`
- `conservative_faab`
- `aggressive_faab`
- `max_faab`
- `claim_order`
- `pros`
- `cons`
- `deadline`
- `source_trace`

### TradeScore

A scored trade package from the user's perspective and the opponent's likely perspective.

Example fields:
- `trade_score_id`
- `league_id`
- `user_team_id`
- `opponent_team_id`
- `give_player_ids`
- `get_player_ids`
- `user_trade_score`
- `opponent_fit_score`
- `starting_lineup_gain`
- `rest_of_season_value_gain`
- `playoff_odds_gain`
- `positional_scarcity_gain`
- `roster_flexibility_gain`
- `schedule_gain`
- `risk_reduction`
- `depth_loss_penalty`
- `bye_week_penalty`
- `suggested_message`
- `source_trace`
- `created_at`

### SimulationRun

A mock, dry-run, or replay session.

Example fields:
- `simulation_run_id`
- `mode`
- `scenario_name`
- `league_id`
- `source_state_ref`
- `started_at`
- `finished_at`
- `status`
- `pass_count`
- `fail_count`
- `warnings`
- `summary`

### SimulationEvent

An event that happened during a simulation.

Example fields:
- `simulation_event_id`
- `simulation_run_id`
- `event_type`
- `event_payload`
- `expected_result`
- `actual_result`
- `passed`
- `created_at`

### RosterState

Current roster and lineup state.

Example fields:
- `team_id`
- `players`
- `starters`
- `bench`
- `ir`
- `taxi`
- `open_slots`

### Recommendation

Every agent output should be stored.

Example fields:
- `recommendation_id`
- `type`
- `priority`
- `summary`
- `actions`
- `expected_gain`
- `confidence`
- `reasoning`
- `risks`
- `requires_approval`
- `status`
- `expires_at`
- `league_is_paid`
- `approval_channel`
- `approval_token_hash`
- `version`

### ApprovalDecision

Every user decision should be stored separately from the recommendation so the agent has an audit trail.

Example fields:
- `approval_id`
- `recommendation_id`
- `user_id`
- `channel`
- `channel_user_id`
- `decision`
- `decision_note`
- `created_at`
- `ip_hash`
- `user_agent_hash`
- `submitted_action_id`

### SubmittedAction

Every Yahoo write attempt should be stored, whether it succeeds or fails.

Example fields:
- `submitted_action_id`
- `recommendation_id`
- `platform`
- `league_id`
- `team_id`
- `action_type`
- `payload_hash`
- `submitted_at`
- `platform_response_status`
- `platform_response_id`
- `result`
- `error_message`
- `execution_mode`
- `simulation_run_id`

## Agent Schedule

### Daily

- Refresh player identity deltas and source ID mappings.
- Refresh projections and news.
- Check injuries and depth chart changes.
- Revalue roster and free agents.
- Scan for trade opportunities.

### After Games

- Import final player stat lines.
- Import usage metrics.
- Recalculate league-specific fantasy points.
- Update rest-of-season ratings.
- Flag role changes that should affect waivers or trades.

### Tuesday

- Build waiver plan.
- Recommend FAAB bids.
- Identify drop candidates.
- Check bye week pressure.

### Wednesday to Saturday

- Monitor injury reports.
- Monitor local and national media signals.
- Update lineups.
- Reassess waiver/free agent opportunities.
- Prepare contingency plans.

### Sunday

- Run early lineup check.
- Monitor inactives.
- Send urgent alerts.
- Re-optimize before each kickoff window.

### Monday

- Evaluate remaining lineup decisions.
- Recalculate matchup odds.
- Prepare recap.

### Before Any Production Release

- Run mock draft scenarios.
- Run dry-run lineup changes.
- Run dry-run waiver and FAAB submissions.
- Run dry-run trade proposals.
- Verify approval cards and callbacks.
- Verify no production connector is called in mock mode.
- Verify submitted action logs include `execution_mode`.

## Recommendation Format

Every recommendation should answer:

1. What should I do?
2. Why?
3. How much does it help?
4. What could go wrong?
5. What is the backup plan?
6. Does this require approval?

Example:

```text
Start Player A over Player B.

Reason: Player A has a higher median projection, a stronger target share trend,
and a better game environment. Player B has a questionable tag and plays in the
late window, which adds inactive risk.

Expected gain: +2.4 projected points.
Confidence: Medium-high.
Risk: Player B has the higher ceiling if fully active.
Backup: If Player A is inactive, switch to Player C.
Approval: Required.
```

## First Build Scope

### MVP

The first useful version should be an advisory agent, not a fully autonomous manager.

MVP features:
- Manual league settings import.
- Manual roster import or one platform connector.
- Weekly projection import.
- Lineup optimizer.
- Waiver/free agent recommendations.
- Drop candidate ranking.
- Simple trade evaluator.
- Decision explanations.
- Decision log.
- Mock mode for recommendations, approvals, and simulated platform actions.
- Dry-run mode that builds exact action payloads without submitting them.

MVP exclusions:
- Full autonomous execution.
- Deep negotiation agent.
- Dynasty-specific modeling.
- Auction draft automation.
- Multi-platform support.
- Real-money DFS.

### Version 2

- Platform write actions with approval.
- FAAB optimizer.
- News monitor.
- Trade package generator.
- Draft assistant.
- Playoff schedule planning.
- Manager tendencies.
- Recorded replay and scenario simulation harness.

### Version 3

- Autonomous low-risk moves.
- Multi-league portfolio management.
- Dynasty/keeper strategy.
- Auction draft strategy.
- Simulation-based season planning.
- Post-season model evaluation.

## Winning Strategy Principles

The agent should be built around durable edges:

- Know the league settings better than opponents.
- Value replacement level accurately.
- React to real role changes faster than opponents.
- Preserve flexibility.
- Do not chase points without usage.
- Trade from depth into starting lineup upgrades.
- Plan for playoffs before the rest of the league does.
- Use FAAB aggressively when the opportunity is real.
- Avoid fragile rosters full of questionable players and same-bye risks.
- Learn from decisions, not just outcomes.

## Risks

### Bad Data

Player IDs, injury statuses, projections, media reports, and platform rosters can drift.

Mitigation:
- Use source timestamps.
- Store raw data.
- Show confidence.
- Alert when sources disagree.
- Keep canonical player identity separate from source observations.
- Require stronger corroboration for media-only availability changes.

### Over-Automation

The agent could submit a bad move faster than a human would.

Mitigation:
- Approval gates.
- Move limits.
- FAAB limits.
- Confidence thresholds.
- Rollback-aware logging where possible.

### Platform Restrictions

Some fantasy platforms may restrict automation.

Mitigation:
- Start with advisory mode.
- Review platform terms before write actions.
- Prefer official APIs or user-approved workflows.

### Projection Overfitting

The agent may optimize noisy weekly projections too aggressively.

Mitigation:
- Use projection ranges.
- Blend multiple sources.
- Track actual performance.
- Penalize unstable inputs.

## Open Questions

The foundational MVP scope is now decided in `DECISIONS.md` and `REQUIREMENTS.md`: Yahoo, local dashboard, redraft half-PPR snake draft, recommendation-only draft copilot, mock/static projections first, and multiple Yahoo leagues from day one.

Remaining strategy decisions before real-season usage:

1. Should low-risk actions ever become auto-approved, or should every paid Yahoo league action require explicit approval?
2. Should every production action require a successful dry run first?
3. Which draft strategy profile should be the default: balanced, hero RB, zero RB, robust RB, elite QB, or best player available?
4. Should the default risk style be safe floor, balanced, or upside-heavy?
5. Should waiver recommendations include FAAB dollar ranges?
6. Should trade scoring optimize weekly wins, playoff odds, long-term roster value, or a blended score?

## Recommended First Implementation Path

1. Define the league schema.
2. Build the canonical player table.
3. Add source ID mapping.
4. Add preseason player baseline import.
5. Build a local roster and league-settings importer.
6. Add projection import.
7. Add weekly stat and availability imports.
8. Implement lineup optimization.
9. Implement waiver add/drop scoring.
10. Produce explainable weekly recommendations.
11. Add a decision log.
12. Connect one fantasy platform.
13. Add approval-based write actions.
14. Expand into draft, trade, and media monitoring.
