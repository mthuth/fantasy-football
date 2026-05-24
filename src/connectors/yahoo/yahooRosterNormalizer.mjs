export function normalizeYahooLeagueTeams(payload) {
  return collectObjects(payload, looksLikeTeam).map((row) => ({
    teamKey: cleanString(row.team_key ?? row.teamKey),
    teamId: cleanString(row.team_id ?? row.teamId) ?? teamIdFromTeamKey(row.team_key ?? row.teamKey),
    name: cleanString(row.name ?? row.team_name ?? row.teamName) ?? "Yahoo team",
    manager: cleanString(row.manager_nickname ?? row.managerNickname ?? row.nickname) ?? null,
  })).filter((team) => team.teamKey);
}

export function normalizeYahooTeamRoster(payload, options = {}) {
  const externalIdLookup = buildExternalIdLookup(options.externalIds ?? []);
  const canonicalPlayers = new Map((options.players ?? []).map((player) => [player.player_id ?? player.playerId, player]));
  const poolIds = new Set((options.playerPool ?? []).map((player) => player.playerId));
  const playerRows = collectObjects(payload, looksLikeRosterPlayer);

  return playerRows.map((row) => {
    const yahooPlayerKey = cleanString(row.player_key ?? row.playerKey);
    const yahooPlayerId = cleanYahooPlayerId(row.player_id ?? row.playerId ?? yahooPlayerKey);
    const canonicalPlayerId = yahooPlayerId ? externalIdLookup.get(yahooPlayerId) ?? null : null;
    const canonicalPlayer = canonicalPlayerId ? canonicalPlayers.get(canonicalPlayerId) : null;
    return {
      yahooPlayerKey,
      yahooPlayerId,
      yahooPlayerName: cleanString(row.name ?? row.full ?? row.player_name ?? row.playerName ?? canonicalPlayer?.display_name),
      selectedPosition: cleanString(row.selected_position ?? row.selectedPosition ?? row.position) ?? null,
      canonicalPlayerId,
      playerId: canonicalPlayerId && poolIds.has(canonicalPlayerId) ? canonicalPlayerId : null,
      matchStatus: canonicalPlayerId ? (poolIds.has(canonicalPlayerId) ? "matched" : "canonical_not_in_pool") : "manual_required",
    };
  }).filter((player) => player.yahooPlayerKey || player.yahooPlayerId || player.yahooPlayerName);
}

function collectObjects(payload, predicate) {
  const rows = [];
  visit(payload, (value) => {
    const normalized = normalizeYahooObject(value);
    if (predicate(normalized)) rows.push(normalized);
  });
  return dedupeRows(rows);
}

function visit(value, callback) {
  if (!value || typeof value !== "object") return;
  callback(value);

  if (Array.isArray(value)) {
    const merged = normalizeYahooObject(value);
    if (merged && merged !== value) callback(merged);
    for (const item of value) visit(item, callback);
    return;
  }

  for (const item of Object.values(value)) visit(item, callback);
}

function normalizeYahooObject(value) {
  if (!Array.isArray(value)) return value;
  const merged = {};
  let mergedAny = false;

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    for (const [key, nestedValue] of Object.entries(item)) {
      if (typeof nestedValue === "string" || typeof nestedValue === "number" || typeof nestedValue === "boolean") {
        merged[key] = nestedValue;
        mergedAny = true;
      }
      if (key === "name" && nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
        merged.name = nestedValue.full ?? nestedValue.ascii_first_last ?? nestedValue.first ?? merged.name;
        mergedAny = true;
      }
    }
  }

  return mergedAny ? merged : value;
}

function looksLikeTeam(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  return Boolean(cleanString(row.team_key ?? row.teamKey));
}

function looksLikeRosterPlayer(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  return Boolean(
    cleanString(row.player_key ?? row.playerKey ?? row.player_id ?? row.playerId)
      || cleanString(row.player_name ?? row.playerName),
  );
}

function buildExternalIdLookup(externalIds) {
  const lookup = new Map();
  for (const row of externalIds) {
    if (row.source !== "yahoo" || !row.source_player_id || !row.player_id) continue;
    lookup.set(String(row.source_player_id), row.player_id);
  }
  return lookup;
}

function dedupeRows(rows) {
  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    const key = row.team_key ?? row.teamKey ?? row.player_key ?? row.playerKey ?? row.player_id ?? row.playerId ?? row.name ?? JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function teamIdFromTeamKey(teamKey) {
  const match = String(teamKey ?? "").match(/\.t\.(\d+)$/);
  return match?.[1] ?? null;
}

function cleanYahooPlayerId(value) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const match = cleaned.match(/(?:^|\.)p\.(\d+)$/);
  return match?.[1] ?? cleaned;
}

function cleanString(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned ? cleaned : null;
}
