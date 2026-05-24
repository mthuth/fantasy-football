import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const jsonRun = runImport("data/projections/samples/mock_projection_sample.json", "mock_projection_sample_test");
const csvRun = runImport("data/projections/samples/mock_projection_sample.csv", "mock_projection_sample_csv_test");

assert.equal(jsonRun.status, 0, jsonRun.stderr);
assert.equal(csvRun.status, 0, csvRun.stderr);

const jsonSummary = JSON.parse(jsonRun.stdout);
const csvSummary = JSON.parse(csvRun.stdout);

assert.equal(jsonSummary.matchedCount, 4);
assert.equal(csvSummary.matchedCount, 4);
assert.ok(jsonSummary.missingProjectionCount > 0);
assert.ok(csvSummary.missingProjectionCount > 0);
assert.ok(existsSync(jsonSummary.output));
assert.ok(existsSync(csvSummary.output));

const merged = JSON.parse(await readFile(jsonSummary.output, "utf8"));
const christian = merged.players.find((player) => player.playerId === "p_001");

assert.equal(merged.source, "mock_projection_sample_test");
assert.equal(christian.projectedPoints, 361.4);
assert.equal(christian.projectionSource.source, "mock_projection_sample_test");

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "sample JSON projection import",
    "sample CSV projection import",
    "merged projection output",
  ],
}, null, 2));

function runImport(inputPath, source) {
  return spawnSync(process.execPath, ["scripts/import_projection_source.mjs", inputPath, source], {
    encoding: "utf8",
    env: {
      ...process.env,
      PROJECTION_OUTPUT_DIR: "/private/tmp/fantasy_projection_import_test",
    },
  });
}
