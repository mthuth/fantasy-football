import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeYahooDraftResults } from "../src/connectors/yahoo/yahooDraftResultsNormalizer.mjs";
import { createDraftState, draftPlayer } from "../src/draft/draftEngine.mjs";
import { applySyncedDraftPicks, compareSyncedPicksToDraftState } from "../src/draft/draftSync.mjs";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";

const payload = JSON.parse(await readFile("data/fixtures/yahoo_draft_results_sample.json", "utf8"));
const externalIds = [
  { source: "yahoo", source_player_id: "101", player_id: "p_001" },
  { source: "yahoo", source_player_id: "102", player_id: "p_002" },
  { source: "yahoo", source_player_id: "999999", player_id: "ply_missing_from_pool" },
];
const canonicalPlayers = [
  { player_id: "p_001", display_name: "Christian McCaffrey", positions: ["RB"] },
  { player_id: "p_002", display_name: "CeeDee Lamb", positions: ["WR"] },
  { player_id: "ply_missing_from_pool", display_name: "Unmapped Yahoo Player", positions: ["WR"] },
];

const normalized = normalizeYahooDraftResults(payload, {
  externalIds,
  players: canonicalPlayers,
  playerPool: mockPlayers,
  teamCount: mockLeague.teams,
});

assert.equal(normalized.summary.pickCount, 3);
assert.equal(normalized.summary.mappedPickCount, 2);
assert.equal(normalized.summary.unmappedPlayerCount, 1);
assert.equal(normalized.picks[0].playerId, "p_001");
assert.equal(normalized.picks[0].teamId, "team_1");
assert.equal(normalized.picks[1].playerId, "p_002");
assert.equal(normalized.unmappedPlayers[0].reason, "canonical_player_not_in_active_pool");

const state = createDraftState(mockLeague, mockTeams, mockPlayers);
const syncResult = applySyncedDraftPicks(state, normalized.picks);

assert.equal(syncResult.appliedCount, 2);
assert.equal(syncResult.skippedCount, 1);
assert.equal(state.drafted.length, 2);
assert.equal(state.currentPick, 3);
assert.equal(state.teams[0].picks[0].playerId, "p_001");

const conflictState = createDraftState(mockLeague, mockTeams, mockPlayers);
draftPlayer(conflictState, "p_002", "team_1", "manual_current_team");
const conflicts = compareSyncedPicksToDraftState(conflictState, normalized.picks);
assert.equal(conflicts.length, 1);
assert.equal(conflicts[0].type, "manual_pick_conflict");

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "Yahoo draft result parsing",
    "Yahoo player ID mapping",
    "unmapped player quarantine",
    "synced pick application",
    "manual conflict detection",
  ],
}, null, 2));
