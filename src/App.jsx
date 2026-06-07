import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import EgoNetworkComparisonView from "./EgoNetworkComparisonView.jsx";
import RoleCausalityCard from "./RoleCausalityCard.jsx";
import TeamEcosystemPanel from "./TeamEcosystemPanel.jsx";
import BrushedSubsetSummary from "./components/BrushedSubsetSummary.jsx";
import HeroSection from "./components/HeroSection.jsx";
import { ExplorationMissions, MissionInsightCard } from "./components/MissionCards.jsx";
import PokemonPicker from "./components/PokemonPicker.jsx";
import StoryNav from "./components/StoryNav.jsx";
import {
  CASE_STUDIES,
  COMPARISON_NAMES,
  DETAIL_TABS,
  INCINEROAR_REVEAL_NAME,
  LOCAL_IMAGE_PATHS,
  ROLE_NOTES,
  STORY_CONNECTIVITY_USAGE_CORRELATION,
  STORY_STATS_USAGE_CORRELATION,
  STORY_STEPS,
} from "./data/storyConfig.js";
import usePokemonData from "./data/usePokemonData.js";
import { connectedNames, buildNetworkSubset, getBuildRows, getTopTeammates } from "./utils/networkUtils.js";
import {
  addNetworkMetrics,
  buildCorrelationScanRows,
  linearRegression,
} from "./utils/pokemonMetrics.js";
import {
  compactName,
  formatCorrelation,
  formatNumber,
  formatPercent,
  formatWeighted,
  imageForPokemon,
  shortEvidenceLabel,
  typeColor,
  typeLabel,
  usageValue,
} from "./utils/pokemonFormatting.js";

function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(ref.current);
    setWidth(ref.current.clientWidth);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

function roleSummary(pokemon) {
  return (
    ROLE_NOTES.get(pokemon.Name) ||
    "Role evidence combines build choices and teammate links so this selection can be read as part of a team pattern."
  );
}

function buildEvidenceRows({ moves, items, abilities, teammates }) {
  return [
    ...abilities.slice(0, 1).map((row) => ({ label: row.name, value: row.usagePercent, kind: "Ability" })),
    ...items.slice(0, 1).map((row) => ({ label: row.name, value: row.usagePercent, kind: "Item" })),
    ...moves.slice(0, 3).map((row) => ({ label: row.name, value: row.usagePercent, kind: "Move" })),
    ...teammates.slice(0, 3).map((row) => ({ label: row.name, value: row.percent, kind: "Partner" })),
  ];
}

function comparisonLabelPlacement(pointX, label, chartLeft, chartRight) {
  // Highlight labels flip sides near chart edges so important names are not clipped.
  const estimatedWidth = label.length * 6.8;
  const rightX = pointX + 12;
  const leftX = pointX - 12;

  if (rightX + estimatedWidth > chartRight) {
    return { x: leftX, anchor: "end" };
  }

  if (leftX - estimatedWidth < chartLeft) {
    return { x: rightX, anchor: "start" };
  }

  return { x: rightX, anchor: "start" };
}

