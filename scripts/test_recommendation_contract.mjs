import assert from "node:assert/strict";
import { createDraftState, recommendPlayers, runMockUntilUserTurn } from "../src/draft/draftEngine.mjs";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";

const REQUIRED_BREAKDOWN_KEYS = [
  "marginalTeamValue",
  "valueOverReplacement",
  "scarcityUrgency",
  "marketValueEdge",
  "ceilingAdjustment",
  "rosterConstructionFit",
  "opponentBlockingValue",
  "riskPenalty",
];

const state = createDraftState(mockLeague, mockTeams, mockPlayers);
runMockUntilUserTurn(state);

const recommendations = recommendPlayers(state, mockLeague.userTeamId, 5);

assert.ok(recommendations.length > 0, "user turn should produce recommendations");
assert.ok(recommendations.length <= 5, "recommendations should be capped at five");

for (const recommendation of recommendations) {
  assert.equal(typeof recommendation.player.name, "string");
  assert.equal(typeof recommendation.player.team, "string");
  assert.equal(typeof recommendation.player.position, "string");
  assert.equal(typeof recommendation.finalScore, "number");
  assert.equal(typeof recommendation.whyNow, "string");
  assert.equal(typeof recommendation.mainRisk, "string");
  assert.equal(typeof recommendation.rosterFitNote, "string");
  assert.equal(typeof recommendation.sourceTrace.source, "string");
  assert.equal(typeof recommendation.sourceTrace.label, "string");
  assert.ok(Array.isArray(recommendation.projectionExplanation.components));

  for (const key of REQUIRED_BREAKDOWN_KEYS) {
    assert.equal(typeof recommendation.scoreBreakdown[key], "number", `${key} should be present in scoreBreakdown`);
    assert.equal(recommendation[key], recommendation.scoreBreakdown[key], `${key} should match the legacy top-level field`);
  }
}

const sortedScores = recommendations.map((recommendation) => recommendation.finalScore);
assert.deepEqual(
  sortedScores,
  sortedScores.slice().sort((a, b) => b - a),
  "recommendations should be sorted by score descending"
);

const adpLeague = {
  ...mockLeague,
  teams: 2,
  userTeamId: "team_1",
  draft: {
    ...mockLeague.draft,
    rounds: 20,
    userDraftSlot: 1,
  },
  rosterSlots: {
    ...mockLeague.rosterSlots,
    QB: 0,
    RB: 0,
    WR: 1,
    TE: 0,
    FLEX: 0,
    K: 0,
    DST: 0,
    BENCH: 19,
  },
};
const adpState = createDraftState(adpLeague, [
  { teamId: "team_1", name: "My Team", draftSlot: 1, picks: [] },
  { teamId: "team_2", name: "Opponent", draftSlot: 2, picks: [] },
], [
  {
    playerId: "adp_bargain",
    name: "ADP Bargain",
    position: "WR",
    team: "BUF",
    bye: 7,
    sourceRank: 40,
    adp: 20,
    stats: { reception: 90, receivingYards: 1100, receivingTd: 7 },
    risk: 2,
    ceiling: 8,
    source: "test",
  },
  {
    playerId: "adp_reach",
    name: "ADP Reach",
    position: "WR",
    team: "DAL",
    bye: 7,
    sourceRank: 40,
    adp: 90,
    stats: { reception: 90, receivingYards: 1100, receivingTd: 7 },
    risk: 2,
    ceiling: 8,
    source: "test",
  },
]);
adpState.currentPick = 35;
const adpRecommendations = recommendPlayers(adpState, "team_1", 2);

assert.equal(adpRecommendations[0].player.playerId, "adp_bargain", "falling ADP value should rank above an otherwise identical reach");
assert.ok(adpRecommendations[0].marketValueEdge > 0, "falling ADP value should have positive market edge");
assert.ok(adpRecommendations[1].marketValueEdge < 0, "ADP reach should have negative market edge");

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "top-five recommendation cap",
    "recommendation card required fields",
    "full score breakdown contract",
    "source trace and projection explanation",
    "score ordering",
    "ADP bargain scores above otherwise identical reach",
  ],
}, null, 2));
