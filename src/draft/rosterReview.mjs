const STARTER_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];
const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);

export function buildPostDraftReview(state, teamId = state.league.userTeamId) {
  const roster = getRoster(state, teamId);
  const lineup = buildProjectedLineup(state.league, roster);
  const rosterCounts = countPositions(roster);
  const available = getAvailablePlayers(state);
  const requiredGaps = getRequiredGaps(state.league, rosterCounts);
  const strengths = buildStrengths(state.league, roster, rosterCounts, lineup);
  const weaknesses = buildWeaknesses(state.league, roster, rosterCounts, lineup, requiredGaps);
  const waiverWatch = buildWaiverWatch(state.league, available, roster, requiredGaps);
  const tradePlan = buildTradePlan(roster, rosterCounts, weaknesses);

  return {
    summary: {
      projectedStarterPoints: round(lineup.starters.reduce((sum, player) => sum + player.projectedPoints, 0), 1),
      projectedBenchPoints: round(lineup.bench.reduce((sum, player) => sum + player.projectedPoints, 0), 1),
      rosterCounts,
      requiredGaps,
    },
    projectedLineup: lineup.starters.map(toReviewPlayer),
    bench: lineup.bench.map(toReviewPlayer),
    strengths,
    weaknesses,
    waiverWatch: waiverWatch.map(toReviewPlayer),
    tradePlan,
  };
}

function buildProjectedLineup(league, roster) {
  const remaining = [...roster].sort((a, b) => b.projectedPoints - a.projectedPoints);
  const starters = [];

  for (const position of STARTER_POSITIONS) {
    const count = league.rosterSlots[position] ?? 0;
    for (let index = 0; index < count; index += 1) {
      const playerIndex = remaining.findIndex((player) => player.position === position);
      if (playerIndex >= 0) starters.push(...remaining.splice(playerIndex, 1));
    }
  }

  const flexSlots = league.rosterSlots.FLEX ?? 0;
  for (let index = 0; index < flexSlots; index += 1) {
    const playerIndex = remaining.findIndex((player) => FLEX_POSITIONS.has(player.position));
    if (playerIndex >= 0) starters.push(...remaining.splice(playerIndex, 1));
  }

  return {
    starters: starters.sort(lineupSort),
    bench: remaining.sort((a, b) => b.projectedPoints - a.projectedPoints),
  };
}

function buildStrengths(league, roster, rosterCounts, lineup) {
  const strengths = [];
  const byPosition = groupByPosition(roster);

  for (const position of ["RB", "WR", "QB", "TE"]) {
    const players = byPosition[position] ?? [];
    if (players.length === 0) continue;
    const topTwoProjection = players.slice(0, position === "QB" || position === "TE" ? 1 : 2)
      .reduce((sum, player) => sum + player.projectedPoints, 0);
    const depth = rosterCounts[position] ?? 0;
    const required = league.rosterSlots[position] ?? 0;

    if (depth > required && topTwoProjection > projectionStrengthThreshold(position)) {
      strengths.push(`${position} has both starter quality and usable depth.`);
    } else if (topTwoProjection > projectionStrengthThreshold(position)) {
      strengths.push(`${position} starter quality is strong.`);
    }
  }

  if (lineup.bench.some((player) => player.projectedPoints > 150 && FLEX_POSITIONS.has(player.position))) {
    strengths.push("Bench has flex candidates instead of only low-upside stashes.");
  }

  return strengths.length > 0 ? strengths : ["Roster is balanced enough for mock-mode review, but no clear positional edge stands out yet."];
}

function buildWeaknesses(league, roster, rosterCounts, lineup, requiredGaps) {
  const weaknesses = [];

  for (const [position, gap] of Object.entries(requiredGaps)) {
    if (gap > 0) weaknesses.push(`Missing ${gap} required ${position} starter slot${gap > 1 ? "s" : ""}.`);
  }

  for (const position of ["QB", "TE", "K", "DST"]) {
    if ((rosterCounts[position] ?? 0) === 0 && (league.rosterSlots[position] ?? 0) > 0) {
      weaknesses.push(`No ${position} selected yet.`);
    }
  }

  const rbWrBench = lineup.bench.filter((player) => FLEX_POSITIONS.has(player.position));
  if (rbWrBench.length < 2) weaknesses.push("Limited RB/WR/TE bench depth for bye weeks and injuries.");

  const duplicatedByes = getDuplicatedByes(lineup.starters);
  if (duplicatedByes.length > 0) {
    weaknesses.push(`Starter bye concentration: Week ${duplicatedByes.slice(0, 3).join(", Week ")}.`);
  }

  return weaknesses.length > 0 ? weaknesses : ["No urgent roster construction weakness from the mock draft."];
}

