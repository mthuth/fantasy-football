# Yahoo ID Gap Report

Generated: 2026-05-24T17:25:05.614Z

## Summary

- Scope: draft-pool players with sourceRank <= 200, plus every generated K and DST row.
- Scoped missing mappings: 70
- Top-200 missing mappings: 64
- K/DST missing mappings: 40
- Synthetic missing rows: 0
- Real kicker candidates missing Yahoo IDs: 17
- Player pool generated at: 2026-05-24T17:24:08.443Z
- Sleeper import: 2026-05-23T10:16:53.727Z
- DynastyProcess import: 2026-05-23T10:16:57.900Z

## Priority Key

- P0: Top-100 live-draft player missing Yahoo ID.
- P1: Top-200 or DST gap likely to affect live draft sync.
- P2: Kicker mapping gap; relevant if league drafts kickers.
- P3: Lower-priority generated pool gap.

## Top Draft-Pool Gaps

| Priority | Rank | Player | Pos | Team | Internal ID | Sleeper ID | Action |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| P0 | 16 | Ashton Jeanty | RB | LV | ply_sleeper_12527 | 12527 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 18 | Bhayshul Tuten | RB | JAX | ply_sleeper_12490 | 12490 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 33 | Jacory Croskey-Merritt | RB | WAS | ply_sleeper_12533 | 12533 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 34 | Dont'e Thornton | WR | LV | ply_sleeper_12541 | 12541 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 38 | Emeka Egbuka | WR | TB | ply_sleeper_12514 | 12514 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 42 | Kaleb Johnson | RB | PIT | ply_sleeper_12504 | 12504 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 53 | Omarion Hampton | RB | LAC | ply_sleeper_12507 | 12507 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 55 | Quinshon Judkins | RB | CLE | ply_sleeper_12512 | 12512 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 58 | RJ Harvey | RB | DEN | ply_sleeper_12489 | 12489 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 60 | Matthew Golden | WR | GB | ply_sleeper_12501 | 12501 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 61 | TreVeyon Henderson | RB | NE | ply_sleeper_12529 | 12529 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 69 | Colston Loveland | TE | CHI | ply_sleeper_12517 | 12517 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 74 | Tetairoa McMillan | WR | CAR | ply_sleeper_12526 | 12526 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 88 | Cam Ward | QB | TEN | ply_sleeper_12522 | 12522 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P0 | 97 | Cam Skattebo | RB | NYG | ply_sleeper_12481 | 12481 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 101 | Elijah Arroyo | TE | SEA | ply_sleeper_12521 | 12521 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 105 | DJ Giddens | RB | IND | ply_sleeper_12471 | 12471 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 108 | Dylan Sampson | RB | CLE | ply_sleeper_12469 | 12469 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 116 | Jayden Higgins | WR | HOU | ply_sleeper_12484 | 12484 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 120 | Gunnar Helm | TE | TEN | ply_sleeper_12502 | 12502 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 123 | Jaydon Blue | RB | DAL | ply_sleeper_12457 | 12457 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 126 | Harold Fannin | TE | CLE | ply_sleeper_12506 | 12506 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 128 | Luther Burden | WR | CHI | ply_sleeper_12519 | 12519 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 132 | Jaxson Dart | QB | NYG | ply_sleeper_12508 | 12508 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 143 | Ollie Gordon | RB | MIA | ply_sleeper_12495 | 12495 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 146 | GB DST | DST | GB | ply_sleeper_gb | GB | Add/verify Yahoo DST ID for canonical ply_sleeper_gb. |
| P1 | 147 | KC DST | DST | KC | ply_sleeper_kc | KC | Add/verify Yahoo DST ID for canonical ply_sleeper_kc. |
| P1 | 148 | LV DST | DST | LV | ply_sleeper_lv | LV | Add/verify Yahoo DST ID for canonical ply_sleeper_lv. |
| P1 | 149 | NE DST | DST | NE | ply_sleeper_ne | NE | Add/verify Yahoo DST ID for canonical ply_sleeper_ne. |
| P1 | 150 | NO DST | DST | NO | ply_sleeper_no | NO | Add/verify Yahoo DST ID for canonical ply_sleeper_no. |
| P1 | 151 | SF DST | DST | SF | ply_sleeper_sf | SF | Add/verify Yahoo DST ID for canonical ply_sleeper_sf. |
| P1 | 152 | TB DST | DST | TB | ply_sleeper_tb | TB | Add/verify Yahoo DST ID for canonical ply_sleeper_tb. |
| P1 | 153 | ARI DST | DST | ARI | ply_sleeper_ari | ARI | Add/verify Yahoo DST ID for canonical ply_sleeper_ari. |
| P1 | 154 | ATL DST | DST | ATL | ply_sleeper_atl | ATL | Add/verify Yahoo DST ID for canonical ply_sleeper_atl. |
| P1 | 155 | BAL DST | DST | BAL | ply_sleeper_bal | BAL | Add/verify Yahoo DST ID for canonical ply_sleeper_bal. |
| P1 | 156 | BUF DST | DST | BUF | ply_sleeper_buf | BUF | Add/verify Yahoo DST ID for canonical ply_sleeper_buf. |
| P1 | 157 | CAR DST | DST | CAR | ply_sleeper_car | CAR | Add/verify Yahoo DST ID for canonical ply_sleeper_car. |
| P1 | 158 | CHI DST | DST | CHI | ply_sleeper_chi | CHI | Add/verify Yahoo DST ID for canonical ply_sleeper_chi. |
| P1 | 159 | CIN DST | DST | CIN | ply_sleeper_cin | CIN | Add/verify Yahoo DST ID for canonical ply_sleeper_cin. |
| P1 | 160 | CLE DST | DST | CLE | ply_sleeper_cle | CLE | Add/verify Yahoo DST ID for canonical ply_sleeper_cle. |
| P1 | 161 | DAL DST | DST | DAL | ply_sleeper_dal | DAL | Add/verify Yahoo DST ID for canonical ply_sleeper_dal. |
| P1 | 162 | DEN DST | DST | DEN | ply_sleeper_den | DEN | Add/verify Yahoo DST ID for canonical ply_sleeper_den. |
| P1 | 163 | DET DST | DST | DET | ply_sleeper_det | DET | Add/verify Yahoo DST ID for canonical ply_sleeper_det. |
| P1 | 164 | HOU DST | DST | HOU | ply_sleeper_hou | HOU | Add/verify Yahoo DST ID for canonical ply_sleeper_hou. |
| P1 | 165 | IND DST | DST | IND | ply_sleeper_ind | IND | Add/verify Yahoo DST ID for canonical ply_sleeper_ind. |
| P1 | 166 | JAX DST | DST | JAX | ply_sleeper_jax | JAX | Add/verify Yahoo DST ID for canonical ply_sleeper_jax. |
| P1 | 167 | LAC DST | DST | LAC | ply_sleeper_lac | LAC | Add/verify Yahoo DST ID for canonical ply_sleeper_lac. |
| P1 | 168 | LAR DST | DST | LAR | ply_sleeper_lar | LAR | Add/verify Yahoo DST ID for canonical ply_sleeper_lar. |
| P1 | 169 | MIA DST | DST | MIA | ply_sleeper_mia | MIA | Add/verify Yahoo DST ID for canonical ply_sleeper_mia. |
| P1 | 170 | MIN DST | DST | MIN | ply_sleeper_min | MIN | Add/verify Yahoo DST ID for canonical ply_sleeper_min. |
| P1 | 171 | NYG DST | DST | NYG | ply_sleeper_nyg | NYG | Add/verify Yahoo DST ID for canonical ply_sleeper_nyg. |
| P1 | 172 | NYJ DST | DST | NYJ | ply_sleeper_nyj | NYJ | Add/verify Yahoo DST ID for canonical ply_sleeper_nyj. |
| P1 | 173 | PHI DST | DST | PHI | ply_sleeper_phi | PHI | Add/verify Yahoo DST ID for canonical ply_sleeper_phi. |
| P1 | 174 | PIT DST | DST | PIT | ply_sleeper_pit | PIT | Add/verify Yahoo DST ID for canonical ply_sleeper_pit. |
| P1 | 175 | SEA DST | DST | SEA | ply_sleeper_sea | SEA | Add/verify Yahoo DST ID for canonical ply_sleeper_sea. |
| P1 | 176 | TEN DST | DST | TEN | ply_sleeper_ten | TEN | Add/verify Yahoo DST ID for canonical ply_sleeper_ten. |
| P1 | 177 | WAS DST | DST | WAS | ply_sleeper_was | WAS | Add/verify Yahoo DST ID for canonical ply_sleeper_was. |
| P1 | 182 | Theo Wease | WR | MIA | ply_sleeper_12860 | 12860 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 184 | Travis Hunter | WR | JAX | ply_sleeper_12530 | 12530 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 185 | Robbie Ouzts | RB | SEA | ply_sleeper_12656 | 12656 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 190 | Tre' Harris | WR | LAC | ply_sleeper_12509 | 12509 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 191 | Tahj Brooks | RB | CIN | ply_sleeper_12543 | 12543 | Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 198 | Andy Borregales | K | NE | ply_sleeper_12713 | 12713 | Look up the kicker in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P1 | 199 | Charlie Smyth | K | NO | ply_sleeper_11653 | 11653 | Look up the kicker in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |

