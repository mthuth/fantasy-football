import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadYahooLeagueSettingsProfile, saveYahooLeagueSettingsProfile } from "../src/league/leagueProfileStore.mjs";
import { loadLocalEnv } from "../src/config/loadLocalEnv.mjs";
import { YahooReadOnlyConnector } from "../src/connectors/yahoo/YahooReadOnlyConnector.mjs";
import { loadYahooTokens, saveYahooTokens } from "../src/connectors/yahoo/YahooTokenStore.mjs";
import { normalizeYahooDraftResults } from "../src/connectors/yahoo/yahooDraftResultsNormalizer.mjs";
import { discoverYahooLeagueOptions } from "../src/connectors/yahoo/yahooLeagueDiscovery.mjs";
import { normalizeYahooLeagueTeams, normalizeYahooTeamRoster } from "../src/connectors/yahoo/yahooRosterNormalizer.mjs";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import { buildLeagueFromYahooSettings } from "../src/league/leagueImport.mjs";
import { saveSimulationReport } from "../src/draft/reporting.mjs";
import {
  buildSimulationScenario,
  buildTeamsForSimulation,
  getOpponentProfiles,
  getSimulationStrategies,
  runSimulationBatch,
} from "../src/draft/simulator.mjs";

await loadLocalEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const preferredPort = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const maxPortAttempts = Number(process.env.PORT_ATTEMPTS ?? 10);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);

if (isMainModule()) {
  listenWithFallback(preferredPort, 0).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export function createAppServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url, `http://${host}`);

    if (url.pathname === "/api/league-profile") {
      await handleLeagueProfileApi(request, response);
      return;
    }

    if (url.pathname === "/api/simulations/run") {
      await handleRunSimulationsApi(request, response);
      return;
    }

    if (url.pathname.startsWith("/api/yahoo/") || url.pathname === "/oauth/yahoo/callback") {
      await handleYahooApi(request, response, url);
      return;
    }

    const pathname = url.pathname === "/" ? "/public/index.html" : url.pathname;
    const filePath = path.normalize(path.join(root, pathname));

    if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "content-type": types.get(path.extname(filePath)) ?? "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  });
}

export function listenWithFallback(port, attempt = 0) {
  const server = createAppServer();
  return new Promise((resolve, reject) => {
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE" && attempt + 1 < maxPortAttempts) {
        server.close();
        listenWithFallback(port + 1, attempt + 1).then(resolve, reject);
        return;
      }
      handleListenError(error, port);
      reject(error);
    });

    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      console.log(`Fantasy Football Agent mock draft dashboard: http://${host}:${actualPort}`);
      if (actualPort !== preferredPort) {
        console.log(`Preferred port ${preferredPort} was busy, so the dashboard started on ${actualPort}.`);
      }
      resolve({ server, port: actualPort, host });
    });
  });
}

function handleListenError(error, port) {
  if (error.code === "EADDRINUSE") {
    console.error(`No local port available from ${preferredPort} to ${preferredPort + maxPortAttempts - 1}. Set PORT to a free port and retry.`);
  } else if (error.code === "EACCES" || error.code === "EPERM") {
    console.error(`Cannot bind ${host}:${port}. Try HOST=127.0.0.1 PORT=${port + 1} npm start.`);
  } else {
    console.error(error);
  }
  process.exit(1);
}

