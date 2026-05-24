import assert from "node:assert/strict";
import { createDraftState, draftPlayer, recommendPlayers } from "../src/draft/draftEngine.mjs";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import { normalizeStrategyPreferences, scoreStrategyPreference } from "../src/draft/strategyPreferences.mjs";

const normalized = normalizeStrategyPreferences({
  strategyProfile: "zero_rb",
  riskProfile: "upside_heavy",
  preferStacking: true,
  avoidTeams: ["dal"],
  avoidPlayers: ["Example Player"],
});

assert.equal(normalized.strategyProfile, "zero_rb");
assert.equal(normalized.riskProfile, "upside_heavy");
assert.equal(normalized.avoidTeams[0], "DAL");

const state = createDraftState({
  ...mockLeague,
  strategyPreferences: { strategyProfile: "zero_rb", riskProfile: "safe_floor" },
}, mockTeams, mockPlayers);
const rb = state.players.find((player) => player.position === "RB");
const wr = state.players.find((player) => player.position === "WR");

assert.ok(rb);
assert.ok(wr);

const rbAdjustment = scoreStrategyPreference({
  preferences: state.league.strategyPreferences,
  roster: [],
  player: rb,
  currentPick: state.currentPick,
});
const wrAdjustment = scoreStrategyPreference({
  preferences: state.league.strategyPreferences,
  roster: [],
  player: wr,
  currentPick: state.currentPick,
});

assert.ok(rbAdjustment.adjustment < wrAdjustment.adjustment);

const fallenValueAdjustment = scoreStrategyPreference({
  preferences: { strategyProfile: "best_player_available", riskProfile: "balanced" },
  roster: [],
  player: { ...wr, adp: 20 },
  currentPick: 60,
});
const reachAdjustment = scoreStrategyPreference({
  preferences: { strategyProfile: "best_player_available", riskProfile: "balanced" },
  roster: [],
  player: { ...wr, adp: 90 },
  currentPick: 60,
});

assert.ok(fallenValueAdjustment.adjustment > reachAdjustment.adjustment, "best-player-available should reward players who fall past ADP");

draftPlayer(state, wr.playerId, state.league.userTeamId, "test");
const recommendations = recommendPlayers(state, state.league.userTeamId, 5, {
  strategyPreferences: { strategyProfile: "best_player_available", riskProfile: "balanced" },
});

assert.equal(recommendations.length, 5);
assert.ok(recommendations.every((recommendation) => recommendation.strategyPreference));

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "strategy preference normalization",
    "profile scoring adjustments",
    "best-player-available market edge direction",
    "recommendation output includes strategy metadata",
  ],
}, null, 2));