function ComparisonChart({ pokemon, selectedName, comparisonName, activeSlot, brushedNames, onSelect, onBrush }) {
  const [containerRef, width] = useElementWidth();
  const onBrushRef = useRef(onBrush);
  const brushedNamesRef = useRef(brushedNames);
  const brushBehaviorRef = useRef(null);
  const brushLayerRef = useRef(null);
  const brushSelectionRef = useRef(null);
  const brushGestureChangedRef = useRef(false);
  const suppressNextBrushClickRef = useRef(false);

  useEffect(() => {
    onBrushRef.current = onBrush;
  }, [onBrush]);

  useEffect(() => {
    brushedNamesRef.current = brushedNames;
  }, [brushedNames]);

  useEffect(() => {
    if (!width || !pokemon.length) return undefined;

    const data = pokemon.filter((d) => d.hasUsageData && Number.isFinite(d.Total) && usageValue(d) > 0);
    const activeName = activeSlot === "second" ? comparisonName : selectedName;
    const selected = data.find((d) => d.Name === activeName);
    const labelNames = new Set([...COMPARISON_NAMES, selectedName, comparisonName].filter(Boolean));
    const labelled = data.filter((d) => labelNames.has(d.Name));
    const trend = linearRegression(data, (d) => d.Total, usageValue);
    const height = 380;
    const margin = { top: 42, right: 28, bottom: 58, left: 64 };
    const root = d3.select(containerRef.current);

    // D3 owns SVG drawing here: axes, annotations, brushing, and point interactions.
    root.selectAll("*").remove();

    const svg = root
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height);

    const x = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.Total))
      .nice()
      .range([margin.left, width - margin.right]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, usageValue) || 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // D3 owns the SVG contents for this chart; React only owns the container.
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(4));

    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat((d) => `${d}%`));

    svg
      .append("text")
      .attr("class", "axis-label")
      .attr("x", width / 2)
      .attr("y", height - 18)
      .attr("text-anchor", "middle")
      .text("Base stat total");

    svg
      .append("text")
      .attr("class", "axis-label")
      .attr("x", -height / 2)
      .attr("y", 20)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .text("Usage percent");

    svg
      .append("text")
      .attr("class", "chart-note")
      .attr("x", margin.left)
      .attr("y", 22)
      .text(`Weak stat/use relationship across usage-tracked Pokemon: r = ${formatCorrelation(STORY_STATS_USAGE_CORRELATION)}`);

    if (trend) {
      const [xMin, xMax] = x.domain();
      svg
        .append("line")
        .attr("class", "regression-line")
        .attr("x1", x(xMin))
        .attr("x2", x(xMax))
        .attr("y1", y(Math.max(0, trend.slope * xMin + trend.intercept)))
        .attr("y2", y(Math.max(0, trend.slope * xMax + trend.intercept)));
    }

    [
      { pokemon: data.find((d) => d.Name === selectedName), slot: "first" },
      { pokemon: data.find((d) => d.Name === comparisonName), slot: "second" },
    ]
      .filter((entry) => entry.pokemon)
      .forEach(({ pokemon: selection, slot }) => {
        svg
          .append("line")
          .attr("class", `selection-guide is-${slot}`)
          .attr("x1", x(selection.Total))
          .attr("x2", x(selection.Total))
          .attr("y1", y(0))
          .attr("y2", y(usageValue(selection)));

        svg
          .append("line")
          .attr("class", `selection-guide is-${slot}`)
          .attr("x1", margin.left)
          .attr("x2", x(selection.Total))
          .attr("y1", y(usageValue(selection)))
          .attr("y2", y(usageValue(selection)));
      });

    // Brush provides focus/context by selecting a subset for linked network highlighting.
    const brush = d3
      .brush()
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom],
      ])
      .on("start", (event) => {
        if (event.sourceEvent) {
          brushGestureChangedRef.current = false;
        }
      })
      .on("brush", (event) => {
        if (event.selection) {
          brushSelectionRef.current = event.selection.map((point) => [...point]);
        }
        if (event.sourceEvent) {
          brushGestureChangedRef.current = true;
        }
      })
      .on("end", (event) => {
        if (!event.selection) {
          brushSelectionRef.current = null;
          onBrushRef.current([]);
          return;
        }

        brushSelectionRef.current = event.selection.map((point) => [...point]);
        if (event.sourceEvent && brushGestureChangedRef.current) {
          suppressNextBrushClickRef.current = true;
        }
        const [[x0, y0], [x1, y1]] = event.selection;
        const names = data
          .filter((d) => {
            const cx = x(d.Total);
            const cy = y(usageValue(d));
            return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
          })
          .map((d) => d.Name);
        onBrushRef.current(names);
      });

    const brushLayer = svg.append("g").attr("class", "scatter-brush").call(brush);
    brushBehaviorRef.current = brush;
    brushLayerRef.current = brushLayer.node();
    if (brushedNamesRef.current.length && brushSelectionRef.current) {
      brushLayer.call(brush.move, brushSelectionRef.current);
    }

    brushLayer.on("click.pick-dot", (event) => {
      event.stopPropagation();
      if (suppressNextBrushClickRef.current) {
        suppressNextBrushClickRef.current = false;
        return;
      }

      const [px, py] = d3.pointer(event, svg.node());
      const nearest = d3.least(data, (d) => {
        const dx = px - x(d.Total);
        const dy = py - y(usageValue(d));
        return dx * dx + dy * dy;
      });
      if (nearest) {
        const threshold = nearest.Name === selectedName || nearest.Name === comparisonName ? 12 : 9;
        const dx = px - x(nearest.Total);
        const dy = py - y(usageValue(nearest));
        if (dx * dx + dy * dy <= threshold * threshold) {
          onSelect(nearest.Name === activeName ? null : nearest.Name);
          return;
        }
      }

      if (brushedNamesRef.current.length) {
        brushLayer.call(brush.move, null);
        return;
      }
      onSelect(null);
    });

    const dotPriority = (d) => {
      if (d.Name === activeName) return 3;
      if (d.Name === selectedName || d.Name === comparisonName) return 2;
      if (brushedNamesRef.current.includes(d.Name)) return 1;
      return 0;
    };

    const dots = svg
      .append("g")
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("class", (d) =>
        [
          "comparison-dot",
          COMPARISON_NAMES.includes(d.Name) ? "is-case-study" : "",
          d.Name === selectedName ? "is-first-selection" : "",
          d.Name === comparisonName ? "is-second-selection" : "",
          d.Name === activeName ? "is-active-selection" : "",
        ]
          .filter(Boolean)
          .join(" "),
      )
      .classed("is-brushed", (d) => brushedNamesRef.current.includes(d.Name))
      .attr("cx", (d) => x(d.Total))
      .attr("cy", (d) => y(usageValue(d)))
      .attr("r", (d) => {
        if (d.Name === selectedName || d.Name === comparisonName) return d.Name === activeName ? 9 : 8;
        return COMPARISON_NAMES.includes(d.Name) ? 6.8 : 4.2;
      })
      .attr("fill", (d) => typeColor(d.Type1))
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelect(d.Name === activeName ? null : d.Name);
      })
      .sort((a, b) => d3.ascending(dotPriority(a), dotPriority(b)));

    dots
      .append("title")
      .text((d) => `${d.Name}: ${formatNumber(d.Total)} total stats, ${formatPercent(usageValue(d))}% usage`);

    svg
      .append("g")
      .selectAll("text")
      .data(labelled)
      .join("text")
      .attr("class", (d) =>
        [
          "comparison-label",
          d.Name === selectedName ? "is-first-selection" : "",
          d.Name === comparisonName ? "is-second-selection" : "",
        ]
          .filter(Boolean)
          .join(" "),
      )
      .attr("x", (d) => comparisonLabelPlacement(x(d.Total), compactName(d.Name), margin.left, width - margin.right).x)
      .attr("y", (d) => y(usageValue(d)) - 10)
      .attr("text-anchor", (d) => comparisonLabelPlacement(x(d.Total), compactName(d.Name), margin.left, width - margin.right).anchor)
      .text((d) => compactName(d.Name));

    brushLayer.raise();

    svg.on("click", (event) => {
      if (event.target !== svg.node()) return;
      if (brushedNamesRef.current.length) {
        brushLayer.call(brush.move, null);
        return;
      }
      onSelect(null);
    });

    return () => root.selectAll("*").remove();
  }, [activeSlot, comparisonName, containerRef, onSelect, pokemon, selectedName, width]);

  useEffect(() => {
    const brushedSet = new Set(brushedNames);
    d3.select(containerRef.current)
      .selectAll(".comparison-dot")
      .classed("is-brushed", (d) => brushedSet.has(d.Name));

    if (!brushedNames.length && brushLayerRef.current && brushBehaviorRef.current) {
      brushSelectionRef.current = null;
      d3.select(brushLayerRef.current).call(brushBehaviorRef.current.move, null);
    }
  }, [brushedNames, containerRef]);

  return (
    <div className="comparison-stack">
      <div ref={containerRef} className="comparison-view" aria-label="Stat total and usage comparison" />
      <ComparisonLegend />
    </div>
  );
}

function ComparisonLegend() {
  return (
    <div className="encoding-legend" aria-label="Comparison chart legend">
      <span>
        <i className="legend-dot" style={{ "--legend-color": "#d85f3f" }} />
        Primary type color
      </span>
      <span>
        <i className="legend-dot legend-dot-large" style={{ "--legend-color": "#f2b56b" }} />
        Selected Pokemon
      </span>
      <span>
        <i className="legend-line legend-line-dashed" />
        Selected value guides
      </span>
      <span>
        <i className="legend-line legend-line-trend" />
        Overall trend
      </span>
    </div>
  );
}

function NetworkLegend() {
  return (
    <div className="encoding-legend network-legend" aria-label="Network legend">
      <span>
        <i className="legend-node-size" />
        Larger node = more usage
      </span>
      <span>
        <i className="legend-line legend-line-strong" />
        Thicker edge = stronger co-usage
      </span>
      <span>
        <i className="legend-dot" style={{ "--legend-color": "#4387c7" }} />
        Node color = primary type
      </span>
      <span>
        <i className="legend-ring" />
        Red outline = selected
      </span>
    </div>
  );
}

