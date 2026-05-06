from pathlib import Path
import re

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
COMPETITIVE_DIR = ROOT / "Complete_Competitive_Pokémon_Database_(2022)"
IMAGE_DIR = ROOT / "Dataset_of_32000_Pokemon_Images"
OUTPUT_DIR = ROOT / "data" / "processed"

POKEMON_SOURCE = COMPETITIVE_DIR / "df_pokemon.csv"
TEAM_SOURCE = COMPETITIVE_DIR / "bridge_pokemon_pokemon_USED_IN_TEAM_WITH.csv"
MOVE_SOURCE = COMPETITIVE_DIR / "bridge_pokemon_move_USED_WITH_MOVE.csv"
ITEM_SOURCE = COMPETITIVE_DIR / "bridge_pokemon_item_USED_WITH_ITEM.csv"
ABILITY_USAGE_SOURCE = COMPETITIVE_DIR / "bridge_pokemon_nature_USED_WITH_ABILITY.csv"
IMAGE_META_SOURCE = IMAGE_DIR / "pokemonDB_dataset.csv"

STAT_COLUMNS = ["Total", "HP", "Attack", "Defense", "Sp. Atk", "Sp. Def", "Speed"]
NUMERIC_USAGE_COLUMNS = ["Monthly Usage (k)", "Usage Percent (%)", "Monthly Rank"]
TEAM_EDGE_MIN_PERCENT = 10
TEAM_EDGE_TOP_N_PER_SOURCE = 8
TOP_N_BY_CATEGORY = {
    "move": 4,
    "item": 3,
    "ability": 2,
}


