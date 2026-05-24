import { mockLeague, mockPlayers } from "../src/draft/mockData.mjs";
import {
  buildLeagueFromYahooSettings,
  parseYahooLeagueSettingsJson,
  summarizeLeagueRules,
} from "../src/league/leagueImport.mjs";
import {
  createDraftState,
  draftPlayer,
  getAvailablePlayers,
  getMaxDraftPicks,
  getTeamForPick,
  getTeamRoster,
  isUserTurn,
  recommendPlayers,
  runMockUntilUserTurn,
  undoLastPick,
} from "../src/draft/draftEngine.mjs";
import { buildPostDraftReview } from "../src/draft/rosterReview.mjs";
import { applyYahooDraftEventsToState } from "../src/draft/yahooDraftSync.mjs";
import { buildLeagueRosterSnapshot } from "../src/draft/leagueRosters.mjs";
import { buildRehearsalDraftEvents } from "../src/draft/rehearsalDraftFeed.mjs";
import { mergeProjectionSource } from "../src/data/projectionSource.mjs";

const params = new URLSearchParams(window.location.search);
let playerPoolMode = params.get("pool") === "generated" ? "generated" : "static";
let playerPool = mockPlayers;
let activeLeague = mockLeague;
let activeTeams = buildTeamsForLeague(activeLeague);
let state = createDraftState(activeLeague, activeTeams, playerPool);
let recommendationsPaused = false;
let manualSearch = "";
let reportIndex = [];
let selectedReport = null;
let yahooLeagueOptions = [];
let latestBatch = null;
let latestYahooReadiness = null;
let activeDraftKey = draftKeyForLeague(activeLeague);
const draftSessions = new Map();
let yahooRosterSnapshots = [];
let pendingManualSyncIssue = null;
let syncEventHistory = [];
let strategyPreferences = {
  strategyProfile: "balanced",
  riskProfile: "balanced",
  preferStacking: false,
  avoidTeams: [],
  avoidPlayers: [],
};
let latestSyncStatus = {
  status: "manual_required",
  highestPick: 0,
  updatedAt: null,
  message: "Manual mock mode",
};
let yahooDraftPollingTimer = null;

const els = {
  status: document.querySelector("#pick-status"),
  leagueSourceChip: document.querySelector("#league-source-chip"),
  leagueSummary: document.querySelector("#league-summary"),
  leagueChip: document.querySelector("#league-chip"),
  log: document.querySelector("#draft-log"),
  recommendations: document.querySelector("#recommendations"),
  roster: document.querySelector("#roster"),
  available: document.querySelector("#available"),
  leagueRostersChip: document.querySelector("#league-rosters-chip"),
  review: document.querySelector("#review"),
  reports: document.querySelector("#reports"),
  runSimulations: document.querySelector("#run-simulations-btn"),
  simulationRunMessage: document.querySelector("#simulation-run-message"),
  simulationComparison: document.querySelector("#simulation-comparison"),
  refreshReports: document.querySelector("#refresh-reports-btn"),
  simTeams: document.querySelector("#sim-teams"),
  simDraftSlot: document.querySelector("#sim-draft-slot"),
  simRounds: document.querySelector("#sim-rounds"),
  simPpr: document.querySelector("#sim-ppr"),
  simOpponentProfile: document.querySelector("#sim-opponent-profile"),
  simUseSavedLeague: document.querySelector("#sim-use-saved-league"),
  advance: document.querySelector("#advance-btn"),
  accept: document.querySelector("#accept-btn"),
  pause: document.querySelector("#pause-btn"),
  undo: document.querySelector("#undo-btn"),
  reset: document.querySelector("#reset-btn"),
  manualSearch: document.querySelector("#manual-player-search"),
  manualSelect: document.querySelector("#manual-player-select"),
  draftCurrent: document.querySelector("#draft-current-btn"),
  draftMe: document.querySelector("#draft-me-btn"),
  importSampleLeague: document.querySelector("#import-sample-league-btn"),
  importCustomLeague: document.querySelector("#import-custom-league-btn"),
  leagueSettingsFile: document.querySelector("#league-settings-file"),
  leagueSettingsJson: document.querySelector("#league-settings-json"),
  leagueImportMessage: document.querySelector("#league-import-message"),
  resetLeague: document.querySelector("#reset-league-btn"),
  strategyProfile: document.querySelector("#strategy-profile"),
  riskProfile: document.querySelector("#risk-profile"),
  preferStacking: document.querySelector("#prefer-stacking"),
  avoidTeams: document.querySelector("#avoid-teams"),
  avoidPlayers: document.querySelector("#avoid-players"),
  strategyMessage: document.querySelector("#strategy-message"),
  projectionSourceName: document.querySelector("#projection-source-name"),
  projectionFile: document.querySelector("#projection-file"),
  projectionJson: document.querySelector("#projection-json"),
  importProjectionSource: document.querySelector("#import-projection-source-btn"),
  projectionImportMessage: document.querySelector("#projection-import-message"),
  yahooStatusChip: document.querySelector("#yahoo-status-chip"),
  yahooMessage: document.querySelector("#yahoo-message"),
  yahooOutput: document.querySelector("#yahoo-output"),
  connectYahoo: document.querySelector("#connect-yahoo-btn"),
  refreshYahooStatus: document.querySelector("#refresh-yahoo-status-btn"),
  refreshYahooReadiness: document.querySelector("#refresh-yahoo-readiness-btn"),
  yahooReadinessSummary: document.querySelector("#yahoo-readiness-summary"),
  yahooReadinessChecks: document.querySelector("#yahoo-readiness-checks"),
  yahooReadinessActions: document.querySelector("#yahoo-readiness-actions"),
  loadYahooGames: document.querySelector("#load-yahoo-games-btn"),
  loadYahooTeams: document.querySelector("#load-yahoo-teams-btn"),
  discoverYahooLeagues: document.querySelector("#discover-yahoo-leagues-btn"),
  loadYahooDraftResults: document.querySelector("#load-yahoo-draft-results-btn"),
  loadYahooRosters: document.querySelector("#load-yahoo-rosters-btn"),
  startYahooDraftPolling: document.querySelector("#start-yahoo-draft-polling-btn"),
  stopYahooDraftPolling: document.querySelector("#stop-yahoo-draft-polling-btn"),
  rehearsalMode: document.querySelector("#rehearsal-mode"),
  rehearsalSync: document.querySelector("#rehearsal-sync-btn"),
  manualSyncResolution: document.querySelector("#manual-sync-resolution"),
  syncEventHistory: document.querySelector("#sync-event-history"),
  yahooDraftSyncStatus: document.querySelector("#yahoo-draft-sync-status"),
  yahooLeagueSelect: document.querySelector("#yahoo-league-select"),
  importYahooLeague: document.querySelector("#import-yahoo-league-btn"),
  leagueRosterView: document.querySelector("#league-roster-view"),
};

els.advance.addEventListener("click", () => {
  if (recommendationsPaused) return;
  runMockUntilUserTurn(state);
  render();
});

els.accept.addEventListener("click", () => {
  const [top] = recommendPlayers(state, activeLeague.userTeamId, 1, { strategyPreferences });
  if (top && isUserTurn(state)) {
    draftPlayer(state, top.player.playerId, activeLeague.userTeamId, "mock_user_accept");
  }
  runMockUntilUserTurn(state);
  render();
});

els.pause.addEventListener("click", () => {
  recommendationsPaused = !recommendationsPaused;
  render();
});

els.undo.addEventListener("click", () => {
  undoLastPick(state);
  render();
});

els.reset.addEventListener("click", () => {
  resetDraftState();
  recommendationsPaused = false;
  manualSearch = "";
  els.manualSearch.value = "";
  render();
});

els.manualSearch.addEventListener("input", (event) => {
  manualSearch = event.target.value;
  renderManualOptions();
});

els.draftCurrent.addEventListener("click", () => {
  const playerId = els.manualSelect.value;
  if (!playerId || isDraftComplete()) return;
  draftPlayer(state, playerId, getTeamForPick(activeLeague, state.currentPick), "manual_current_team");
  render();
});

els.draftMe.addEventListener("click", () => {
  const playerId = els.manualSelect.value;
  if (!playerId || isDraftComplete()) return;
  draftPlayer(state, playerId, activeLeague.userTeamId, "manual_user");
  render();
});

els.importSampleLeague.addEventListener("click", async () => {
  await importSampleYahooLeague();
  render();
});

els.importCustomLeague.addEventListener("click", () => {
  importPastedYahooLeague().then(() => render());
});

els.leagueSettingsFile.addEventListener("change", async (event) => {
  await loadYahooSettingsFile(event.target.files?.[0]);
});

els.resetLeague.addEventListener("click", () => {
  activeLeague = mockLeague;
  activeTeams = buildTeamsForLeague(activeLeague);
  els.leagueImportMessage.textContent = "";
  resetDraftState();
  syncScenarioControlsToLeague();
  render();
});