function NetworkRevealCallout({ selectedPokemon }) {
  if (!selectedPokemon) return null;

  const isIncineroar = selectedPokemon.Name === INCINEROAR_REVEAL_NAME;
  const isZamazenta = selectedPokemon.Name === "Zamazenta Crowned Shield";

  return (
    <aside className="network-reveal-callout" aria-label="Selected Pokemon network interpretation">
      <span>{isIncineroar ? "Contradiction case" : isZamazenta ? "Stat monster under pressure" : "Selected network state"}</span>
      {isIncineroar ? (
        <>
          <p>
            Incineroar has 530 base stats, but {formatPercent(usageValue(selectedPokemon))}% usage and one of the broadest
            teammate footprints in the format.
          </p>
          <strong>It connects to many successful teammates across different team styles, which helps explain why usage stays so high.</strong>
        </>
      ) : isZamazenta ? (
        <>
          <p>
            Zamazenta has elite raw stats, but it appears in a much smaller teammate ecosystem than the format's most-used
            anchors.
          </p>
          <strong>Its limited footprint helps explain why usage remains low even though the base stats are exceptional.</strong>
        </>
      ) : (
        <>
          <p>
            {selectedPokemon.Name} is strongest when it repeatedly appears beside teammates that support its role in winning
            team structures.
          </p>
          <strong>A broader teammate footprint usually supports higher usage than raw stats alone.</strong>
        </>
      )}
    </aside>
  );
}

