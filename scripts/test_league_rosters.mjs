import assert from "node:assert/strict";
import { createDraftState, draftPlayer } from "../src/draft/draftEngine.mjs";
import { buildLeagueRosterSnapshot } from "../src/draft/leagueRosters.mjs";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";

const state = createDraftState(mockLeague, mockTeams, mockPlayers);
draftPlayer(state, "p_001", "team_1", "mock");
draftPlayer(state, "p_002", "team_2", "mock");
draftPlayer(state, "p_003", mockLeague.userTeamId, "manual_user");

const snapshot = buildLeagueRosterSnapshot(state);
const userTeam = snapshot.teams.find((team) => team.teamId === mockLeague.userTeamId);

assert.equal(snapshot.leagueId, mockLeague.leagueId);
assert.equal(snapshot.teams.length, mockLeague.teams);
assert.equal(snapshot.currentPick, 4);
assert.equal(userTeam.isUserTeam, true);
assert.equal(userTeam.pickCount, 1);
assert.equal(userTeam.rosterCounts.WR, 1);
assert.equal(userTeam.openSlots.WR, 1);
assert.equal(userTeam.openSlots.QB, 1);
assert.equal(userTeam.roster[0].name, "Tyreek Hill");
assert.equal(userTeam.roster[0].pickNumber, 3);

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "league roster snapshot",
    "user team detection",
    "open slot calculation",
    "pick metadata hydration",
  ],
}, null, 2));