function buildWaiverWatch(league, available, roster, requiredGaps) {
  const rosterPositions = new Set(roster.map((player) => player.position));
  const targetPositions = Object.entries(requiredGaps)
    .filter(([, gap]) => gap > 0)
    .map(([position]) => position);

  if (targetPositions.length === 0) {
    targetPositions.push("RB", "WR", "TE");
    for (const position of ["QB", "DST", "K"]) {
      if (!rosterPositions.has(position) && (league.rosterSlots[position] ?? 0) > 0) targetPositions.push(position);
    }
  }

  const primaryTargets = available
    .filter((player) => targetPositions.length === 0 || targetPositions.includes(player.position))
    .sort((a, b) => b.projectedPoints - a.projectedPoints)
    .slice(0, 5);

  const upsideTargets = available
    .filter((player) => FLEX_POSITIONS.has(player.position))
    .sort((a, b) => (b.ceiling ?? 0) - (a.ceiling ?? 0) || b.projectedPoints - a.projectedPoints)
    .slice(0, 5);

  return uniquePlayers([...primaryTargets, ...upsideTargets]).slice(0, 8);
}

function buildTradePlan(roster, rosterCounts, weaknesses) {
  const surplusPositions = Object.entries(rosterCounts)
    .filter(([position, count]) => ["RB", "WR", "TE", "QB"].includes(position) && count >= surplusThreshold(position))
    .map(([position]) => position);
  const weakestPosition = inferWeakestPosition(weaknesses);
  const bestBench = roster
    .filter((player) => surplusPositions.includes(player.position))
    .sort((a, b) => b.projectedPoints - a.projectedPoints)
    .slice(0, 3)
    .map(toReviewPlayer);

  const plan = [];
  if (surplusPositions.length > 0 && weakestPosition) {
    plan.push(`Shop surplus ${surplusPositions.join("/")} depth for a ${weakestPosition} upgrade.`);
  }
  if (bestBench.length > 0) {
    plan.push(`Potential trade chips: ${bestBench.map((player) => player.name).join(", ")}.`);
  }
  if (plan.length === 0) {
    plan.push("No obvious trade need from this mock; monitor early waiver usage before forcing a deal.");
  }

  return {
    surplusPositions,
    weakestPosition,
    suggestedActions: plan,
    potentialTradeChips: bestBench,
  };
}

function getRoster(state, teamId) {
  const playerById = new Map(state.players.map((player) => [player.playerId, player]));
  const team = state.teams.find((candidate) => candidate.teamId === teamId);
  return (team?.picks ?? []).map((pick) => playerById.get(pick.playerId)).filter(Boolean);
}

function getAvailablePlayers(state) {
  const draftedIds = new Set(state.drafted.map((pick) => pick.playerId));
  return state.players.filter((player) => !draftedIds.has(player.playerId));
}

function getRequiredGaps(league, rosterCounts) {
  return Object.fromEntries(STARTER_POSITIONS.map((position) => [
    position,
    Math.max(0, (league.rosterSlots[position] ?? 0) - (rosterCounts[position] ?? 0)),
  ]).filter(([, gap]) => gap > 0));
}

function countPositions(roster) {
  return roster.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
}

function groupByPosition(roster) {
  const grouped = {};
  for (const player of roster) {
    if (!grouped[player.position]) grouped[player.position] = [];
    grouped[player.position].push(player);
  }
  for (const players of Object.values(grouped)) {
    players.sort((a, b) => b.projectedPoints - a.projectedPoints);
  }
  return grouped;
}

function projectionStrengthThreshold(position) {
  return {
    QB: 285,
    RB: 235,
    WR: 220,
    TE: 155,
  }[position] ?? 120;
}

function getDuplicatedByes(players) {
  const counts = players.reduce((weeks, player) => {
    if (player.bye) weeks[player.bye] = (weeks[player.bye] ?? 0) + 1;
    return weeks;
  }, {});
  return Object.entries(counts)
    .filter(([, count]) => count >= 3)
    .map(([week]) => week)
    .sort((a, b) => Number(a) - Number(b));
}

function lineupSort(a, b) {
  const order = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DST: 6 };
  return (order[a.position] ?? 99) - (order[b.position] ?? 99) || b.projectedPoints - a.projectedPoints;
}

function uniquePlayers(players) {
  const seen = new Set();
  return players.filter((player) => {
    if (seen.has(player.playerId)) return false;
    seen.add(player.playerId);
    return true;
  });
}

function inferWeakestPosition(weaknesses) {
  for (const position of ["QB", "TE", "RB", "WR", "K", "DST"]) {
    if (weaknesses.some((weakness) => weakness.includes(position))) return position;
  }
  return null;
}

function surplusThreshold(position) {
  return {
    QB: 2,
    RB: 5,
    WR: 5,
    TE: 2,
  }[position] ?? 99;
}

function toReviewPlayer(player) {
  return {
    playerId: player.playerId,
    name: player.name,
    position: player.position,
    team: player.team,
    bye: player.bye,
    projectedPoints: round(player.projectedPoints, 1),
    adp: player.adp,
    sourceRank: player.sourceRank,
  };
}

function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