function StoryCallouts({ items }) {
  return (
    <div className="story-callouts">
      {items.map((item) => (
        <article className="story-callout" key={item.title}>
          <span>{item.label}</span>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  );
}

function CorrelationScanChart({ rows }) {
  const [containerRef, width] = useElementWidth();

  useEffect(() => {
    if (!width || !rows.length) return undefined;

    const rowHeight = 42;
    const height = 74 + rows.length * rowHeight;
    const margin = { top: 40, right: width < 560 ? 48 : 90, bottom: 38, left: width < 560 ? 124 : 228 };
    const root = d3.select(containerRef.current);
    // D3 draws the signal scan so bar length, axis scale, and labels stay tightly coordinated.
    root.selectAll("*").remove();

    const svg = root
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height);

    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const y = d3
      .scaleBand()
      .domain(rows.map((d) => d.label))
      .range([margin.top, height - margin.bottom])
      .padding(0.28);

    svg
      .append("g")
      .attr("class", "axis correlation-axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickValues([0, 0.25, 0.5, 0.75, 1]).tickFormat((d) => d3.format(".2f")(d)));

    svg
      .append("text")
      .attr("class", "axis-label")
      .attr("x", (margin.left + width - margin.right) / 2)
      .attr("y", height - 3)
      .attr("text-anchor", "middle")
      .text("Absolute correlation with usage");

    const row = svg.append("g").selectAll("g").data(rows).join("g").attr("transform", (d) => `translate(0,${y(d.label)})`);

    row
      .append("line")
      .attr("class", "correlation-track")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", y.bandwidth() / 2)
      .attr("y2", y.bandwidth() / 2);

    row
      .append("rect")
      .attr("class", (d) => `correlation-bar${d.isWinner ? " is-winner" : ""}`)
      .attr("x", margin.left)
      .attr("y", y.bandwidth() / 2 - 5)
      .attr("rx", 5)
      .attr("width", 0)
      .attr("height", 10)
      .transition()
      .duration(620)
      .delay((d, index) => index * 45)
      .attr("width", (d) => Math.max(2, x(d.strength) - margin.left));

    row
      .append("circle")
      .attr("class", (d) => `correlation-dot${d.isWinner ? " is-winner" : ""}`)
      .attr("cx", (d) => x(d.strength))
      .attr("cy", y.bandwidth() / 2)
      .attr("r", (d) => (d.isWinner ? 8 : 5.5));

    row
      .append("text")
      .attr("class", (d) => `correlation-label${d.isWinner ? " is-winner" : ""}`)
      .attr("x", margin.left - 12)
      .attr("y", y.bandwidth() / 2 + 5)
      .attr("text-anchor", "end")
      .text((d) => {
        if (width >= 560) return d.label;
        if (d.id === "connectivity") return "Connectivity";
        if (d.id === "topPartner") return "Top partner";
        if (d.id === "offense") return "Offense";
        if (d.id === "stats") return "Stats total";
        if (d.id === "specialization") return "Specialization";
        if (d.id === "defensive") return "Bulk";
        return d.label;
      });

    row
      .append("text")
      .attr("class", (d) => `correlation-value${d.isWinner ? " is-winner" : ""}`)
      .attr("x", (d) => Math.min(width - 4, x(d.strength) + 13))
      .attr("y", y.bandwidth() / 2 + 5)
      .text((d) => `r = ${formatCorrelation(d.value)}`);

    svg
      .append("text")
      .attr("class", "chart-note")
      .attr("x", margin.left)
      .attr("y", 20)
      .text("What explains usage?");

    return () => root.selectAll("*").remove();
  }, [containerRef, rows, width]);

  return <div ref={containerRef} className="correlation-scan-chart" aria-label="Correlation scan chart" />;
}

function CorrelationScanLegend() {
  return (
    <div className="encoding-legend correlation-legend" aria-label="Correlation scan legend">
      <span>
        <i className="legend-line legend-line-correlation" />
        More length = stronger relationship
      </span>
      <span>
        <i className="legend-dot legend-dot-winner" />
        Strongest signal
      </span>
    </div>
  );
}

function ConnectivityBridge({ pokemon }) {
  const rows = useMemo(() => buildCorrelationScanRows(pokemon), [pokemon]);
  const winner = rows.find((row) => row.isWinner);
  const statsRow = rows.find((row) => row.id === "stats");
  const connectivityValue = winner?.value || STORY_CONNECTIVITY_USAGE_CORRELATION;
  const statsValue = statsRow?.value || STORY_STATS_USAGE_CORRELATION;
  const strengthRatio = connectivityValue / statsValue;
  const summaryMetrics = [
    {
      label: "Total stats",
      value: statsValue,
      note: "Weak signal",
      tone: "baseline",
    },
    {
      label: "Connectivity degree",
      value: connectivityValue,
      note: "Best signal",
      tone: "winner",
    },
  ];

  return (
    <section id="contradiction-bridge" className="connectivity-bridge" aria-labelledby="connectivity-bridge-title">
      <div className="bridge-copy">
        <p className="section-label">Signal scan</p>
        <h2 id="connectivity-bridge-title">Usage follows team connections more closely than raw stats.</h2>
        <p>
          If raw stats are not enough, what explains usage better? In this dataset, teammate connectivity is the
          strongest signal.
        </p>
        <div className="bridge-summary" aria-label="Correlation scan summary">
          {summaryMetrics.map((metric) => (
            <div
              className={`bridge-summary-card is-${metric.tone}`}
              key={metric.label}
              style={{ "--summary-width": `${Math.abs(metric.value) * 100}%` }}
            >
              <div className="bridge-summary-card-header">
                <span>{metric.label}</span>
                <em>{metric.note}</em>
              </div>
              <strong>r = {formatCorrelation(metric.value)}</strong>
              <i className="bridge-summary-meter" aria-hidden="true">
                <b />
              </i>
            </div>
          ))}
        </div>
        <aside className="correlation-interpretation" aria-label="Signal scan interpretation">
          <h3>What does this mean?</h3>
          <p>
            Teammate connectivity (r = {formatCorrelation(connectivityValue)}) is nearly {d3.format(".0f")(strengthRatio)} times
            stronger than total stats (r = {formatCorrelation(statsValue)}), so repeated teammate structure explains
            usage better than raw power alone.
          </p>
        </aside>
      </div>

      <div className="correlation-scan-panel">
        <CorrelationScanChart rows={rows} />
        <CorrelationScanLegend />
      </div>
    </section>
  );
}

function SelectionSlotButton({ slot, pokemon, isActive, onSelect }) {
  const slotClass = slot.toLowerCase();
  return (
    <button className={`${isActive ? "is-active" : ""} is-${slotClass}`} type="button" onClick={onSelect}>
      <span>{slot}</span>
      <strong>{pokemon?.Name || "Empty"}</strong>
    </button>
  );
}

function ComparisonSlotSelector({ selectedPokemon, comparisonPokemon, activeSlot, onActiveSlotChange }) {
  return (
    <div className="global-selection-slots" aria-label="Global comparison selections">
      <SelectionSlotButton
        slot="First"
        pokemon={selectedPokemon}
        isActive={activeSlot === "first"}
        onSelect={() => onActiveSlotChange("first")}
      />
      <SelectionSlotButton
        slot="Second"
        pokemon={comparisonPokemon}
        isActive={activeSlot === "second"}
        onSelect={() => onActiveSlotChange("second")}
      />
    </div>
  );
}

function NetworkGraph({ nodes, links, imageLookup, focusedName, selectedNames = {}, brushedNames, onNodeSelect, onBackgroundClick }) {
  const [containerRef, width] = useElementWidth();
  const graphLayerRef = useRef(null);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const simulationRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    onBackgroundClickRef.current = onBackgroundClick;
  }, [onBackgroundClick]);

  useEffect(() => {
    if (!width || !nodes.length) return undefined;

    if (simulationRef.current) simulationRef.current.stop();

    const height = Math.max(520, Math.min(640, width * 0.48));
    const root = d3.select(graphLayerRef.current);
    root.selectAll("*").remove();
    setTooltip(null);

    const svg = root
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height);

    const graphLinks = links.map((d) => ({ ...d, source: d.sourceName, target: d.targetName }));
    const graphNodes = nodes.map((d) => ({ ...d }));
    const radius = d3.scaleSqrt().domain([0, d3.max(graphNodes, usageValue) || 1]).range([6, 24]);
    const edgeWidth = d3.scaleLinear().domain(d3.extent(graphLinks, (d) => d.coUsagePercent)).range([0.8, 4.5]);

    // D3 force layout encodes repeated teammate structure as spatial proximity.
    const link = svg
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(graphLinks)
      .join("line")
      .attr("class", "link")
      .attr("stroke-width", (d) => edgeWidth(d.coUsagePercent))
      .attr("stroke-opacity", (d) => Math.min(0.55, 0.14 + d.coUsagePercent / 180));

    const nodeLayer = svg
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(graphNodes)
      .join("g")
      .attr("class", "node-group")
      .on("mouseenter", (event, d) => setTooltipFromEvent(event, d))
      .on("mousemove", (event, d) => setTooltipFromEvent(event, d))
      .on("mouseleave", () => setTooltip(null))
      .on("click", (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        onNodeSelectRef.current(d.Name);
      });

    const node = nodeLayer
      .append("circle")
      .attr("class", "node")
      .attr("r", (d) => radius(usageValue(d)))
      .attr("fill", (d) => typeColor(d.Type1))
      .attr("stroke-width", (d) => (CASE_STUDIES.includes(d.Name) ? 2.4 : 1.2));

    const nodeSprite = nodeLayer
      .append("image")
      .attr("class", "node-sprite")
      .attr("href", (d) => imageForPokemon(d.Name, imageLookup))
      .attr("width", (d) => Math.max(20, radius(usageValue(d)) * 1.7))
      .attr("height", (d) => Math.max(20, radius(usageValue(d)) * 1.7))
      .attr("pointer-events", "none")
      .attr("preserveAspectRatio", "xMidYMid meet");

    const nodeHit = nodeLayer
      .append("circle")
      .attr("class", "node-hit")
      .attr("r", (d) => Math.max(24, radius(usageValue(d)) * 1.65));

    const label = svg
      .append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(graphNodes)
      .join("text")
      .attr("class", (d) => `node-label${CASE_STUDIES.includes(d.Name) ? " is-visible" : ""}`)
      .text((d) => compactName(d.Name));

    const simulation = d3
      .forceSimulation(graphNodes)
      .force(
        "link",
        d3
          .forceLink(graphLinks)
          .id((d) => d.Name)
          .distance((d) => 136 - Math.min(54, d.coUsagePercent))
          .strength(0.36),
      )
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide((d) => radius(usageValue(d)) + 10))
      .force("x", d3.forceX(width / 2).strength(0.07))
      .force("y", d3.forceY(height / 2).strength(0.08))
      .on("tick", () => {
        graphNodes.forEach((d) => {
          d.x = Math.max(24, Math.min(width - 24, d.x));
          d.y = Math.max(24, Math.min(height - 24, d.y));
        });

        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        nodeHit.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        nodeSprite
          .attr("x", (d) => d.x - Math.max(20, radius(usageValue(d)) * 1.7) / 2)
          .attr("y", (d) => d.y - Math.max(20, radius(usageValue(d)) * 1.7) / 2);
        label.attr("x", (d) => d.x + radius(usageValue(d)) + 5).attr("y", (d) => d.y + 4);
      });

    nodeLayer.call(
      d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.25).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

    svg.on("click", () => onBackgroundClickRef.current());
    simulationRef.current = simulation;

    function setTooltipFromEvent(event, d) {
      const bounds = containerRef.current.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      setTooltip({
        d,
        x: Math.min(x + 18, bounds.width - 260),
        y: Math.max(y - 26, 12),
      });
    }

    return () => {
      // Stop the D3 simulation to avoid background timers after unmount.
      simulation.stop();
      root.selectAll("*").remove();
    };
  }, [containerRef, imageLookup, links, nodes, width]);

  useEffect(() => {
    const firstSelectedName = Array.isArray(selectedNames) ? selectedNames[0] : selectedNames.first;
    const secondSelectedName = Array.isArray(selectedNames) ? selectedNames[1] : selectedNames.second;
    const selectedSet = new Set([firstSelectedName, secondSelectedName].filter(Boolean));
    const focusedInGraph = focusedName && nodes.some((d) => d.Name === focusedName);
    const brushedSet = new Set(brushedNames);
    const hasBrush = brushedSet.size > 0;
    const connected = connectedNames(focusedInGraph ? focusedName : null, links);
    const strongestNeighborLabels = new Set();
    const strongestLinkKeys = new Set();
    if (focusedInGraph) {
      links
        .filter((d) => d.sourceName === focusedName || d.targetName === focusedName)
        .sort((a, b) => d3.descending(a.coUsagePercent, b.coUsagePercent))
        .slice(0, 8)
        .forEach((d, index) => {
          const neighbor = d.sourceName === focusedName ? d.targetName : d.sourceName;
          strongestNeighborLabels.add(neighbor);
          if (index < 5) strongestLinkKeys.add(`${d.sourceName}|${d.targetName}`);
        });
    }
    const root = d3.select(graphLayerRef.current);
    const edgeWidth = d3.scaleLinear().domain(d3.extent(links, (d) => d.coUsagePercent)).range([0.8, 4.5]);

    // Linked state is applied as classes so D3 rendering and React state stay separate.
    root
      .selectAll(".link")
      .classed(
        "is-muted",
        (d) =>
          (focusedInGraph &&
            d.sourceName !== focusedName &&
            d.targetName !== focusedName) ||
          (!focusedInGraph && hasBrush && !brushedSet.has(d.sourceName) && !brushedSet.has(d.targetName)),
      )
      .classed(
        "is-active",
        (d) =>
          (focusedInGraph && (d.sourceName === focusedName || d.targetName === focusedName)) ||
          (!focusedInGraph && hasBrush && (brushedSet.has(d.sourceName) || brushedSet.has(d.targetName))),
      )
      .classed("is-key-link", (d) => focusedInGraph && strongestLinkKeys.has(`${d.sourceName}|${d.targetName}`))
      .style("stroke-width", (d) => {
        const baseWidth = edgeWidth(d.coUsagePercent);
        if (focusedInGraph && strongestLinkKeys.has(`${d.sourceName}|${d.targetName}`)) return baseWidth + 2.2;
        if (focusedInGraph && (d.sourceName === focusedName || d.targetName === focusedName)) return baseWidth + 1.2;
        return baseWidth;
      });

    root.selectAll(".link.is-active").raise();

    root
      .selectAll(".node-group")
      .classed(
        "is-muted",
        (d) => (focusedInGraph && !connected.has(d.Name) && !selectedSet.has(d.Name)) || (!focusedInGraph && hasBrush && !brushedSet.has(d.Name)),
      )
      .classed("is-selected", (d) => selectedSet.has(d.Name))
      .classed("is-first-selection", (d) => d.Name === firstSelectedName)
      .classed("is-second-selection", (d) => d.Name === secondSelectedName)
      .classed("is-focused", (d) => d.Name === focusedName)
      .classed("is-neighbor", (d) => focusedInGraph && d.Name !== focusedName && connected.has(d.Name))
      .classed("is-brushed", (d) => !focusedInGraph && hasBrush && brushedSet.has(d.Name));

    root
      .selectAll(".node-label")
      .classed(
        "is-visible",
        (d) =>
          CASE_STUDIES.includes(d.Name) ||
          selectedSet.has(d.Name) ||
          (focusedInGraph && (d.Name === focusedName || strongestNeighborLabels.has(d.Name))) ||
          (!focusedInGraph && brushedSet.size <= 12 && brushedSet.has(d.Name)),
      )
      .classed("is-reveal-label", (d) => focusedInGraph && (d.Name === focusedName || strongestNeighborLabels.has(d.Name)));

  }, [brushedNames, containerRef, focusedName, links, nodes, selectedNames]);

  return (
    <div
      ref={containerRef}
      className="network-graph"
      role="img"
      aria-label="Force-directed Pokémon team synergy network"
    >
      <div ref={graphLayerRef} className="network-graph-layer" />
      {tooltip ? <NetworkTooltip pokemon={tooltip.d} imageLookup={imageLookup} x={tooltip.x} y={tooltip.y} /> : null}
    </div>
  );
}