async function handleLeagueProfileApi(request, response) {
  try {
    if (request.method === "GET") {
      sendJson(response, 200, await loadYahooLeagueSettingsProfile());
      return;
    }

    if (request.method === "PUT") {
      const body = await readJsonBody(request);
      const saved = await saveYahooLeagueSettingsProfile(body.yahooSettings, undefined, body.selectedLeague ?? null);
      sendJson(response, 200, { saved: true, savedAt: saved.savedAt });
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
}

async function handleRunSimulationsApi(request, response) {
  try {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(request);
    const strategyIds = Array.isArray(body.strategyIds) && body.strategyIds.length > 0
      ? body.strategyIds
      : getSimulationStrategies().map((strategy) => strategy.id);
    const playerPool = await loadServerPlayerPool(body.playerPool === "generated");
    const baseLeague = await loadSimulationBaseLeague(body.useSavedLeague !== false);
    const scenarioLeague = buildSimulationScenario(baseLeague, body.scenario ?? {});
    const simulations = runSimulationBatch({
      league: scenarioLeague,
      teams: shouldUseMockTeams(scenarioLeague) ? mockTeams : buildTeamsForSimulation(scenarioLeague),
      players: playerPool,
      strategyIds,
      opponentProfileId: scenarioLeague.simulationScenario.opponentProfileId,
      mode: "dashboard_simulator",
    });
    const reports = [];

    for (const simulation of simulations) {
      const reportPath = await saveSimulationReport(simulation.report, root);
      reports.push({
        ...simulation.summary,
        file: path.basename(reportPath),
      });
    }

    const batch = {
      batchRunId: `batch_${new Date().toISOString().replaceAll(/[:.]/g, "-")}`,
      createdAt: new Date().toISOString(),
      league: {
        leagueId: scenarioLeague.leagueId,
        name: scenarioLeague.name,
        teams: scenarioLeague.teams,
        draft: scenarioLeague.draft,
        rosterSlots: scenarioLeague.rosterSlots,
      },
      scenario: scenarioLeague.simulationScenario,
      opponentProfiles: getOpponentProfiles(),
      reports,
      winner: chooseWinner(reports),
    };
    const outputDir = path.join(root, "data", "simulations");
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, `${batch.batchRunId}.json`), `${JSON.stringify(batch, null, 2)}\n`);

    sendJson(response, 200, batch);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
}

async function loadSimulationBaseLeague(useSavedLeague) {
  if (!useSavedLeague) return mockLeague;

  const profile = await loadYahooLeagueSettingsProfile();
  if (!profile.exists || !profile.yahooSettings) return mockLeague;
  return buildLeagueFromYahooSettings(mockLeague, profile.yahooSettings, profile.selectedLeague ?? {});
}

async function handleYahooApi(request, response, url) {
  try {
    if (url.pathname === "/api/yahoo/status" && request.method === "GET") {
      sendJson(response, 200, await getYahooStatus());
      return;
    }

    if (url.pathname === "/api/yahoo/auth-url" && request.method === "GET") {
      const connector = buildYahooConnector();
      const state = randomBytes(16).toString("hex");
      sendJson(response, 200, {
        authUrl: connector.buildAuthorizationUrl({ state }),
        state,
        scope: "fspt-r",
      });
      return;
    }

    if (url.pathname === "/oauth/yahoo/callback" && request.method === "GET") {
      await handleYahooCallback(response, url);
      return;
    }

    if (url.pathname === "/api/yahoo/games" && request.method === "GET") {
      const connector = await buildAuthorizedYahooConnector();
      sendJson(response, 200, await connector.readUserGames());
      return;
    }

    if (url.pathname === "/api/yahoo/teams" && request.method === "GET") {
      const connector = await buildAuthorizedYahooConnector();
      sendJson(response, 200, await connector.readUserTeams());
      return;
    }

    if (url.pathname === "/api/yahoo/league-options" && request.method === "GET") {
      const connector = await buildAuthorizedYahooConnector();
      const payload = await connector.readUserTeams();
      sendJson(response, 200, {
        leagues: discoverYahooLeagueOptions(payload),
        raw: payload,
      });
      return;
    }

    if (url.pathname === "/api/yahoo/league-settings" && request.method === "GET") {
      const leagueKey = url.searchParams.get("leagueKey");
      if (!leagueKey) throw new Error("leagueKey is required.");
      const connector = await buildAuthorizedYahooConnector();
      sendJson(response, 200, await connector.readLeagueSettings(leagueKey));
      return;
    }

    if (url.pathname === "/api/yahoo/draft-results" && request.method === "GET") {
      const leagueKey = url.searchParams.get("leagueKey");
      if (!leagueKey) throw new Error("leagueKey is required.");
      const connector = await buildAuthorizedYahooConnector();
      const raw = await connector.readLeagueDraftResults(leagueKey);
      const externalIds = await loadExternalPlayerIds();
      const players = await loadCanonicalPlayers();
      const playerPool = await loadServerPlayerPool(url.searchParams.get("playerPool") === "generated");
      sendJson(response, 200, {
        ...normalizeYahooDraftResults(raw, {
          leagueKey,
          externalIds,
          players,
          playerPool,
          teamCount: mockLeague.teams,
        }),
        raw,
      });
      return;
    }

    if (url.pathname === "/api/yahoo/league-rosters" && request.method === "GET") {
      const leagueKey = url.searchParams.get("leagueKey");
      if (!leagueKey) throw new Error("leagueKey is required.");
      const connector = await buildAuthorizedYahooConnector();
      const rawTeams = await connector.readLeagueTeams(leagueKey);
      const externalIds = await loadExternalPlayerIds();
      const players = await loadCanonicalPlayers();
      const playerPool = await loadServerPlayerPool(url.searchParams.get("playerPool") === "generated");
      const teams = normalizeYahooLeagueTeams(rawTeams);
      const rosters = [];

      for (const team of teams) {
        const rawRoster = await connector.readTeamRoster(team.teamKey);
        rosters.push({
          ...team,
          roster: normalizeYahooTeamRoster(rawRoster, { externalIds, players, playerPool }),
          raw: rawRoster,
        });
      }

      sendJson(response, 200, {
        leagueKey,
        syncStatus: rosters.length > 0 ? "synced" : "manual_required",
        teamCount: teams.length,
        rosteredPlayerCount: rosters.reduce((sum, team) => sum + team.roster.length, 0),
        unmatchedPlayerCount: rosters.reduce((sum, team) => sum + team.roster.filter((player) => player.matchStatus !== "matched").length, 0),
        teams: rosters,
        rawTeams,
      });
      return;
    }

    sendJson(response, 404, { error: "Yahoo endpoint not found" });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
}

async function getYahooStatus() {
  const config = {
    hasClientId: Boolean(process.env.YAHOO_CLIENT_ID),
    hasClientSecret: Boolean(process.env.YAHOO_CLIENT_SECRET),
    redirectUri: process.env.YAHOO_REDIRECT_URI ?? null,
  };
  const saved = await loadYahooTokens();
  return {
    configured: config.hasClientId && config.hasClientSecret && Boolean(config.redirectUri),
    config,
    token: saved.summary ?? { connected: false, hasRefreshToken: false, expiresAt: null, scope: null },
    readOnly: true,
  };
}

async function handleYahooCallback(response, url) {
  const error = url.searchParams.get("error");
  if (error) {
    sendHtml(response, 400, `<h1>Yahoo authorization failed</h1><p>${escapeHtml(error)}</p>`);
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    sendHtml(response, 400, "<h1>Yahoo authorization failed</h1><p>Missing authorization code.</p>");
    return;
  }

  const connector = buildYahooConnector();
  const tokenSet = await connector.exchangeAuthorizationCode(code);
  await saveYahooTokens(tokenSet);
  sendHtml(response, 200, "<h1>Yahoo connected</h1><p>You can close this tab and return to Fantasy Football Agent.</p>");
}

function buildYahooConnector(options = {}) {
  return new YahooReadOnlyConnector(options);
}

async function buildAuthorizedYahooConnector() {
  const saved = await loadYahooTokens();
  if (!saved.exists) {
    throw new Error("Yahoo is not connected yet. Use Connect Yahoo first.");
  }

  let tokenSet = saved.tokenSet;
  if (isExpiredOrClose(tokenSet) && tokenSet.refresh_token) {
    const connector = buildYahooConnector({ refreshToken: tokenSet.refresh_token });
    const refreshed = await connector.refreshAccessToken();
    tokenSet = {
      ...tokenSet,
      ...refreshed,
      refresh_token: refreshed.refresh_token ?? tokenSet.refresh_token,
    };
    await saveYahooTokens(tokenSet);
  }

  return buildYahooConnector({
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
  });
}

function isExpiredOrClose(tokenSet) {
  if (!tokenSet.expires_at) return false;
  return new Date(tokenSet.expires_at).getTime() - Date.now() < 60_000;
}

async function loadServerPlayerPool(useGenerated) {
  if (!useGenerated) return mockPlayers;

  try {
    const payload = JSON.parse(await readFile(path.join(root, "data", "mock", "current_player_pool.json"), "utf8"));
    if (Array.isArray(payload.players) && payload.players.length >= mockLeague.teams * mockLeague.draft.rounds) {
      return payload.players;
    }
  } catch {
    // Static fallback keeps the dashboard simulator available before generated data exists.
  }

  return mockPlayers;
}

async function loadExternalPlayerIds() {
  try {
    const externalIdsPath = path.join(root, "data", "normalized", "player_external_ids.json");
    const payload = JSON.parse(await readFile(externalIdsPath, "utf8"));
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

async function loadCanonicalPlayers() {
  try {
    const playersPath = path.join(root, "data", "normalized", "players.json");
    const payload = JSON.parse(await readFile(playersPath, "utf8"));
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

function chooseWinner(reports) {
  const [winner] = reports.slice().sort((a, b) =>
    b.projectedStarterPoints - a.projectedStarterPoints ||
    b.projectedRosterPoints - a.projectedRosterPoints ||
    a.weaknessCount - b.weaknessCount
  );
  return winner ? {
    strategy: winner.strategy,
    projectedStarterPoints: winner.projectedStarterPoints,
    projectedRosterPoints: winner.projectedRosterPoints,
    weaknessCount: winner.weaknessCount,
  } : null;
}

function shouldUseMockTeams(league) {
  return league.teams === mockLeague.teams
    && league.draft.userDraftSlot === mockLeague.draft.userDraftSlot
    && league.userTeamId === mockLeague.userTeamId;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html><head><title>Yahoo Fantasy</title></head><body>${html}</body></html>`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    request.on("error", reject);
  });
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}
