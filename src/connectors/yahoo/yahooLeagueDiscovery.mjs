export function discoverYahooLeagueOptions(payload) {
  const teamRows = collectTeamRows(payload);
  const leaguesByKey = new Map();

  for (const row of teamRows) {
    const teamKey = cleanString(row.team_key ?? row.teamKey);
    const leagueKey = cleanString(row.league_key ?? row.leagueKey) ?? leagueKeyFromTeamKey(teamKey);
    if (!leagueKey) continue;

    const league = leaguesByKey.get(leagueKey) ?? {
      leagueKey,
      leagueId: leagueIdFromLeagueKey(leagueKey),
      leagueName: cleanString(row.league_name ?? row.leagueName) ?? null,
      season: seasonFromLeagueKey(leagueKey),
      teams: [],
    };

    const team = {
      teamKey,
      teamId: cleanString(row.team_id ?? row.teamId) ?? teamIdFromTeamKey(teamKey),
      name: cleanString(row.name ?? row.team_name ?? row.teamName) ?? teamKey ?? "Yahoo team",
      url: cleanString(row.url) ?? null,
      isOwnedByUser: Boolean(row.is_owned_by_current_login ?? row.isOwnedByUser ?? row.is_owned),
    };

    if (team.teamKey && !league.teams.some((candidate) => candidate.teamKey === team.teamKey)) {
      league.teams.push(team);
    }
    if (!league.leagueName && row.league_name) league.leagueName = cleanString(row.league_name);
    leaguesByKey.set(leagueKey, league);
  }

  return [...leaguesByKey.values()]
    .map((league) => ({
      ...league,
      label: buildLeagueLabel(league),
      primaryTeam: league.teams.find((team) => team.isOwnedByUser) ?? league.teams[0] ?? null,
      teams: league.teams.sort((a, b) => String(a.teamId).localeCompare(String(b.teamId), undefined, { numeric: true })),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function collectTeamRows(payload) {
  const rows = [];
  visit(payload, (value) => {
    const normalized = normalizeYahooObject(value);
    if (looksLikeTeam(normalized)) rows.push(normalized);
  });
  return rows;
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

function looksLikeTeam(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const teamKey = cleanString(row.team_key ?? row.teamKey);
  const leagueKey = cleanString(row.league_key ?? row.leagueKey) ?? leagueKeyFromTeamKey(teamKey);
  return Boolean(teamKey && leagueKey);
}

function buildLeagueLabel(league) {
  const teamNames = league.teams.map((team) => team.name).filter(Boolean).slice(0, 2).join(", ");
  const name = league.leagueName ?? league.leagueKey;
  return teamNames ? `${name} (${teamNames})` : name;
}

function leagueKeyFromTeamKey(teamKey) {
  const match = String(teamKey ?? "").match(/^(.+\.l\.\d+)\.t\.\d+$/);
  return match?.[1] ?? null;
}

function teamIdFromTeamKey(teamKey) {
  const match = String(teamKey ?? "").match(/\.t\.(\d+)$/);
  return match?.[1] ?? null;
}

function leagueIdFromLeagueKey(leagueKey) {
  const match = String(leagueKey ?? "").match(/\.l\.(\d+)$/);
  return match?.[1] ?? null;
}

function seasonFromLeagueKey(leagueKey) {
  const match = String(leagueKey ?? "").match(/^(\d+)\.l\./);
  return match?.[1] ?? null;
}

function cleanString(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned ? cleaned : null;
}