function NetworkTooltip({ pokemon, imageLookup, x, y }) {
  return (
    <div className="tooltip" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <div className="tooltip-heading">
        <PokemonAvatar pokemon={pokemon} imageLookup={imageLookup} />
        <div>
          <strong>{pokemon.Name}</strong>
          <span>{typeLabel(pokemon)}</span>
        </div>
      </div>
      <dl>
        <dt>Total stats</dt>
        <dd>{formatNumber(pokemon.Total)}</dd>
        <dt>Usage</dt>
        <dd>{formatPercent(usageValue(pokemon))}%</dd>
        <dt>Partners</dt>
        <dd>{formatNumber(pokemon.degree)}</dd>
      </dl>
    </div>
  );
}

function PokemonAvatar({ pokemon, imageLookup }) {
  return (
    <span className="pokemon-avatar" style={{ "--type-color": typeColor(pokemon.Type1) }}>
      <span>{pokemon.Type1.slice(0, 3)}</span>
      <img
        src={imageForPokemon(pokemon.Name, imageLookup)}
        alt=""
        className={LOCAL_IMAGE_PATHS.has(pokemon.Name) ? "is-loaded" : ""}
        onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
        onError={(event) => event.currentTarget.remove()}
      />
    </span>
  );
}

function DetailPanel({ pokemon, builds, edges, imageLookup, allPokemon, selectionLabel = "Selected Pokémon" }) {
  const [activeTab, setActiveTab] = useState("evidence");

  useEffect(() => {
    setActiveTab("evidence");
  }, [pokemon?.Name]);

  if (!pokemon) {
    return (
      <aside className="detail-panel" aria-live="polite">
        <p className="section-label">{selectionLabel}</p>
        <h3>Choose a node</h3>
        <p className="panel-copy">Click a Pokémon in the network to see its team role, common partners, and build choices.</p>
      </aside>
    );
  }

  const moves = getBuildRows(builds, pokemon.Name, "move").slice(0, 4);
  const items = getBuildRows(builds, pokemon.Name, "item").slice(0, 1);
  const abilities = getBuildRows(builds, pokemon.Name, "ability").slice(0, 1);
  const teammates = getTopTeammates(edges, pokemon.Name);
  const evidenceRows = buildEvidenceRows({ moves, items, abilities, teammates });

  return (
    <aside className="detail-panel" aria-live="polite">
      <div className="pokemon-heading">
        <PokemonAvatar pokemon={pokemon} imageLookup={imageLookup} />
        <div>
          <p className="section-label">{selectionLabel}</p>
          <h3>{pokemon.Name}</h3>
          <div className="type-row">
            <span style={{ "--type-color": typeColor(pokemon.Type1) }}>{pokemon.Type1}</span>
            {pokemon.Type2 ? <span style={{ "--type-color": typeColor(pokemon.Type2) }}>{pokemon.Type2}</span> : null}
          </div>
        </div>
      </div>

      <dl className="metric-strip" aria-label="Selected Pokémon metrics">
        <div>
          <dt>Total stats</dt>
          <dd>{formatNumber(pokemon.Total)}</dd>
        </div>
        <div>
          <dt>Usage</dt>
          <dd>{formatPercent(usageValue(pokemon))}%</dd>
        </div>
        <div>
          <dt>Rank</dt>
          <dd>{Number.isFinite(pokemon.monthlyRank) ? formatNumber(pokemon.monthlyRank) : "N/A"}</dd>
        </div>
        <div>
          <dt>Partners</dt>
          <dd>{formatNumber(pokemon.degree)}</dd>
        </div>
        <div>
          <dt>Teammate footprint</dt>
          <dd>{formatWeighted(pokemon.weightedDegree)}</dd>
        </div>
      </dl>

      <div className="detail-tabs" role="tablist" aria-label="Selected Pokémon detail sections">
        {DETAIL_TABS.map((tab) => (
          <button
            aria-controls={`detail-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "is-active" : ""}
            id={`detail-tab-button-${tab.id}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "evidence" ? (
        <section
          aria-labelledby="detail-tab-button-evidence"
          className="detail-tab-panel is-evidence"
          id="detail-tab-evidence"
          role="tabpanel"
        >
          <section className="role-evidence">
            <h4>Competitive role evidence</h4>
            <p>{roleSummary(pokemon)}</p>
          </section>
          <EvidenceBarChart rows={evidenceRows} />
        </section>
      ) : null}

      {activeTab === "role" ? (
        <section aria-labelledby="detail-tab-button-role" className="detail-tab-panel" id="detail-tab-role" role="tabpanel">
          <RoleCausalityCard selectedPokemon={pokemon} abilities={abilities} moves={moves} items={items} teammates={teammates} />
        </section>
      ) : null}

      {activeTab === "team" ? (
        <section aria-labelledby="detail-tab-button-team" className="detail-tab-panel" id="detail-tab-team" role="tabpanel">
          <TeamEcosystemPanel selectedPokemon={pokemon} teammates={teammates} pokemon={allPokemon} edges={edges} />
        </section>
      ) : null}
    </aside>
  );
}

function EvidenceBarChart({ rows }) {
  const [containerRef, width] = useElementWidth();

  useEffect(() => {
    if (!width || !rows.length) return undefined;

    const rowHeight = 24;
    const margin = { top: 8, right: 42, bottom: 6, left: 76 };
    const height = margin.top + margin.bottom + rows.length * rowHeight;
    const root = d3.select(containerRef.current);
    root.selectAll("*").remove();

    const svg = root
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.value) || 1])
      .nice()
      .range([margin.left, width - margin.right]);
    const y = d3
      .scaleBand()
      .domain(rows.map((d) => d.label))
      .range([margin.top, height - margin.bottom])
      .padding(0.26);
    const kindColor = d3
      .scaleOrdinal()
      .domain(["Ability", "Item", "Move", "Partner"])
      .range(["#f2b56b", "#d282aa", "#6aaeb2", "#e25f4d"]);

    const row = svg.append("g").selectAll("g").data(rows).join("g").attr("transform", (d) => `translate(0,${y(d.label)})`);

    row
      .append("text")
      .attr("class", "evidence-kind")
      .attr("x", 0)
      .attr("y", y.bandwidth() / 2 + 4)
      .text((d) => d.kind);

    row
      .append("rect")
      .attr("class", "evidence-track")
      .attr("x", margin.left)
      .attr("width", width - margin.left - margin.right)
      .attr("height", y.bandwidth());

    row
      .append("rect")
      .attr("class", "evidence-bar")
      .attr("x", margin.left)
      .attr("width", 0)
      .attr("height", y.bandwidth())
      .attr("fill", (d) => kindColor(d.kind))
      .transition()
      .duration(520)
      .attr("width", (d) => Math.max(2, x(d.value) - margin.left));

    row
      .append("text")
      .attr("class", "evidence-label")
      .attr("x", margin.left + 7)
      .attr("y", y.bandwidth() / 2 + 4)
      .text((d) => shortEvidenceLabel(d.label))
      .append("title")
      .text((d) => d.label);

    row
      .append("text")
      .attr("class", "evidence-value")
      .attr("x", width - 2)
      .attr("y", y.bandwidth() / 2 + 4)
      .attr("text-anchor", "end")
      .text((d) => `${formatPercent(d.value)}%`);

    return () => root.selectAll("*").remove();
  }, [containerRef, rows, width]);

  if (!rows.length) return null;
  return (
    <section className="evidence-chart-section">
      <h4>Build and teammate signals</h4>
      <p className="evidence-chart-subtitle">Most common abilities, items, moves, and teammates associated with this Pokemon.</p>
      <p className="evidence-chart-note">Percentages show how frequently each signal appears in competitive team records.</p>
      <div ref={containerRef} className="evidence-chart" aria-label="Build and teammate evidence chart" />
    </section>
  );
}

