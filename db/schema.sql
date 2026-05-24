PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

DROP TABLE IF EXISTS skipped_external_id_conflicts;
DROP TABLE IF EXISTS dynastyprocess_match_conflicts;
DROP TABLE IF EXISTS dynastyprocess_unmatched_playerids;
DROP TABLE IF EXISTS sleeper_external_id_conflicts;
DROP TABLE IF EXISTS player_external_ids;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS import_runs;

CREATE TABLE import_runs (
  import_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_url TEXT,
  imported_at TEXT NOT NULL,
  raw_count INTEGER,
  normalized_count INTEGER,
  summary_json TEXT NOT NULL
);

CREATE TABLE players (
  player_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  suffix TEXT,
  team TEXT,
  positions_json TEXT NOT NULL,
  eligible_positions_json TEXT NOT NULL,
  fantasy_relevant INTEGER NOT NULL DEFAULT 0,
  nfl_gsis_id TEXT,
  external_ids_json TEXT NOT NULL DEFAULT '{}',
  birth_date TEXT,
  height TEXT,
  weight TEXT,
  college TEXT,
  years_exp INTEGER,
  rookie_year TEXT,
  jersey_number INTEGER,
  depth_chart_position TEXT,
  depth_chart_order INTEGER,
  active INTEGER,
  current_status TEXT,
  injury_status TEXT,
  source TEXT NOT NULL,
  source_player_id TEXT,
  last_verified_at TEXT,
  last_identity_crosswalk_at TEXT
);

CREATE TABLE player_external_ids (
  player_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_player_id TEXT NOT NULL,
  source_player_name TEXT,
  matched_by TEXT,
  match_confidence REAL,
  first_seen_at TEXT,
  last_seen_at TEXT,
  PRIMARY KEY (player_id, source, source_player_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE sleeper_external_id_conflicts (
  conflict_id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  rows_json TEXT NOT NULL
);

CREATE TABLE dynastyprocess_unmatched_playerids (
  unmatched_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  position TEXT,
  team TEXT,
  sleeper_id TEXT,
  gsis_id TEXT,
  espn_id TEXT,
  yahoo_id TEXT,
  mfl_id TEXT,
  fantasypros_id TEXT,
  row_json TEXT NOT NULL
);

CREATE TABLE dynastyprocess_match_conflicts (
  conflict_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  position TEXT,
  team TEXT,
  conflicts_json TEXT NOT NULL
);

CREATE TABLE skipped_external_id_conflicts (
  conflict_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  position TEXT,
  team TEXT,
  matched_by_json TEXT NOT NULL,
  source TEXT NOT NULL,
  source_player_id TEXT NOT NULL,
  existing_player_id TEXT NOT NULL,
  proposed_player_id TEXT NOT NULL
);

CREATE INDEX idx_players_display_name ON players(display_name);
CREATE INDEX idx_players_team ON players(team);
CREATE INDEX idx_players_fantasy_relevant ON players(fantasy_relevant);
CREATE INDEX idx_players_active ON players(active);
CREATE INDEX idx_player_external_ids_source_id ON player_external_ids(source, source_player_id);
CREATE INDEX idx_player_external_ids_player ON player_external_ids(player_id);
CREATE INDEX idx_unmatched_name ON dynastyprocess_unmatched_playerids(name);
