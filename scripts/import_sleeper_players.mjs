import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const SOURCE = "sleeper";
const PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const importedAt = new Date().toISOString();

const rawDir = path.join(projectRoot, "data", "raw");
const normalizedDir = path.join(projectRoot, "data", "normalized");

const rawOutputPath = path.join(rawDir, "sleeper_players_raw.json");
const playersJsonPath = path.join(normalizedDir, "players.json");
const playersCsvPath = path.join(normalizedDir, "players.csv");
const externalIdsJsonPath = path.join(normalizedDir, "player_external_ids.json");
const externalIdsCsvPath = path.join(normalizedDir, "player_external_ids.csv");
const externalIdConflictsPath = path.join(normalizedDir, "sleeper_external_id_conflicts.json");
const summaryPath = path.join(normalizedDir, "sleeper_import_summary.json");

const POSITION_MAP = new Map([
  ["DEF", "DST"],
  ["D/ST", "DST"],
]);

const EXTERNAL_ID_FIELDS = [
  ["sleeper", "player_id"],
  ["gsis", "gsis_id"],
  ["espn", "espn_id"],
  ["yahoo", "yahoo_id"],
  ["sportradar", "sportradar_id"],
  ["fantasy_data", "fantasy_data_id"],
  ["stats", "stats_id"],
  ["rotowire", "rotowire_id"],
  ["rotoworld", "rotoworld_id"],
  ["pff", "pff_id"],
  ["swish", "swish_id"],
];

const FANTASY_RELEVANT_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DST"]);

function cleanString(value) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanExternalId(value) {
  const cleaned = cleanString(value);
  if (!cleaned || cleaned === "0") return null;
  return cleaned;
}

function normalizePosition(value) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  return POSITION_MAP.get(cleaned) ?? cleaned;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizePositions(player) {
  const fantasyPositions = Array.isArray(player.fantasy_positions)
    ? player.fantasy_positions
    : [];
  const positions = fantasyPositions.length > 0
    ? fantasyPositions
    : [player.position];

  return unique(positions.map(normalizePosition));
}

function buildDisplayName(player) {
  return (
    cleanString(player.full_name) ??
    cleanString(player.search_full_name) ??
    cleanString([player.first_name, player.last_name].filter(Boolean).join(" ")) ??
    cleanString(player.player_id)
  );
}

