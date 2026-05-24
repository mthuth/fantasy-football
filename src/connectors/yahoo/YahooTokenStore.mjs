import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const defaultTokenPath = path.resolve("data/auth/yahoo_tokens.json");

export async function loadYahooTokens(tokenPath = defaultTokenPath) {
  try {
    const tokenSet = JSON.parse(await readFile(tokenPath, "utf8"));
    return {
      exists: true,
      tokenSet,
      summary: summarizeYahooTokens(tokenSet),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { exists: false, tokenSet: null, summary: null };
    }
    throw error;
  }
}

export async function saveYahooTokens(tokenSet, tokenPath = defaultTokenPath) {
  const normalized = normalizeYahooTokenSet(tokenSet);
  await mkdir(path.dirname(tokenPath), { recursive: true });
  await writeFile(tokenPath, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  return {
    tokenSet: normalized,
    summary: summarizeYahooTokens(normalized),
  };
}

export function normalizeYahooTokenSet(tokenSet) {
  if (!tokenSet || typeof tokenSet !== "object" || Array.isArray(tokenSet)) {
    throw new Error("Yahoo token payload must be an object.");
  }
  if (!tokenSet.access_token) {
    throw new Error("Yahoo token payload is missing access_token.");
  }

  const issuedAt = tokenSet.issued_at ?? new Date().toISOString();
  const expiresIn = Number(tokenSet.expires_in ?? 0);
  const expiresAt = tokenSet.expires_at ?? (expiresIn > 0
    ? new Date(new Date(issuedAt).getTime() + expiresIn * 1000).toISOString()
    : null);

  return {
    access_token: tokenSet.access_token,
    refresh_token: tokenSet.refresh_token ?? null,
    token_type: tokenSet.token_type ?? "bearer",
    expires_in: expiresIn || null,
    expires_at: expiresAt,
    issued_at: issuedAt,
    scope: tokenSet.scope ?? null,
  };
}

export function summarizeYahooTokens(tokenSet) {
  if (!tokenSet) return null;
  return {
    connected: Boolean(tokenSet.access_token),
    hasRefreshToken: Boolean(tokenSet.refresh_token),
    expiresAt: tokenSet.expires_at ?? null,
    scope: tokenSet.scope ?? null,
  };
}
