import assert from "node:assert/strict";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { createAppServer } from "./serve_mock_draft.mjs";

const server = createAppServer();
const baseUrl = await listen(server);
const profilePath = "data/leagues/active_yahoo_settings.json";
let originalProfile = null;
let hadOriginalProfile = true;

try {
  try {
    originalProfile = await readFile(profilePath, "utf8");
  } catch {
    hadOriginalProfile = false;
  }

  const home = await fetchText(`${baseUrl}/`);
  assert.equal(home.status, 200);
  assert.match(home.text, /Fantasy Football Agent/);

  const missing = await fetchText(`${baseUrl}/not-a-real-route`);
  assert.equal(missing.status, 404);
  assert.equal(missing.text.trim(), "Not found");

  const yahooStatus = await fetchJson(`${baseUrl}/api/yahoo/status`);
  assert.equal(yahooStatus.status, 200);
  assert.equal(yahooStatus.body.readOnly, true);
  assert.equal(typeof yahooStatus.body.configured, "boolean");

  const leagueProfile = await fetchJson(`${baseUrl}/api/league-profile`);
  assert.equal(leagueProfile.status, 200);
  assert.equal(typeof leagueProfile.body.exists, "boolean");

  const sampleSettings = JSON.parse(await readFile("data/fixtures/yahoo_league_settings_sample.json", "utf8"));
  const saveProfile = await fetchJson(`${baseUrl}/api/league-profile`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ yahooSettings: sampleSettings, selectedLeague: { leagueKey: "test.l.1" } }),
  });
  assert.equal(saveProfile.status, 200);
  assert.equal(saveProfile.body.saved, true);
  assert.ok(saveProfile.body.savedAt);

  const simulationsGet = await fetchJson(`${baseUrl}/api/simulations/run`);
  assert.equal(simulationsGet.status, 405);
  assert.match(simulationsGet.body.error, /Method not allowed/);

  const badSimulationBody = await fetchJson(`${baseUrl}/api/simulations/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(badSimulationBody.status, 400);
  assert.match(badSimulationBody.body.error, /Invalid JSON body/);

  const simulationRun = await fetchJson(`${baseUrl}/api/simulations/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      strategyIds: ["balanced"],
      playerPool: "static",
      scenario: {
        teams: 10,
        draftSlot: 7,
        rounds: 9,
        ppr: 1,
        opponentProfileId: "wr_heavy",
      },
    }),
  });
  assert.equal(simulationRun.status, 200);
  assert.equal(simulationRun.body.reports.length, 1);
  assert.equal(simulationRun.body.winner.strategy.id, "balanced");
  assert.equal(simulationRun.body.scenario.teams, 10);
  assert.equal(simulationRun.body.scenario.draftSlot, 7);
  assert.equal(simulationRun.body.scenario.ppr, 1);
  assert.equal(simulationRun.body.scenario.opponentProfileId, "wr_heavy");
  assert.equal(simulationRun.body.reports[0].opponentProfile.id, "wr_heavy");

  const missingLeagueKey = await fetchJson(`${baseUrl}/api/yahoo/league-settings`);
  assert.equal(missingLeagueKey.status, 400);
  assert.match(missingLeagueKey.body.error, /leagueKey is required/);

  console.log(JSON.stringify({
    status: "passed",
    tested: [
      "static dashboard route",
      "not found route",
      "Yahoo status route",
      "league profile get and put",
      "simulation method guard",
      "simulation invalid JSON guard",
      "simulation run route with scenario overrides",
      "Yahoo league settings validation",
    ],
  }, null, 2));
} finally {
  await close(server);
  if (hadOriginalProfile) {
    await writeFile(profilePath, originalProfile);
  } else {
    await unlink(profilePath).catch(() => {});
  }
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function fetchText(url, options) {
  const response = await fetch(url, options);
  return {
    status: response.status,
    text: await response.text(),
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  return {
    status: response.status,
    body: await response.json(),
  };
}
