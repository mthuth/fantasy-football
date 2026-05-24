import { readFile } from "node:fs/promises";

export async function loadLocalEnv(envPath = ".env") {
  let contents;
  try {
    contents = await readFile(envPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { loaded: false, path: envPath };
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = unquoteEnvValue(rawValue);
  }

  return { loaded: true, path: envPath };
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
