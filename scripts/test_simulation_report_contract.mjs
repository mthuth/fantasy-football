import assert from "node:assert/strict";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import { runDraftSimulation } from "../src/draft/simulator.mjs";

const simulation = runDraftSimulation({
  league: mockLeague,
  teams: mockTeams,
  players: mockPlayers,
  strategyId: "balanced",
  opponentProfileId: "agent",
  mode: "mock_contract_test",
});

const report = simulation.report;

assert.match(report.simulationRunId, /^sim_balanced_/);
assert.equal(report.mode, "mock_contract_test");
assert.equal(report.strategy.id, "balanced");
assert.equal(report.opponentProfile.id, "agent");
assert.ok(Date.parse(report.createdAt), "report should include a parseable timestamp");
assert.equal(report.league.leagueId, mockLeague.leagueId);
assert.equal(report.league.draft.type, "snake");
assert.deepEqual(report.league.rosterSlots, mockLeague.rosterSlots);

assert.equal(report.summary.picksMade, mockLeague.teams * mockLeague.draft.rounds);
assert.equal(report.draftLog.length, report.summary.picksMade);
assert.equal(report.userRoster.length, mockLeague.draft.rounds);
assert.equal(report.userRecommendations.length, mockLeague.draft.rounds);
assert.equal(report.replayTurns.length, mockLeague.draft.rounds);

const firstTurn = report.userRecommendations[0];
assert.ok(firstTurn.pickNumber > 0);
assert.equal(firstTurn.options.length, 5);
assert.ok(firstTurn.options[0].scoreBreakdown, "saved recommendations should include full score breakdown");
assert.equal(typeof firstTurn.options[0].whyNow, "string");
assert.equal(typeof firstTurn.options[0].mainRisk, "string");
assert.equal(typeof firstTurn.options[0].rosterFitNote, "string");
assert.equal(typeof firstTurn.options[0].sourceTrace.source, "string");

assert.ok(report.postDraftReview.summary.projectedStarterPoints > 0);
assert.ok(Array.isArray(report.postDraftReview.projectedLineup));
assert.ok(Array.isArray(report.postDraftReview.strengths));
assert.ok(Array.isArray(report.postDraftReview.weaknesses));
assert.ok(Array.isArray(report.postDraftReview.waiverWatch));
assert.ok(report.postDraftReview.tradePlan);
assert.ok(Array.isArray(report.postDraftReview.tradePlan.suggestedActions));

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "simulation report timestamp and model settings",
    "league settings and snake draft transcript",
    "user roster and recommendation turns",
    "saved recommendation score breakdown",
    "post-draft waiver and trade watch output",
  ],
}, null, 2));
