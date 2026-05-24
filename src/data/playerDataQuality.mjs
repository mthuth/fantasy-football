const REQUIRED_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];

export function auditPlayerPoolQuality(players, options = {}) {
  const yahooExternalIds = new Set((options.externalIds ?? [])
    .filter((externalId) => externalId.source === "yahoo" && externalId.source_player_id && externalId.player_id)
    .map((externalId) => externalId.player_id));
  const byPosition = countByPosition(players);
  const syntheticPlayers = players.filter((player) => isSyntheticPlayer(player));
  const missingProjection = players.filter((player) => !Number.isFinite(player.projectedPoints) && !player.stats);
  const missingYahooId = players.filter((player) => !yahooExternalIds.has(player.playerId));
  const missingRequiredPositions = REQUIRED_POSITIONS.filter((position) => (byPosition[position] ?? 0) === 0);
  const warnings = [];

  if (missingRequiredPositions.length > 0) {
    warnings.push(`Missing draftable player records for ${missingRequiredPositions.join(", ")}.`);
  }
  if (syntheticPlayers.length > 0) {
    warnings.push(`${syntheticPlayers.length} player records are synthetic and should stay labeled in recommendations.`);
  }
  if (missingProjection.length > 0) {
    warnings.push(`${missingProjection.length} player records are missing projection stats.`);
  }
  if (missingYahooId.length > 0) {
    warnings.push(`${missingYahooId.length} player records do not have active Yahoo external ID mappings.`);
  }

  return {
    playerCount: players.length,
    byPosition,
    syntheticCount: syntheticPlayers.length,
    missingProjectionCount: missingProjection.length,
    missingYahooIdCount: missingYahooId.length,
    missingRequiredPositions,
    yahooMappedCount: players.length - missingYahooId.length,
    status: warnings.length === 0 ? "ready" : "needs_attention",
    warnings,
  };
}

export function summarizeKickerDefenseCoverage(players) {
  const kickers = players.filter((player) => player.position === "K");
  const defenses = players.filter((player) => player.position === "DST");
  return {
    kickerCount: kickers.length,
    defenseCount: defenses.length,
    syntheticKickerCount: kickers.filter(isSyntheticPlayer).length,
    syntheticDefenseCount: defenses.filter(isSyntheticPlayer).length,
    hasMinimumMockCoverage: kickers.length >= 2 && defenses.length >= 2,
  };
}

function countByPosition(players) {
  return players.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
}

function isSyntheticPlayer(player) {
  return player.source === "synthetic" || player.source === "synthetic_fixture" || Boolean(player.synthetic);
}