for (const element of [els.strategyProfile, els.riskProfile, els.preferStacking, els.avoidTeams, els.avoidPlayers]) {
  element.addEventListener("change", () => {
    applyStrategyPreferencesFromControls();
    render();
  });
  element.addEventListener("input", () => {
    applyStrategyPreferencesFromControls();
    render();
  });
}

els.importProjectionSource.addEventListener("click", async () => {
  await importProjectionSourceFromControls();
  render();
});

els.projectionFile.addEventListener("change", async (event) => {
  await loadProjectionFile(event.target.files?.[0]);
});

els.refreshReports.addEventListener("click", async () => {
  await loadSimulationReports();
  renderReports();
});

els.runSimulations.addEventListener("click", async () => {
  await runStrategyBatch();
});

els.connectYahoo.addEventListener("click", async () => {
  await connectYahoo();
});

els.refreshYahooStatus.addEventListener("click", async () => {
  await loadYahooStatus();
  await loadYahooReadiness();
});

els.refreshYahooReadiness.addEventListener("click", async () => {
  await loadYahooReadiness({ showOutput: true });
});

els.loadYahooGames.addEventListener("click", async () => {
  await loadYahooReadEndpoint("/api/yahoo/games", "Yahoo NFL games");
});

els.loadYahooTeams.addEventListener("click", async () => {
  await loadYahooReadEndpoint("/api/yahoo/teams", "Yahoo NFL teams");
});

els.discoverYahooLeagues.addEventListener("click", async () => {
  await discoverYahooLeagues();
});

els.loadYahooDraftResults.addEventListener("click", async () => {
  await loadSelectedYahooDraftResults();
});

els.loadYahooRosters.addEventListener("click", async () => {
  await loadSelectedYahooRosters();
});

els.startYahooDraftPolling.addEventListener("click", async () => {
  await startYahooDraftPolling();
});

els.stopYahooDraftPolling.addEventListener("click", () => {
  stopYahooDraftPolling("Yahoo draft polling stopped.");
});

els.rehearsalSync.addEventListener("click", () => {
  runRehearsalDraftSync();
});

els.importYahooLeague.addEventListener("click", async () => {
  await importSelectedYahooLeagueSettings();
});

if (playerPoolMode === "generated") {
  await loadGeneratedPlayerPool();
}
await loadSavedYahooLeagueProfile();
await loadYahooStatus();
await loadYahooReadiness();
await loadSimulationReports();
syncScenarioControlsToLeague();

function render() {
  saveActiveDraftSession();
  const currentTeam = getTeamForPick(state.league, state.currentPick);
  els.status.textContent = isDraftComplete()
    ? "Draft complete"
    : `Pick ${state.currentPick} - ${teamName(currentTeam)}`;
  els.leagueChip.textContent = `${activeLeague.teams} teams / ${activeLeague.name} / ${playerPoolMode} / ${playerPool.length} players`;
  els.advance.disabled = recommendationsPaused || isDraftComplete();
  els.accept.disabled = recommendationsPaused || !isUserTurn(state) || isDraftComplete();
  els.pause.textContent = recommendationsPaused ? "Resume" : "Pause";
  els.undo.disabled = state.drafted.length === 0;
  els.draftCurrent.disabled = isDraftComplete();
  els.draftMe.disabled = isDraftComplete();
  els.rehearsalSync.disabled = isDraftComplete();
  renderStrategyControls();
  renderYahooLeagueOptions();
  renderManualOptions();
  renderLog();
  renderLeagueSummary();
  renderRecommendations();
  renderRoster();
  renderLeagueRosterView();
  renderAvailable();
  renderReview();
  renderYahooDraftSyncStatus();
  renderYahooReadiness();
  renderManualSyncResolution();
  renderSyncEventHistory();
  renderSimulationComparison();
  renderReports();
}

function renderLog() {
  els.log.innerHTML = state.drafted.slice(-18).reverse().map((pick) => {
    const player = state.players.find((candidate) => candidate.playerId === pick.playerId);
    return `
      <div class="pick">
        <div>
          <strong>${pick.pickNumber}. ${player.name}</strong>
          <div class="meta">${player.position} - ${player.team} - ${teamName(pick.teamId)}</div>
        </div>
        <div class="meta">R${pick.round}</div>
      </div>
    `;
  }).join("") || `<div class="meta">No picks yet. Advance to your first pick.</div>`;
}

function renderRecommendations() {
  if (recommendationsPaused) {
    els.recommendations.innerHTML = `<div class="meta">Recommendations paused. Manual board corrections remain available.</div>`;
    return;
  }

  if (!isUserTurn(state)) {
    els.recommendations.innerHTML = `<div class="meta">Advance to your next pick to generate recommendations.</div>`;
    return;
  }

  const recommendations = recommendPlayers(state, activeLeague.userTeamId, 5, { strategyPreferences });
  els.recommendations.innerHTML = recommendations.map((option, index) => `
    <article class="rec">
      <div class="rec-title">
        <div>
          <h3>${index + 1}. ${option.player.name}</h3>
          <div class="meta">${option.player.position} - ${option.player.team} - Bye ${option.player.bye}</div>
        </div>
        <div class="score">${option.finalScore}</div>
      </div>
      <p class="meta">${option.whyNow} Survival to next pick: ${Math.round(option.survivalProbability * 100)}%.</p>
      <div class="breakdown">
        <div>Projection: <strong>${option.projectedPoints}</strong></div>
        <div>VORP: <strong>${option.valueOverReplacement}</strong></div>
        <div>Team value: <strong>${option.marginalTeamValue}</strong></div>
        <div>Scarcity: <strong>${option.scarcityUrgency}</strong></div>
        <div>Market edge: <strong>${option.marketValueEdge}</strong></div>
        <div>Roster pressure: <strong>${option.rosterPressure}</strong></div>
        <div>Risk penalty: <strong>${option.riskPenalty}</strong></div>
        <div>Strategy: <strong>${option.strategyPreference.adjustment}</strong></div>
        <div>Source confidence: <strong>${Math.round(option.sourceConfidence * 100)}%</strong></div>
      </div>
      ${option.strategyPreference.reasons.length > 0 ? `<p class="strategy-note">${option.strategyPreference.reasons.map(escapeHtml).join("; ")}.</p>` : ""}
      ${renderProjectionMath(option.projectionExplanation)}
      ${option.sourceWarning ? `<p class="source-warning">${option.sourceWarning}</p>` : ""}
      <strong>Pros</strong>
      <ul>${option.pros.map((item) => `<li>${item}</li>`).join("")}</ul>
      <strong>Cons</strong>
      <ul>${option.cons.map((item) => `<li>${item}</li>`).join("")}</ul>
    </article>
  `).join("");
}

function renderProjectionMath(explanation) {
  if (!explanation?.components?.length) return "";
  return `
    <details class="projection-math">
      <summary>Projection math: ${explanation.total} points</summary>
      <div class="projection-components">
        ${explanation.components.map((component) => `
          <span>${escapeHtml(component.label)}: ${component.stat} x ${component.rate} = <strong>${component.points}</strong></span>
        `).join("")}
      </div>
    </details>
  `;
}

function renderManualOptions() {
  const query = manualSearch.trim().toLowerCase();
  const available = getAvailablePlayers(state)
    .slice()
    .sort((a, b) => a.adp - b.adp)
    .filter((player) => {
      if (!query) return true;
      return `${player.name} ${player.position} ${player.team}`.toLowerCase().includes(query);
    })
    .slice(0, 40);

  els.manualSelect.innerHTML = available.map((player) => `
    <option value="${player.playerId}">
      ${player.name} - ${player.position} - ${player.team} - ADP ${player.adp}
    </option>
  `).join("");
}

function renderRoster() {
  const roster = getTeamRoster(state, activeLeague.userTeamId);
  els.roster.innerHTML = roster.map((player) => `
    <div class="roster-row">
      <strong>${player.name}</strong>
      <span class="meta">${player.position} - ${player.team}</span>
    </div>
  `).join("") || `<div class="meta">No players drafted yet.</div>`;
}

