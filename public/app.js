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

const els = {
  status: document.querySelector("#pick-status"),
  leagueSourceChip: document.querySelector("#league-source-chip"),
  leagueSummary: document.querySelector("#league-summary"),
  leagueChip: document.querySelector("#league-chip"),
  log: document.querySelector("#draft-log"),
  recommendations: document.querySelector("#recommendations"),
  roster: document.querySelector("#roster"),
  available: document.querySelector("#available"),
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
  yahooStatusChip: document.querySelector("#yahoo-status-chip"),
  yahooMessage: document.querySelector("#yahoo-message"),
  yahooOutput: document.querySelector("#yahoo-output"),
  connectYahoo: document.querySelector("#connect-yahoo-btn"),
  refreshYahooStatus: document.querySelector("#refresh-yahoo-status-btn"),
  loadYahooGames: document.querySelector("#load-yahoo-games-btn"),
  loadYahooTeams: document.querySelector("#load-yahoo-teams-btn"),
  discoverYahooLeagues: document.querySelector("#discover-yahoo-leagues-btn"),
  loadYahooDraftResults: document.querySelector("#load-yahoo-draft-results-btn"),
  yahooLeagueSelect: document.querySelector("#yahoo-league-select"),
  importYahooLeague: document.querySelector("#import-yahoo-league-btn"),
};

els.advance.addEventListener("click", () => {
  if (recommendationsPaused) return;
  runMockUntilUserTurn(state);
  render();
});

els.accept.addEventListener("click", () => {
  const [top] = recommendPlayers(state, activeLeague.userTeamId, 1);
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

els.importYahooLeague.addEventListener("click", async () => {
  await importSelectedYahooLeagueSettings();
});

if (playerPoolMode === "generated") {
  await loadGeneratedPlayerPool();
}
await loadSavedYahooLeagueProfile();
await loadYahooStatus();
await loadSimulationReports();
syncScenarioControlsToLeague();

function render() {
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
  renderYahooLeagueOptions();
  renderManualOptions();
  renderLog();
  renderLeagueSummary();
  renderRecommendations();
  renderRoster();
  renderAvailable();
  renderReview();
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

  const recommendations = recommendPlayers(state, activeLeague.userTeamId, 5);
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
        <div>Source confidence: <strong>${Math.round(option.sourceConfidence * 100)}%</strong></div>
      </div>
      ${option.sourceWarning ? `<p class="source-warning">${option.sourceWarning}</p>` : ""}
      <strong>Pros</strong>
      <ul>${option.pros.map((item) => `<li>${item}</li>`).join("")}</ul>
      <strong>Cons</strong>
      <ul>${option.cons.map((item) => `<li>${item}</li>`).join("")}</ul>
    </article>
  `).join("");
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
    </div>
    <div class="slot-list">
      ${Object.entries(summary.rosterSlots).map(([slot, count]) => `
        <span>${slot}: <strong>${count}</strong></span>
      `).join("")}
    </div>
    ${warnings.length > 0 ? renderTextSection("Import Warnings", warnings) : ""}
  `;
}

function buildTeamsForLeague(league) {
  return Array.from({ length: league.teams }, (_, index) => ({
    teamId: `team_${index + 1}`,
    name: index + 1 === league.draft.userDraftSlot ? "My Team" : `Opponent ${index + 1}`,
    draftSlot: index + 1,
    picks: [],
  }));
}

function resetDraftState() {
  activeTeams = buildTeamsForLeague(activeLeague);
  state = createDraftState(activeLeague, activeTeams, playerPool);
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
    activeLeague = buildLeagueFromYahooSettings(mockLeague, profile.yahooSettings, profile.selectedLeague ?? {});
    els.leagueSettingsJson.value = JSON.stringify(profile.yahooSettings, null, 2);
    els.leagueImportMessage.textContent = profile.savedAt
      ? `Loaded saved Yahoo settings from ${formatDate(profile.savedAt)}.`
      : "Loaded saved Yahoo settings.";
    resetDraftState();
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
    if (response.ok) await loadYahooStatus();
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
    if (response.ok) await loadYahooStatus();
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
    const selectedLeague = yahooLeagueOptions.find((league) => league.leagueKey === leagueKey);
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
    });
    els.leagueSettingsJson.value = JSON.stringify(payload, null, 2);
    resetDraftState();
    await saveActiveYahooLeagueProfile(payload, `Imported and saved ${activeLeague.name}.`, {
      leagueKey,
      leagueId: selectedLeague?.leagueId,
      name: selectedLeague?.leagueName,
      season: selectedLeague?.season,
      selectedTeamKey: selectedLeague?.primaryTeam?.teamKey,
      selectedTeamName: selectedLeague?.primaryTeam?.name,
      selectedLeagueLabel: selectedLeague?.label,
    });
    const teamMessage = selectedLeague?.primaryTeam?.name ? ` for ${selectedLeague.primaryTeam.name}` : "";
    els.yahooMessage.textContent = `Imported read-only settings for ${activeLeague.name}${teamMessage}.`;
    els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
    render();
  } catch (error) {
    els.yahooMessage.textContent = error.message;
  }
}

async function loadSelectedYahooDraftResults() {
  const leagueKey = els.yahooLeagueSelect.value;
  if (!leagueKey) {
    els.yahooMessage.textContent = "Discover Yahoo leagues, then select one before loading draft results.";
    return;
  }

  try {
    const response = await fetch(`/api/yahoo/draft-results?leagueKey=${encodeURIComponent(leagueKey)}&playerPool=${encodeURIComponent(playerPoolMode)}`, { cache: "no-store" });
    const payload = await response.json();
    els.yahooMessage.textContent = response.ok
      ? buildYahooDraftResultsMessage(payload, applyYahooDraftEventsToState(state, payload.picks ?? []))
      : payload.error ?? "Could not load Yahoo draft results.";
    els.yahooOutput.textContent = JSON.stringify(payload, null, 2);
    if (response.ok) {
      syncScenarioControlsToLeague();
      render();
      await loadYahooStatus();
    }
  } catch (error) {
    els.yahooMessage.textContent = error.message;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
