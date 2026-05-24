import assert from "node:assert/strict";
import { auditPlayerPoolQuality, summarizeKickerDefenseCoverage } from "../src/data/playerDataQuality.mjs";
import { mockPlayers } from "../src/draft/mockData.mjs";

const externalIds = mockPlayers.slice(0, 3).map((player, index) => ({
  source: "yahoo",
  source_player_id: String(index + 1),
  player_id: player.playerId,
}));

const audit = auditPlayerPoolQuality(mockPlayers, { externalIds });
const specialTeams = summarizeKickerDefenseCoverage(mockPlayers);

assert.equal(audit.playerCount, mockPlayers.length);
assert.equal(audit.status, "needs_attention");
assert.ok(audit.byPosition.QB > 0);
assert.ok(audit.byPosition.K > 0);
assert.ok(audit.byPosition.DST > 0);
assert.ok(audit.missingYahooIdCount > 0);
assert.equal(specialTeams.hasMinimumMockCoverage, true);
assert.ok(specialTeams.kickerCount >= 2);
assert.ok(specialTeams.defenseCount >= 2);

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "player pool quality audit",
    "Yahoo external ID gap detection",
    "K/DST coverage summary",
  ],
}, null, 2));
