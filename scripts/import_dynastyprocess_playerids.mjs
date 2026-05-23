import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const SOURCE = "dynastyprocess";
const PLAYER_IDS_URL = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv";
const importedAt = new Date().toISOString();

const rawDir = path.join(projectRoot, "data", "raw");
const normalizedDir = path.join(projectRoot, "data", "normalized");

const rawOutputPath = path.join(rawDir, "dynastyprocess_playerids.csv");
const parsedJsonPath = path.join(normalizedDir, "dynastyprocess_playerids.json");
const playersJsonPath = path.join(normalizedDir, "players.json");
const playersCsvPath = path.join(normalizedDir, "players.csv");
const externalIdsJsonPath = path.join(normalizedDir, "player_external_ids.json");
const externalIdsCsvPath = path.join(normalizedDir, "player_external_ids.csv");
const unmatchedPath = path.join(normalizedDir, "dynastyprocess_unmatched_playerids.json");
const conflictsPath = path.join(normalizedDir, "dynastyprocess_match_conflicts.json");
const summaryPath = path.join(normalizedDir, "dynastyprocess_import_summary.json");

const ID_COLUMNS = [
  ["mfl", "mfl_id"],
  ["sportradar", "sportradar_id"],
  ["fantasypros", "fantasypros_id"],
  ["gsis", "gsis_id"],
  ["pff", "pff_id"],
  ["sleeper", "sleeper_id"],
  ["nfl", "nfl_id"],
  ["espn", "espn_id"],
  ["yahoo", "yahoo_id"],
  ["fleaflicker", "fleaflicker_id"],
  ["cbs", "cbs_id"],
  ["pfr", "pfr_id"],
  ["cfbref", "cfbref_id"],
  ["rotowire", "rotowire_id"],
  ["rotoworld", "rotoworld_id"],
  ["ktc", "ktc_id"],
  ["stats", "stats_id"],
  ["stats_global", "stats_global_id"],
  ["fantasy_data", "fantasy_data_id"],
  ["swish", "swish_id"],
  ["twitter", "twitter_username"],
];

const MATCH_PRIORITY = [
  "sleeper",
  "gsis",
  "espn",
  "yahoo",
  "fantasy_data",
  "sportradar",
  "stats",
  "rotowire",
  "rotoworld",
  "pff",
  "swish",
  "mfl",
  "fleaflicker",
  "fantasypros",
];

const POSITION_MAP = new Map([
  ["DEF", "DST"],
  ["D/ST", "DST"],
  ["PK", "K"],
  ["PN", "P"],
]);

const FANTASY_RELEVANT_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DST"]);

function cleanString(value) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).trim();
  if (!cleaned || ["NA", "N/A", "NULL", "NONE", "#N/A"].includes(cleaned.toUpperCase())) {
    return null;
  }
  return cleaned;
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

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows
    .filter((dataRow) => dataRow.some((value) => cleanString(value)))
    .map((dataRow) => Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""])));
}

