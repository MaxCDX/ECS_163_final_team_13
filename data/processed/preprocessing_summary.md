# Pokémon Preprocessing Summary

Project: **What Really Makes a Pokémon Strong?**

Subtitle: **Visualizing competitive success beyond raw stats.**

## Source Files Used

- `Complete_Competitive_Pokémon_Database_(2022)/df_pokemon.csv`
- `Complete_Competitive_Pokémon_Database_(2022)/bridge_pokemon_pokemon_USED_IN_TEAM_WITH.csv`
- `Complete_Competitive_Pokémon_Database_(2022)/bridge_pokemon_move_USED_WITH_MOVE.csv`
- `Complete_Competitive_Pokémon_Database_(2022)/bridge_pokemon_item_USED_WITH_ITEM.csv`
- `Complete_Competitive_Pokémon_Database_(2022)/bridge_pokemon_nature_USED_WITH_ABILITY.csv`
- `Dataset_of_32000_Pokemon_Images/Pokemon Images DB/...` inspected as a fallback image source
- `Dataset_of_32000_Pokemon_Images/pokemonDB_dataset.csv` inspected for metadata compatibility

## Cleaning Decisions

- Kept `df_pokemon.csv` as the main Pokémon/form table.
- Converted base stats, monthly usage, usage percent, and monthly rank to numeric values.
- Converted `-`, empty strings, and unparsable values to null.
- Preserved Pokémon/form rows with missing base stats and flagged them with `missing_base_stats`.
- Treated VGC 2022 `Permitted`, `Gigantamax Allowed`, and `Restricted` rows as allowed by `is_permitted_vgc2022`; banned and missing-rule rows are false.
- Normalized Pokémon names for image lookup, but kept original display names in the clean datasets.
- Used `df_pokemon.image_url` first for `image_lookup.csv`; local image files are fallback only.

## Filtering Decisions

- `team_edges_clean.csv` keeps only team edges where both Pokémon exist in `pokemon_clean.csv`.
- Team edges are filtered to `co_usage_percent >= 10` and the top 8 teammates per source Pokémon.
- `build_usage_clean.csv` keeps the top 4 moves, top 3 items, and top 2 abilities per Pokémon.

## Missing Values and Flagged Rows

- Pokémon rows: 1098
- Rows with usage data: 228
- Rows missing base stats: 32
- Image URL matches: 1098
- Local image fallback matches: 0
- Missing key fields:
|                   |   0 |
|:------------------|----:|
| Name              |   0 |
| Generation        |   0 |
| Type1             |   0 |
| Total             |  32 |
| HP                |  32 |
| Attack            |  32 |
| Defense           |  32 |
| Sp. Atk           |  32 |
| Sp. Def           |  32 |
| Speed             |  32 |
| Usage Percent (%) | 870 |
| Monthly Rank      | 870 |

Rows missing base stats are mostly Gigantamax forms. They are retained for identity/rule context, but later stat-based visualizations should either filter them out or show them with a clear missing-data state.

## Derived Fields

- `offensive_score = max(Attack, Sp. Atk)`
- `defensive_score = HP + Defense + Sp. Def`
- `speed_tier`: slow `<50`, mid `50-89`, fast `90-119`, elite `>=120`
- `is_single_type`
- `is_legendary`
- `is_mythical`
- `has_usage_data`
- `is_permitted_vgc2022`
- `stat_specialization = max(base stat) - average(other five base stats)`
- `normalized_name`
- `missing_base_stats`

## Output Files Created

- `data/processed/pokemon_clean.csv`
- `data/processed/team_edges_clean.csv`
- `data/processed/build_usage_clean.csv`
- `data/processed/image_lookup.csv`
- `data/processed/preprocessing_summary.md`

## Quality-Check Results

- Pokémon rows: 1098
- Pokémon with usage data: 228
- Pokémon missing base stats: 32
- Team edges: 2606
- Build usage rows: 2967
- Image matches: 1098

## How To Rerun

From the repository root:

```bash
python3 scripts/preprocess_pokemon_data.py
python3 scripts/validate_pokemon_outputs.py
```

## Storytelling Notes

These outputs are prepared to support the project question: **What really makes a Pokémon strong?**

The cleaned data can compare raw stats against:

- competitive usage rate
- type and dual-type status
- VGC rule status
- move, item, and ability choices
- teammate synergy

This structure is intentionally split into Pokémon nodes, team edges, build usage rows, and image lookup rows so the final D3 visualization can use coordinated views without one oversized table.
