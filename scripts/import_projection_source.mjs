import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mergeProjectionSource } from "../src/data/projectionSource.mjs";
import { mockPlayers } from "../src/draft/mockData.mjs";

const inputPath = process.argv[2];
const source = process.argv[3] ?? "manual_projection_source";

if (!inputPath) {
  console.error("Usage: node scripts/import_projection_source.mjs <projections.json|projections.csv> [source]");
  process.exit(1);
}

const rows = await readRows(inputPath);
const result = mergeProjectionSource(mockPlayers, rows, { source });
const outputDir = path.resolve("data/projections");
const outputPath = path.join(outputDir, `${source.replaceAll(/[^a-z0-9_-]/gi, "_").toLowerCase()}_merged.json`);

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  importedAt: new Date().toISOString(),
  source,
  matchedCount: result.matchedCount,
  missingProjectionCount: result.missingProjectionIds.length,
  unusedProjectionCount: result.unusedProjectionIds.length,
  players: result.players,
}, null, 2)}\n`);

console.log(JSON.stringify({
  output: outputPath,
  source,
  matchedCount: result.matchedCount,
  missingProjectionCount: result.missingProjectionIds.length,
  unusedProjectionCount: result.unusedProjectionIds.length,
}, null, 2));

async function readRows(filePath) {
  const text = await readFile(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    const payload = JSON.parse(text);
    return Array.isArray(payload) ? payload : payload.rows ?? payload.projections ?? [];
  }
  if (filePath.endsWith(".csv")) return parseCsv(text);
  throw new Error("Projection import supports .json and .csv files.");
}

function parseCsv(text) {
  const rows = splitCsvRows(text).filter((row) => row.some((cell) => cell.trim()));
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((cells) => Object.fromEntries(header.map((key, index) => [key.trim(), cells[index]?.trim() ?? ""])));
}

function splitCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}
