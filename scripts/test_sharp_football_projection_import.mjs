import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { parseCsvText } from "../src/data/csv.mjs";
import { normalizeSharpFootballProjectionRows } from "../src/data/sharpFootballProjections.mjs";
import { mockPlayers } from "../src/draft/mockData.mjs";

const samplePath = "data/projections/samples/sharp_football_projection_sample.csv";
const rows = parseCsvText(await readFile(samplePath, "utf8"));
const normalized = normalizeSharpFootballProjectionRows(rows, mockPlayers, {
  scoringFormat: "half_ppr",
  updatedAt: "2026-05-24T00:00:00.000Z",
});

assert.equal(normalized.source, "sharp_football_projections");
assert.equal(normalized.matchedCount, 4);
assert.equal(normalized.unmatched.length, 0);
assert.equal(normalized.ambiguous.length, 0);
assert.equal(normalized.rows[0].playerId, "p_001");
assert.equal(normalized.rows[0].projectedPoints, 344.5);
assert.equal(normalized.rows[0].stats.rushingYards, 1180);
assert.equal(normalized.rows[2].playerId, "p_019");
assert.equal(normalized.rows[2].stats.passingTd, 30);

const unmatched = normalizeSharpFootballProjectionRows([
  { Player: "Not A Real Player", Team: "FA", Pos: "RB", "Half PPR": "100" },
], mockPlayers, { scoringFormat: "half_ppr" });
assert.equal(unmatched.matchedCount, 0);
assert.equal(unmatched.unmatched[0].reason, "no_name_match");

const run = spawnSync(process.execPath, ["scripts/import_sharp_football_projections.mjs", samplePath, "half_ppr"], {
  encoding: "utf8",
  env: {
    ...process.env,
    PROJECTION_OUTPUT_DIR: "/private/tmp/fantasy_sharp_projection_import_test",
  },
});

assert.equal(run.status, 0, run.stderr);
const summary = JSON.parse(run.stdout);
assert.equal(summary.source, "sharp_football_projections");
assert.equal(summary.matchedCount, 4);
assert.equal(summary.unmatchedCount, 0);
assert.ok(existsSync(summary.outputs.normalized));
assert.ok(existsSync(summary.outputs.audit));
assert.ok(existsSync(summary.outputs.merged));

const merged = JSON.parse(await readFile(summary.outputs.merged, "utf8"));
const christian = merged.players.find((player) => player.playerId === "p_001");
assert.equal(merged.source, "sharp_football_projections");
assert.equal(christian.projectedPoints, 344.5);
assert.equal(christian.projectionSource.source, "sharp_football_projections");

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "Sharp Football CSV normalization",
    "name/team/position player matching",
    "provider unmatched audit",
    "Sharp Football import CLI outputs",
  ],
}, null, 2));