## K/DST Gaps Outside Top Scope

| Priority | Rank | Player | Pos | Team | Internal ID | Sleeper ID | Action |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| P2 | 206 | Tyler Loop | K | BAL | ply_sleeper_12711 | 12711 | Look up the kicker in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P2 | 208 | Ryan Fitzgerald | K | CAR | ply_sleeper_12961 | 12961 | Look up the kicker in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P2 | 216 | Spencer Shrader | K | IND | ply_sleeper_12185 | 12185 | Look up the kicker in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P2 | 219 | Harrison Mevis | K | LAR | ply_sleeper_12015 | 12015 | Look up the kicker in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P2 | 222 | Ben Sauls | K | NYG | ply_sleeper_13066 | 13066 | Look up the kicker in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |
| P2 | 223 | Lenny Krieg | K | NYJ | ply_sleeper_12548 | 12548 | Look up the kicker in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database. |

## Real Kicker Candidates Missing Yahoo IDs

| Name | Team | Depth | Status | Internal ID | Sleeper ID |
| --- | --- | ---: | --- | --- | --- |
| Tyler Loop | BAL | 1 | Active | ply_sleeper_12711 | 12711 |
| Ryan Fitzgerald | CAR | 1 | Active | ply_sleeper_12961 | 12961 |
| Spencer Shrader | IND | 1 | Active | ply_sleeper_12185 | 12185 |
| Harrison Mevis | LAR | 1 | Active | ply_sleeper_12015 | 12015 |
| Andy Borregales | NE | 1 | Active | ply_sleeper_12713 | 12713 |
| Charlie Smyth | NO | 1 | Active | ply_sleeper_11653 | 11653 |
| Ben Sauls | NYG | 1 | Active | ply_sleeper_13066 | 13066 |
| Lenny Krieg | NYJ | 2 | Active | ply_sleeper_12548 | 12548 |
| Maddux Trujillo | BUF |  | Active | ply_sleeper_12824 | 12824 |
| Gabriel Plascencia | CHI |  | Active | ply_sleeper_13710 | 13710 |
| Trey Smack | GB |  | Active | ply_sleeper_13545 | 13545 |
| Kansei Matsuzawa | LV |  | Active | ply_sleeper_13804 | 13804 |
| Mason Shipley | NO |  | Active | ply_sleeper_13644 | 13644 |
| Dominic Zvada | NYG |  | Active | ply_sleeper_13833 | 13833 |
| Jude McAtamney | NYG |  | Active | ply_sleeper_12385 | 12385 |
| Laith Marjan | PIT |  | Active | ply_sleeper_13813 | 13813 |
| Drew Stevens | WAS |  | Active | ply_sleeper_13968 | 13968 |

## Next Actions

1. Resolve P0/P1 offensive players first from Yahoo player search or live draft payload IDs.
2. Add/verify Yahoo IDs for canonical DST rows before relying on live Yahoo DST sync.
3. Add/verify Yahoo IDs for canonical kicker rows that remain unmapped.
4. After edits, rerun `node scripts/load_player_database.mjs` and regenerate this report.

