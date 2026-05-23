import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadYahooLeagueSettingsProfile,
  saveYahooLeagueSettingsProfile,
} from "../src/league/leagueProfileStore.mjs";

const tempDir = await mkdtemp(path.join(os.tmpdir(), "ffa-league-profile-"));
const profilePath = path.join(tempDir, "active_yahoo_settings.json");

try {
  const empty = await loadYahooLeagueSettingsProfile(profilePath);
  assert.equal(empty.exists, false);

  const yahooSettings = {
    league: {
      leagueId: "12345",
      leagueKey: "461.l.12345",
      name: "Saved League",
    },
  };

  const selectedLeague = {
    leagueKey: "461.l.12345",
    selectedTeamKey: "461.l.12345.t.4",
    selectedTeamName: "Matt's Team",
  };

  const saved = await saveYahooLeagueSettingsProfile(yahooSettings, profilePath, selectedLeague);
  assert.equal(saved.yahooSettings.league.name, "Saved League");
  assert.equal(saved.selectedLeague.selectedTeamName, "Matt's Team");
  assert.match(saved.savedAt, /^\d{4}-\d{2}-\d{2}T/);

  const loaded = await loadYahooLeagueSettingsProfile(profilePath);
  assert.equal(loaded.exists, true);
  assert.deepEqual(loaded.yahooSettings, yahooSettings);
  assert.deepEqual(loaded.selectedLeague, selectedLeague);
  assert.equal(loaded.savedAt, saved.savedAt);

  assert.rejects(
    () => saveYahooLeagueSettingsProfile(null, profilePath),
    /requires a Yahoo settings object/,
  );

  console.log(JSON.stringify({
    status: "passed",
    tested: ["empty profile", "save profile", "load profile", "selected league metadata", "invalid profile guard"],
  }, null, 2));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