function buildCanonicalPlayerId(player) {
  const sleeperId = cleanString(player.player_id);
  if (sleeperId) return `ply_sleeper_${sleeperId.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

  const fallbackName = buildDisplayName(player).toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return `ply_unmatched_${fallbackName}`;
}

function extractExternalIds(player) {
  const externalIds = {};

  for (const [source, field] of EXTERNAL_ID_FIELDS) {
    const value = cleanExternalId(player[field]);
    if (value) externalIds[`${source}_id`] = value;
  }

  return externalIds;
}

function normalizePlayer(player) {
  const playerId = buildCanonicalPlayerId(player);
  const positions = normalizePositions(player);
  const externalIds = extractExternalIds(player);

  return {
    player_id: playerId,
    display_name: buildDisplayName(player),
    first_name: cleanString(player.first_name),
    last_name: cleanString(player.last_name),
    suffix: cleanString(player.suffix),
    team: cleanString(player.team),
    positions,
    eligible_positions: positions,
    fantasy_relevant: positions.some((position) => FANTASY_RELEVANT_POSITIONS.has(position)),
    nfl_gsis_id: externalIds.gsis_id ?? null,
    external_ids: externalIds,
    birth_date: cleanString(player.birth_date),
    height: cleanString(player.height),
    weight: player.weight ?? null,
    college: cleanString(player.college),
    years_exp: player.years_exp ?? null,
    rookie_year: player.rookie_year ?? null,
    jersey_number: player.number ?? null,
    depth_chart_position: cleanString(player.depth_chart_position),
    depth_chart_order: player.depth_chart_order ?? null,
    active: player.active ?? null,
    current_status: cleanString(player.status),
    injury_status: cleanString(player.injury_status),
    source: SOURCE,
    source_player_id: cleanString(player.player_id),
    last_verified_at: importedAt,
  };
}

function buildExternalIdRows(player) {
  const rows = [];
  const playerId = player.player_id;
  const displayName = player.display_name;

  for (const [key, value] of Object.entries(player.external_ids)) {
    const source = key.replace(/_id$/, "");
    rows.push({
      player_id: playerId,
      source,
      source_player_id: value,
      source_player_name: displayName,
      matched_by: source === "sleeper" ? "source_primary_id" : "source_payload_id",
      match_confidence: source === "sleeper" ? 1 : 0.95,
      first_seen_at: importedAt,
      last_seen_at: importedAt,
    });
  }

  return rows;
}

function quarantineExternalIdConflicts(rows, playersById) {
  const rowsBySourceId = new Map();

  for (const row of rows) {
    const key = `${row.source}:${row.source_player_id}`;
    if (!rowsBySourceId.has(key)) rowsBySourceId.set(key, []);
    rowsBySourceId.get(key).push(row);
  }

  const conflictEntries = [...rowsBySourceId.entries()]
    .filter(([, group]) => new Set(group.map((row) => row.player_id)).size > 1)
    .map(([source_id, group]) => ({
      source_id,
      rows: group.map((row) => ({
        ...row,
        player_name: playersById.get(row.player_id)?.display_name ?? null,
      })),
    }));

  const conflictKeys = new Set(conflictEntries.map((entry) => entry.source_id));
  const stableRows = rows.filter((row) => !conflictKeys.has(`${row.source}:${row.source_player_id}`));

  return { stableRows, conflicts: conflictEntries };
}

function csvEscape(value) {
  if (value === undefined || value === null) return "";
  const stringValue = Array.isArray(value) ? value.join("|") : String(value);
  if (!/[",\n\r]/.test(stringValue)) return stringValue;
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function toCsv(rows, columns) {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","));
  return [header, ...body].join("\n") + "\n";
}

function countBy(rows, field) {
  return rows.reduce((counts, row) => {
    const values = Array.isArray(row[field]) ? row[field] : [row[field]];
    for (const value of values) {
      const key = value || "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, {});
}

async function fetchSleeperPlayers() {
  const response = await fetch(PLAYERS_URL, {
    headers: {
      accept: "application/json",
      "user-agent": "FantasyFootballAgentPlayerImporter/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Sleeper player import failed: HTTP ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function main() {
  await mkdir(rawDir, { recursive: true });
  await mkdir(normalizedDir, { recursive: true });

  const rawPlayers = await fetchSleeperPlayers();
  const sourceRows = Object.values(rawPlayers);
  const players = sourceRows
    .filter((player) => player && cleanString(player.player_id))
    .map(normalizePlayer)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  const externalIdRows = players.flatMap(buildExternalIdRows);
  const playersById = new Map(players.map((player) => [player.player_id, player]));
  const { stableRows: stableExternalIdRows, conflicts: externalIdConflicts } =
    quarantineExternalIdConflicts(externalIdRows, playersById);

  const playerCsvColumns = [
    "player_id",
    "display_name",
    "first_name",
    "last_name",
    "team",
    "positions",
    "eligible_positions",
    "fantasy_relevant",
    "nfl_gsis_id",
    "source",
    "source_player_id",
    "active",
    "current_status",
    "injury_status",
    "birth_date",
    "height",
    "weight",
    "college",
    "years_exp",
    "rookie_year",
    "last_verified_at",
  ];

  const externalIdCsvColumns = [
    "player_id",
    "source",
    "source_player_id",
    "source_player_name",
    "matched_by",
    "match_confidence",
    "first_seen_at",
    "last_seen_at",
  ];

  const summary = {
    source: SOURCE,
    source_url: PLAYERS_URL,
    imported_at: importedAt,
    raw_player_count: sourceRows.length,
    normalized_player_count: players.length,
    active_player_count: players.filter((player) => player.active === true).length,
    fantasy_relevant_player_count: players.filter((player) => player.fantasy_relevant).length,
    active_fantasy_relevant_player_count: players.filter((player) => player.fantasy_relevant && player.active === true).length,
    players_with_gsis_id: players.filter((player) => player.nfl_gsis_id).length,
    external_id_row_count: stableExternalIdRows.length,
    quarantined_external_id_conflict_count: externalIdConflicts.length,
    by_position: countBy(players, "positions"),
    by_team: countBy(players, "team"),
    outputs: {
      raw_players: path.relative(projectRoot, rawOutputPath),
      players_json: path.relative(projectRoot, playersJsonPath),
      players_csv: path.relative(projectRoot, playersCsvPath),
      external_ids_json: path.relative(projectRoot, externalIdsJsonPath),
      external_ids_csv: path.relative(projectRoot, externalIdsCsvPath),
      external_id_conflicts: path.relative(projectRoot, externalIdConflictsPath),
      summary: path.relative(projectRoot, summaryPath),
    },
  };

  await writeFile(rawOutputPath, JSON.stringify(rawPlayers, null, 2) + "\n");
  await writeFile(playersJsonPath, JSON.stringify(players, null, 2) + "\n");
  await writeFile(playersCsvPath, toCsv(players, playerCsvColumns));
  await writeFile(externalIdsJsonPath, JSON.stringify(stableExternalIdRows, null, 2) + "\n");
  await writeFile(externalIdsCsvPath, toCsv(stableExternalIdRows, externalIdCsvColumns));
  await writeFile(externalIdConflictsPath, JSON.stringify(externalIdConflicts, null, 2) + "\n");
  await writeFile(summaryPath, JSON.stringify(summary, null, 2) + "\n");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
