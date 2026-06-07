import * as d3 from "d3";
import { formatNumber, formatPercent, formatWeighted, usageValue } from "./pokemonFormatting.js";

export function rankedPickerOptions(pokemon, query, mode) {
  // Picker rankings support open exploration after the authored story.
  const searchText = query.trim().toLowerCase();
  const hasSearch = searchText.length > 0;
  // Exclude records with no usage or network evidence so exploration avoids dead-end selections.
  const eligiblePokemon = pokemon.filter((d) => usageValue(d) > 0 || d.degree > 0 || d.weightedDegree > 0);
  const matchingPokemon = hasSearch ? eligiblePokemon.filter((d) => d.Name.toLowerCase().includes(searchText)) : eligiblePokemon;

  const searchTieBreak = (a, b) => {
    if (!hasSearch) return d3.ascending(a.Name, b.Name);
    const aStarts = a.Name.toLowerCase().startsWith(searchText);
    const bStarts = b.Name.toLowerCase().startsWith(searchText);
    return d3.descending(aStarts, bStarts) || d3.ascending(a.Name, b.Name);
  };

  if (mode === "stats") {
    return (hasSearch ? matchingPokemon : matchingPokemon.filter((d) => Number.isFinite(d.Total)))
      .sort((a, b) => d3.descending(a.Total, b.Total) || searchTieBreak(a, b))
      .slice(0, 8);
  }

  if (mode === "synergy") {
    return (hasSearch ? matchingPokemon : matchingPokemon.filter((d) => d.weightedDegree > 0))
      .sort((a, b) => d3.descending(a.weightedDegree, b.weightedDegree) || searchTieBreak(a, b))
      .slice(0, 8);
  }

  return (hasSearch ? matchingPokemon : matchingPokemon.filter((d) => d.hasUsageData && usageValue(d) > 0))
    .sort((a, b) => d3.descending(usageValue(a), usageValue(b)) || searchTieBreak(a, b))
    .slice(0, 8);
}

export function pickerMetric(pokemon, mode) {
  if (mode === "stats") return formatNumber(pokemon.Total);
  if (mode === "synergy") return formatWeighted(pokemon.weightedDegree);
  return `${formatPercent(usageValue(pokemon))}%`;
}

export function missionRank(pokemon, name, mode) {
  // Mission helpers reuse picker ranking so guided examples and open exploration agree.
  const ranked = rankedPickerOptions(pokemon, "", mode);
  const index = ranked.findIndex((item) => item.Name === name);
  if (index >= 0) return index + 1;

  const allRanked = pokemon
    .filter((item) => {
      if (mode === "stats") return Number.isFinite(item.Total);
      if (mode === "synergy") return item.weightedDegree > 0;
      return item.hasUsageData;
    })
    .sort((a, b) => {
      if (mode === "stats") return d3.descending(a.Total, b.Total);
      if (mode === "synergy") return d3.descending(a.weightedDegree, b.weightedDegree);
      return d3.descending(usageValue(a), usageValue(b));
    });

  const allIndex = allRanked.findIndex((item) => item.Name === name);
  return allIndex >= 0 ? allIndex + 1 : null;
}

export function missionEvidence(insight, pokemon) {
  // Mission evidence turns each guided task into question, evidence, conclusion, and next step.
  const subject = pokemon.find((item) => item.Name === insight.subjectName);
  const comparison = pokemon.find((item) => item.Name === insight.comparisonName);
  if (!subject) return [];

  if (insight.subjectName === "Amoonguss") {
    return [
      `Base stats: ${formatNumber(subject.Total)}`,
      `Stats rank: #${missionRank(pokemon, subject.Name, "stats")}`,
      `Synergy rank: #${missionRank(pokemon, subject.Name, "synergy")}`,
      `Team partners: ${formatNumber(subject.degree)}`,
    ];
  }

  if (insight.subjectName === "Zamazenta Crowned Shield") {
    return [
      `Base stats: ${formatNumber(subject.Total)}`,
      `Stats rank: #${missionRank(pokemon, subject.Name, "stats")}`,
      `Usage: ${formatPercent(usageValue(subject))}%`,
      `Usage rank: #${missionRank(pokemon, subject.Name, "usage")}`,
    ];
  }

  if (comparison) {
    return [
      `${subject.Name}: #${missionRank(pokemon, subject.Name, "synergy")} Synergy`,
      `${comparison.Name}: #${missionRank(pokemon, comparison.Name, "stats")} Stats`,
      `${subject.Name}: ${formatNumber(subject.degree)} partners`,
      `${comparison.Name}: ${formatNumber(comparison.degree)} partners`,
    ];
  }

  if (insight.subjectName === "Incineroar" && insight.title === "Ranking changes when team connectivity becomes the focus") {
    return [
      "Usage leader: Zacian Crowned Sword",
      "Stats leader: Zacian Crowned Sword",
      "Synergy outlier: Incineroar",
    ];
  }

  return [
    `Stats rank: #${missionRank(pokemon, subject.Name, "stats")}`,
    `Usage rank: #${missionRank(pokemon, subject.Name, "usage")}`,
    `Synergy rank: #${missionRank(pokemon, subject.Name, "synergy")}`,
    `Team partners: ${formatNumber(subject.degree)}`,
  ];
}

export function currentFocusTakeaway({ statsRank, synergyRank, usageRank }) {
  if (!statsRank || !synergyRank || !usageRank) return "Compare its raw power, adoption, and team position.";
  if (synergyRank <= 10 && statsRank > 20) return "Moderate stats, elite team connectivity.";
  if (statsRank <= 10 && usageRank > 30) return "Elite stats, limited competitive adoption.";
  if (usageRank <= 10 && synergyRank <= 10) return "High usage backed by strong team connectivity.";
  if (synergyRank < statsRank) return "Team connectivity adds value beyond raw stats.";
  return "Raw power and team position tell different parts of the story.";
}
