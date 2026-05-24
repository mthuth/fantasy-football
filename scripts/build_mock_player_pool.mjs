import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlayerPoolFromCanonical } from "../src/draft/playerPoolBuilder.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const playersPath = path.join(projectRoot, "data", "normalized", "players.json");
const outputDir = path.join(projectRoot, "data", "mock");
const outputPath = path.join(outputDir, "current_player_pool.json");

const canonicalPlayers = JSON.parse(await readFile(playersPath, "utf8"));
const playerPool = buildPlayerPoolFromCanonical(canonicalPlayers, { limit: 220 });

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  generated_at: new Date().toISOString(),
  source: "data/normalized/players.json",
  projection_note: "Deterministic mock projections for simulation only. Not real 2026 projections.",
  players: playerPool,
}, null, 2)}\n`);

console.log(JSON.stringify({
  output: outputPath,
  players: playerPool.length,
  positions: countBy(playerPool, "position"),
}, null, 2));

function countBy(rows, field) {
  return rows.reduce((counts, row) => {
    counts[row[field]] = (counts[row[field]] ?? 0) + 1;
    return counts;
  }, {});
}
