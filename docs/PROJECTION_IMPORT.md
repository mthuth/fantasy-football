# Projection Import

Use projection imports while Yahoo API approval is pending, or any time you want
to test a ranking/projection source before wiring a provider-specific adapter.

## Supported Inputs

The importer accepts JSON or CSV.

Required fields:

- `playerId`: internal player id from the active draft pool, such as `p_001`.
- `projectedPoints`: season-long projected fantasy points.

Optional fields:

- `source`: source name for the row.
- `sourceRank`: source overall rank.
- `adp`: average draft position.
- `risk`: numeric risk penalty used by recommendation scoring.
- `ceiling`: numeric ceiling adjustment used by recommendation scoring.
- `confidence`: source confidence from `0` to `1`.
- `updatedAt`: source freshness timestamp.
- `stats`: JSON-only stat projection object.

Templates:

- `data/projections/templates/projection_import_template.csv`
- `data/projections/templates/projection_import_template.json`

Sample files:

- `data/projections/samples/mock_projection_sample.csv`
- `data/projections/samples/mock_projection_sample.json`
- `data/projections/samples/sharp_football_projection_sample.csv`

## CLI Import

```sh
npm run projection:import -- data/projections/samples/mock_projection_sample.json mock_projection_sample
```

The merged output is written to:

```text
data/projections/<source>_merged.json
```

The output includes matched, missing, and unused counts so the source can be
audited before it is used on draft day.

## Sharp Football Projections

The first wired real projection source is Sharp Football Analysis:

```text
https://www.sharpfootballanalysis.com/fantasy/fantasy-football-projections/
```

Sharp publishes current season QB/RB/WR/TE projections and notes that the table
can be downloaded as CSV. Download that CSV from the page, then run:

```sh
npm run projection:import:sharp -- ~/Downloads/sharp-football-projections.csv half_ppr
```

The optional scoring format is one of `half_ppr`, `ppr`, `standard`, or
`te_premium`; `half_ppr` is the default because the MVP league profile is half
PPR. To use the generated current-player pool instead of the small static mock
pool, run:

```sh
PLAYER_POOL=generated npm run projection:import:sharp -- ~/Downloads/sharp-football-projections.csv half_ppr
```

Outputs:

- `data/projections/sharp_football_projection_rows.json`: normalized provider
  rows in the app's projection shape.
- `data/projections/sharp_football_projection_audit.json`: unmatched and
  ambiguous player matches for review.
- `data/projections/sharp_football_projections_merged.json`: active player
  pool with Sharp projections merged in.

The adapter matches provider rows to internal players by normalized
player-name, position, and team. Rows that do not match cleanly are audited
instead of being forced onto a player.

## Dashboard Import

In the local dashboard, use `Projection source`, `Projection JSON file`, and
`Import Projections` in the League Rules panel. The dashboard import expects the
same JSON shape as the template.
