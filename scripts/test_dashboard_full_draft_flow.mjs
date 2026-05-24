import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import {
  createDraftState,
  draftPlayer,
  getMaxDraftPicks,
  getTeamForPick,
  getTeamRoster,
  isUserTurn,
  recommendPlayers,
  runMockUntilUserTurn,
} from "../src/draft/draftEngine.mjs";
import { buildPostDraftReview } from "../src/draft/rosterReview.mjs";

const css = await readFile("public/styles.css", "utf8");

assert.match(css, /button:disabled/, "dashboard CSS should visibly style disabled buttons");
assert.match(css, /cursor:\s*not-allowed/, "disabled buttons should use not-allowed cursor");

let state = createDraftState(mockLeague, mockTeams, mockPlayers);
assert.equal(renderPickStatus(state), "Pick 1 - Opponent 1", "initial dashboard status should start at pick 1");

runMockUntilUserTurn(state);
assert.equal(isUserTurn(state), true, "advance button should move the board to the user's pick");
assert.ok(recommendPlayers(state, mockLeague.userTeamId, 5).length > 0, "recommendation cards should render on user turn");

let userTurns = 0;
while (state.currentPick <= getMaxDraftPicks(state)) {
  if (!isUserTurn(state)) runMockUntilUserTurn(state);
  if (!isUserTurn(state)) break;

  const [topRecommendation] = recommendPlayers(state, mockLeague.userTeamId, 1);
  assert.ok(topRecommendation, `expected a top recommendation at pick ${state.currentPick}`);
  draftPlayer(state, topRecommendation.player.playerId, mockLeague.userTeamId, "dashboard_accept_top");
  userTurns += 1;
  runMockUntilUserTurn(state);
}

assert.equal(renderPickStatus(state), "Draft complete", "dashboard status should show draft completion");
assert.equal(userTurns, mockLeague.draft.rounds, "dashboard flow should draft one user pick per round");
assert.equal(state.drafted.length, mockLeague.teams * mockLeague.draft.rounds, "dashboard flow should complete every pick");
assertValidRequiredRoster(state);

const review = buildPostDraftReview(state, mockLeague.userTeamId);
assert.ok(review.projectedLineup.length > 0, "completed dashboard flow should produce projected lineup review");
assert.ok(review.waiverWatch.length > 0, "completed dashboard flow should produce waiver watch output");

state = createDraftState(mockLeague, mockTeams, mockPlayers);
assert.equal(renderPickStatus(state), "Pick 1 - Opponent 1", "reset should return dashboard status to pick 1");
assert.equal(state.drafted.length, 0, "reset should clear drafted players");

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "initial dashboard draft status",
    "advance to user pick",
    "recommendation cards available",
    "draft top recommendation through all user turns",
    "draft complete status",
    "required roster validation",
    "post-draft review generation",
    "reset returns to pick 1",
    "disabled button styling contract",
  ],
}, null, 2));

function renderPickStatus(state) {
  if (state.currentPick > getMaxDraftPicks(state)) return "Draft complete";
  const teamId = getTeamForPick(state.league, state.currentPick);
  const team = state.teams.find((candidate) => candidate.teamId === teamId);
  return `Pick ${state.currentPick} - ${team?.name ?? teamId}`;
}

function assertValidRequiredRoster(state) {
  const roster = getTeamRoster(state, mockLeague.userTeamId);
  const rosterCounts = roster.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});

  for (const [position, required] of Object.entries(mockLeague.rosterSlots)) {
    if (!["QB", "RB", "WR", "TE", "K", "DST"].includes(position)) continue;
    assert.ok((rosterCounts[position] ?? 0) >= required, `dashboard flow missing required ${position}`);
  }
}
