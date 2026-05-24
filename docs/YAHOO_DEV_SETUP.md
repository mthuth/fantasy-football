# Yahoo Development Setup

This project treats Yahoo as a read-only integration until draft, waiver, lineup, and trade write paths are deliberately designed behind approval and dry-run controls.

## Create Yahoo App Credentials

1. Create a Yahoo developer app.
2. Enable Yahoo Fantasy Sports API access.
3. Set the local callback URL to:

```text
http://127.0.0.1:3001/oauth/yahoo/callback
```

4. Copy `.env.example` to `.env`.
5. Fill in:

```text
YAHOO_CLIENT_ID=
YAHOO_CLIENT_SECRET=
YAHOO_REDIRECT_URI=http://127.0.0.1:3001/oauth/yahoo/callback
```

## Connect Locally

1. Run:

```text
npm start
```

2. Open the local dashboard.
3. Use `Connect Yahoo` in the Yahoo Development panel.
4. Complete the Yahoo authorization in the opened browser tab.
5. Return to the dashboard and use `Refresh Status`.

The local server saves Yahoo OAuth tokens to:

```text
data/auth/yahoo_tokens.json
```

That folder is ignored by git.

## Live Draft Readiness Check

Run this before a Yahoo-connected draft rehearsal:

```text
npm run yahoo:readiness
```

The check is read-only. It verifies local OAuth configuration, saved token shape,
selected league/team metadata, Yahoo player mapping coverage, and whether draft
results sync has been proven for the selected league.

## Current Read-Only Endpoints

```text
GET /api/yahoo/status
GET /api/yahoo/auth-url
GET /oauth/yahoo/callback
GET /api/yahoo/games
GET /api/yahoo/teams
```

## Guardrails

- The connector exposes read methods only for the dashboard.
- Write methods still throw explicit read-only errors.
- Saved tokens are local development credentials and should not be committed.
- The next build slice should map Yahoo league/team responses into clean dashboard selectors before importing real settings automatically.

## Reference

- Yahoo OAuth 2.0 server-side authorization code flow: https://developer.yahoo.com/oauth2/guide/flows_authcode/
- Yahoo Fantasy Sports API guide: https://developer.yahoo.com/fantasysports/guide/