export default function App() {
  const { data, error } = usePokemonData();
  // App owns shared story and selection state so scatterplot, network, comparison, picker, and detail stay synchronized.
  const [selectedName, setSelectedName] = useState("Incineroar");
  const [comparisonName, setComparisonName] = useState("Zacian Crowned Sword");
  const [activeComparisonSlot, setActiveComparisonSlot] = useState("second");
  const [networkFocusName, setNetworkFocusName] = useState("Incineroar");
  const [brushedNames, setBrushedNames] = useState([]);
  const [activeStep, setActiveStep] = useState("assumption");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerMode, setPickerMode] = useState("usage");
  const [activeMission, setActiveMission] = useState(null);
  const brushedKeyRef = useRef("");
  const storyStepLockRef = useRef(null);
  const storyVisibilityRef = useRef(new Map());

  const enrichedPokemon = useMemo(() => {
    if (!data) return [];
    return addNetworkMetrics(data.pokemon, data.edges);
  }, [data]);

  const subset = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return buildNetworkSubset(enrichedPokemon, data.edges);
  }, [data, enrichedPokemon]);

  const selectedPokemon = useMemo(
    () => enrichedPokemon.find((d) => d.Name === selectedName) || null,
    [enrichedPokemon, selectedName],
  );
  const brushedPokemon = useMemo(() => {
    if (!brushedNames.length) return [];
    const brushedSet = new Set(brushedNames);
    return enrichedPokemon.filter((pokemon) => brushedSet.has(pokemon.Name));
  }, [brushedNames, enrichedPokemon]);
  const scatterDatasetPokemon = useMemo(
    () => enrichedPokemon.filter((pokemon) => pokemon.hasUsageData && Number.isFinite(pokemon.Total) && usageValue(pokemon) > 0),
    [enrichedPokemon],
  );

  const comparisonPokemon = useMemo(
    () => {
      const directMatch = enrichedPokemon.find((d) => d.Name === comparisonName) || null;
      if (!selectedPokemon || directMatch?.Name !== selectedPokemon.Name) return directMatch;
      return (
        enrichedPokemon
          .filter((pokemon) => pokemon.Name !== selectedPokemon.Name && pokemon.hasUsageData && usageValue(pokemon) > 0)
          .sort((a, b) => d3.descending(usageValue(a), usageValue(b)))[0] ||
        enrichedPokemon.find((pokemon) => pokemon.Name !== selectedPokemon.Name) ||
        null
      );
    },
    [comparisonName, enrichedPokemon, selectedPokemon],
  );
  const selectionNames = useMemo(() => ({ first: selectedName, second: comparisonName }), [comparisonName, selectedName]);

  useEffect(() => {
    if (!selectedPokemon || !enrichedPokemon.length) return;
    const comparisonIsValid =
      comparisonName &&
      comparisonName !== selectedPokemon.Name &&
      enrichedPokemon.some((pokemon) => pokemon.Name === comparisonName);
    if (comparisonIsValid) return;

    const fallback =
      enrichedPokemon
        .filter((pokemon) => pokemon.Name !== selectedPokemon.Name && pokemon.hasUsageData && usageValue(pokemon) > 0)
        .sort((a, b) => d3.descending(usageValue(a), usageValue(b)))[0] ||
      enrichedPokemon.find((pokemon) => pokemon.Name !== selectedPokemon.Name);
    if (fallback) setComparisonName(fallback.Name);
  }, [comparisonName, enrichedPokemon, selectedPokemon]);

  const handleSelectName = useCallback(
    (name, options = {}) => {
      // Updates the selected Pokémon and keeps linked views aligned through the active comparison slot.
      const targetSlot = options.slot || activeComparisonSlot;
      const isInsideBrush = name && brushedNames.includes(name);

      if (targetSlot === "second") {
        setComparisonName(name);
      } else {
        setSelectedName(name);
      }

      if (brushedNames.length && !isInsideBrush) {
        setBrushedNames([]);
        brushedKeyRef.current = "";
      }

      setNetworkFocusName(name || null);
      setActiveMission(null);
      if (options.scrollToNetwork) {
        setActiveStep("reveal");
        window.requestAnimationFrame(() => {
          document.getElementById("network-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    [activeComparisonSlot, brushedNames],
  );

  const handleBrushNames = useCallback(
    (names) => {
      const nextKey = names.slice().sort().join("|");
      if (nextKey === brushedKeyRef.current) return;
      const wasBrushing = brushedKeyRef.current.length > 0;
      brushedKeyRef.current = nextKey;
      setBrushedNames(names);
      if (names.length) {
        // Brush is subset focus; click remains single-Pokémon detail selection.
        setActiveStep("contradiction");
        if (!wasBrushing) {
          setNetworkFocusName(null);
        }
      }
    },
    [],
  );

  const handleClearBrush = useCallback(() => {
    // Clearing the brush restores the full network context.
    brushedKeyRef.current = "";
    setBrushedNames([]);
    setNetworkFocusName(null);
  }, []);

  const handleNetworkNodeSelect = useCallback(
    (name) => {
      if (!name) return;
      // Network clicks update detail evidence and make the network the active story focus.
      setActiveStep("reveal");
      setActiveMission(null);
      setNetworkFocusName(name);

      if (activeComparisonSlot === "first") {
        setSelectedName(name);
        return;
      }

      setComparisonName(name);
    },
    [activeComparisonSlot],
  );

  const handleNetworkBackgroundClick = useCallback(() => {
    if (networkFocusName) {
      setNetworkFocusName(null);
      return;
    }
    if (brushedNames.length) {
      handleClearBrush();
    }
  }, [brushedNames.length, handleClearBrush, networkFocusName]);

  const handleComparisonSlotChange = useCallback(
    (slot) => {
      // The active slot controls whether future clicks edit the first or second Pokémon.
      setActiveComparisonSlot(slot);
      if (brushedNames.length) {
        setNetworkFocusName(null);
      } else {
        setNetworkFocusName(slot === "first" ? selectedName : comparisonName);
      }
    },
    [brushedNames.length, comparisonName, selectedName],
  );

  const handleStoryStep = useCallback((step) => {
    // Story step clicks reset exploratory state before scrolling to the guided section.
    setActiveStep(step.id);
    setSelectedName(step.selectedName || null);
    setBrushedNames([]);
    brushedKeyRef.current = "";
    setNetworkFocusName(step.selectedName || null);
    setActiveComparisonSlot("second");
    setActiveMission(null);
    storyStepLockRef.current = { id: step.id, targetId: step.targetId, minRatio: 0.2 };
    window.requestAnimationFrame(() => {
      document.getElementById(step.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleMissionSelect = useCallback((missionId) => {
    // Missions drive guided exploration examples without changing the underlying calculations.
    setActiveMission(missionId);
    setActiveStep("explore");
    setBrushedNames([]);
    brushedKeyRef.current = "";

    if (missionId === "another-incineroar") {
      setPickerQuery("");
      setPickerMode("usage");
      setSelectedName("Amoonguss");
      setNetworkFocusName("Amoonguss");
      setActiveComparisonSlot("second");
      return;
    }

    if (missionId === "failed-stat-monster") {
      setPickerQuery("");
      setPickerMode("stats");
      setSelectedName("Zamazenta Crowned Shield");
      setNetworkFocusName("Zamazenta Crowned Shield");
      setActiveComparisonSlot("second");
      return;
    }

    if (missionId === "support-vs-attacker") {
      setPickerQuery("");
      setPickerMode("usage");
      setSelectedName("Incineroar");
      setComparisonName("Zacian Crowned Sword");
      setNetworkFocusName("Incineroar");
      setActiveComparisonSlot("second");
      return;
    }

    setPickerQuery("");
    setPickerMode("usage");
    window.requestAnimationFrame(() => {
      document.querySelector(".picker-mode-row button.is-active")?.focus();
      document.querySelector(".pokemon-picker-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (!data) return undefined;
    let frameId = 0;

    // Scroll position maps the page to Martini Glass stages for the sticky story navigation.
    const resolveActiveStep = () => {
      const lockedStep = storyStepLockRef.current;
      if (lockedStep) {
        const lockedTarget = document.getElementById(lockedStep.targetId);
        if (lockedTarget && lockedTarget.getBoundingClientRect().top > window.innerHeight * 0.2) {
          setActiveStep((current) => (current === lockedStep.id ? current : lockedStep.id));
          return;
        }
        storyStepLockRef.current = null;
      }

      const activationOffset = 120;
      const exploreActivationOffset = window.innerHeight * 0.4;
      const contradictionTop = document.getElementById("contradiction-section")?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const bridgeTop = document.getElementById("contradiction-bridge")?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const revealTop = document.getElementById("reveal-section")?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const exploreTop = document.getElementById("explore-section")?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;

      let nextStep = "assumption";
      if (exploreTop <= exploreActivationOffset) {
        nextStep = "explore";
      } else if (revealTop <= activationOffset) {
        nextStep = "reveal";
      } else if (contradictionTop <= activationOffset || bridgeTop <= activationOffset) {
        nextStep = "contradiction";
      }

      setActiveStep((current) => (current === nextStep ? current : nextStep));
    };

    const scheduleResolve = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        resolveActiveStep();
      });
    };

    resolveActiveStep();
    window.addEventListener("scroll", scheduleResolve, { passive: true });
    window.addEventListener("resize", scheduleResolve);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleResolve);
      window.removeEventListener("resize", scheduleResolve);
      storyVisibilityRef.current.clear();
    };
  }, [data]);

  if (error) {
    return (
      <main className="story-shell">
        <p className="load-error">Could not load the processed Pokémon data. {error.message}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="story-shell">
        <p className="load-error">Loading processed Pokémon data...</p>
      </main>
    );
  }

  const detailPokemon = activeComparisonSlot === "second" ? comparisonPokemon : selectedPokemon;
  const detailSelectionLabel = activeComparisonSlot === "second" ? "Second selection" : "First selection";

  return (
    <main className="story-shell">
      <HeroSection
        pokemon={enrichedPokemon}
        edges={data.edges}
        builds={data.builds}
        imageLookup={data.imageLookup}
        onSelect={handleSelectName}
      />

      <StoryNav activeStep={activeStep} onStep={handleStoryStep} />

      <section id="contradiction-section" className="guided-section" aria-labelledby="guided-title">
        <div className="section-copy">
          <p className="section-label">Stat total vs. usage</p>
          <h2 id="guided-title">High stats do not guarantee high usage.</h2>
          <p>
            If stronger Pokémon were always used more, the highest stats would cluster at the top. Instead, the
            relationship is weak: Zacian fits the assumption, Zamazenta challenges it, and Incineroar breaks it.
          </p>
          <StoryCallouts
            items={[
              {
                label: "01",
                title: "Stat total is a weak predictor",
                body: "The trend line is shallow, so high base stats alone do not explain which Pokémon dominate usage.",
              },
              {
                label: "02",
                title: "Incineroar carries team value",
                body: "Its stat total is modest next to restricted legends, but its usage stays near the top because it fits many teams.",
              },
            ]}
          />
        </div>
        <div className="comparison-column">
          <ComparisonChart
            pokemon={enrichedPokemon}
            selectedName={selectedName}
            comparisonName={comparisonName}
            activeSlot={activeComparisonSlot}
            brushedNames={brushedNames}
            onSelect={handleSelectName}
            onBrush={handleBrushNames}
          />
          <BrushedSubsetSummary
            brushedPokemon={brushedPokemon}
            datasetPokemon={scatterDatasetPokemon}
            onClearBrush={handleClearBrush}
          />
        </div>
      </section>

      <ConnectivityBridge pokemon={enrichedPokemon} />

      <section id="reveal-section" className="network-section" aria-labelledby="network-title">
        <div className="network-intro">
          <div>
            <p className="section-label">Team synergy network</p>
            <h2 id="network-title">Competitive success emerges from synergy.</h2>
          </div>
        </div>
        <StoryCallouts
          items={[
              {
                label: "03",
                title: "Incineroar breaks the simple stats story",
                body: "The default selection starts with the contradiction case: moderate stats, high usage, and an unusually broad teammate footprint.",
              },
              {
                label: "04",
                title: "Team fit explains usage",
                body: "The strongest competitive Pokémon are not just powerful. They also sit inside larger, repeated teammate structures.",
              },
          ]}
        />
        <aside className="network-intro-explanation" aria-label="Why look at a network">
          <h3>Why look at a network?</h3>
          <p>
            If team fit explains usage better than raw stats, important Pokémon should appear inside larger and more
            repeated teammate ecosystems.
          </p>
          <small>
            Larger nodes are used more often. Thicker edges show stronger teammate co-usage.
          </small>
        </aside>

        <div className="network-layout">
          <div className="network-panel">
            <NetworkRevealCallout selectedPokemon={selectedPokemon} />
            <NetworkLegend />
            <NetworkGraph
              nodes={subset.nodes}
              links={subset.links}
              imageLookup={data.imageLookup}
              focusedName={networkFocusName}
              selectedNames={selectionNames}
              brushedNames={brushedNames}
              onNodeSelect={handleNetworkNodeSelect}
              onBackgroundClick={handleNetworkBackgroundClick}
            />
          </div>
          <ComparisonSlotSelector
            selectedPokemon={selectedPokemon}
            comparisonPokemon={comparisonPokemon}
            activeSlot={activeComparisonSlot}
            onActiveSlotChange={handleComparisonSlotChange}
          />
          <EgoNetworkComparisonView
            selectedPokemon={selectedPokemon}
            comparisonPokemon={comparisonPokemon}
            pokemon={enrichedPokemon}
            edges={data.edges}
          />
          <section className={`detail-selection-section is-${activeComparisonSlot}`} aria-label="Selected Pokémon details">
            <DetailPanel
              pokemon={detailPokemon}
              builds={data.builds}
              edges={data.edges}
              imageLookup={data.imageLookup}
              allPokemon={enrichedPokemon}
              selectionLabel={detailSelectionLabel}
            />
          </section>
        </div>
      </section>

      <section id="explore-section" className="exploration-prompt" aria-labelledby="exploration-title">
        <p className="section-label">Reader task</p>
        <h2 id="exploration-title">Find the high-value connectors.</h2>
        <p>
          Use the missions and rankings below to test whether team connectivity explains usage better than raw stats.
        </p>
        <ExplorationMissions activeMission={activeMission} onMissionSelect={handleMissionSelect} />
        <MissionInsightCard activeMission={activeMission} pokemon={enrichedPokemon} />
        <PokemonPicker
          pokemon={enrichedPokemon}
          imageLookup={data.imageLookup}
          selectedPokemon={detailPokemon}
          selectedName={selectedName}
          comparisonName={comparisonName}
          activeSlot={activeComparisonSlot}
          query={pickerQuery}
          mode={pickerMode}
          onQueryChange={setPickerQuery}
          onModeChange={setPickerMode}
          onSelect={(name) => handleSelectName(name, { scrollToNetwork: true })}
        />
        <p className="exploration-limitation-note">
          Usage and teammate co-occurrence are observational signals and do not prove direct causal battle outcomes.
        </p>
      </section>
    </main>
  );
}