def normalize_name(value):
    if pd.isna(value):
        return ""
    text = str(value).lower().replace("pokémon", "pokemon").replace("é", "e")
    text = text.replace("♀", " female").replace("♂", " male")
    text = re.sub(r"[_’'\\.:]", "", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return text.strip()


def to_number(series):
    cleaned = (
        series.astype("string")
        .str.strip()
        .replace({"-": pd.NA, "": pd.NA, "nan": pd.NA})
        .str.replace("%", "", regex=False)
        .str.replace(",", "", regex=False)
    )
    return pd.to_numeric(cleaned, errors="coerce")


def speed_tier(speed):
    if pd.isna(speed):
        return pd.NA
    if speed < 50:
        return "slow"
    if speed < 90:
        return "mid"
    if speed < 120:
        return "fast"
    return "elite"


def stat_specialization(row):
    values = row[["HP", "Attack", "Defense", "Sp. Atk", "Sp. Def", "Speed"]]
    if values.isna().any():
        return pd.NA
    max_stat = values.max()
    return max_stat - values[values != max_stat].mean() if (values != max_stat).any() else 0


def clean_pokemon():
    keep_columns = [
        "ID",
        "Name",
        "Species",
        "Variant",
        "Generation",
        "Rarity",
        "Type1",
        "Type2",
        "Total",
        "HP",
        "Attack",
        "Defense",
        "Sp. Atk",
        "Sp. Def",
        "Speed",
        "VGC2022_rules",
        "Monthly Usage (k)",
        "Usage Percent (%)",
        "Monthly Rank",
        "image_url",
    ]
    pokemon = pd.read_csv(POKEMON_SOURCE)[keep_columns].copy()

    for column in STAT_COLUMNS + NUMERIC_USAGE_COLUMNS:
        pokemon[column] = to_number(pokemon[column])

    pokemon["missing_base_stats"] = pokemon[STAT_COLUMNS].isna().any(axis=1)
    pokemon["offensive_score"] = pokemon[["Attack", "Sp. Atk"]].max(axis=1)
    pokemon["defensive_score"] = pokemon[["HP", "Defense", "Sp. Def"]].sum(axis=1, min_count=3)
    pokemon["speed_tier"] = pokemon["Speed"].map(speed_tier)
    pokemon["is_single_type"] = pokemon["Type2"].isna()
    pokemon["is_legendary"] = pokemon["Rarity"].eq("Legendary")
    pokemon["is_mythical"] = pokemon["Rarity"].eq("Mythical")
    pokemon["has_usage_data"] = pokemon[["Monthly Usage (k)", "Usage Percent (%)", "Monthly Rank"]].notna().any(axis=1)
    pokemon["is_permitted_vgc2022"] = pokemon["VGC2022_rules"].isin(
        [
            "Permitted",
            "Gigantamax Allowed",
            "Restricted (players can include two Restricted Pokémon in their team)",
        ]
    )
    pokemon["stat_specialization"] = pokemon.apply(stat_specialization, axis=1)
    pokemon["normalized_name"] = pokemon["Name"].map(normalize_name)

    return pokemon


def clean_team_edges(pokemon):
    usage_lookup = pokemon.set_index("Name")["Usage Percent (%)"].to_dict()
    names = set(pokemon["Name"])

    team_edges = pd.read_csv(TEAM_SOURCE).rename(
        columns={
            "Pokemon": "source",
            "Teammate": "target",
            "Use_Percentage (%)": "co_usage_percent",
        }
    )
    team_edges["co_usage_percent"] = to_number(team_edges["co_usage_percent"])
    team_edges = team_edges[
        team_edges["source"].isin(names)
        & team_edges["target"].isin(names)
        & team_edges["co_usage_percent"].notna()
    ].copy()
    team_edges["source_usage_percent"] = team_edges["source"].map(usage_lookup)
    team_edges["target_usage_percent"] = team_edges["target"].map(usage_lookup)

    team_edges = team_edges[team_edges["co_usage_percent"] >= TEAM_EDGE_MIN_PERCENT].copy()
    team_edges = (
        team_edges.sort_values(["source", "co_usage_percent"], ascending=[True, False])
        .groupby("source", group_keys=False)
        .head(TEAM_EDGE_TOP_N_PER_SOURCE)
        .sort_values("co_usage_percent", ascending=False)
        .reset_index(drop=True)
    )
    return team_edges[["source", "target", "co_usage_percent", "source_usage_percent", "target_usage_percent"]]


def read_build_source(path, category, name_column):
    data = pd.read_csv(path).rename(
        columns={
            "Pokemon": "pokemon",
            name_column: "name",
            "Use_Percentage (%)": "usage_percent",
        }
    )
    data["category"] = category
    data["usage_percent"] = to_number(data["usage_percent"])
    return data[["pokemon", "category", "name", "usage_percent"]]


def clean_build_usage(pokemon):
    names = set(pokemon["Name"])
    pieces = [
        read_build_source(MOVE_SOURCE, "move", "Move"),
        read_build_source(ITEM_SOURCE, "item", "Item"),
        read_build_source(ABILITY_USAGE_SOURCE, "ability", "Ability"),
    ]
    build_usage = pd.concat(pieces, ignore_index=True)
    build_usage = build_usage[
        build_usage["pokemon"].isin(names)
        & build_usage["name"].notna()
        & build_usage["usage_percent"].notna()
    ].copy()

    limited = []
    for category, top_n in TOP_N_BY_CATEGORY.items():
        subset = build_usage[build_usage["category"].eq(category)]
        subset = (
            subset.sort_values(["pokemon", "usage_percent"], ascending=[True, False])
            .groupby("pokemon", group_keys=False)
            .head(top_n)
        )
        limited.append(subset)

    return (
        pd.concat(limited, ignore_index=True)
        .sort_values(["pokemon", "category", "usage_percent"], ascending=[True, True, False])
        .reset_index(drop=True)
    )


def build_local_image_lookup():
    lookup = {}
    images_root = IMAGE_DIR / "Pokemon Images DB" / "Pokemon Images DB"
    if not images_root.exists():
        return lookup

    for path in images_root.glob("*/*"):
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
            continue
        key = normalize_name(path.parent.name)
        current = lookup.get(key)
        # Prefer the plain PNG over generated "_new" variants when both exist.
        if current is None or ("_new" in current.name and "_new" not in path.name):
            lookup[key] = path.relative_to(ROOT)
    return lookup


def clean_image_lookup(pokemon):
    local_lookup = build_local_image_lookup()
    rows = []
    for row in pokemon.itertuples(index=False):
        normalized = row.normalized_name
        local_path = local_lookup.get(normalized)
        if pd.notna(row.image_url) and str(row.image_url).strip():
            image_path_or_url = row.image_url
            source = "df_pokemon.image_url"
        elif local_path:
            image_path_or_url = str(local_path)
            source = "Dataset_of_32000_Pokemon_Images/Pokemon Images DB"
        else:
            image_path_or_url = pd.NA
            source = "missing"
        rows.append(
            {
                "pokemon": row.Name,
                "normalized_name": normalized,
                "image_path_or_url": image_path_or_url,
                "source": source,
            }
        )
    return pd.DataFrame(rows)


def summarize_outputs(pokemon, team_edges, build_usage, image_lookup):
    key_fields = [
        "Name",
        "Generation",
        "Type1",
        "Total",
        "HP",
        "Attack",
        "Defense",
        "Sp. Atk",
        "Sp. Def",
        "Speed",
        "Usage Percent (%)",
        "Monthly Rank",
    ]
    missing_key = pokemon[key_fields].isna().sum().to_dict()
    local_image_matches = int(image_lookup["source"].str.contains("Dataset_of_32000", na=False).sum())
    url_image_matches = int(image_lookup["source"].eq("df_pokemon.image_url").sum())

    return f"""# Pokémon Preprocessing Summary

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
- Team edges are filtered to `co_usage_percent >= {TEAM_EDGE_MIN_PERCENT}` and the top {TEAM_EDGE_TOP_N_PER_SOURCE} teammates per source Pokémon.
- `build_usage_clean.csv` keeps the top {TOP_N_BY_CATEGORY['move']} moves, top {TOP_N_BY_CATEGORY['item']} items, and top {TOP_N_BY_CATEGORY['ability']} abilities per Pokémon.

## Missing Values and Flagged Rows

- Pokémon rows: {len(pokemon)}
- Rows with usage data: {int(pokemon['has_usage_data'].sum())}
- Rows missing base stats: {int(pokemon['missing_base_stats'].sum())}
- Image URL matches: {url_image_matches}
- Local image fallback matches: {local_image_matches}
- Missing key fields:
{pd.Series(missing_key).to_markdown()}

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

- Pokémon rows: {len(pokemon)}
- Pokémon with usage data: {int(pokemon['has_usage_data'].sum())}
- Pokémon missing base stats: {int(pokemon['missing_base_stats'].sum())}
- Team edges: {len(team_edges)}
- Build usage rows: {len(build_usage)}
- Image matches: {int(image_lookup['image_path_or_url'].notna().sum())}

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
"""


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    pokemon = clean_pokemon()
    team_edges = clean_team_edges(pokemon)
    build_usage = clean_build_usage(pokemon)
    image_lookup = clean_image_lookup(pokemon)

    pokemon.to_csv(OUTPUT_DIR / "pokemon_clean.csv", index=False)
    team_edges.to_csv(OUTPUT_DIR / "team_edges_clean.csv", index=False)
    build_usage.to_csv(OUTPUT_DIR / "build_usage_clean.csv", index=False)
    image_lookup.to_csv(OUTPUT_DIR / "image_lookup.csv", index=False)
    (OUTPUT_DIR / "preprocessing_summary.md").write_text(
        summarize_outputs(pokemon, team_edges, build_usage, image_lookup),
        encoding="utf-8",
    )

    print(f"Pokemon rows: {len(pokemon)}")
    print(f"Rows with usage data: {int(pokemon['has_usage_data'].sum())}")
    print(f"Rows missing base stats: {int(pokemon['missing_base_stats'].sum())}")
    print(f"Team edges: {len(team_edges)}")
    print(f"Build usage rows: {len(build_usage)}")
    print(f"Image matches: {int(image_lookup['image_path_or_url'].notna().sum())}")
    print("Missing values in key fields:")
    print(
        pokemon[
            [
                "Name",
                "Generation",
                "Type1",
                "Total",
                "HP",
                "Attack",
                "Defense",
                "Sp. Atk",
                "Sp. Def",
                "Speed",
                "Usage Percent (%)",
                "Monthly Rank",
            ]
        ]
        .isna()
        .sum()
        .to_string()
    )


if __name__ == "__main__":
    main()
