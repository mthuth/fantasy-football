import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTeamRoster } from "../src/draft/draftEngine.mjs";
import { saveSimulationReport } from "../src/draft/reporting.mjs";
import { runDraftSimulation } from "../src/draft/simulator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const generatedPoolPath = path.join(projectRoot, "data", "mock", "current_player_pool.json");
const strategyId = process.env.SIM_STRATEGY ?? "balanced";

const playerPool = await loadPlayerPool();
const simulation = runDraftSimulation({
  league: mockLeague,
  teams: mockTeams,
  players: playerPool,
  strategyId,
  mode: "mock",
});
const { state, report } = simulation;

const userPicks = state.teams
  .find((team) => team.teamId === mockLeague.userTeamId)
  .picks.map((pick) => {
    const player = state.players.find((candidate) => candidate.playerId === pick.playerId);
    return `${pick.pickNumber}. ${player.name} (${player.position})`;
  });

const rosterValidation = validateRequiredRoster(state, mockLeague.userTeamId);
if (!rosterValidation.valid) {
  console.error(JSON.stringify({
    mode: "mock",
    error: "invalid_final_roster",
    missingRequiredPositions: rosterValidation.missingRequiredPositions,
    rosterCounts: rosterValidation.rosterCounts,
    userPicks,
  }, null, 2));
  process.exit(1);
}
const reportPath = await saveSimulationReport(report, projectRoot);

console.log(JSON.stringify({
  mode: "mock",
  strategy: simulation.strategy,
  league: mockLeague.name,
  playerPool: playerPool === mockPlayers ? "static_fixture" : "generated_current_players",
  picksMade: state.drafted.length,
  userPicks,
  firstRecommendationSet: report.userRecommendations[0],
  recommendationTurns: report.userRecommendations.length,
  simulationReport: reportPath,
}, null, 2));

async function loadPlayerPool() {
  if (process.env.PLAYER_POOL !== "generated") return mockPlayers;

  try {
    const payload = JSON.parse(await readFile(generatedPoolPath, "utf8"));
    if (Array.isArray(payload.players) && payload.players.length >= mockLeague.teams * mockLeague.draft.rounds) {
      return payload.players;
    }
  } catch {
    // Static fixture fallback keeps mock mode usable before data generation.
  }

  return mockPlayers;
}

function validateRequiredRoster(state, teamId) {
  const roster = getTeamRoster(state, teamId);
  const rosterCounts = roster.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
  const missingRequiredPositions = Object.entries(state.league.rosterSlots)
    .filter(([position]) => ["QB", "RB", "WR", "TE", "K", "DST"].includes(position))
    .flatMap(([position, required]) => {
      const missing = Math.max(0, required - (rosterCounts[position] ?? 0));
      return missing > 0 ? [{ position, required, drafted: rosterCounts[position] ?? 0, missing }] : [];
    });

  return {
    valid: missingRequiredPositions.length === 0,
    missingRequiredPositions,
    rosterCounts,
  };
}
