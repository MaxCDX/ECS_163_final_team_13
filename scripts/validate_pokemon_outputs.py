from pathlib import Path

import pandas as pd


OUTPUT_DIR = Path("data/processed")

EXPECTED_FILES = [
    "pokemon_clean.csv",
    "team_edges_clean.csv",
    "build_usage_clean.csv",
    "image_lookup.csv",
    "preprocessing_summary.md",
]

EXPECTED_COLUMNS = {
    "pokemon_clean.csv": {
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
        "offensive_score",
        "defensive_score",
        "speed_tier",
        "is_single_type",
        "is_legendary",
        "is_mythical",
        "has_usage_data",
        "is_permitted_vgc2022",
        "stat_specialization",
        "missing_base_stats",
    },
    "team_edges_clean.csv": {
        "source",
        "target",
        "co_usage_percent",
        "source_usage_percent",
        "target_usage_percent",
    },
    "build_usage_clean.csv": {
        "pokemon",
        "category",
        "name",
        "usage_percent",
    },
    "image_lookup.csv": {
        "pokemon",
        "normalized_name",
        "image_path_or_url",
        "source",
    },
}


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    for filename in EXPECTED_FILES:
        require((OUTPUT_DIR / filename).exists(), f"Missing output file: {filename}")

    frames = {name: pd.read_csv(OUTPUT_DIR / name) for name in EXPECTED_COLUMNS}
    for filename, expected in EXPECTED_COLUMNS.items():
        missing = expected - set(frames[filename].columns)
        require(not missing, f"{filename} missing columns: {sorted(missing)}")

    pokemon = frames["pokemon_clean.csv"]
    require(len(pokemon) == 1098, f"Expected 1098 pokemon rows, found {len(pokemon)}")
    require(pokemon["Name"].is_unique, "Pokemon names should be unique")
    require(pokemon["missing_base_stats"].sum() == 32, "Expected 32 missing-stat rows")
    require(pokemon["has_usage_data"].sum() >= 200, "Expected substantial numeric usage coverage")

    key_numeric = [
        "Total",
        "HP",
        "Attack",
        "Defense",
        "Sp. Atk",
        "Sp. Def",
        "Speed",
        "Monthly Usage (k)",
        "Usage Percent (%)",
        "Monthly Rank",
        "offensive_score",
        "defensive_score",
        "stat_specialization",
    ]
    for column in key_numeric:
        require(pd.api.types.is_numeric_dtype(pokemon[column]), f"{column} should be numeric")

    team_edges = frames["team_edges_clean.csv"]
    require(len(team_edges) > 0, "team_edges_clean.csv should not be empty")
    names = set(pokemon["Name"])
    require(set(team_edges["source"]).issubset(names), "Team edge source outside pokemon_clean")
    require(set(team_edges["target"]).issubset(names), "Team edge target outside pokemon_clean")
    require(team_edges["co_usage_percent"].between(0, 100).all(), "Team percentages outside 0-100")

    build_usage = frames["build_usage_clean.csv"]
    require(len(build_usage) > 0, "build_usage_clean.csv should not be empty")
    require(set(build_usage["pokemon"]).issubset(names), "Build usage pokemon outside pokemon_clean")
    require(set(build_usage["category"]) == {"ability", "item", "move"}, "Expected move/item/ability categories")
    require(build_usage["usage_percent"].between(0, 100).all(), "Build percentages outside 0-100")

    image_lookup = frames["image_lookup.csv"]
    require(len(image_lookup) == len(pokemon), "Expected one image row per pokemon")
    require(image_lookup["image_path_or_url"].notna().all(), "Image lookup contains missing paths/URLs")

    print("Validation passed")
    print(f"Pokemon rows: {len(pokemon)}")
    print(f"Rows with usage data: {int(pokemon['has_usage_data'].sum())}")
    print(f"Rows missing base stats: {int(pokemon['missing_base_stats'].sum())}")
    print(f"Team edges: {len(team_edges)}")
    print(f"Build usage rows: {len(build_usage)}")
    print(f"Image matches: {image_lookup['image_path_or_url'].notna().sum()}")


if __name__ == "__main__":
    main()
