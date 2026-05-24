import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPostDraftReview } from "./rosterReview.mjs";

export function buildSimulationReport(state, userRecommendations, options = {}) {
  const playerById = new Map(state.players.map((player) => [player.playerId, player]));
  const userTeam = state.teams.find((team) => team.teamId === state.league.userTeamId);
  const userRoster = (userTeam?.picks ?? []).map((pick) => {
    const player = playerById.get(pick.playerId);
    return {
      pickNumber: pick.pickNumber,
      round: pick.round,
      playerId: player.playerId,
      name: player.name,
      position: player.position,
      team: player.team,
      projectedPoints: player.projectedPoints,
      adp: player.adp,
      sourceRank: player.sourceRank,
      source: player.source ?? "static_fixture",
    };
  });

  const rosterCounts = userRoster.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});

  return {
    simulationRunId: options.simulationRunId ?? `sim_${new Date().toISOString().replaceAll(/[:.]/g, "-")}`,
    mode: options.mode ?? "mock",
    strategy: options.strategy ?? null,
    opponentProfile: options.opponentProfile ?? null,
    scenario: options.scenario ?? null,
    createdAt: new Date().toISOString(),
    league: {
      leagueId: state.league.leagueId,
      name: state.league.name,
      teams: state.league.teams,
      draft: state.league.draft,
      rosterSlots: state.league.rosterSlots,
    },
    summary: {
      picksMade: state.drafted.length,
      recommendationTurns: userRecommendations.length,
      userRosterSize: userRoster.length,
      rosterCounts,
      projectedRosterPoints: round(userRoster.reduce((sum, player) => sum + player.projectedPoints, 0), 1),
    },
    postDraftReview: buildPostDraftReview(state, state.league.userTeamId),
    userRoster,
    userRecommendations,
    replayTurns: options.replayTurns ?? [],
    draftLog: state.drafted.map((pick) => {
      const player = playerById.get(pick.playerId);
      return {
        pickNumber: pick.pickNumber,
        round: pick.round,
        teamId: pick.teamId,
        playerId: pick.playerId,
        name: player?.name ?? pick.playerId,
        position: player?.position ?? null,
        source: pick.source,
      };
    }),
  };
}

export async function saveSimulationReport(report, projectRoot) {
  const outputDir = path.join(projectRoot, "data", "simulations");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${report.simulationRunId}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  await updateSimulationIndex(report, outputDir);
  return outputPath;
}

async function updateSimulationIndex(report, outputDir) {
  const indexPath = path.join(outputDir, "index.json");
  const existing = await readSimulationIndex(indexPath);
  const entry = {
    simulationRunId: report.simulationRunId,
    file: `${report.simulationRunId}.json`,
    mode: report.mode,
    strategy: report.strategy,
    opponentProfile: report.opponentProfile,
    scenario: report.scenario,
    createdAt: report.createdAt,
    leagueName: report.league.name,
    teams: report.league.teams,
    draftType: report.league.draft.type,
    picksMade: report.summary.picksMade,
    recommendationTurns: report.summary.recommendationTurns,
    userRosterSize: report.summary.userRosterSize,
    projectedRosterPoints: report.summary.projectedRosterPoints,
    projectedStarterPoints: report.postDraftReview.summary.projectedStarterPoints,
    weaknessCount: report.postDraftReview.weaknesses.length,
    waiverWatchCount: report.postDraftReview.waiverWatch.length,
  };

  const entriesById = new Map(existing.reports.map((item) => [item.simulationRunId, item]));
  entriesById.set(entry.simulationRunId, entry);
  const reports = [...entriesById.values()]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);

  await writeFile(indexPath, `${JSON.stringify({
    updatedAt: new Date().toISOString(),
    reports,
  }, null, 2)}\n`);
}

async function readSimulationIndex(indexPath) {
  try {
    const payload = JSON.parse(await readFile(indexPath, "utf8"));
    if (Array.isArray(payload.reports)) return payload;
  } catch {
    // Missing or malformed index gets rebuilt on the next saved report.
  }

  return { updatedAt: null, reports: [] };
}

function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
