import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile("public/index.html", "utf8");
const app = await readFile("public/app.js", "utf8");
const server = await readFile("scripts/serve_mock_draft.mjs", "utf8");

const idsInHtml = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
const queriedIds = [...app.matchAll(/querySelector\("#([^"]+)"\)/g)].map((match) => match[1]);

for (const id of queriedIds) {
  assert.ok(idsInHtml.has(id), `public/app.js queries #${id}, but public/index.html does not define it`);
}

for (const id of [
  "advance-btn",
  "accept-btn",
  "pause-btn",
  "undo-btn",
  "reset-btn",
  "manual-player-search",
  "manual-player-select",
  "import-sample-league-btn",
  "import-custom-league-btn",
  "strategy-profile",
  "risk-profile",
  "prefer-stacking",
  "import-projection-source-btn",
  "rehearsal-mode",
  "rehearsal-sync-btn",
  "manual-sync-resolution",
  "sync-event-history",
  "run-simulations-btn",
  "sim-teams",
  "sim-draft-slot",
  "sim-rounds",
  "sim-ppr",
  "sim-opponent-profile",
  "sim-use-saved-league",
  "simulation-comparison",
  "refresh-reports-btn",
  "connect-yahoo-btn",
  "refresh-yahoo-readiness-btn",
  "yahoo-readiness-summary",
  "yahoo-readiness-checks",
  "yahoo-readiness-actions",
  "discover-yahoo-leagues-btn",
  "import-yahoo-league-btn",
]) {
  assert.ok(idsInHtml.has(id), `dashboard should include #${id}`);
}

for (const endpoint of [
  "/api/league-profile",
  "/api/simulations/run",
  "/api/yahoo/status",
  "/api/yahoo/readiness",
  "/api/yahoo/auth-url",
  "/api/yahoo/games",
  "/api/yahoo/teams",
  "/api/yahoo/league-options",
  "/api/yahoo/league-settings",
  "/api/yahoo/draft-results",
]) {
  assert.ok(app.includes(endpoint), `public/app.js should call ${endpoint}`);
  assert.ok(server.includes(endpoint), `scripts/serve_mock_draft.mjs should handle ${endpoint}`);
}

assert.ok(app.includes("/data/mock/current_player_pool.json"), "generated player pool should be loaded by the dashboard");
assert.ok(app.includes("/data/simulations/index.json"), "simulation report index should be loaded by the dashboard");
assert.ok(app.includes("Recommendations paused"), "pause state should have visible copy");
assert.ok(app.includes("Source confidence"), "recommendation cards should show source confidence");
assert.ok(app.includes("strategyPreference"), "recommendation cards should include strategy preference adjustments");
assert.ok(app.includes("buildRehearsalDraftEvents"), "dashboard should support Yahoo-like draft rehearsal sync");
assert.ok(app.includes("resolveManualSyncWithSelected"), "dashboard should support manual sync issue resolution");
assert.ok(app.includes("renderSyncEventHistory"), "dashboard should render sync event queue history");
assert.ok(app.includes("mergeProjectionSource"), "dashboard should support projection source imports");
assert.ok(app.includes("Latest Batch Comparison"), "dashboard should render strategy comparison output");
assert.ok(app.includes("Turn Replay"), "dashboard should render saved recommendation replay details");
assert.ok(app.includes("Live draft blocked"), "dashboard should render Yahoo readiness blockers");
assert.ok(app.includes("formatReadinessCheck"), "dashboard should label Yahoo readiness checks");

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "HTML ids match app selectors",
    "required dashboard controls exist",
    "dashboard API endpoints are wired in app and server",
    "generated pool and report index hooks exist",
    "pause and source-confidence UI copy exists",
    "strategy, rehearsal, sync history, and projection import hooks exist",
    "scenario controls and replay UI copy exists",
    "Yahoo readiness dashboard hooks exist",
  ],
}, null, 2));