function renderLeagueRosterView() {
  if (!els.leagueRosterView) return;
  const snapshot = buildLeagueRosterSnapshot(state);
  const teams = mergeYahooRosterSnapshots(snapshot.teams);
  els.leagueRostersChip.textContent = yahooRosterSnapshots.length > 0
    ? `${yahooRosterSnapshots.length} Yahoo rosters`
    : `${snapshot.teams.length} teams / pick ${snapshot.currentPick}`;
  els.leagueRosterView.innerHTML = teams.map((team) => {
    const needed = Object.entries(team.openSlots)
      .filter(([, count]) => count > 0)
      .map(([slot, count]) => `${count} ${slot}`);
    return `
      <article class="team-roster-card ${team.teamId === activeLeague.userTeamId ? "mine" : ""}">
        <div class="team-roster-title">
          <strong>${escapeHtml(team.name)}</strong>
          <span class="meta">${team.teamKey ? escapeHtml(team.teamKey) : `Slot ${team.draftSlot}`} / ${team.pickCount} picks</span>
        </div>
        <div class="slot-list compact-slots">
          ${["QB", "RB", "WR", "TE", "K", "DST"].map((position) => `
            <span>${position}: <strong>${team.rosterCounts[position] ?? 0}</strong></span>
          `).join("")}
        </div>
        <div class="meta">${needed.length > 0 ? `Needs ${needed.join(", ")}` : "Required starters filled"}</div>
        <div class="mini-list roster-mini">
          ${team.roster.slice(0, 8).map((player) => `
            <div class="mini-row">
              <strong>${player.pickNumber ? `${player.pickNumber}. ` : ""}${escapeHtml(player.name)}</strong>
              <span class="meta">${player.position} - ${escapeHtml(player.team)}</span>
            </div>
          `).join("") || `<div class="meta">No picks yet.</div>`}
        </div>
      </article>
    `;
  }).join("");
}

function mergeYahooRosterSnapshots(draftTeams) {
  if (yahooRosterSnapshots.length === 0) return draftTeams;
  const byTeamKey = new Map(yahooRosterSnapshots.map((team) => [team.teamKey, team]));

  return draftTeams.map((team) => {
    const yahoo = byTeamKey.get(team.teamKey);
    if (!yahoo) return team;
    const roster = yahoo.roster.map((player) => ({
      playerId: player.playerId,
      name: player.yahooPlayerName ?? player.yahooPlayerKey ?? "Unmapped Yahoo player",
      position: player.selectedPosition ?? "UNK",
      team: player.matchStatus,
      source: "yahoo_roster",
    }));
    const rosterCounts = roster.reduce((counts, player) => {
      counts[player.position] = (counts[player.position] ?? 0) + 1;
      return counts;
    }, {});
    return {
      ...team,
      name: yahoo.name ?? team.name,
      roster,
      pickCount: roster.length,
      rosterCounts,
      openSlots: calculateOpenSlotsForCounts(activeLeague, rosterCounts),
    };
  });
}

function calculateOpenSlotsForCounts(league, counts) {
  return Object.fromEntries(["QB", "RB", "WR", "TE", "K", "DST"].map((position) => [
    position,
    Math.max(0, (league.rosterSlots[position] ?? 0) - (counts[position] ?? 0)),
  ]));
}

function renderAvailable() {
  els.available.innerHTML = getAvailablePlayers(state)
    .slice()
    .sort((a, b) => a.adp - b.adp)
    .slice(0, 16)
    .map((player) => `
      <div class="player-row">
        <strong>${player.name}</strong>
        <span class="meta">${player.position} - ADP ${player.adp}</span>
      </div>
    `).join("");
}

function renderReview() {
  if (!isDraftComplete()) {
    els.review.innerHTML = `<div class="meta">Complete the mock draft to generate roster strengths, weaknesses, waiver watch, and trade-plan ideas.</div>`;
    return;
  }

  const review = buildPostDraftReview(state, activeLeague.userTeamId);
  els.review.innerHTML = `
    <div class="review-summary">
      <div>Starter projection: <strong>${review.summary.projectedStarterPoints}</strong></div>
      <div>Bench projection: <strong>${review.summary.projectedBenchPoints}</strong></div>
    </div>
    ${renderListSection("Projected Lineup", review.projectedLineup)}
    ${renderTextSection("Strengths", review.strengths)}
    ${renderTextSection("Weaknesses", review.weaknesses)}
    ${renderListSection("Waiver Watch", review.waiverWatch)}
    ${renderTextSection("Trade Plan", review.tradePlan.suggestedActions)}
  `;
}

function renderTextSection(title, items) {
  return `
    <div class="review-section">
      <h3>${title}</h3>
      <ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>
    </div>
  `;
}

function renderListSection(title, players) {
  return `
    <div class="review-section">
      <h3>${title}</h3>
      <div class="mini-list">
        ${players.map((player) => `
          <div class="mini-row">
            <strong>${player.name}</strong>
            <span class="meta">${player.position} - ${player.team} - ${player.projectedPoints}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderReports() {
  if (reportIndex.length === 0) {
    els.reports.innerHTML = `<div class="meta">No simulation report index yet. Run <code>npm run mock:draft</code> to create one.</div>`;
    return;
  }

  const selected = selectedReport;
  els.reports.innerHTML = `
    <div class="report-layout">
      <div class="report-list">
        ${reportIndex.map((report) => `
          <button class="report-button ${selected?.simulationRunId === report.simulationRunId ? "active" : ""}" data-report-file="${report.file}">
            <strong>${formatDate(report.createdAt)}</strong>
            <span>${formatStrategy(report.strategy)} - ${report.picksMade} picks - ${report.projectedStarterPoints} starter pts - ${report.weaknessCount} weaknesses</span>
          </button>
        `).join("")}
      </div>
      <div class="report-detail">
        ${selected ? renderSelectedReport(selected) : `<div class="meta">Select a report to review the saved mock draft.</div>`}
      </div>
    </div>
  `;

  els.reports.querySelectorAll("[data-report-file]").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadSimulationReport(button.dataset.reportFile);
      renderReports();
    });
  });
}

function renderSelectedReport(report) {
  return `
    <div class="review-summary">
      <div>Strategy: <strong>${formatStrategy(report.strategy)}</strong></div>
      <div>Room: <strong>${formatOpponentProfile(report.opponentProfile?.id)}</strong></div>
      <div>Picks made: <strong>${report.summary.picksMade}</strong></div>
      <div>Roster projection: <strong>${report.summary.projectedRosterPoints}</strong></div>
      <div>Starter projection: <strong>${report.postDraftReview.summary.projectedStarterPoints}</strong></div>
      <div>Recommendations: <strong>${report.summary.recommendationTurns}</strong></div>
    </div>
    ${renderListSection("Saved Roster", report.userRoster)}
    ${renderTextSection("Saved Strengths", report.postDraftReview.strengths)}
    ${renderTextSection("Saved Weaknesses", report.postDraftReview.weaknesses)}
    ${renderListSection("Saved Waiver Watch", report.postDraftReview.waiverWatch)}
    ${renderTextSection("Saved Trade Plan", report.postDraftReview.tradePlan.suggestedActions)}
    ${renderReplaySection(report)}
    ${renderRecommendationSnapshot(report)}
  `;
}

function renderSimulationComparison() {
  if (!latestBatch?.reports?.length) {
    els.simulationComparison.innerHTML = "";
    return;
  }

  const sortedReports = latestBatch.reports.slice().sort((a, b) =>
    b.projectedStarterPoints - a.projectedStarterPoints ||
    b.projectedRosterPoints - a.projectedRosterPoints ||
    a.weaknessCount - b.weaknessCount
  );
  const scenario = latestBatch.scenario ?? readScenarioControls();
  els.simulationComparison.innerHTML = `
    <div class="comparison-header">
      <div>
        <h3>Latest Batch Comparison</h3>
        <div class="meta">${latestBatch.league?.name ?? activeLeague.name} - ${scenario.teams} teams - slot ${scenario.draftSlot} - ${formatPpr(scenario.ppr)} - ${formatOpponentProfile(scenario.opponentProfileId)}</div>
      </div>
      <div class="score">${latestBatch.winner?.projectedStarterPoints ?? "-"}</div>
    </div>
    <div class="comparison-grid">
      ${sortedReports.map((report) => `
        <article class="comparison-card">
          <div class="comparison-title">
            <strong>${formatStrategy(report.strategy)}</strong>
            <span>${report.projectedStarterPoints} starter pts</span>
          </div>
          <div class="metric-row">
            <span>Roster</span><strong>${report.projectedRosterPoints}</strong>
            <span>Bench</span><strong>${report.projectedBenchPoints}</strong>
            <span>Weaknesses</span><strong>${report.weaknessCount}</strong>
          </div>
          ${renderInlineList("Best picks", report.bestPicks?.map((pick) => `${pick.pickNumber}. ${pick.name}`) ?? [])}
          ${renderInlineList("Missed", report.missedOpportunities?.map((miss) => `${miss.pickNumber}: ${miss.topAvailable} over ${miss.selected}`) ?? [])}
        </article>
      `).join("")}
    </div>
  `;
}

function renderInlineList(label, items) {
  if (items.length === 0) return `<p class="meta">${label}: none flagged.</p>`;
  return `<p class="meta">${label}: ${items.slice(0, 3).map(escapeHtml).join("; ")}</p>`;
}

