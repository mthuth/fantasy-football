const REQUIRED_FIELDS = ["playerId", "source", "projectedPoints"];

export function normalizeProjectionRows(rows, options = {}) {
  if (!Array.isArray(rows)) throw new Error("Projection rows must be an array.");

  return rows.map((row, index) => normalizeProjectionRow(row, {
    source: options.source ?? row.source ?? "unknown_projection_source",
    index,
  }));
}

export function mergeProjectionSource(players, projectionRows, options = {}) {
  const normalizedRows = normalizeProjectionRows(projectionRows, options);
  const projectionByPlayerId = new Map(normalizedRows.map((row) => [row.playerId, row]));
  const missingProjectionIds = [];
  const mergedPlayers = players.map((player) => {
    const projection = projectionByPlayerId.get(player.playerId);
    if (!projection) {
      missingProjectionIds.push(player.playerId);
      return player;
    }

    return {
      ...player,
      stats: projection.stats ?? player.stats,
      projectedPoints: projection.projectedPoints,
      sourceRank: projection.sourceRank ?? player.sourceRank,
      adp: projection.adp ?? player.adp,
      risk: projection.risk ?? player.risk,
      ceiling: projection.ceiling ?? player.ceiling,
      projectionSource: {
        source: projection.source,
        updatedAt: projection.updatedAt,
        confidence: projection.confidence,
      },
    };
  });

  return {
    players: mergedPlayers,
    source: options.source ?? "unknown_projection_source",
    matchedCount: players.length - missingProjectionIds.length,
    missingProjectionIds,
    unusedProjectionIds: normalizedRows
      .filter((row) => !players.some((player) => player.playerId === row.playerId))
      .map((row) => row.playerId),
  };
}

function normalizeProjectionRow(row, context) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error(`Projection row ${context.index + 1} must be an object.`);
  }

  const normalized = {
    playerId: String(row.playerId ?? row.player_id ?? "").trim(),
    source: String(row.source ?? context.source).trim(),
    projectedPoints: numberOrNull(row.projectedPoints ?? row.projected_points),
    sourceRank: numberOrNull(row.sourceRank ?? row.source_rank),
    adp: numberOrNull(row.adp),
    risk: numberOrNull(row.risk),
    ceiling: numberOrNull(row.ceiling),
    stats: row.stats && typeof row.stats === "object" && !Array.isArray(row.stats) ? row.stats : null,
    confidence: numberOrNull(row.confidence) ?? 0.7,
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
  };

  for (const field of REQUIRED_FIELDS) {
    if (field === "projectedPoints") {
      if (!Number.isFinite(normalized.projectedPoints)) {
        throw new Error(`Projection row ${context.index + 1} is missing projectedPoints.`);
      }
      continue;
    }
    if (!normalized[field]) throw new Error(`Projection row ${context.index + 1} is missing ${field}.`);
  }

  return normalized;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
