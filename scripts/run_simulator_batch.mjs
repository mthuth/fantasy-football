import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import { saveSimulationReport } from "../src/draft/reporting.mjs";
import {
  buildSimulationScenario,
  buildTeamsForSimulation,
  getSimulationStrategies,
  runSimulationBatch,
} from "../src/draft/simulator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const generatedPoolPath = path.join(projectRoot, "data", "mock", "current_player_pool.json");
const outputDir = path.join(projectRoot, "data", "simulations");

const strategyIds = (process.env.SIM_STRATEGIES ?? getSimulationStrategies().map((strategy) => strategy.id).join(","))
  .split(",")
  .map((strategy) => strategy.trim())
  .filter(Boolean);
const playerPool = await loadPlayerPool();
const scenarioLeague = buildSimulationScenario(mockLeague, {
  teams: process.env.SIM_TEAMS,
  draftSlot: process.env.SIM_DRAFT_SLOT,
  rounds: process.env.SIM_ROUNDS,
  ppr: process.env.SIM_PPR,
  opponentProfileId: process.env.SIM_OPPONENT_PROFILE,
});
const simulations = runSimulationBatch({
  league: scenarioLeague,
  teams: hasScenarioOverrides() ? buildTeamsForSimulation(scenarioLeague) : mockTeams,
  players: playerPool,
  strategyIds,
  opponentProfileId: scenarioLeague.simulationScenario.opponentProfileId,
});

const savedReports = [];
for (const simulation of simulations) {
  const reportPath = await saveSimulationReport(simulation.report, projectRoot);
  savedReports.push({
    ...simulation.summary,
    reportPath,
  });
}

const batch = {
  batchRunId: `batch_${new Date().toISOString().replaceAll(/[:.]/g, "-")}`,
  createdAt: new Date().toISOString(),
  league: scenarioLeague.name,
  scenario: scenarioLeague.simulationScenario,
  playerPool: playerPool === mockPlayers ? "static_fixture" : "generated_current_players",
  strategies: strategyIds,
  winner: chooseWinner(savedReports),
  reports: savedReports.sort((a, b) =>
    b.projectedStarterPoints - a.projectedStarterPoints ||
    b.projectedRosterPoints - a.projectedRosterPoints ||
    a.weaknessCount - b.weaknessCount
  ),
};

await mkdir(outputDir, { recursive: true });
const batchPath = path.join(outputDir, `${batch.batchRunId}.json`);
await writeFile(batchPath, `${JSON.stringify(batch, null, 2)}\n`);

console.log(JSON.stringify({
  batchRunId: batch.batchRunId,
  output: batchPath,
  league: batch.league,
  scenario: batch.scenario,
  playerPool: batch.playerPool,
  winner: batch.winner,
  reports: batch.reports.map((report) => ({
    strategy: report.strategy,
    projectedStarterPoints: report.projectedStarterPoints,
    projectedRosterPoints: report.projectedRosterPoints,
    weaknessCount: report.weaknessCount,
    reportPath: report.reportPath,
  })),
}, null, 2));

async function loadPlayerPool() {
  if (process.env.PLAYER_POOL !== "generated") return mockPlayers;

  try {
    const payload = JSON.parse(await readFile(generatedPoolPath, "utf8"));
    if (Array.isArray(payload.players) && payload.players.length >= mockLeague.teams * mockLeague.draft.rounds) {
      return payload.players;
    }
  } catch {
    // Static fixture fallback keeps the simulator runnable before generated data exists.
  }

  return mockPlayers;
}

function hasScenarioOverrides() {
  return Boolean(process.env.SIM_TEAMS || process.env.SIM_DRAFT_SLOT || process.env.SIM_ROUNDS || process.env.SIM_PPR || process.env.SIM_OPPONENT_PROFILE);
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
