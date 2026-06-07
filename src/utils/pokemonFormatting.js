import * as d3 from "d3";
import { LOCAL_IMAGE_PATHS } from "../data/storyConfig.js";

export const TYPE_COLORS = new Map([
  ["Normal", "#a9a78f"],
  ["Fire", "#d85f3f"],
  ["Water", "#4387c7"],
  ["Electric", "#d1a72d"],
  ["Grass", "#5c9f5b"],
  ["Ice", "#6aaeb2"],
  ["Fighting", "#b85a47"],
  ["Poison", "#8f62a5"],
  ["Ground", "#b99254"],
  ["Flying", "#7696c8"],
  ["Psychic", "#cf5e7f"],
  ["Bug", "#8fa653"],
  ["Rock", "#99835a"],
  ["Ghost", "#696199"],
  ["Dragon", "#6a73c9"],
  ["Dark", "#61554f"],
  ["Steel", "#7f91a0"],
  ["Fairy", "#d282aa"],
]);

export const formatPercent = d3.format(".0f");
export const formatNumber = d3.format(",");
export const formatWeighted = d3.format(",.0f");
export const formatCorrelation = d3.format(".2f");

export function typeColor(type) {
  return TYPE_COLORS.get(type) || "#8b949e";
}

export function typeLabel(d) {
  return d?.Type2 ? `${d.Type1} / ${d.Type2}` : d?.Type1 || "Unknown";
}

export function usageValue(d) {
  // Missing usage is treated as zero so rankings and averages do not produce NaN.
  return Number.isFinite(d?.usagePercent) ? d.usagePercent : 0;
}

export function compactName(name) {
  return name.replace(" Crowned Sword", "").replace(" Crowned Shield", "");
}

export function imageForPokemon(name, imageLookup) {
  return LOCAL_IMAGE_PATHS.get(name) || imageLookup.get(name) || "";
}

export function shortEvidenceLabel(label) {
  return compactName(label)
    .replace(" Solo Form", " Solo")
    .replace(" Complete Forme", " Complete")
    .replace(" Shadow Rider", " Shadow")
    .replace(" Ice Rider", " Ice")
    .replace(" Incarnate Forme", " Incarnate")
    .replace(" Therian Forme", " Therian");
}

export function formatRank(rank) {
  return rank ? `#${rank}` : "N/A";
}
