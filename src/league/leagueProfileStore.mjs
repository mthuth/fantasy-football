import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const defaultProfilePath = path.resolve("data/leagues/active_yahoo_settings.json");

export async function loadYahooLeagueSettingsProfile(profilePath = defaultProfilePath) {
  try {
    const payload = JSON.parse(await readFile(profilePath, "utf8"));
    if (!payload.yahooSettings) {
      return { exists: false, yahooSettings: null };
    }
    return {
      exists: true,
      yahooSettings: payload.yahooSettings,
      selectedLeague: payload.selectedLeague ?? null,
      savedAt: payload.savedAt ?? null,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { exists: false, yahooSettings: null };
    }
    throw error;
  }
}

export async function saveYahooLeagueSettingsProfile(yahooSettings, profilePath = defaultProfilePath, selectedLeague = null) {
  if (!yahooSettings || typeof yahooSettings !== "object" || Array.isArray(yahooSettings)) {
    throw new Error("League profile requires a Yahoo settings object.");
  }

  const payload = {
    savedAt: new Date().toISOString(),
    yahooSettings,
    selectedLeague,
  };

  await mkdir(path.dirname(profilePath), { recursive: true });
  await writeFile(profilePath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}
