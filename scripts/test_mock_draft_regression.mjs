import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import {
  createDraftState,
  draftPlayer,
  getMaxDraftPicks,
  getTeamRoster,
  isUserTurn,
  recommendPlayers,
  runMockUntilUserTurn,
  undoLastPick,
} from "../src/draft/draftEngine.mjs";
import { buildPostDraftReview } from "../src/draft/rosterReview.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const generatedPoolPath = path.join(projectRoot, "data", "mock", "current_player_pool.json");

const generatedPool = await loadGeneratedPool();

runFullDraftScenario("static fixture", mockPlayers);
runFullDraftScenario("generated player pool", generatedPool);
testUndoBehavior(generatedPool);
testGeneratedRankingSanity(generatedPool);

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "static full mock draft",
    "generated full mock draft",
    "required roster validation",
    "post-draft review generation",
    "undo behavior",
    "generated ranking sanity",
  ],
}, null, 2));

function runFullDraftScenario(name, players) {
  const state = createDraftState(mockLeague, mockTeams, players);
  let recommendationTurns = 0;

  while (state.currentPick <= getMaxDraftPicks(state)) {
    runMockUntilUserTurn(state);
    if (!isUserTurn(state)) break;

    const recommendations = recommendPlayers(state, mockLeague.userTeamId, 5);
    assert.ok(recommendations.length > 0, `${name}: expected recommendations at pick ${state.currentPick}`);
    assertRecommendationSourceTrace(name, recommendations[0]);
    draftPlayer(state, recommendations[0].player.playerId, mockLeague.userTeamId, "regression_accept");
    recommendationTurns += 1;
  }

  assert.equal(state.drafted.length, mockLeague.teams * mockLeague.draft.rounds, `${name}: draft should complete`);
  assert.equal(recommendationTurns, mockLeague.draft.rounds, `${name}: user should pick once per round`);
  assertValidRequiredRoster(name, state);

  const review = buildPostDraftReview(state, mockLeague.userTeamId);
  assert.ok(review.projectedLineup.length >= 7, `${name}: post-draft review should include projected starters`);
  assert.ok(review.strengths.length > 0, `${name}: post-draft review should include strengths`);
  assert.ok(review.weaknesses.length > 0, `${name}: post-draft review should include weaknesses`);
}

function testUndoBehavior(players) {
  const state = createDraftState(mockLeague, mockTeams, players);
  runMockUntilUserTurn(state);
  const beforePick = state.currentPick;
  const [top] = recommendPlayers(state, mockLeague.userTeamId, 1);
  draftPlayer(state, top.player.playerId, mockLeague.userTeamId, "regression_accept");

  const undone = undoLastPick(state);
  assert.equal(undone.pickNumber, beforePick, "undo should return the pick it removed");
  assert.equal(state.currentPick, beforePick, "undo should restore current pick");
  assert.equal(getTeamRoster(state, mockLeague.userTeamId).length, 0, "undo should remove player from roster");
}

function testGeneratedRankingSanity(players) {
  const topTwenty = players.slice().sort((a, b) => a.adp - b.adp).slice(0, 20);
  const earlyKickers = topTwenty.filter((player) => player.position === "K");
  const earlyDefenses = topTwenty.filter((player) => player.position === "DST");
  const unexpectedEarlyQbs = topTwenty
    .filter((player) => player.position === "QB")
    .filter((player) => !["Josh Allen", "Jalen Hurts", "Lamar Jackson"].includes(player.name));

  assert.equal(earlyKickers.length, 0, "generated ADP should not place kickers in the top 20");
  assert.equal(earlyDefenses.length, 0, "generated ADP should not place defenses in the top 20");
  assert.equal(unexpectedEarlyQbs.length, 0, `generated ADP has unexpected early QBs: ${unexpectedEarlyQbs.map((player) => player.name).join(", ")}`);
}

function assertRecommendationSourceTrace(name, recommendation) {
  assert.equal(typeof recommendation.sourceConfidence, "number", `${name}: recommendation should expose source confidence`);
  assert.ok(recommendation.sourceConfidence > 0 && recommendation.sourceConfidence <= 1, `${name}: source confidence should be a 0-1 score`);
  assert.ok(recommendation.sourceTrace?.source, `${name}: recommendation should expose source trace`);
  assert.ok(recommendation.sourceTrace?.label, `${name}: recommendation should expose source label`);
}

function assertValidRequiredRoster(name, state) {
  const roster = getTeamRoster(state, mockLeague.userTeamId);
  const rosterCounts = roster.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});

  for (const [position, required] of Object.entries(mockLeague.rosterSlots)) {
    if (!["QB", "RB", "WR", "TE", "K", "DST"].includes(position)) continue;
    assert.ok((rosterCounts[position] ?? 0) >= required, `${name}: missing required ${position}`);
  }
}

async function loadGeneratedPool() {
  const payload = JSON.parse(await readFile(generatedPoolPath, "utf8"));
  assert.ok(Array.isArray(payload.players), "generated pool file should contain players");
  return payload.players;
}