function renderReplaySection(report) {
  const turns = report.replayTurns ?? [];
  if (turns.length === 0) return "";

  return `
    <div class="review-section">
      <h3>Turn Replay</h3>
      <div class="replay-list">
        ${turns.map((turn) => `
          <details class="replay-turn">
            <summary>
              <strong>Pick ${turn.pickNumber}</strong>
              <span>${turn.selected.name} (${turn.selected.position}) - selected rank ${turn.selectedRank}</span>
            </summary>
            <div class="replay-body">
              <div>
                <h4>Options Shown</h4>
                <div class="mini-list">
                  ${turn.options.map((option, index) => `
                    <div class="mini-row ${option.playerId === turn.selected.playerId ? "selected-option" : ""}">
                      <strong>${index + 1}. ${option.name}</strong>
                      <span class="meta">${option.position} - score ${option.score} - survive ${Math.round(option.survivalProbability * 100)}%</span>
                    </div>
                  `).join("")}
                </div>
              </div>
              <div>
                <h4>Roster After Pick</h4>
                <div class="mini-list">
                  ${(turn.afterRoster ?? []).map((player) => `
                    <div class="mini-row">
                      <strong>${player.name}</strong>
                      <span class="meta">${player.position} - ${player.projectedPoints}</span>
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>
          </details>
        `).join("")}
      </div>
    </div>
  `;
}

function renderRecommendationSnapshot(report) {
  const firstTurn = report.userRecommendations?.[0];
  if (!firstTurn) return "";
  return `
    <div class="review-section">
      <h3>First Recommendation Snapshot</h3>
      <div class="mini-list">
        ${firstTurn.options.slice(0, 5).map((option) => `
          <div class="mini-row">
            <strong>${option.name}</strong>
            <span class="meta">${option.position} - score ${option.score}</span>
            ${option.sourceConfidence ? `<span class="meta">Source confidence ${Math.round(option.sourceConfidence * 100)}%</span>` : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function teamName(teamId) {
  return state.teams.find((team) => team.teamId === teamId)?.name ?? teamId;
}

function isDraftComplete() {
  return state.currentPick > getMaxDraftPicks(state);
}

render();

function renderLeagueSummary() {
  const summary = summarizeLeagueRules(activeLeague);
  const warnings = [...summary.warnings, ...getLeagueCapacityWarnings(activeLeague)];
  els.leagueSourceChip.textContent = activeLeague.importSource ? "Imported Yahoo sample" : "Mock rules";
  els.leagueSummary.innerHTML = `
    <div class="review-summary">
      <div>League: <strong>${summary.name}</strong></div>
      <div>Draft: <strong>${summary.draftType ?? "unknown"} / ${summary.rounds} rounds</strong></div>
      <div>Reception: <strong>${summary.scoring.reception}</strong></div>
      <div>Pass TD: <strong>${summary.scoring.passingTd}</strong></div>
      ${summary.selectedTeam ? `<div>Yahoo team: <strong>${escapeHtml(summary.selectedTeam)}</strong></div>` : ""}
      <div>Draft key: <strong>${escapeHtml(activeDraftKey)}</strong></div>
      <div>Sync: <strong>${escapeHtml(latestSyncStatus.status)}</strong></div>
      <div>Highest pick: <strong>${latestSyncStatus.highestPick}</strong></div>
      <div>Updated: <strong>${latestSyncStatus.updatedAt ? formatDate(latestSyncStatus.updatedAt) : "Not synced"}</strong></div>
      <div>Strategy: <strong>${formatPreference(strategyPreferences.strategyProfile)}</strong></div>
      <div>Risk: <strong>${formatPreference(strategyPreferences.riskProfile)}</strong></div>
    </div>
    <div class="slot-list">
      ${Object.entries(summary.rosterSlots).map(([slot, count]) => `
        <span>${slot}: <strong>${count}</strong></span>
      `).join("")}
    </div>
    ${warnings.length > 0 ? renderTextSection("Import Warnings", warnings) : ""}
  `;
}

function saveActiveDraftSession() {
  if (!activeDraftKey || !state) return;
  draftSessions.set(activeDraftKey, {
    activeLeague,
    state,
    latestSyncStatus,
    yahooRosterSnapshots,
    pendingManualSyncIssue,
    syncEventHistory,
    recommendationsPaused,
  });
}

function switchToDraftSession(league, selectedLeague = null) {
  saveActiveDraftSession();
  activeLeague = { ...league, strategyPreferences };
  activeDraftKey = draftKeyForLeague(league, selectedLeague);
  const existing = draftSessions.get(activeDraftKey);
  if (existing) {
    state = existing.state;
    activeLeague = existing.activeLeague;
    latestSyncStatus = existing.latestSyncStatus;
    yahooRosterSnapshots = existing.yahooRosterSnapshots ?? [];
    pendingManualSyncIssue = existing.pendingManualSyncIssue ?? null;
    syncEventHistory = existing.syncEventHistory ?? [];
    recommendationsPaused = existing.recommendationsPaused;
    activeTeams = state.teams;
    return;
  }

  activeTeams = buildTeamsForLeague(activeLeague);
  state = createDraftState(activeLeague, activeTeams, playerPool);
  latestSyncStatus = {
    status: activeLeague.leagueKey ? "manual_required" : "mock",
    highestPick: 0,
    updatedAt: new Date().toISOString(),
    message: activeLeague.leagueKey ? "No Yahoo draft sync loaded yet" : "Manual mock mode",
  };
  yahooRosterSnapshots = [];
  pendingManualSyncIssue = null;
  syncEventHistory = [];
  saveActiveDraftSession();
}

function draftKeyForLeague(league, selectedLeague = null) {
  const leagueKey = league?.leagueKey ?? selectedLeague?.leagueKey ?? "mock";
  const teamKey = league?.selectedTeamKey ?? selectedLeague?.selectedTeamKey ?? selectedLeague?.primaryTeam?.teamKey ?? league?.userTeamId ?? "team";
  return `${leagueKey}:${teamKey}`;
}

function teamNameFromLeagueMetadata(league, draftSlot) {
  const teams = league.yahooDraftOrderTeams ?? league.importSource?.selectedLeague?.teams ?? league.yahooTeams ?? [];
  const team = teams.find((candidate) => {
    if (candidate.teamId === `team_${draftSlot}`) return true;
    if (league.teamKeyToTeamId?.[candidate.teamKey] === `team_${draftSlot}`) return true;
    const keySlot = Number(String(candidate.teamKey ?? "").match(/\.t\.(\d+)$/)?.[1]);
    return keySlot === draftSlot || Number(candidate.teamId) === draftSlot;
  });
  return team?.name ?? null;
}

function yahooTeamKeyFromLeagueMetadata(league, draftSlot) {
  const teams = league.yahooDraftOrderTeams ?? league.importSource?.selectedLeague?.teams ?? league.yahooTeams ?? [];
  const team = teams.find((candidate) => {
    if (candidate.teamId === `team_${draftSlot}`) return true;
    if (league.teamKeyToTeamId?.[candidate.teamKey] === `team_${draftSlot}`) return true;
    const keySlot = Number(String(candidate.teamKey ?? "").match(/\.t\.(\d+)$/)?.[1]);
    return keySlot === draftSlot || Number(candidate.teamId) === draftSlot;
  });
  return team?.teamKey ?? null;
}

function buildTeamsForLeague(league) {
  return Array.from({ length: league.teams }, (_, index) => ({
    teamId: `team_${index + 1}`,
    name: teamNameFromLeagueMetadata(league, index + 1) ?? (index + 1 === league.draft.userDraftSlot ? "My Team" : `Opponent ${index + 1}`),
    yahooTeamKey: yahooTeamKeyFromLeagueMetadata(league, index + 1),
    draftSlot: index + 1,
    picks: [],
  }));
}

function resetDraftState() {
  saveActiveDraftSession();
  activeLeague = { ...activeLeague, strategyPreferences };
  activeTeams = buildTeamsForLeague(activeLeague);
  state = createDraftState(activeLeague, activeTeams, playerPool);
  activeDraftKey = draftKeyForLeague(activeLeague);
  latestSyncStatus = {
    status: activeLeague.leagueKey ? "manual_required" : "mock",
    highestPick: 0,
    updatedAt: new Date().toISOString(),
    message: activeLeague.leagueKey ? "No Yahoo draft sync loaded yet" : "Manual mock mode",
  };
  pendingManualSyncIssue = null;
  syncEventHistory = [];
  saveActiveDraftSession();
}

function renderStrategyControls() {
  if (els.strategyProfile.value !== strategyPreferences.strategyProfile) els.strategyProfile.value = strategyPreferences.strategyProfile;
  if (els.riskProfile.value !== strategyPreferences.riskProfile) els.riskProfile.value = strategyPreferences.riskProfile;
  els.preferStacking.checked = strategyPreferences.preferStacking;
  els.strategyMessage.textContent = `${formatPreference(strategyPreferences.strategyProfile)} / ${formatPreference(strategyPreferences.riskProfile)}${strategyPreferences.preferStacking ? " / stacking on" : ""}`;
}

function applyStrategyPreferencesFromControls() {
  strategyPreferences = {
    strategyProfile: els.strategyProfile.value,
    riskProfile: els.riskProfile.value,
    preferStacking: els.preferStacking.checked,
    avoidTeams: splitCsvInput(els.avoidTeams.value).map((team) => team.toUpperCase()),
    avoidPlayers: splitCsvInput(els.avoidPlayers.value),
  };
  activeLeague = { ...activeLeague, strategyPreferences };
  state.league = { ...state.league, strategyPreferences };
  saveActiveDraftSession();
}

async function loadProjectionFile(file) {
  if (!file) return;
  els.projectionJson.value = await file.text();
}

async function importProjectionSourceFromControls() {
  try {
    const source = els.projectionSourceName.value.trim() || "manual_projection_source";
    const payload = JSON.parse(els.projectionJson.value);
    const rows = Array.isArray(payload) ? payload : payload.rows ?? payload.projections ?? [];
    const result = mergeProjectionSource(playerPool, rows, { source });
    playerPool = result.players;
    state.players = createDraftState(activeLeague, activeTeams, playerPool).players.map((player) => {
      const existing = state.players.find((candidate) => candidate.playerId === player.playerId);
      return existing ? { ...existing, ...player } : player;
    });
    els.projectionImportMessage.textContent = `Imported ${source}: matched ${result.matchedCount}, missing ${result.missingProjectionIds.length}, unused ${result.unusedProjectionIds.length}.`;
  } catch (error) {
    els.projectionImportMessage.textContent = error.message;
  }
}

function runRehearsalDraftSync() {
  const payload = buildRehearsalDraftEvents(state, {
    mode: els.rehearsalMode.value,
    maxEvents: 4,
    stopBeforeUserPick: true,
  });
  const syncSummary = applyYahooDraftEventsToState(state, payload.picks);
  recordSyncEventsFromSummary(syncSummary, {
    sourceLabel: "Rehearsal",
    leagueKey: activeLeague.leagueKey ?? "rehearsal",
  });
  captureManualSyncIssue(syncSummary);
  updateYahooDraftSyncStatus({
    status: syncSummary.manualRequired.length > 0 ? "manual_required" : payload.syncStatus,
    highestPick: Math.max(latestSyncStatus.highestPick ?? 0, payload.summary.highestPick ?? 0, state.currentPick - 1),
    message: buildYahooDraftResultsMessage(payload, syncSummary).replace("Yahoo", "rehearsal"),
    leagueKey: activeLeague.leagueKey ?? "rehearsal",
  });
  els.yahooMessage.textContent = latestSyncStatus.message;
  els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
  render();
}

function captureManualSyncIssue(syncSummary) {
  const [issue] = syncSummary.manualRequired ?? [];
  pendingManualSyncIssue = issue ? {
    ...issue,
    capturedAt: new Date().toISOString(),
  } : null;
  saveActiveDraftSession();
}

function renderManualSyncResolution() {
  if (!pendingManualSyncIssue) {
    els.manualSyncResolution.innerHTML = "";
    return;
  }

  const issue = pendingManualSyncIssue;
  const selectedPlayer = state.players.find((player) => player.playerId === els.manualSelect.value);
  const existingPlayer = issue.existingPick
    ? state.players.find((player) => player.playerId === issue.existingPick.playerId)
    : null;
  const canResolveWithSelected = issue.pickNumber === state.currentPick
    && Boolean(selectedPlayer)
    && !state.drafted.some((pick) => pick.playerId === selectedPlayer.playerId);

  els.manualSyncResolution.innerHTML = `
    <div class="manual-sync-card">
      <div>
        <strong>Manual sync issue at pick ${issue.pickNumber ?? "unknown"}</strong>
        <div class="meta">${formatManualReason(issue.manualReason)}${issue.yahooPlayerName ? ` - Yahoo saw ${escapeHtml(issue.yahooPlayerName)}` : ""}</div>
        ${existingPlayer ? `<div class="meta">Local board has ${escapeHtml(existingPlayer.name)} at this pick.</div>` : ""}
      </div>
      <div class="actions compact">
        <button class="resolve-sync-selected-btn" ${canResolveWithSelected ? "" : "disabled"}>Resolve With Selected Player</button>
        <button class="keep-local-sync-btn secondary">Keep Local Board</button>
      </div>
    </div>
  `;

  els.manualSyncResolution.querySelector(".resolve-sync-selected-btn")?.addEventListener("click", () => {
    resolveManualSyncWithSelected();
  });
  els.manualSyncResolution.querySelector(".keep-local-sync-btn")?.addEventListener("click", () => {
    keepLocalBoardForManualSync();
  });
}

function resolveManualSyncWithSelected() {
  if (!pendingManualSyncIssue) return;
  const issue = pendingManualSyncIssue;
  const playerId = els.manualSelect.value;
  if (!playerId || issue.pickNumber !== state.currentPick) return;
  const teamId = normalizeTeamId(issue.teamId ?? getTeamForPick(activeLeague, state.currentPick));
  const pick = draftPlayer(state, playerId, teamId, "manual_sync_resolution");
  recordManualResolutionEvent(issue, {
    resolution: "selected_player",
    playerId,
    teamId,
    pick,
  });
  pendingManualSyncIssue = null;
  updateYahooDraftSyncStatus({
    status: "synced",
    highestPick: Math.max(latestSyncStatus.highestPick ?? 0, state.currentPick - 1),
    message: "Manual sync issue resolved with selected player.",
  });
  saveActiveDraftSession();
  render();
}

function keepLocalBoardForManualSync() {
  const issue = pendingManualSyncIssue;
  if (issue) {
    recordManualResolutionEvent(issue, {
      resolution: "kept_local_board",
      playerId: issue.existingPick?.playerId ?? issue.playerId ?? null,
      teamId: issue.existingPick?.teamId ?? issue.teamId ?? null,
      pick: issue.existingPick ?? null,
    });
  }
  pendingManualSyncIssue = null;
  updateYahooDraftSyncStatus({
    status: "synced",
    highestPick: Math.max(latestSyncStatus.highestPick ?? 0, state.currentPick - 1),
    message: "Manual sync issue cleared; local board kept as source of truth.",
  });
  saveActiveDraftSession();
  render();
}

function recordSyncEventsFromSummary(syncSummary, context = {}) {
  const createdAt = new Date().toISOString();
  const events = syncSummary.events ?? [];
  for (const event of events) {
    addSyncEvent({
      ...decorateSyncEvent(event, context),
      createdAt,
    });
  }
  saveActiveDraftSession();
}

function recordManualResolutionEvent(issue, options = {}) {
  addSyncEvent({
    createdAt: new Date().toISOString(),
    sourceLabel: options.sourceLabel ?? "Manual",
    leagueKey: activeLeague.leagueKey ?? latestSyncStatus.leagueKey ?? "mock",
    pickNumber: issue.pickNumber ?? options.pick?.pickNumber ?? null,
    teamId: normalizeTeamId(options.teamId ?? issue.teamId ?? options.pick?.teamId),
    teamName: teamName(normalizeTeamId(options.teamId ?? issue.teamId ?? options.pick?.teamId)),
    playerId: options.playerId ?? issue.playerId ?? null,
    playerName: playerNameForSyncEvent(options.playerId ?? issue.playerId, issue.yahooPlayerName),
    yahooPlayerName: issue.yahooPlayerName ?? null,
    status: "manually_resolved",
    reason: issue.manualReason ?? null,
    resolution: options.resolution,
    existingPlayerName: issue.existingPick ? playerNameForSyncEvent(issue.existingPick.playerId) : null,
  });
}

function decorateSyncEvent(event, context = {}) {
  const teamId = event.teamId ? normalizeTeamId(event.teamId) : null;
  const playerName = playerNameForSyncEvent(event.playerId, event.yahooPlayerName);
  const existingPlayerName = event.existingPick ? playerNameForSyncEvent(event.existingPick.playerId) : null;
  return {
    sourceLabel: context.sourceLabel ?? "Yahoo",
    leagueKey: context.leagueKey ?? latestSyncStatus.leagueKey ?? activeLeague.leagueKey ?? "mock",
    pickNumber: event.pickNumber,
    teamId,
    teamName: teamId ? teamName(teamId) : null,
    playerId: event.playerId,
    playerName,
    yahooPlayerName: event.yahooPlayerName ?? null,
    status: event.status,
    reason: event.reason,
    existingPlayerName,
  };
}

function addSyncEvent(event) {
  syncEventHistory = [
    {
      id: `${event.createdAt}-${event.status}-${event.pickNumber ?? "unknown"}-${syncEventHistory.length}`,
      ...event,
    },
    ...syncEventHistory,
  ].slice(0, 30);
}

function playerNameForSyncEvent(playerId, fallback = null) {
  if (!playerId) return fallback ?? "Unmapped player";
  return state.players.find((player) => player.playerId === playerId)?.name ?? fallback ?? playerId;
}

function renderSyncEventHistory() {
  if (syncEventHistory.length === 0) {
    els.syncEventHistory.innerHTML = `
      <div class="sync-history-card empty">
        <div class="sync-history-header">
          <strong>Sync Event Queue</strong>
          <span class="meta">No events yet</span>
        </div>
      </div>
    `;
    return;
  }

  els.syncEventHistory.innerHTML = `
    <div class="sync-history-card">
      <div class="sync-history-header">
        <strong>Sync Event Queue</strong>
        <span class="meta">${syncEventHistory.length} latest event${syncEventHistory.length === 1 ? "" : "s"}</span>
      </div>
      <div class="sync-event-list">
        ${syncEventHistory.slice(0, 12).map(renderSyncEventRow).join("")}
      </div>
    </div>
  `;
}

function renderSyncEventRow(event) {
  const statusLabel = formatSyncEventStatus(event.status);
  const pickLabel = event.pickNumber ? `Pick ${event.pickNumber}` : "Unknown pick";
  const teamLabel = event.teamName ? ` / ${escapeHtml(event.teamName)}` : "";
  return `
    <div class="sync-event-row sync-event-${event.status}">
      <div>
        <strong>${statusLabel}</strong>
        <div class="meta">${pickLabel}${teamLabel} / ${escapeHtml(event.sourceLabel)} / ${formatDate(event.createdAt)}</div>
      </div>
      <div class="meta">${renderSyncEventMessage(event)}</div>
    </div>
  `;
}

function renderSyncEventMessage(event) {
  if (event.status === "applied") {
    return `${escapeHtml(event.playerName)} was applied to the local board.`;
  }
  if (event.status === "skipped") {
    return `${escapeHtml(event.playerName)} was already present, so the sync skipped it.`;
  }
  if (event.status === "manual_required") {
    const reason = formatManualReason(event.reason);
    const existing = event.existingPlayerName ? ` Local board has ${escapeHtml(event.existingPlayerName)}.` : "";
    return `${escapeHtml(event.playerName)} needs review: ${escapeHtml(reason)}${existing}`;
  }
  if (event.status === "manually_resolved") {
    if (event.resolution === "kept_local_board") {
      return `Manual issue resolved by keeping the local board${event.existingPlayerName ? ` with ${escapeHtml(event.existingPlayerName)}` : ""}.`;
    }
    return `Manual issue resolved with ${escapeHtml(event.playerName)}.`;
  }
  return escapeHtml(event.reason ?? "Sync event recorded.");
}

function formatSyncEventStatus(status) {
  return {
    applied: "Applied",
    skipped: "Skipped",
    manual_required: "Needs Manual Resolution",
    manually_resolved: "Manually Resolved",
  }[status] ?? formatSyncStatus(status);
}

async function importSampleYahooLeague() {
  const response = await fetch("/data/fixtures/yahoo_league_settings_sample.json", { cache: "no-store" });
  if (!response.ok) {
    els.leagueImportMessage.textContent = "Could not load the bundled Yahoo settings sample.";
    return;
  }
  const payload = await response.json();
  activeLeague = buildLeagueFromYahooSettings(mockLeague, payload);
  els.leagueSettingsJson.value = JSON.stringify(payload, null, 2);
  resetDraftState();
  syncScenarioControlsToLeague();
  await saveActiveYahooLeagueProfile(payload, "Imported and saved bundled Yahoo settings sample.");
}

async function importPastedYahooLeague() {
  try {
    const payload = parseYahooLeagueSettingsJson(els.leagueSettingsJson.value);
    activeLeague = buildLeagueFromYahooSettings(mockLeague, payload);
    resetDraftState();
    syncScenarioControlsToLeague();
    await saveActiveYahooLeagueProfile(payload, `Imported and saved ${activeLeague.name}.`);
  } catch (error) {
    els.leagueImportMessage.textContent = error.message;
  }
}

async function loadYahooSettingsFile(file) {
  if (!file) return;
  els.leagueSettingsJson.value = await file.text();
  await importPastedYahooLeague();
  render();
}

async function loadSavedYahooLeagueProfile() {
  try {
    const response = await fetch("/api/league-profile", { cache: "no-store" });
    if (!response.ok) return;
    const profile = await response.json();
    if (!profile.exists || !profile.yahooSettings) return;
    activeLeague = buildLeagueFromYahooSettings(mockLeague, profile.yahooSettings, {
      ...(profile.selectedLeague ?? {}),
      selectedLeague: profile.selectedLeague ?? null,
      selectedTeamKey: profile.selectedLeague?.selectedTeamKey,
      selectedTeamName: profile.selectedLeague?.selectedTeamName,
    });
    els.leagueSettingsJson.value = JSON.stringify(profile.yahooSettings, null, 2);
    els.leagueImportMessage.textContent = profile.savedAt
      ? `Loaded saved Yahoo settings from ${formatDate(profile.savedAt)}.`
      : "Loaded saved Yahoo settings.";
    switchToDraftSession(activeLeague, profile.selectedLeague);
    syncScenarioControlsToLeague();
  } catch {
    els.leagueImportMessage.textContent = "Could not load the saved Yahoo settings profile.";
  }
}

async function saveActiveYahooLeagueProfile(yahooSettings, successMessage, selectedLeague = null) {
  try {
    const response = await fetch("/api/league-profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ yahooSettings, selectedLeague }),
    });
    const payload = await response.json();
    els.leagueImportMessage.textContent = response.ok && payload.saved
      ? successMessage
      : payload.error ?? "Imported league settings, but could not save them.";
  } catch {
    els.leagueImportMessage.textContent = "Imported league settings, but could not save them.";
  }
}

async function loadSimulationReports() {
  try {
    const response = await fetch("/data/simulations/index.json", { cache: "no-store" });
    if (!response.ok) {
      reportIndex = [];
      selectedReport = null;
      return;
    }
    const payload = await response.json();
    reportIndex = Array.isArray(payload.reports) ? payload.reports : [];
    if (!selectedReport && reportIndex[0]) {
      await loadSimulationReport(reportIndex[0].file);
    }
  } catch {
    reportIndex = [];
    selectedReport = null;
  }
}

async function runStrategyBatch() {
  els.runSimulations.disabled = true;
  els.simulationRunMessage.textContent = "Running strategy batch...";

  try {
    const response = await fetch("/api/simulations/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerPool: playerPoolMode,
        useSavedLeague: els.simUseSavedLeague.checked,
        scenario: readScenarioControls(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Simulation batch failed.");

    const winner = payload.winner?.strategy?.label ?? payload.winner?.strategy?.id ?? "Unknown";
    latestBatch = payload;
    els.simulationRunMessage.textContent = `Saved ${payload.reports.length} simulations. Best starter projection: ${winner}.`;
    selectedReport = null;
    await loadSimulationReports();
    renderSimulationComparison();
    renderReports();
  } catch (error) {
    els.simulationRunMessage.textContent = error.message;
  } finally {
    els.runSimulations.disabled = false;
  }
}

function readScenarioControls() {
  return {
    teams: Number(els.simTeams.value),
    draftSlot: Number(els.simDraftSlot.value),
    rounds: Number(els.simRounds.value),
    ppr: Number(els.simPpr.value),
    opponentProfileId: els.simOpponentProfile.value,
  };
}

function syncScenarioControlsToLeague() {
  els.simTeams.value = activeLeague.teams;
  els.simDraftSlot.max = activeLeague.teams;
  els.simDraftSlot.value = Math.min(activeLeague.draft.userDraftSlot ?? 1, activeLeague.teams);
  els.simRounds.value = activeLeague.draft.rounds;
  els.simPpr.value = String(activeLeague.scoring.reception ?? 0.5);
}

async function loadSimulationReport(file) {
  try {
    const response = await fetch(`/data/simulations/${file}`, { cache: "no-store" });
    selectedReport = response.ok ? await response.json() : null;
  } catch {
    selectedReport = null;
  }
}

async function loadYahooStatus() {
  try {
    const response = await fetch("/api/yahoo/status", { cache: "no-store" });
    const payload = await response.json();
    els.yahooStatusChip.textContent = payload.token?.connected
      ? "Yahoo connected"
      : payload.configured
        ? "Yahoo configured"
        : "Yahoo config needed";
    els.yahooMessage.textContent = buildYahooStatusMessage(payload);
    els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    els.yahooStatusChip.textContent = "Yahoo unavailable";
    els.yahooMessage.textContent = error.message;
  }
}

async function loadYahooReadiness({ showOutput = false } = {}) {
  try {
    const params = new URLSearchParams({
      playerPool: playerPoolMode,
      draftSyncStatus: latestSyncStatus.status,
    });
    const selectedLeague = selectedYahooLeagueOption();
    if (selectedLeague?.leagueKey) params.set("leagueKey", selectedLeague.leagueKey);
    if (selectedLeague?.primaryTeam?.teamKey) params.set("teamKey", selectedLeague.primaryTeam.teamKey);

    const response = await fetch(`/api/yahoo/readiness?${params.toString()}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not load Yahoo readiness.");
    latestYahooReadiness = payload;
    renderYahooReadiness();
    if (showOutput) {
      els.yahooMessage.textContent = payload.readiness.readyForLiveDraft
        ? "Yahoo live draft readiness is clear."
        : `Yahoo live draft has ${payload.readiness.blockers.length} blocker${payload.readiness.blockers.length === 1 ? "" : "s"}.`;
      els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
    }
  } catch (error) {
    latestYahooReadiness = {
      checkedAt: new Date().toISOString(),
      readiness: {
        readyForLiveDraft: false,
        status: "blocked",
        checks: [],
        blockers: ["readiness_unavailable"],
        nextActions: [error.message],
      },
    };
    renderYahooReadiness();
    if (showOutput) els.yahooMessage.textContent = error.message;
  }
}

function renderYahooReadiness() {
  if (!latestYahooReadiness?.readiness) {
    els.yahooReadinessSummary.innerHTML = `<div><strong>Live readiness</strong><span class="meta">Not checked yet</span></div>`;
    els.yahooReadinessChecks.innerHTML = "";
    els.yahooReadinessActions.innerHTML = "";
    return;
  }

  const readiness = latestYahooReadiness.readiness;
  const blockerCount = readiness.blockers?.length ?? 0;
  const checkedAt = latestYahooReadiness.checkedAt ? formatDate(latestYahooReadiness.checkedAt) : "Unknown date";
  els.yahooReadinessSummary.className = `readiness-summary readiness-${readiness.status}`;
  els.yahooReadinessSummary.innerHTML = `
    <div>
      <strong>${readiness.readyForLiveDraft ? "Ready for live draft" : "Live draft blocked"}</strong>
      <span class="meta">${blockerCount} blocker${blockerCount === 1 ? "" : "s"} / checked ${checkedAt}</span>
    </div>
    <div>
      <strong>${latestYahooReadiness.playerAudit?.yahooMappedCount ?? 0}/${latestYahooReadiness.playerAudit?.playerCount ?? 0}</strong>
      <span class="meta">Yahoo player mappings</span>
    </div>
    <div>
      <strong>${formatSyncStatus(latestYahooReadiness.draftResults?.syncStatus ?? latestSyncStatus.status)}</strong>
      <span class="meta">Draft results</span>
    </div>
  `;
  els.yahooReadinessChecks.innerHTML = (readiness.checks ?? []).map((item) => `
    <article class="readiness-check ${item.ready ? "ready" : "blocked"}">
      <div>
        <strong>${formatReadinessCheck(item.id)}</strong>
        <span>${item.ready ? "Ready" : "Blocked"}</span>
      </div>
      <p class="meta">${escapeHtml(item.message)}</p>
    </article>
  `).join("");

  const nextActions = [...new Set((readiness.nextActions ?? []).filter(Boolean))];
  els.yahooReadinessActions.innerHTML = nextActions.length > 0
    ? `
      <div class="readiness-next-actions">
        <strong>Next actions</strong>
        <ul>${nextActions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul>
      </div>
    `
    : `<div class="meta readiness-next-actions">No Yahoo readiness blockers.</div>`;
}

async function connectYahoo() {
  try {
    const response = await fetch("/api/yahoo/auth-url", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      els.yahooMessage.textContent = payload.error ?? "Could not build Yahoo authorization URL.";
      els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
      return;
    }
    window.open(payload.authUrl, "_blank", "noopener,noreferrer");
    els.yahooMessage.textContent = "Opened Yahoo authorization in a new tab. Refresh status after completing the login.";
    els.yahooOutput.textContent = JSON.stringify({
      scope: payload.scope,
      state: payload.state,
    }, null, 2);
  } catch (error) {
    els.yahooMessage.textContent = error.message;
  }
}

async function loadYahooReadEndpoint(endpoint, label) {
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();
    els.yahooMessage.textContent = response.ok
      ? `Loaded ${label}.`
      : payload.error ?? `Could not load ${label}.`;
    els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
    if (response.ok) {
      await loadYahooStatus();
      await loadYahooReadiness();
    }
  } catch (error) {
    els.yahooMessage.textContent = error.message;
  }
}

