import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCsvText } from "../src/data/csv.mjs";
import { mergeProjectionSource } from "../src/data/projectionSource.mjs";
import { normalizeSharpFootballProjectionRows } from "../src/data/sharpFootballProjections.mjs";
import { mockPlayers } from "../src/draft/mockData.mjs";

const input = process.argv[2];
const scoringFormat = process.argv[3] ?? process.env.PROJECTION_SCORING_FORMAT ?? "half_ppr";

if (!input) {
  console.error("Usage: node scripts/import_sharp_football_projections.mjs <sharp-football.csv|https://...csv> [half_ppr|ppr|standard|te_premium]");
  process.exit(1);
}

const players = await loadPlayerPool();
const csvText = await readInput(input);
const rawRows = parseCsvText(csvText);
const normalized = normalizeSharpFootballProjectionRows(rawRows, players, { scoringFormat });
const merged = mergeProjectionSource(players, normalized.rows, { source: normalized.source });
const outputDir = path.resolve(process.env.PROJECTION_OUTPUT_DIR ?? "data/projections");
const importedAt = new Date().toISOString();
const normalizedPath = path.join(outputDir, "sharp_football_projection_rows.json");
const auditPath = path.join(outputDir, "sharp_football_projection_audit.json");
const mergedPath = path.join(outputDir, "sharp_football_projections_merged.json");

await mkdir(outputDir, { recursive: true });
await writeFile(normalizedPath, `${JSON.stringify({
  importedAt,
  source: normalized.source,
  sourceUrl: normalized.sourceUrl,
  scoringFormat,
  rowCount: normalized.rows.length,
  rows: normalized.rows,
}, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify({
  importedAt,
  source: normalized.source,
  sourceUrl: normalized.sourceUrl,
  scoringFormat,
  rawRowCount: rawRows.length,
  matchedCount: normalized.matchedCount,
  unmatchedCount: normalized.unmatched.length,
  ambiguousCount: normalized.ambiguous.length,
  unmatched: normalized.unmatched,
  ambiguous: normalized.ambiguous,
}, null, 2)}\n`);
await writeFile(mergedPath, `${JSON.stringify({
  importedAt,
  source: normalized.source,
  sourceUrl: normalized.sourceUrl,
  scoringFormat,
  matchedCount: merged.matchedCount,
  missingProjectionCount: merged.missingProjectionIds.length,
  unusedProjectionCount: merged.unusedProjectionIds.length,
  providerUnmatchedCount: normalized.unmatched.length,
  providerAmbiguousCount: normalized.ambiguous.length,
  players: merged.players,
}, null, 2)}\n`);

console.log(JSON.stringify({
  source: normalized.source,
  scoringFormat,
  rawRowCount: rawRows.length,
  matchedCount: normalized.matchedCount,
  unmatchedCount: normalized.unmatched.length,
  ambiguousCount: normalized.ambiguous.length,
  mergedPlayerCount: merged.players.length,
  missingProjectionCount: merged.missingProjectionIds.length,
  outputs: {
    normalized: normalizedPath,
    audit: auditPath,
    merged: mergedPath,
  },
}, null, 2));

async function readInput(value) {
  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value);
    if (!response.ok) throw new Error(`Sharp Football projection download failed: ${response.status} ${response.statusText}`);
    return response.text();
  }
  return readFile(value, "utf8");
}

async function loadPlayerPool() {
  if (process.env.PLAYER_POOL !== "generated") return mockPlayers;

  try {
    const payload = JSON.parse(await readFile("data/mock/current_player_pool.json", "utf8"));
    return Array.isArray(payload.players) && payload.players.length > 0 ? payload.players : mockPlayers;
  } catch {
    return mockPlayers;
  }
}
