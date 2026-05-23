export function normalizeYahooDraftResults(payload, options = {}) {
  const externalIds = options.externalIds ?? [];
  const players = options.players ?? [];
  const playerPool = options.playerPool ?? [];
  const yahooIdToCanonical = buildYahooIdMap(externalIds);
  const canonicalPlayers = new Map(players.map((player) => [player.player_id ?? player.playerId, player]));
  const poolIds = new Set(playerPool.map((player) => player.playerId));
  const poolByName = new Map(playerPool.map((player) => [nameKey(player.name, player.position), player.playerId]));
  const rows = collectDraftResultRows(payload);
  const picks = [];
  const unmappedPlayers = [];
  const conflicts = [];
  const leagueKey = options.leagueKey ?? findLeagueKey(payload);

  for (const row of rows) {
    const yahooPlayerId = cleanString(row.player_id ?? row.playerId) ?? playerIdFromYahooKey(row.player_key ?? row.playerKey);
    const yahooPlayerKey = cleanString(row.player_key ?? row.playerKey);
    const canonicalPlayerId = yahooPlayerId ? yahooIdToCanonical.get(yahooPlayerId) ?? null : null;
    const canonicalPlayer = canonicalPlayerId ? canonicalPlayers.get(canonicalPlayerId) : null;
    const poolPlayerId = canonicalPlayerId && (playerPool.length === 0 || poolIds.has(canonicalPlayerId))
      ? canonicalPlayerId
      : poolByName.get(nameKey(row.player_name ?? row.playerName ?? canonicalPlayer?.display_name, firstPosition(canonicalPlayer))) ?? null;
    const pickNumber = numberOrNull(row.pick ?? row.pick_number ?? row.pickNumber);
    const round = numberOrNull(row.round) ?? inferRound(pickNumber, options.teamCount);
    const teamKey = cleanString(row.team_key ?? row.teamKey);
    const teamId = options.teamKeyToTeamId?.[teamKey] ?? internalTeamIdFromYahooTeamKey(teamKey);

    const pick = {
      pickNumber,
      round,
      teamKey,
      teamId,
      yahooPlayerKey,
      yahooPlayerId,
      yahooPlayerName: cleanString(row.player_name ?? row.playerName),
      canonicalPlayerId,
      playerId: poolPlayerId,
      cost: numberOrNull(row.cost ?? row.bid_amount ?? row.auction_cost),
      source: "yahoo_draft_results",
    };

    if (!pickNumber) {
      conflicts.push({ type: "missing_pick_number", row });
      continue;
    }

    if (!teamId) {
      conflicts.push({ type: "missing_team_mapping", pick });
    }

    if (!pick.playerId) {
      unmappedPlayers.push({
        pickNumber,
        yahooPlayerKey,
        yahooPlayerId,
        yahooPlayerName: pick.yahooPlayerName,
        canonicalPlayerId,
        reason: canonicalPlayerId ? "canonical_player_not_in_active_pool" : "yahoo_player_not_mapped",
      });
    }

    picks.push(pick);
  }

  const sortedPicks = picks.sort((a, b) => a.pickNumber - b.pickNumber);
  const events = sortedPicks.map((pick) => ({
    pickNumber: pick.pickNumber,
    round: pick.round,
    teamId: eventTeamId(pick.teamId),
    teamKey: pick.teamKey,
    yahooPlayerKey: pick.yahooPlayerKey,
    yahooPlayerId: pick.yahooPlayerId,
    yahooPlayerName: pick.yahooPlayerName,
    canonicalPlayerId: pick.canonicalPlayerId,
    playerId: pick.playerId,
    cost: pick.cost,
    source: pick.source,
    matchStatus: pick.playerId ? "matched" : "manual_required",
  }));

  return {
    leagueKey,
    syncStatus: conflicts.length === 0 ? "synced" : "needs_review",
    eventCount: events.length,
    unmatchedCount: unmappedPlayers.length,
    events,
    picks: sortedPicks,
    unmappedPlayers,
    conflicts,
    summary: {
      pickCount: sortedPicks.length,
      mappedPickCount: sortedPicks.filter((pick) => pick.playerId).length,
      unmappedPlayerCount: unmappedPlayers.length,
      conflictCount: conflicts.length,
    },
  };
}

function buildYahooIdMap(externalIds) {
  const map = new Map();
  for (const row of externalIds) {
    if (row.source !== "yahoo" || !row.source_player_id || !row.player_id) continue;
    if (!map.has(String(row.source_player_id))) {
      map.set(String(row.source_player_id), row.player_id);
    }
  }
  return map;
}

function collectDraftResultRows(payload) {
  const rows = [];
  visit(payload, (value) => {
    const normalized = normalizeYahooObject(value);
    if (looksLikeDraftResult(normalized)) rows.push(normalized);
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
    }
  }
  return mergedAny ? merged : value;
}

function looksLikeDraftResult(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  return Boolean(
    (row.pick ?? row.pick_number ?? row.pickNumber) &&
    ((row.player_key ?? row.playerKey ?? row.player_id ?? row.playerId) || (row.player_name ?? row.playerName))
  );
}

function dedupeRows(rows) {
  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    const key = `${row.pick ?? row.pick_number ?? row.pickNumber}:${row.player_key ?? row.player_id ?? row.player_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function internalTeamIdFromYahooTeamKey(teamKey) {
  const match = String(teamKey ?? "").match(/\.t\.(\d+)$/);
  return match ? `team_${match[1]}` : null;
}

function eventTeamId(teamId) {
  return String(teamId ?? "").replace(/^team_/, "") || null;
}

function findLeagueKey(payload) {
  let leagueKey = null;
  visit(payload, (value) => {
    if (leagueKey || !value || typeof value !== "object" || Array.isArray(value)) return;
    leagueKey = cleanString(value.league_key ?? value.leagueKey);
  });
  return leagueKey;
}

function playerIdFromYahooKey(playerKey) {
  const match = String(playerKey ?? "").match(/\.p\.(\d+)$/);
  return match?.[1] ?? null;
}

function inferRound(pickNumber, teamCount) {
  if (!pickNumber || !teamCount) return null;
  return Math.ceil(pickNumber / teamCount);
}

function firstPosition(player) {
  const positions = player?.positions ?? player?.eligible_positions ?? [];
  return Array.isArray(positions) ? positions[0] : null;
}

function nameKey(name, position) {
  return `${String(name ?? "").trim().toLowerCase()}|${String(position ?? "").trim().toUpperCase()}`;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanString(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned ? cleaned : null;
}
