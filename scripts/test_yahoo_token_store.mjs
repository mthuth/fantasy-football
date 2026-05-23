import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadYahooTokens,
  normalizeYahooTokenSet,
  saveYahooTokens,
} from "../src/connectors/yahoo/YahooTokenStore.mjs";

const tempDir = await mkdtemp(path.join(os.tmpdir(), "ffa-yahoo-token-"));
const tokenPath = path.join(tempDir, "yahoo_tokens.json");

try {
  const missing = await loadYahooTokens(tokenPath);
  assert.equal(missing.exists, false);

  const normalized = normalizeYahooTokenSet({
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    issued_at: "2026-05-23T10:00:00.000Z",
    scope: "fspt-r",
  });
  assert.equal(normalized.expires_at, "2026-05-23T11:00:00.000Z");

  const saved = await saveYahooTokens(normalized, tokenPath);
  assert.equal(saved.summary.connected, true);
  assert.equal(saved.summary.hasRefreshToken, true);

  const loaded = await loadYahooTokens(tokenPath);
  assert.equal(loaded.exists, true);
  assert.deepEqual(loaded.tokenSet, normalized);

  assert.throws(
    () => normalizeYahooTokenSet({ refresh_token: "refresh-token" }),
    /missing access_token/,
  );

  console.log(JSON.stringify({
    status: "passed",
    tested: ["missing token file", "normalize token set", "save token set", "load token set"],
  }, null, 2));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
