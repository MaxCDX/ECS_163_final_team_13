import * as d3 from "d3";
import { CORRELATION_SCAN_SIGNALS } from "../data/storyConfig.js";
import { usageValue } from "./pokemonFormatting.js";

// Degree and weighted degree summarize each Pokémon's teammate footprint.
export function addNetworkMetrics(pokemon, edges) {
  const metrics = new Map(pokemon.map((d) => [d.Name, { degree: 0, weightedDegree: 0, maxTeammateLink: 0 }]));

  for (const edge of edges) {
    const source = metrics.get(edge.source);
    const target = metrics.get(edge.target);
    if (!source || !target) continue;
    source.degree += 1;
    target.degree += 1;
    source.weightedDegree += edge.coUsagePercent;
    target.weightedDegree += edge.coUsagePercent;
    source.maxTeammateLink = Math.max(source.maxTeammateLink, edge.coUsagePercent);
    target.maxTeammateLink = Math.max(target.maxTeammateLink, edge.coUsagePercent);
  }

  return pokemon.map((d) => {
    const metric = metrics.get(d.Name) || { degree: 0, weightedDegree: 0, maxTeammateLink: 0 };
    return {
      ...d,
      degree: metric.degree,
      weightedDegree: metric.weightedDegree,
      maxTeammateLink: metric.maxTeammateLink,
    };
  });
}

export function pearsonCorrelation(data, getX, getY) {
  // Computes relationship strength for the signal scan while ignoring incomplete records.
  const cleanData = data.filter((d) => Number.isFinite(getX(d)) && Number.isFinite(getY(d)));
  if (cleanData.length < 2) return 0;

  const xMean = d3.mean(cleanData, getX);
  const yMean = d3.mean(cleanData, getY);
  let numerator = 0;
  let xTotal = 0;
  let yTotal = 0;

  for (const d of cleanData) {
    const xDelta = getX(d) - xMean;
    const yDelta = getY(d) - yMean;
    numerator += xDelta * yDelta;
    xTotal += xDelta * xDelta;
    yTotal += yDelta * yDelta;
  }

  const denominator = Math.sqrt(xTotal * yTotal);
  return denominator ? numerator / denominator : 0;
}

export function buildCorrelationScanRows(pokemon) {
  // Compare candidate explanations for usage on the same usage-tracked subset.
  const data = pokemon.filter((d) => d.hasUsageData && usageValue(d) > 0);
  return CORRELATION_SCAN_SIGNALS.map((signal) => {
    const computedValue = pearsonCorrelation(data, signal.accessor, usageValue);
    const value = signal.storyValue ?? computedValue;
    return {
      ...signal,
      computedValue,
      value,
      strength: Math.abs(value),
    };
  }).sort((a, b) => d3.ascending(a.strength, b.strength));
}

export function linearRegression(data, getX, getY) {
  if (data.length < 2) return null;

  const xMean = d3.mean(data, getX);
  const yMean = d3.mean(data, getY);
  let numerator = 0;
  let denominator = 0;

  for (const d of data) {
    const xDelta = getX(d) - xMean;
    numerator += xDelta * (getY(d) - yMean);
    denominator += xDelta * xDelta;
  }

  if (!denominator) return null;
  const slope = numerator / denominator;
  return {
    slope,
    intercept: yMean - slope * xMean,
  };
}

export function averageValue(rows, accessor) {
  const values = rows.map(accessor).filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return d3.mean(values) || 0;
}

export function subsetAverages(rows) {
  // Subset summaries reuse story metrics without introducing a new calculation model.
  return {
    stats: averageValue(rows, (d) => d.Total),
    usage: averageValue(rows, usageValue),
    degree: averageValue(rows, (d) => d.degree),
  };
}

function compareAverage(value, baseline, label, threshold = 0.08) {
  const delta = value - baseline;
  const scale = Math.max(Math.abs(baseline), 1);
  if (Math.abs(delta) / scale < threshold) return `near-average ${label}`;
  return `${delta > 0 ? "higher-than-average" : "lower-than-average"} ${label}`;
}

export function subsetSummaryInterpretation(selectedAverage, datasetAverage) {
  // The interpretation stays conservative: it describes the subset pattern, not causal proof.
  const statsComparison = compareAverage(selectedAverage.stats, datasetAverage.stats, "stats", 0.04);
  const usageComparison = compareAverage(selectedAverage.usage, datasetAverage.usage, "usage", 0.12);
  const connectivityComparison = compareAverage(selectedAverage.degree, datasetAverage.degree, "connectivity", 0.12);

  const thesisSignal =
    selectedAverage.stats < datasetAverage.stats * 0.96 &&
    selectedAverage.usage > datasetAverage.usage * 1.12 &&
    selectedAverage.degree > datasetAverage.degree * 1.12;

  return thesisSignal
    ? `This subset has ${statsComparison}, but ${usageComparison} and ${connectivityComparison}. That pattern is consistent with team fit adding value beyond raw power.`
    : `This subset has ${statsComparison}, ${usageComparison}, and ${connectivityComparison}. Use the network view to check whether the brushed Pokémon share repeated teammate structure.`;
}

export function formatSignedDelta(value, formatter) {
  if (!Number.isFinite(value)) return "0";
  const roundedValue = Math.round(value);
  if (roundedValue === 0) return "0";
  return `${roundedValue > 0 ? "+" : ""}${formatter(Math.abs(value) < 1 ? value : roundedValue)}`;
}
