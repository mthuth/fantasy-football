import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = JSON.parse(await readFile("data/simulations/index.json", "utf8"));
assert.ok(Array.isArray(index.reports), "index should expose reports array");
assert.ok(index.reports.length > 0, "index should contain at least one report");

const latest = index.reports[0];
assert.ok(latest.file.endsWith(".json"), "latest report should point to json file");
assert.ok(latest.projectedStarterPoints > 0, "latest report should summarize starter points");

const report = JSON.parse(await readFile(`data/simulations/${latest.file}`, "utf8"));
assert.equal(report.simulationRunId, latest.simulationRunId);
assert.ok(report.postDraftReview, "report should include post-draft review");
assert.ok(report.userRecommendations.length > 0, "report should include recommendation turns");
assert.ok(report.userRoster.length > 0, "report should include user roster");

console.log(JSON.stringify({
  status: "passed",
  reportsIndexed: index.reports.length,
  latest: latest.simulationRunId,
}, null, 2));
