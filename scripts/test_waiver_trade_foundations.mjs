import assert from "node:assert/strict";
import { createDraftState, draftPlayer } from "../src/draft/draftEngine.mjs";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import { recommendWaiverPickups, scoreDropCandidates } from "../src/waivers/waiverRecommendations.mjs";
import { findTradePartners, scoreTradeProposal } from "../src/trades/tradeScoring.mjs";

const state = createDraftState(mockLeague, mockTeams, mockPlayers);
draftPlayer(state, "p_019", mockLeague.userTeamId, "manual_user");
draftPlayer(state, "p_001", mockLeague.userTeamId, "manual_user");
draftPlayer(state, "p_005", mockLeague.userTeamId, "manual_user");
draftPlayer(state, "p_014", mockLeague.userTeamId, "manual_user");
draftPlayer(state, "p_002", "team_1", "mock");
draftPlayer(state, "p_003", "team_1", "mock");

const waiverTargets = recommendWaiverPickups(state, mockLeague.userTeamId, { limit: 5 });
const dropCandidates = scoreDropCandidates(state, mockLeague.userTeamId, { limit: 2 });
const tradeScore = scoreTradeProposal(state, {
  fromTeamId: mockLeague.userTeamId,
  toTeamId: "team_1",
  givePlayerIds: ["p_014"],
  receivePlayerIds: ["p_003"],
});
const partners = findTradePartners(state, mockLeague.userTeamId);

assert.equal(waiverTargets.length, 5);
assert.ok(waiverTargets[0].score >= waiverTargets[1].score);
assert.equal(dropCandidates.length, 2);
assert.equal(tradeScore.recommendation, "favorable");
assert.ok(tradeScore.userDelta > 0);
assert.ok(Array.isArray(partners));

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "waiver pickup ranking",
    "drop candidate scoring",
    "trade proposal scoring",
    "trade partner discovery",
  ],
}, null, 2));
