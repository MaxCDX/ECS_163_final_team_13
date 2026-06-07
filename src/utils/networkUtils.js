import * as d3 from "d3";
import { CASE_STUDIES } from "../data/storyConfig.js";
import { usageValue } from "./pokemonFormatting.js";

export function buildNetworkSubset(pokemon, edges) {
  // Filter the visible network for readability while preserving high-signal teammate structure.
  const byName = new Map(pokemon.map((d) => [d.Name, d]));
  const selected = new Set(CASE_STUDIES.filter((name) => byName.has(name)));

  const ranked = pokemon
    .filter((d) => !d.missingBaseStats && (d.hasUsageData || d.weightedDegree > 0))
    .sort((a, b) => d3.descending(a.weightedDegree + usageValue(a) * 65, b.weightedDegree + usageValue(b) * 65));

  for (const d of ranked) {
    if (selected.size >= 52) break;
    selected.add(d.Name);
  }

  const nodes = [...selected].map((name) => byName.get(name)).filter(Boolean);
  const selectedEdges = edges
    .filter((edge) => selected.has(edge.source) && selected.has(edge.target))
    .sort((a, b) => d3.descending(a.coUsagePercent, b.coUsagePercent));

  const keep = new Map();
  // Weaker links are filtered out so edge width and neighbor structure remain legible.
  for (const edge of selectedEdges.slice(0, 115)) {
    keep.set(`${edge.source}|${edge.target}`, edge);
  }

  for (const caseName of CASE_STUDIES) {
    // Preserve each case study's strongest local links even if they fall outside the global cutoff.
    selectedEdges
      .filter((edge) => edge.source === caseName || edge.target === caseName)
      .slice(0, 7)
      .forEach((edge) => keep.set(`${edge.source}|${edge.target}`, edge));
  }

  return {
    nodes,
    links: [...keep.values()].map((edge) => ({
      ...edge,
      sourceName: edge.source,
      targetName: edge.target,
    })),
  };
}

export function connectedNames(selectedName, links) {
  // Supports linked highlighting by finding the selected node and its immediate teammates.
  if (!selectedName) return new Set();
  const connected = new Set([selectedName]);
  for (const edge of links) {
    if (edge.sourceName === selectedName) connected.add(edge.targetName);
    if (edge.targetName === selectedName) connected.add(edge.sourceName);
  }
  return connected;
}

export function getBuildRows(builds, name, category) {
  return builds
    .filter((row) => row.pokemon === name && row.category === category)
    .sort((a, b) => d3.descending(a.usagePercent, b.usagePercent));
}

export function getTopTeammates(edges, name) {
  // Local views use strongest links so teammate evidence does not turn into an unreadable hairball.
  return edges
    .filter((edge) => edge.source === name || edge.target === name)
    .map((edge) => ({
      name: edge.source === name ? edge.target : edge.source,
      percent: edge.coUsagePercent,
    }))
    .sort((a, b) => d3.descending(a.percent, b.percent))
    .slice(0, 5);
}