async function discoverYahooLeagues() {
  try {
    const response = await fetch("/api/yahoo/league-options", { cache: "no-store" });
    const payload = await response.json();
    yahooLeagueOptions = Array.isArray(payload.leagues) ? payload.leagues : [];
    els.yahooMessage.textContent = response.ok
      ? `Discovered ${yahooLeagueOptions.length} Yahoo league option${yahooLeagueOptions.length === 1 ? "" : "s"}.`
      : payload.error ?? "Could not discover Yahoo leagues.";
    els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
    renderYahooLeagueOptions();
    if (response.ok) {
      await loadYahooStatus();
      await loadYahooReadiness();
    }
  } catch (error) {
    els.yahooMessage.textContent = error.message;
  }
}

async function importSelectedYahooLeagueSettings() {
  const leagueKey = els.yahooLeagueSelect.value;
  if (!leagueKey) {
    els.yahooMessage.textContent = "Discover Yahoo leagues, then select one to import.";
    return;
  }

  try {
    const selectedLeague = selectedYahooLeagueOption();
    const response = await fetch(`/api/yahoo/league-settings?leagueKey=${encodeURIComponent(leagueKey)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      els.yahooMessage.textContent = payload.error ?? "Could not load selected Yahoo league settings.";
      els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
      return;
    }

    activeLeague = buildLeagueFromYahooSettings(mockLeague, payload, {
      leagueKey,
      leagueId: selectedLeague?.leagueId,
      name: selectedLeague?.leagueName,
      season: selectedLeague?.season,
      selectedTeamKey: selectedLeague?.primaryTeam?.teamKey,
      selectedTeamName: selectedLeague?.primaryTeam?.name,
      selectedLeagueLabel: selectedLeague?.label,
      selectedLeague,
    });
    els.leagueSettingsJson.value = JSON.stringify(payload, null, 2);
    switchToDraftSession(activeLeague, selectedLeague);
    await saveActiveYahooLeagueProfile(payload, `Imported and saved ${activeLeague.name}.`, {
      leagueKey,
      leagueId: selectedLeague?.leagueId,
      name: selectedLeague?.leagueName,
      season: selectedLeague?.season,
      selectedTeamKey: selectedLeague?.primaryTeam?.teamKey,
      selectedTeamName: selectedLeague?.primaryTeam?.name,
      selectedLeagueLabel: selectedLeague?.label,
      teams: selectedLeague?.teams ?? [],
    });
    const teamMessage = selectedLeague?.primaryTeam?.name ? ` for ${selectedLeague.primaryTeam.name}` : "";
    els.yahooMessage.textContent = `Imported read-only settings for ${activeLeague.name}${teamMessage}.`;
    els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
    await loadYahooReadiness();
    render();
  } catch (error) {
    els.yahooMessage.textContent = error.message;
  }
}

async function loadSelectedYahooDraftResults() {
  return syncSelectedYahooDraftResults({ quiet: false });
}

async function syncSelectedYahooDraftResults({ quiet = false } = {}) {
  const leagueKey = els.yahooLeagueSelect.value;
  if (!leagueKey) {
    els.yahooMessage.textContent = "Discover Yahoo leagues, then select one before loading draft results.";
    updateYahooDraftSyncStatus({
      status: "manual_required",
      message: "No Yahoo league selected for draft-results sync.",
    });
    return;
  }

  try {
    const response = await fetch(`/api/yahoo/draft-results?leagueKey=${encodeURIComponent(leagueKey)}&playerPool=${encodeURIComponent(playerPoolMode)}`, { cache: "no-store" });
    const payload = await response.json();
    let syncSummary = null;
    if (response.ok) {
      syncSummary = applyYahooDraftEventsToState(state, payload.picks ?? []);
      recordSyncEventsFromSummary(syncSummary, {
        sourceLabel: "Yahoo",
        leagueKey,
      });
      captureManualSyncIssue(syncSummary);
      updateYahooDraftSyncStatus({
        status: syncSummary.manualRequired.length > 0 ? "manual_required" : "synced",
        highestPick: Math.max(latestSyncStatus.highestPick ?? 0, payload.summary?.pickCount ?? 0, state.currentPick - 1),
        message: buildYahooDraftResultsMessage(payload, syncSummary),
        leagueKey,
      });
    } else {
      updateYahooDraftSyncStatus({
        status: "unavailable",
        message: payload.error ?? "Could not load Yahoo draft results.",
        leagueKey,
      });
    }
    els.yahooMessage.textContent = response.ok
      ? latestSyncStatus.message
      : payload.error ?? "Could not load Yahoo draft results.";
    if (!quiet || !response.ok) {
      els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
    }
    if (response.ok) {
      syncScenarioControlsToLeague();
      render();
      await loadYahooStatus();
      await loadYahooReadiness();
    }
  } catch (error) {
    els.yahooMessage.textContent = error.message;
    updateYahooDraftSyncStatus({
      status: "unavailable",
      message: error.message,
      leagueKey,
    });
    renderYahooDraftSyncStatus();
  }
}

async function loadSelectedYahooRosters() {
  const leagueKey = els.yahooLeagueSelect.value;
  if (!leagueKey) {
    els.yahooMessage.textContent = "Discover Yahoo leagues, then select one before loading rosters.";
    return;
  }

  try {
    const response = await fetch(`/api/yahoo/league-rosters?leagueKey=${encodeURIComponent(leagueKey)}&playerPool=${encodeURIComponent(playerPoolMode)}`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      yahooRosterSnapshots = payload.teams ?? [];
      updateYahooDraftSyncStatus({
        status: payload.syncStatus ?? "synced",
        message: `Loaded ${payload.teamCount} Yahoo rosters with ${payload.unmatchedPlayerCount} players requiring mapping.`,
        leagueKey,
      });
      saveActiveDraftSession();
      render();
      await loadYahooStatus();
      await loadYahooReadiness();
    }

    els.yahooMessage.textContent = response.ok
      ? latestSyncStatus.message
      : payload.error ?? "Could not load Yahoo rosters.";
    els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    els.yahooMessage.textContent = error.message;
    updateYahooDraftSyncStatus({
      status: "unavailable",
      message: error.message,
      leagueKey,
    });
    renderYahooDraftSyncStatus();
  }
}

function buildYahooDraftResultsMessage(payload, syncSummary) {
  const pickCount = payload.summary?.pickCount ?? 0;
  const unmatchedCount = payload.summary?.unmappedPlayerCount ?? 0;
  const loaded = `Loaded ${pickCount} Yahoo draft result pick${pickCount === 1 ? "" : "s"}`;
  const applied = `applied ${syncSummary.applied} to the board`;
  if (syncSummary.manualRequired.length > 0) {
    const manual = syncSummary.manualRequired[0];
    return `${loaded}; ${applied}; manual correction needed at pick ${manual.pickNumber} (${manual.manualReason}).`;
  }
  return `${loaded}; ${applied}; ${unmatchedCount} unmatched in the source payload.`;
}

function renderYahooLeagueOptions() {
  els.yahooLeagueSelect.innerHTML = yahooLeagueOptions.length === 0
    ? `<option value="">No Yahoo leagues discovered</option>`
    : yahooLeagueOptions.map((league) => `
      <option value="${league.leagueKey}">
        ${escapeHtml(league.label)} - ${league.leagueKey}
      </option>
    `).join("");
  els.importYahooLeague.disabled = yahooLeagueOptions.length === 0;
  els.loadYahooDraftResults.disabled = yahooLeagueOptions.length === 0;
  els.loadYahooRosters.disabled = yahooLeagueOptions.length === 0;
  els.startYahooDraftPolling.disabled = yahooLeagueOptions.length === 0 || Boolean(yahooDraftPollingTimer);
  els.stopYahooDraftPolling.disabled = !yahooDraftPollingTimer;
}

function selectedYahooLeagueOption() {
  const leagueKey = els.yahooLeagueSelect.value;
  return yahooLeagueOptions.find((league) => league.leagueKey === leagueKey) ?? null;
}

async function startYahooDraftPolling() {
  if (yahooDraftPollingTimer) return;
  await syncSelectedYahooDraftResults({ quiet: false });
  yahooDraftPollingTimer = window.setInterval(() => {
    syncSelectedYahooDraftResults({ quiet: true });
  }, 15_000);
  updateYahooDraftSyncStatus({
    status: latestSyncStatus.status === "unavailable" ? "stale" : latestSyncStatus.status,
    message: `${latestSyncStatus.message} Polling every 15 seconds.`,
    pollActive: true,
  });
  renderYahooLeagueOptions();
  renderYahooDraftSyncStatus();
}

function stopYahooDraftPolling(message = null) {
  if (yahooDraftPollingTimer) {
    window.clearInterval(yahooDraftPollingTimer);
    yahooDraftPollingTimer = null;
  }
  updateYahooDraftSyncStatus({
    status: latestSyncStatus.status,
    message: message ?? latestSyncStatus.message,
    pollActive: false,
  });
  renderYahooLeagueOptions();
  renderYahooDraftSyncStatus();
}

function updateYahooDraftSyncStatus(patch) {
  latestSyncStatus = {
    ...latestSyncStatus,
    ...patch,
    updatedAt: new Date().toISOString(),
    pollActive: patch.pollActive ?? Boolean(yahooDraftPollingTimer),
  };
}

function renderYahooDraftSyncStatus() {
  els.yahooDraftSyncStatus.className = `sync-status sync-${latestSyncStatus.status}`;
  els.yahooDraftSyncStatus.innerHTML = `
    <span><strong>Draft sync:</strong> ${formatSyncStatus(latestSyncStatus.status)}</span>
    <span>Highest pick: <strong>${latestSyncStatus.highestPick ?? 0}</strong></span>
    <span>${latestSyncStatus.pollActive ? "Polling active" : "Manual refresh"}</span>
    <span>${latestSyncStatus.updatedAt ? `Updated ${formatDate(latestSyncStatus.updatedAt)}` : "Not synced"}</span>
  `;
}

function formatSyncStatus(status) {
  return {
    synced: "Synced",
    stale: "Stale",
    unavailable: "Unavailable",
    manual_required: "Manual correction needed",
    mock: "Mock mode",
  }[status] ?? status;
}

function formatManualReason(reason) {
  return {
    missing_pick_number: "The synced event is missing a pick number.",
    non_sequential_pick: "The synced event is not the next board pick.",
    unmatched_yahoo_player: "Yahoo player is not mapped to the local player pool.",
    unmatched_yahoo_team: "Yahoo team is not mapped to this league.",
    player_not_in_active_pool: "Mapped player is not in the active draft pool.",
    team_not_in_active_league: "Mapped team is not in the active league.",
    manual_pick_conflict: "Yahoo and the local board disagree on this pick.",
  }[reason] ?? reason ?? "Manual review required.";
}

function formatReadinessCheck(id) {
  return {
    oauth_config: "OAuth config",
    token_connected: "Yahoo connection",
    refresh_token: "Refresh token",
    league_selected: "League selected",
    team_selected: "Team selected",
    draft_results_sync: "Draft results sync",
    player_mapping: "Player mapping",
    read_only_guardrail: "Read-only guardrail",
  }[id] ?? formatPreference(id);
}

function normalizeTeamId(teamId) {
  const value = String(teamId ?? "");
  return value.startsWith("team_") ? value : `team_${value}`;
}

function buildYahooStatusMessage(payload) {
  if (!payload.configured) {
    return "Set YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, and YAHOO_REDIRECT_URI in .env before connecting.";
  }
  if (payload.token?.connected) {
    return payload.token.expiresAt
      ? `Read-only Yahoo token saved. Expires ${formatDate(payload.token.expiresAt)}.`
      : "Read-only Yahoo token saved.";
  }
  return "Yahoo app config found. Connect Yahoo to save a local read-only token.";
}

async function loadGeneratedPlayerPool() {
  try {
    const response = await fetch("/data/mock/current_player_pool.json", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.players) || payload.players.length === 0) return;
    playerPool = payload.players;
    resetDraftState();
  } catch {
    playerPoolMode = "static";
    playerPool = mockPlayers;
  }
}

function getLeagueCapacityWarnings(league) {
  const requestedPicks = league.teams * league.draft.rounds;
  if (requestedPicks <= playerPool.length) return [];
  return [
    `This rule set requests ${requestedPicks} picks, but the current ${playerPoolMode} player pool has ${playerPool.length} players. Use generated mode for fuller simulations.`,
  ];
}

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStrategy(strategy) {
  if (!strategy) return "Balanced";
  return strategy.label ?? strategy.id ?? "Balanced";
}

function formatPpr(value) {
  if (Number(value) === 1) return "Full PPR";
  if (Number(value) === 0) return "Standard";
  return "Half PPR";
}

function formatOpponentProfile(value) {
  return {
    agent: "Agent-like",
    adp: "ADP Room",
    rb_heavy: "RB Heavy",
    wr_heavy: "WR Heavy",
    qb_early: "QB Early",
  }[value] ?? value ?? "Agent-like";
}

function formatPreference(value) {
  return String(value ?? "balanced")
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function splitCsvInput(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
