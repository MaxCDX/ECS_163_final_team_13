import { useEffect, useState } from "react";
import * as d3 from "d3";
import { DATA_PATHS } from "./storyConfig.js";

// Runtime CSVs live under public/data/processed because Vite serves public files as static assets.
function parsePokemon(row) {
  // Normalize CSV rows into chart-ready Pokemon records with numeric stats and usage fields.
  return {
    ...row,
    ID: +row.ID,
    Generation: +row.Generation,
    Total: +row.Total,
    HP: +row.HP,
    Attack: +row.Attack,
    Defense: +row.Defense,
    "Sp. Atk": +row["Sp. Atk"],
    "Sp. Def": +row["Sp. Def"],
    Speed: +row.Speed,
    usagePercent: +row["Usage Percent (%)"] || 0,
    monthlyRank: +row["Monthly Rank"],
    offensiveScore: +row.offensive_score,
    defensiveScore: +row.defensive_score,
    statSpecialization: +row.stat_specialization,
    missingBaseStats: row.missing_base_stats === "True" || row.missing_base_stats === "true",
    hasUsageData: row.has_usage_data === "True" || row.has_usage_data === "true",
  };
}

function parseEdge(row) {
  // Preserve teammate co-usage links for network analysis and local ego comparisons.
  return {
    source: row.source,
    target: row.target,
    coUsagePercent: +row.co_usage_percent,
    sourceUsagePercent: +row.source_usage_percent || 0,
    targetUsagePercent: +row.target_usage_percent || 0,
  };
}

function parseBuild(row) {
  // Build records power the move, item, and ability evidence in the detail panel.
  return {
    pokemon: row.pokemon,
    category: row.category,
    name: row.name,
    usagePercent: +row.usage_percent,
  };
}

function parseImage(row) {
  // Image lookup keeps visual identity separate from analysis metrics.
  return {
    pokemon: row.pokemon,
    imagePathOrUrl: row.image_path_or_url,
  };
}

export default function usePokemonData() {
  // Load once, then share one normalized dataset across all coordinated views.
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    // Normalize CSV strings once so downstream views can use numeric fields directly.
    Promise.all([
      d3.csv(DATA_PATHS.pokemon, parsePokemon),
      d3.csv(DATA_PATHS.edges, parseEdge),
      d3.csv(DATA_PATHS.builds, parseBuild),
      d3.csv(DATA_PATHS.images, parseImage),
    ])
      .then(([pokemon, edges, builds, images]) => {
        if (isCancelled) return;
        setData({
          pokemon: pokemon.filter((d) => !d.missingBaseStats),
          edges,
          builds,
          imageLookup: new Map(images.map((d) => [d.pokemon, d.imagePathOrUrl])),
        });
      })
      .catch((loadError) => {
        if (!isCancelled) setError(loadError);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return { data, error };
}