async function fetchCrosswalk() {
  const response = await fetch(PLAYER_IDS_URL, {
    headers: {
      accept: "text/csv",
      "user-agent": "FantasyFootballAgentPlayerImporter/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`DynastyProcess player ID import failed: HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function buildExternalIdLookup(rows) {
  const lookup = new Map();

  for (const row of rows) {
    const source = cleanString(row.source);
    const sourcePlayerId = cleanExternalId(row.source_player_id);
    const playerId = cleanString(row.player_id);
    if (source && sourcePlayerId && playerId) {
      lookup.set(`${source}:${sourcePlayerId}`, playerId);
    }
  }

  return lookup;
}

function buildPlayerLookup(players) {
  return new Map(players.map((player) => [player.player_id, player]));
}

function findPlayerId(crosswalkRow, externalIdLookup) {
  const matches = [];

  for (const source of MATCH_PRIORITY) {
    const column = ID_COLUMNS.find(([idSource]) => idSource === source)?.[1];
    const value = cleanExternalId(crosswalkRow[column]);
    if (!value) continue;

    const playerId = externalIdLookup.get(`${source}:${value}`);
    if (playerId) {
      matches.push({ source, source_player_id: value, player_id: playerId });
    }
  }

  const uniquePlayerIds = unique(matches.map((match) => match.player_id));
  return {
    player_id: uniquePlayerIds[0] ?? null,
    matched_by: matches[0] ?? null,
    has_conflict: uniquePlayerIds.length > 1,
    conflicts: matches,
  };
}

function addExternalIdRow(rowsByKey, externalIdLookup, playerId, source, sourcePlayerId, sourcePlayerName, matchedBy) {
  const sourceKey = `${source}:${sourcePlayerId}`;
  const existingPlayerId = externalIdLookup.get(sourceKey);
  if (existingPlayerId && existingPlayerId !== playerId) {
    return {
      added: false,
      conflict: {
        source,
        source_player_id: sourcePlayerId,
        existing_player_id: existingPlayerId,
        proposed_player_id: playerId,
      },
    };
  }

  const key = `${playerId}|${source}|${sourcePlayerId}`;
  if (rowsByKey.has(key)) return { added: false, conflict: null };

  rowsByKey.set(key, {
    player_id: playerId,
    source,
    source_player_id: sourcePlayerId,
    source_player_name: sourcePlayerName,
    matched_by: `dynastyprocess_${matchedBy.source}`,
    match_confidence: matchedBy.source === source ? 1 : 0.98,
    first_seen_at: importedAt,
    last_seen_at: importedAt,
  });

  externalIdLookup.set(sourceKey, playerId);
  return { added: true, conflict: null };
}

function mergePlayerProfile(player, crosswalkRow) {
  const position = normalizePosition(crosswalkRow.position);
  if (position && !player.positions?.includes(position)) {
    player.positions = unique([...(player.positions ?? []), position]);
    player.eligible_positions = unique([...(player.eligible_positions ?? []), position]);
    player.fantasy_relevant = player.positions.some((pos) => FANTASY_RELEVANT_POSITIONS.has(pos));
  }

  player.team = player.team ?? cleanString(crosswalkRow.team);
  player.nfl_gsis_id = player.nfl_gsis_id ?? cleanString(crosswalkRow.gsis_id);
  player.birth_date = player.birth_date ?? cleanString(crosswalkRow.birthdate);
  player.height = player.height ?? cleanString(crosswalkRow.height);
  player.weight = player.weight ?? cleanString(crosswalkRow.weight);
  player.college = player.college ?? cleanString(crosswalkRow.college);
  player.rookie_year = player.rookie_year ?? cleanString(crosswalkRow.draft_year);
  player.external_ids = player.external_ids ?? {};
  player.last_identity_crosswalk_at = importedAt;
}

async function main() {
  await mkdir(rawDir, { recursive: true });
  await mkdir(normalizedDir, { recursive: true });

  const rawCsv = await fetchCrosswalk();
  const crosswalkRows = parseCsv(rawCsv);

  const players = JSON.parse(await readFile(playersJsonPath, "utf8"));
  const externalIdRows = JSON.parse(await readFile(externalIdsJsonPath, "utf8"));

  const playerLookup = buildPlayerLookup(players);
  const externalIdLookup = buildExternalIdLookup(externalIdRows);
  const externalIdRowsByKey = new Map(
    externalIdRows.map((row) => [`${row.player_id}|${row.source}|${row.source_player_id}`, row]),
  );

  const unmatched = [];
  const conflicts = [];
  const skippedExternalIdConflicts = [];
  let matchedRows = 0;
  let addedExternalIds = 0;

  for (const crosswalkRow of crosswalkRows) {
    const match = findPlayerId(crosswalkRow, externalIdLookup);
    const sourcePlayerName = cleanString(crosswalkRow.name) ?? cleanString(crosswalkRow.merge_name);

    if (match.has_conflict) {
      conflicts.push({
        name: sourcePlayerName,
        position: cleanString(crosswalkRow.position),
        team: cleanString(crosswalkRow.team),
        conflicts: match.conflicts,
      });
    }

    if (!match.player_id || !match.matched_by) {
      unmatched.push({
        name: sourcePlayerName,
        position: cleanString(crosswalkRow.position),
        team: cleanString(crosswalkRow.team),
        sleeper_id: cleanString(crosswalkRow.sleeper_id),
        gsis_id: cleanString(crosswalkRow.gsis_id),
        espn_id: cleanString(crosswalkRow.espn_id),
        yahoo_id: cleanString(crosswalkRow.yahoo_id),
        mfl_id: cleanString(crosswalkRow.mfl_id),
        fantasypros_id: cleanString(crosswalkRow.fantasypros_id),
      });
      continue;
    }

    matchedRows += 1;
    const player = playerLookup.get(match.player_id);
    if (player) {
      mergePlayerProfile(player, crosswalkRow);
    }

    for (const [source, column] of ID_COLUMNS) {
      const value = cleanExternalId(crosswalkRow[column]);
      if (!value) continue;

      const addResult = addExternalIdRow(
        externalIdRowsByKey,
        externalIdLookup,
        match.player_id,
        source,
        value,
        sourcePlayerName,
        match.matched_by,
      );
      if (addResult.conflict) {
        skippedExternalIdConflicts.push({
          name: sourcePlayerName,
          position: cleanString(crosswalkRow.position),
          team: cleanString(crosswalkRow.team),
          matched_by: match.matched_by,
          ...addResult.conflict,
        });
        continue;
      }

      if (player) {
        player.external_ids[`${source}_id`] = player.external_ids[`${source}_id`] ?? value;
      }

      if (addResult.added) addedExternalIds += 1;
    }
  }

  const mergedExternalIdRows = [...externalIdRowsByKey.values()].sort((a, b) => (
    a.player_id.localeCompare(b.player_id) ||
    a.source.localeCompare(b.source) ||
    a.source_player_id.localeCompare(b.source_player_id)
  ));

  const sortedPlayers = players.sort((a, b) => a.display_name.localeCompare(b.display_name));

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
    "last_identity_crosswalk_at",
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
    source_url: PLAYER_IDS_URL,
    imported_at: importedAt,
    crosswalk_row_count: crosswalkRows.length,
    matched_crosswalk_rows: matchedRows,
    unmatched_crosswalk_rows: unmatched.length,
    conflict_count: conflicts.length,
    skipped_external_id_conflict_count: skippedExternalIdConflicts.length,
    existing_external_id_rows: externalIdRows.length,
    added_external_id_rows: addedExternalIds,
    merged_external_id_rows: mergedExternalIdRows.length,
    players_updated: sortedPlayers.filter((player) => player.last_identity_crosswalk_at === importedAt).length,
    outputs: {
      raw_crosswalk: path.relative(projectRoot, rawOutputPath),
      parsed_crosswalk: path.relative(projectRoot, parsedJsonPath),
      players_json: path.relative(projectRoot, playersJsonPath),
      players_csv: path.relative(projectRoot, playersCsvPath),
      external_ids_json: path.relative(projectRoot, externalIdsJsonPath),
      external_ids_csv: path.relative(projectRoot, externalIdsCsvPath),
      unmatched: path.relative(projectRoot, unmatchedPath),
      conflicts: path.relative(projectRoot, conflictsPath),
      summary: path.relative(projectRoot, summaryPath),
    },
  };

  await writeFile(rawOutputPath, rawCsv);
  await writeFile(parsedJsonPath, JSON.stringify(crosswalkRows, null, 2) + "\n");
  await writeFile(playersJsonPath, JSON.stringify(sortedPlayers, null, 2) + "\n");
  await writeFile(playersCsvPath, toCsv(sortedPlayers, playerCsvColumns));
  await writeFile(externalIdsJsonPath, JSON.stringify(mergedExternalIdRows, null, 2) + "\n");
  await writeFile(externalIdsCsvPath, toCsv(mergedExternalIdRows, externalIdCsvColumns));
  await writeFile(unmatchedPath, JSON.stringify(unmatched, null, 2) + "\n");
  await writeFile(conflictsPath, JSON.stringify({
    match_conflicts: conflicts,
    skipped_external_id_conflicts: skippedExternalIdConflicts,
  }, null, 2) + "\n");
  await writeFile(summaryPath, JSON.stringify(summary, null, 2) + "\n");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
