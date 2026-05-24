import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mockLeague, mockPlayers } from "../src/draft/mockData.mjs";
import {
  buildStrategyTuningScenarios,
  buildTuningMarkdown,
  evaluateStrategyWeightCandidates,
} from "../src/draft/strategyTuning.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const generatedPoolPath = path.join(projectRoot, "data", "mock", "current_player_pool.json");
const docsDir = path.join(projectRoot, "docs");
const outputPath = path.join(docsDir, "STRATEGY_WEIGHT_TUNING.md");

const playerPool = await loadPlayerPool();
const scenarios = buildStrategyTuningScenarios(mockLeague, {
  teamCounts: parseList(process.env.TUNING_TEAMS, [8, 10, 12]).map(Number),
  pprValues: parseList(process.env.TUNING_PPR, [0, 0.5, 1]).map(Number),
  rounds: parseList(process.env.TUNING_ROUNDS, [10, 14]).map(Number),
  opponentProfileIds: parseList(process.env.TUNING_OPPONENTS, null),
  limit: process.env.TUNING_SCENARIO_LIMIT ? Number(process.env.TUNING_SCENARIO_LIMIT) : undefined,
});

const result = evaluateStrategyWeightCandidates({
  baseLeague: mockLeague,
  players: playerPool,
  scenarios,
});

await mkdir(docsDir, { recursive: true });
await writeFile(outputPath, buildTuningMarkdown(result));

console.log(JSON.stringify({
  output: outputPath,
  playerPool: playerPool === mockPlayers ? "static_fixture" : "generated_current_players",
  simulations: result.simulationCount,
  scenarios: result.scenarioCount,
  winner: result.winner && {
    candidateId: result.winner.candidateId,
    averageScore: result.winner.averageScore,
    averageStarterPoints: result.winner.averageStarterPoints,
    wins: result.winner.wins,
  },
  recommendedDefaultStrategy: result.recommendedDefaultStrategy,
  topCandidates: result.rankings.slice(0, 3).map((ranking) => ({
    candidateId: ranking.candidateId,
    averageScore: ranking.averageScore,
    averageStarterPoints: ranking.averageStarterPoints,
    averageWeaknessCount: ranking.averageWeaknessCount,
    wins: ranking.wins,
  })),
}, null, 2));

async function loadPlayerPool() {
  try {
    const payload = JSON.parse(await readFile(generatedPoolPath, "utf8"));
    if (Array.isArray(payload.players) && payload.players.length >= 120) return payload.players;
  } catch {
    // Static fixture fallback keeps tuning runnable before generated data exists.
  }

  return mockPlayers;
}

function parseList(value, fallback) {
  if (!value) return fallback;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
