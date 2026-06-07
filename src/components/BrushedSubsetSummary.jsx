import { useMemo } from "react";
import { formatSignedDelta, subsetAverages, subsetSummaryInterpretation } from "../utils/pokemonMetrics.js";
import { formatNumber, formatPercent } from "../utils/pokemonFormatting.js";

export default function BrushedSubsetSummary({ brushedPokemon, datasetPokemon, onClearBrush }) {
  const hasSelection = brushedPokemon.length > 0;
  // This card summarizes the brushed subset; DetailPanel still explains one selected Pokémon.
  const selectedAverage = useMemo(
    () => subsetAverages(hasSelection ? brushedPokemon : datasetPokemon),
    [brushedPokemon, datasetPokemon, hasSelection],
  );
  const datasetAverage = useMemo(() => subsetAverages(datasetPokemon), [datasetPokemon]);
  const description = hasSelection
    ? subsetSummaryInterpretation(selectedAverage, datasetAverage)
    : "No subset selected. Brush the scatterplot to compare a selected group against the full plotted dataset.";
  const metricRows = [
    {
      label: "Avg stats",
      selected: Math.round(selectedAverage.stats),
      dataset: Math.round(datasetAverage.stats),
      delta: selectedAverage.stats - datasetAverage.stats,
      formatter: formatNumber,
    },
    {
      label: "Avg usage",
      selected: `${formatPercent(selectedAverage.usage)}%`,
      dataset: `${formatPercent(datasetAverage.usage)}%`,
      delta: selectedAverage.usage - datasetAverage.usage,
      formatter: (value) => `${formatPercent(value)}%`,
    },
    {
      label: "Avg partners",
      selected: Math.round(selectedAverage.degree),
      dataset: Math.round(datasetAverage.degree),
      delta: selectedAverage.degree - datasetAverage.degree,
      formatter: formatNumber,
    },
  ];

  return (
    <aside className="selection-stats-panel" aria-live="polite">
      <div className="selection-stats-header">
        <div>
          <p className="section-label">Selection stats</p>
          <h3>Selected group vs. full dataset</h3>
        </div>
        <button className="clear-brush-button" type="button" onClick={onClearBrush} disabled={!hasSelection}>
          Clear brush
        </button>
      </div>

      <div className="selection-stats-summary">
        <div className="subset-count">
          <strong>{formatNumber(brushedPokemon.length)}</strong>
          <span>selected</span>
        </div>
        <p>{description}</p>
      </div>

      <dl className="selection-stat-grid" aria-label="Selected group compared with the full dataset">
        {metricRows.map((metric) => {
          const deltaClass = metric.delta > 0 ? "is-positive" : metric.delta < 0 ? "is-negative" : "";
          return (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>
                <strong>{metric.selected}</strong>
                <span>Full: {metric.dataset}</span>
                <em className={deltaClass}>{formatSignedDelta(metric.delta, metric.formatter)}</em>
              </dd>
            </div>
          );
        })}
      </dl>
    </aside>
  );
}
