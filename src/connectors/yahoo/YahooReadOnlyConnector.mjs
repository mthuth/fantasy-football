const DEFAULT_FANTASY_BASE_URL = "https://fantasysports.yahooapis.com/fantasy/v2";
const DEFAULT_AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const DEFAULT_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

export const YAHOO_READ_ONLY_CAPABILITIES = Object.freeze({
  readLeagueSettings: true,
  readRosters: true,
  readMatchups: true,
  readPlayers: true,
  readTransactions: true,
  readDraftResults: true,
  setLineup: false,
  addPlayer: false,
  dropPlayer: false,
  submitWaiverClaim: false,
  proposeTrade: false,
  acceptTrade: false,
  draftPick: false,
});

export class YahooReadOnlyConnector {
  constructor(options = {}) {
    this.clientId = options.clientId ?? process.env.YAHOO_CLIENT_ID ?? null;
    this.clientSecret = options.clientSecret ?? process.env.YAHOO_CLIENT_SECRET ?? null;
    this.redirectUri = options.redirectUri ?? process.env.YAHOO_REDIRECT_URI ?? null;
    this.accessToken = options.accessToken ?? process.env.YAHOO_ACCESS_TOKEN ?? null;
    this.refreshToken = options.refreshToken ?? process.env.YAHOO_REFRESH_TOKEN ?? null;
    this.fantasyBaseUrl = options.fantasyBaseUrl ?? DEFAULT_FANTASY_BASE_URL;
    this.authUrl = options.authUrl ?? DEFAULT_AUTH_URL;
    this.tokenUrl = options.tokenUrl ?? DEFAULT_TOKEN_URL;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  get capabilities() {
    return YAHOO_READ_ONLY_CAPABILITIES;
  }

  buildAuthorizationUrl({ state, scope = "fspt-r" } = {}) {
    this.#assertOAuthConfig();
    const url = new URL(this.authUrl);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("language", "en-us");
    url.searchParams.set("scope", scope);
    if (state) url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeAuthorizationCode(code) {
    this.#assertOAuthConfig();
    this.#assertFetch();
    if (!code) throw new Error("Yahoo authorization code is required");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: this.redirectUri,
      code,
    });

    const response = await this.fetchImpl(this.tokenUrl, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });

    return this.#readJsonResponse(response, "Yahoo token exchange failed");
  }

  async refreshAccessToken(refreshToken = this.refreshToken) {
    this.#assertOAuthConfig();
    this.#assertFetch();
    if (!refreshToken) throw new Error("Yahoo refresh token is required");

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      redirect_uri: this.redirectUri,
      refresh_token: refreshToken,
    });

    const response = await this.fetchImpl(this.tokenUrl, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });

    return this.#readJsonResponse(response, "Yahoo token refresh failed");
  }

  async readUserGames() {
    return this.#get("users;use_login=1/games;game_codes=nfl");
  }

  async readUserTeams() {
    return this.#get("users;use_login=1/games;game_keys=nfl/teams");
  }

  async readLeagueSettings(leagueKey) {
    return this.#get(`league/${encodeURIComponent(leagueKey)}/settings`);
  }

  async readLeagueTeams(leagueKey) {
    return this.#get(`league/${encodeURIComponent(leagueKey)}/teams`);
  }

  async readLeaguePlayers(leagueKey) {
    return this.#get(`league/${encodeURIComponent(leagueKey)}/players`);
  }

  async readLeagueDraftResults(leagueKey) {
    return this.#get(`league/${encodeURIComponent(leagueKey)}/draftresults`);
  }

  async readTeamRoster(teamKey) {
    return this.#get(`team/${encodeURIComponent(teamKey)}/roster`);
  }

  async readTransactions(leagueKey) {
    return this.#get(`league/${encodeURIComponent(leagueKey)}/transactions`);
  }

  async setLineup() {
    throwReadOnlyError("setLineup");
  }

  async addPlayer() {
    throwReadOnlyError("addPlayer");
  }

  async dropPlayer() {
    throwReadOnlyError("dropPlayer");
  }

  async submitWaiverClaim() {
    throwReadOnlyError("submitWaiverClaim");
  }

  async proposeTrade() {
    throwReadOnlyError("proposeTrade");
  }

  async acceptTrade() {
    throwReadOnlyError("acceptTrade");
  }

  async draftPick() {
    throwReadOnlyError("draftPick");
  }

  buildFantasyUrl(path) {
    const cleanPath = String(path).replace(/^\/+/, "");
    const url = new URL(`${this.fantasyBaseUrl}/${cleanPath}`);
    url.searchParams.set("format", "json");
    return url.toString();
  }

  async #get(path) {
    this.#assertAccessToken();
    this.#assertFetch();

    const response = await this.fetchImpl(this.buildFantasyUrl(path), {
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        accept: "application/json",
      },
    });

    return this.#readJsonResponse(response, `Yahoo read failed for ${path}`);
  }

  async #readJsonResponse(response, message) {
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`${message}: HTTP ${response.status} ${response.statusText}${body ? ` - ${body.slice(0, 300)}` : ""}`);
    }
    return response.json();
  }

  #assertOAuthConfig() {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error("Yahoo OAuth config requires YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, and YAHOO_REDIRECT_URI");
    }
  }

  #assertAccessToken() {
    if (!this.accessToken) {
      throw new Error("Yahoo read operation requires YAHOO_ACCESS_TOKEN or an injected accessToken");
    }
  }

  #assertFetch() {
    if (!this.fetchImpl) {
      throw new Error("Yahoo connector requires a fetch implementation");
    }
  }
}

function throwReadOnlyError(action) {
  throw new Error(`YahooReadOnlyConnector blocks write action: ${action}`);
}
