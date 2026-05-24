import assert from "node:assert/strict";
import { mergeProjectionSource, normalizeProjectionRows } from "../src/data/projectionSource.mjs";

const players = [
  { playerId: "ply_1", name: "Player One", stats: { reception: 10 }, projectedPoints: 80, sourceRank: 20 },
  { playerId: "ply_2", name: "Player Two", stats: { reception: 20 }, projectedPoints: 90, sourceRank: 18 },
];

const rows = normalizeProjectionRows([
  {
    player_id: "ply_1",
    source: "fixture_projection_source",
    projected_points: 123.4,
    source_rank: 7,
    adp: 8.5,
    confidence: 0.82,
  },
], { source: "fixture_projection_source" });

assert.equal(rows[0].playerId, "ply_1");
assert.equal(rows[0].projectedPoints, 123.4);

const merged = mergeProjectionSource(players, rows, { source: "fixture_projection_source" });

assert.equal(merged.matchedCount, 1);
assert.deepEqual(merged.missingProjectionIds, ["ply_2"]);
assert.equal(merged.players[0].projectedPoints, 123.4);
assert.equal(merged.players[0].projectionSource.source, "fixture_projection_source");

assert.throws(() => normalizeProjectionRows([{ playerId: "ply_3" }]), /projectedPoints/);

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "projection source normalization",
    "projection merge metadata",
    "bad projection row validation",
  ],
}, null, 2));
