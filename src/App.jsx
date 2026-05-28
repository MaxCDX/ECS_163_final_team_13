import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const DATA_PATHS = {
  pokemon: "/data/processed/pokemon_clean.csv",
  edges: "/data/processed/team_edges_clean.csv",
  builds: "/data/processed/build_usage_clean.csv",
  images: "/data/processed/image_lookup.csv",
};

const CASE_STUDIES = [
  "Incineroar",
  "Zacian Crowned Sword",
  "Kyogre",
  "Grimmsnarl",
  "Amoonguss",
  "Rillaboom",
  "Zamazenta Crowned Shield",
  "Mewtwo",
];

const COMPARISON_NAMES = ["Zacian Crowned Sword", "Zamazenta Crowned Shield", "Incineroar"];

const PICKER_MODES = [
  { id: "usage", label: "Usage", metricLabel: "Usage" },
  { id: "stats", label: "Stats", metricLabel: "Base stats" },
  { id: "synergy", label: "Synergy", metricLabel: "Synergy weight" },
];
const LOCAL_IMAGE_PATHS = new Map([
  ["Incineroar", "/assets/pokemon/incineroar.png"],
  ["Zacian Crowned Sword", "/assets/pokemon/zacian-crowned-sword.png"],
  ["Kyogre", "/assets/pokemon/kyogre.png"],
  ["Grimmsnarl", "/assets/pokemon/grimmsnarl.png"],
  ["Amoonguss", "/assets/pokemon/amoonguss.png"],
  ["Rillaboom", "/assets/pokemon/rillaboom.png"],
]);

const TYPE_COLORS = new Map([
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

const formatPercent = d3.format(".0f");
const formatNumber = d3.format(",");
const formatWeighted = d3.format(",.0f");
const formatCorrelation = d3.format(".2f");

// Report/story metric calculated from data/processed/pokemon_clean.csv.
const STORY_STATS_USAGE_CORRELATION = 0.194;
const STORY_CONNECTIVITY_USAGE_CORRELATION = 0.903;
const INCINEROAR_REVEAL_NAME = "Incineroar";
const STORY_STEPS = [
  {
    id: "assumption",
    label: "Assumption",
    title: "Raw power looks like the answer.",
    targetId: "hero-title",
  },
  {
    id: "contradiction",
    label: "Contradiction",
    title: "High stats do not guarantee usage.",
    targetId: "guided-title",
    selectedName: "Zamazenta Crowned Shield",
  },
  {
    id: "reveal",
    label: "Network reveal",
    title: "Team context explains the gap.",
    targetId: "network-title",
    selectedName: INCINEROAR_REVEAL_NAME,
  },
  {
    id: "explore",
    label: "Explore",
    title: "Test the pattern yourself.",
    targetId: "exploration-title",
  },
];

function typeColor(type) {
  return TYPE_COLORS.get(type) || "#8b949e";
}

function typeLabel(d) {
  return d?.Type2 ? `${d.Type1} / ${d.Type2}` : d?.Type1 || "Unknown";
}

function usageValue(d) {
  return Number.isFinite(d?.usagePercent) ? d.usagePercent : 0;
}

function compactName(name) {
  return name.replace(" Crowned Sword", "").replace(" Crowned Shield", "");
}

function imageForPokemon(name, imageLookup) {
  return LOCAL_IMAGE_PATHS.get(name) || imageLookup.get(name) || "";
}

function parsePokemon(row) {
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
  return {
    source: row.source,
    target: row.target,
    coUsagePercent: +row.co_usage_percent,
    sourceUsagePercent: +row.source_usage_percent || 0,
    targetUsagePercent: +row.target_usage_percent || 0,
  };
}

function parseBuild(row) {
  return {
    pokemon: row.pokemon,
    category: row.category,
    name: row.name,
    usagePercent: +row.usage_percent,
  };
}

function parseImage(row) {
  return {
    pokemon: row.pokemon,
    imagePathOrUrl: row.image_path_or_url,
  };
}

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

function addNetworkMetrics(pokemon, edges) {
  const metrics = new Map(pokemon.map((d) => [d.Name, { degree: 0, weightedDegree: 0 }]));

  for (const edge of edges) {
    const source = metrics.get(edge.source);
    const target = metrics.get(edge.target);
    if (!source || !target) continue;
    source.degree += 1;
    target.degree += 1;
    source.weightedDegree += edge.coUsagePercent;
    target.weightedDegree += edge.coUsagePercent;
  }

  return pokemon.map((d) => {
    const metric = metrics.get(d.Name) || { degree: 0, weightedDegree: 0 };
    return { ...d, degree: metric.degree, weightedDegree: metric.weightedDegree };
  });
}

function buildNetworkSubset(pokemon, edges) {
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
  for (const edge of selectedEdges.slice(0, 115)) {
    keep.set(`${edge.source}|${edge.target}`, edge);
  }

  for (const caseName of CASE_STUDIES) {
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

function connectedNames(selectedName, links) {
  if (!selectedName) return new Set();
  const connected = new Set([selectedName]);
  for (const edge of links) {
    if (edge.sourceName === selectedName) connected.add(edge.targetName);
    if (edge.targetName === selectedName) connected.add(edge.sourceName);
  }
  return connected;
}

function getBuildRows(builds, name, category) {
  return builds
    .filter((row) => row.pokemon === name && row.category === category)
    .sort((a, b) => d3.descending(a.usagePercent, b.usagePercent));
}

function getTopTeammates(edges, name) {
  return edges
    .filter((edge) => edge.source === name || edge.target === name)
    .map((edge) => ({
      name: edge.source === name ? edge.target : edge.source,
      percent: edge.coUsagePercent,
    }))
    .sort((a, b) => d3.descending(a.percent, b.percent))
    .slice(0, 5);
}

function pearsonCorrelation(data, getX, getY) {
  if (data.length < 2) return 0;

  const xMean = d3.mean(data, getX);
  const yMean = d3.mean(data, getY);
  let numerator = 0;
  let xTotal = 0;
  let yTotal = 0;

  for (const d of data) {
    const xDelta = getX(d) - xMean;
    const yDelta = getY(d) - yMean;
    numerator += xDelta * yDelta;
    xTotal += xDelta * xDelta;
    yTotal += yDelta * yDelta;
  }

  return numerator / Math.sqrt(xTotal * yTotal);
}

function rankedPickerOptions(pokemon, query, mode) {
  const searchText = query.trim().toLowerCase();
  const hasSearch = searchText.length > 0;
  const matchingPokemon = hasSearch ? pokemon.filter((d) => d.Name.toLowerCase().includes(searchText)) : pokemon;

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

function pickerMetric(pokemon, mode) {
  if (mode === "stats") return formatNumber(pokemon.Total);
  if (mode === "synergy") return formatWeighted(pokemon.weightedDegree);
  return `${formatPercent(usageValue(pokemon))}%`;
}

function linearRegression(data, getX, getY) {
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

function usePokemonData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;

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

function ComparisonChart({ pokemon, selectedName, brushedNames, onSelect, onBrush }) {
  const [containerRef, width] = useElementWidth();
  const onBrushRef = useRef(onBrush);

  useEffect(() => {
    onBrushRef.current = onBrush;
  }, [onBrush]);

  useEffect(() => {
    if (!width || !pokemon.length) return undefined;

    const data = pokemon.filter((d) => d.hasUsageData && Number.isFinite(d.Total) && usageValue(d) > 0);
    const selected = data.find((d) => d.Name === selectedName);
    const labelNames = new Set([...COMPARISON_NAMES, selectedName].filter(Boolean));
    const labelled = data.filter((d) => labelNames.has(d.Name));
    const trend = linearRegression(data, (d) => d.Total, usageValue);
    const height = 380;
    const margin = { top: 42, right: 28, bottom: 58, left: 64 };
    const root = d3.select(containerRef.current);

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

    if (selected) {
      svg
        .append("line")
        .attr("class", "selection-guide")
        .attr("x1", x(selected.Total))
        .attr("x2", x(selected.Total))
        .attr("y1", y(0))
        .attr("y2", y(usageValue(selected)));

      svg
        .append("line")
        .attr("class", "selection-guide")
        .attr("x1", margin.left)
        .attr("x2", x(selected.Total))
        .attr("y1", y(usageValue(selected)))
        .attr("y2", y(usageValue(selected)));
    }

    const brush = d3
      .brush()
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom],
      ])
      .on("brush end", (event) => {
        if (!event.selection) {
          onBrushRef.current([]);
          return;
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

    svg.append("g").attr("class", "scatter-brush").call(brush);

    svg
      .append("g")
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("class", (d) =>
        [
          "comparison-dot",
          COMPARISON_NAMES.includes(d.Name) ? "is-case-study" : "",
          d.Name === selectedName ? "is-selected" : "",
        ]
          .filter(Boolean)
          .join(" "),
      )
      .attr("cx", (d) => x(d.Total))
      .attr("cy", (d) => y(usageValue(d)))
      .attr("r", (d) => {
        if (d.Name === selectedName) return 8.5;
        return COMPARISON_NAMES.includes(d.Name) ? 6.8 : 4.2;
      })
      .attr("fill", (d) => typeColor(d.Type1))
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelect(d.Name === selectedName ? null : d.Name);
      })
      .append("title")
      .text((d) => `${d.Name}: ${formatNumber(d.Total)} total stats, ${formatPercent(usageValue(d))}% usage`);

    svg
      .append("g")
      .selectAll("text")
      .data(labelled)
      .join("text")
      .attr("class", (d) => `comparison-label${d.Name === selectedName ? " is-selected" : ""}`)
      .attr("x", (d) => x(d.Total) + 12)
      .attr("y", (d) => y(usageValue(d)) - 10)
      .text((d) => compactName(d.Name));

    svg.on("click", () => onSelect(null));

    return () => root.selectAll("*").remove();
  }, [containerRef, onSelect, pokemon, selectedName, width]);

  useEffect(() => {
    const brushedSet = new Set(brushedNames);
    d3.select(containerRef.current)
      .selectAll(".comparison-dot")
      .classed("is-brushed", (d) => brushedSet.has(d.Name));
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
  const isIncineroar = selectedPokemon?.Name === INCINEROAR_REVEAL_NAME;

  if (!isIncineroar) return null;

  return (
    <aside className="network-reveal-callout" aria-label="Incineroar narrative reveal">
      <span>Contradiction case</span>
      <p>
        Incineroar has 530 base stats, but {formatPercent(usageValue(selectedPokemon))}% usage and one of the strongest
        teammate footprints in the format.
      </p>
      <strong>Its links reveal support value: Intimidate, Fake Out, Parting Shot, and repeated team fit.</strong>
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

function StoryStepper({ activeStep, onStep }) {
  return (
    <nav className="story-stepper" aria-label="Guided story stages">
      {STORY_STEPS.map((step, index) => (
        <button
          className={step.id === activeStep ? "is-active" : ""}
          key={step.id}
          type="button"
          onClick={() => onStep(step)}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{step.label}</strong>
          <small>{step.title}</small>
        </button>
      ))}
    </nav>
  );
}

function ConnectivityBridge() {
  const metrics = [
    {
      label: "Total stats vs usage",
      value: STORY_STATS_USAGE_CORRELATION,
      display: "0.19",
      strength: "Weak relationship",
      body: "Raw power is part of the story, but it does not explain usage on its own.",
      tone: "weak",
    },
    {
      label: "Team connectivity degree vs usage",
      value: STORY_CONNECTIVITY_USAGE_CORRELATION,
      display: "0.903",
      strength: "Strong relationship",
      body: "Pokémon with more team connections tend to appear in usage much more consistently.",
      tone: "strong",
    },
  ];

  return (
    <section className="connectivity-bridge" aria-labelledby="connectivity-bridge-title">
      <div className="bridge-copy">
        <p className="section-label">Why move to the network?</p>
        <h2 id="connectivity-bridge-title">Usage follows team connection more closely than raw stats.</h2>
        <p>
          If raw stats do not explain usage very well, the next question is relational: which Pokémon keep appearing
          with strong teammates?
        </p>
      </div>

      <div className="bridge-metrics" aria-label="Correlation comparison">
        {metrics.map((metric) => (
          <article className={`bridge-metric is-${metric.tone}`} key={metric.label}>
            <div className="bridge-metric-header">
              <span>{metric.label}</span>
              <strong>r = {metric.display}</strong>
            </div>
            <div className="bridge-meter" aria-hidden="true">
              <span className="bridge-meter-fill" style={{ "--metric-width": `${metric.value * 100}%` }} />
            </div>
            <h3>{metric.strength}</h3>
            <p>{metric.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PokemonPicker({ pokemon, imageLookup, selectedPokemon, selectedName, onSelect }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("usage");
  const modeInfo = PICKER_MODES.find((item) => item.id === mode) || PICKER_MODES[0];
  const options = useMemo(() => rankedPickerOptions(pokemon, query, mode), [mode, pokemon, query]);

  return (
    <section className="pokemon-picker-section" aria-labelledby="pokemon-picker-title">
      <div className="picker-copy">
        <p className="section-label">Pick a focus</p>
        <h2 id="pokemon-picker-title">Choose a Pokémon to examine.</h2>
        <p>
          Search directly, or use the ranked shortcuts to test whether usage, raw stats, and team synergy point to the
          same names.
        </p>
      </div>

      <div className="pokemon-picker">
        <div className="picker-current">
          {selectedPokemon ? (
            <img src={imageLookup.get(selectedPokemon.Name) || ""} alt="" />
          ) : (
            <div className="picker-image-placeholder" />
          )}
          <div>
            <span>Current focus</span>
            <strong>{selectedPokemon?.Name || "None selected"}</strong>
            <small>{selectedPokemon ? typeLabel(selectedPokemon) : "Choose a search result or ranked option"}</small>
          </div>
        </div>

        <label className="picker-search">
          <span>Search by name</span>
          <input
            type="search"
            value={query}
            placeholder="Try Incineroar, Kyogre, Mewtwo..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="picker-mode-row" aria-label="Rank suggestions by">
          {PICKER_MODES.map((item) => (
            <button
              className={item.id === mode ? "is-active" : ""}
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="picker-results" aria-label={query ? "Search results" : `${modeInfo.label} ranked suggestions`}>
          {options.length ? (
            options.map((item, index) => (
              <button
                className={item.Name === selectedName ? "is-selected" : ""}
                key={item.Name}
                type="button"
                onClick={() => onSelect(item.Name)}
              >
                <span className="picker-rank">{query ? "Result" : `#${index + 1}`}</span>
                <img src={imageLookup.get(item.Name) || ""} alt="" />
                <span className="picker-name">
                  <strong>{item.Name}</strong>
                  <small>{typeLabel(item)}</small>
                </span>
                <span className="picker-metric">
                  <strong>{pickerMetric(item, mode)}</strong>
                  <small>{modeInfo.metricLabel}</small>
                </span>
              </button>
            ))
          ) : (
            <p className="picker-empty">No Pokémon match that search.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function HeroRoster({ pokemon, imageLookup, selectedName, onSelect }) {
  const featured = CASE_STUDIES.map((name) => pokemon.find((d) => d.Name === name)).filter(Boolean).slice(0, 6);

  return (
    <aside className="hero-roster" aria-label="Featured Pokémon in the network">
      <div className="hero-roster-header">
        <span>{featured.length}</span>
        <p>case-study Pokémon</p>
      </div>
      <div className="hero-sprite-grid">
        {featured.map((d) => (
          <button
            className={d.Name === selectedName ? "is-selected" : ""}
            key={d.Name}
            style={{ "--type-color": typeColor(d.Type1) }}
            type="button"
            onClick={() => onSelect(d.Name, { scrollToNetwork: true })}
          >
            <span className="hero-type-mark">{d.Type1.slice(0, 3)}</span>
            <img
              src={imageForPokemon(d.Name, imageLookup)}
              alt=""
              className={LOCAL_IMAGE_PATHS.has(d.Name) ? "is-loaded" : ""}
              onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
              onError={(event) => event.currentTarget.remove()}
            />
            <span className="hero-card-name">{compactName(d.Name)}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function NetworkGraph({ nodes, links, imageLookup, selectedName, brushedNames, onSelect }) {
  const [containerRef, width] = useElementWidth();
  const selectedNameRef = useRef(selectedName);
  const simulationRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    selectedNameRef.current = selectedName;
  }, [selectedName]);

  useEffect(() => {
    if (!width || !nodes.length) return undefined;

    if (simulationRef.current) simulationRef.current.stop();

    const height = Math.max(560, Math.min(720, width * 0.72));
    const root = d3.select(containerRef.current);
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
        onSelect(d.Name === selectedNameRef.current ? null : d.Name);
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
          .distance((d) => 142 - Math.min(72, d.coUsagePercent))
          .strength(0.42),
      )
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide((d) => radius(usageValue(d)) + 10))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.06))
      .on("tick", () => {
        graphNodes.forEach((d) => {
          d.x = Math.max(34, Math.min(width - 34, d.x));
          d.y = Math.max(34, Math.min(height - 34, d.y));
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

    svg.on("click", () => onSelect(null));
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
      simulation.stop();
      root.selectAll("*").remove();
    };
  }, [containerRef, imageLookup, links, nodes, onSelect, width]);

  useEffect(() => {
    const selectedInGraph = selectedName && nodes.some((d) => d.Name === selectedName);
    const brushedSet = new Set(brushedNames);
    const hasBrush = brushedSet.size > 0;
    const connected = connectedNames(selectedInGraph ? selectedName : null, links);
    const strongestNeighborLabels = new Set();
    const strongestLinkKeys = new Set();
    if (selectedInGraph) {
      links
        .filter((d) => d.sourceName === selectedName || d.targetName === selectedName)
        .sort((a, b) => d3.descending(a.coUsagePercent, b.coUsagePercent))
        .slice(0, 8)
        .forEach((d, index) => {
          const neighbor = d.sourceName === selectedName ? d.targetName : d.sourceName;
          strongestNeighborLabels.add(neighbor);
          if (index < 5) strongestLinkKeys.add(`${d.sourceName}|${d.targetName}`);
        });
    }
    const root = d3.select(containerRef.current);
    const edgeWidth = d3.scaleLinear().domain(d3.extent(links, (d) => d.coUsagePercent)).range([0.8, 4.5]);

    root
      .selectAll(".link")
      .classed(
        "is-muted",
        (d) =>
          (selectedInGraph && d.sourceName !== selectedName && d.targetName !== selectedName) ||
          (!selectedInGraph && hasBrush && !brushedSet.has(d.sourceName) && !brushedSet.has(d.targetName)),
      )
      .classed(
        "is-active",
        (d) =>
          (selectedInGraph && (d.sourceName === selectedName || d.targetName === selectedName)) ||
          (!selectedInGraph && hasBrush && (brushedSet.has(d.sourceName) || brushedSet.has(d.targetName))),
      )
      .classed("is-key-link", (d) => selectedInGraph && strongestLinkKeys.has(`${d.sourceName}|${d.targetName}`))
      .style("stroke-width", (d) => {
        const baseWidth = edgeWidth(d.coUsagePercent);
        if (selectedInGraph && strongestLinkKeys.has(`${d.sourceName}|${d.targetName}`)) return baseWidth + 2.2;
        if (selectedInGraph && (d.sourceName === selectedName || d.targetName === selectedName)) return baseWidth + 1.2;
        return baseWidth;
      });

    root.selectAll(".link.is-active").raise();

    root
      .selectAll(".node-group")
      .classed("is-muted", (d) => (selectedInGraph && !connected.has(d.Name)) || (!selectedInGraph && hasBrush && !brushedSet.has(d.Name)))
      .classed("is-selected", (d) => d.Name === selectedName)
      .classed("is-neighbor", (d) => selectedInGraph && d.Name !== selectedName && connected.has(d.Name))
      .classed("is-brushed", (d) => !selectedInGraph && hasBrush && brushedSet.has(d.Name));

    root
      .selectAll(".node-label")
      .classed(
        "is-visible",
        (d) =>
          CASE_STUDIES.includes(d.Name) ||
          (selectedInGraph && (d.Name === selectedName || strongestNeighborLabels.has(d.Name))) ||
          (!selectedInGraph && brushedSet.size <= 12 && brushedSet.has(d.Name)),
      )
      .classed("is-reveal-label", (d) => selectedInGraph && (d.Name === selectedName || strongestNeighborLabels.has(d.Name)));
  }, [brushedNames, containerRef, links, nodes, selectedName]);

  return (
    <div
      ref={containerRef}
      className="network-graph"
      role="img"
      aria-label="Force-directed Pokémon team synergy network"
    >
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

function DetailPanel({ pokemon, builds, edges, imageLookup }) {
  if (!pokemon) {
    return (
      <aside className="detail-panel" aria-live="polite">
        <p className="section-label">Selected Pokémon</p>
        <h3>Choose a node</h3>
        <p className="panel-copy">Click a Pokémon in the network to see its team role, common partners, and build choices.</p>
      </aside>
    );
  }

  const moves = getBuildRows(builds, pokemon.Name, "move").slice(0, 4);
  const items = getBuildRows(builds, pokemon.Name, "item").slice(0, 1);
  const abilities = getBuildRows(builds, pokemon.Name, "ability").slice(0, 1);
  const teammates = getTopTeammates(edges, pokemon.Name);
  const isIncineroar = pokemon.Name === INCINEROAR_REVEAL_NAME;

  return (
    <aside className="detail-panel" aria-live="polite">
      <div className="pokemon-heading">
        <PokemonAvatar pokemon={pokemon} imageLookup={imageLookup} />
        <div>
          <p className="section-label">Selected Pokémon</p>
          <h3>{pokemon.Name}</h3>
          <div className="type-row">
            <span style={{ "--type-color": typeColor(pokemon.Type1) }}>{pokemon.Type1}</span>
            {pokemon.Type2 ? <span style={{ "--type-color": typeColor(pokemon.Type2) }}>{pokemon.Type2}</span> : null}
          </div>
        </div>
      </div>

      <dl className="metric-grid">
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
          <dt>Synergy weight</dt>
          <dd>{formatWeighted(pokemon.weightedDegree)}</dd>
        </div>
      </dl>

      {isIncineroar ? (
        <section className="role-evidence">
          <h4>Competitive role evidence</h4>
          <p>
            Incineroar succeeds as a support pivot. Intimidate softens attackers, Fake Out buys positioning, and Parting
            Shot resets matchups so stronger teammates can keep pressure.
          </p>
        </section>
      ) : null}

      <div className="detail-list-grid">
        <DetailList title="Common moves" rows={moves} />
        <DetailList title="Top item" rows={items} />
        <DetailList title="Top ability" rows={abilities} />
        <TeammateList rows={teammates} />
      </div>
    </aside>
  );
}

function DetailList({ title, rows }) {
  if (!rows.length) return null;
  return (
    <section className="detail-list">
      <h4>{title}</h4>
      <ul>
        {rows.map((row) => (
          <li key={`${row.category}-${row.name}`}>
            <span>{row.name}</span>
            <strong>{formatPercent(row.usagePercent)}%</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TeammateList({ rows }) {
  if (!rows.length) return null;
  return (
    <section className="detail-list">
      <h4>Common teammates</h4>
      <ul>
        {rows.map((row) => (
          <li key={row.name}>
            <span>{row.name}</span>
            <strong>{formatPercent(row.percent)}%</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const { data, error } = usePokemonData();
  const [selectedName, setSelectedName] = useState("Incineroar");
  const [brushedNames, setBrushedNames] = useState([]);
  const [activeStep, setActiveStep] = useState("reveal");
  const brushedKeyRef = useRef("");

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

  const handleSelectName = useCallback((name, options = {}) => {
    setSelectedName(name);
    setBrushedNames([]);
    brushedKeyRef.current = "";
    if (options.scrollToNetwork) {
      setActiveStep("reveal");
      window.requestAnimationFrame(() => {
        document.getElementById("network-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  const handleBrushNames = useCallback((names) => {
    const nextKey = names.slice().sort().join("|");
    if (nextKey === brushedKeyRef.current) return;
    brushedKeyRef.current = nextKey;
    setBrushedNames(names);
    if (names.length) {
      setSelectedName(null);
      setActiveStep("contradiction");
    }
  }, []);

  const handleStoryStep = useCallback((step) => {
    setActiveStep(step.id);
    setSelectedName(step.selectedName || null);
    setBrushedNames([]);
    brushedKeyRef.current = "";
    window.requestAnimationFrame(() => {
      document.getElementById(step.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

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

  const selectedInNetwork = selectedName && subset.nodes.some((d) => d.Name === selectedName);
  const networkNote = brushedNames.length
    ? `${brushedNames.length} Pokémon brushed in the scatterplot. Matching nodes are highlighted in the network.`
    : selectedInNetwork
    ? selectedName === INCINEROAR_REVEAL_NAME
      ? "Incineroar is the authored reveal: moderate stats, high usage, and bright support links."
      : `${selectedName} is selected. Its brightest links show common teammates.`
    : "Click a Pokémon to lock its team relationships.";

  return (
    <main className="story-shell">
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <p className="section-label">Team 13 · competitive Pokémon data story</p>
          <h1 id="hero-title">Raw power matters. Team fit matters too.</h1>
          <p className="data-kicker">VGC stats, usage, teammate networks, roles, moves, items, and abilities</p>
          <p>
            Base stats explain part of competitive value. This story asks what else separates powerful Pokémon from
            Pokémon that keep showing up on winning teams.
          </p>
          <div className="hero-facts" aria-label="Dataset summary">
            <span>{formatNumber(enrichedPokemon.length)} Pokémon</span>
            <span>{formatNumber(data.edges.length)} teammate links</span>
            <span>{formatNumber(data.builds.length)} build records</span>
          </div>
        </div>
        <HeroRoster
          pokemon={enrichedPokemon}
          imageLookup={data.imageLookup}
          selectedName={selectedName}
          onSelect={handleSelectName}
        />
      </section>

      <StoryStepper activeStep={activeStep} onStep={handleStoryStep} />

      <section className="guided-section" aria-labelledby="guided-title">
        <div className="section-copy">
          <p className="section-label">Stat total vs. usage</p>
          <h2 id="guided-title">High stats do not guarantee high usage.</h2>
          <p>
            Base stat total has only a weak relationship with usage. Zacian is both powerful and popular, but Zamazenta
            has similarly huge stats with far lower usage. Incineroar has moderate stats and still sits near the top.
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
        <ComparisonChart
          pokemon={enrichedPokemon}
          selectedName={selectedName}
          brushedNames={brushedNames}
          onSelect={handleSelectName}
          onBrush={handleBrushNames}
        />
      </section>

      <ConnectivityBridge />

      <section className="network-section" aria-labelledby="network-title">
        <div className="network-intro">
          <div>
            <p className="section-label">Team synergy network</p>
            <h2 id="network-title">Competitive success emerges from synergy.</h2>
          </div>
          <p>
            Each node is a Pokémon. Larger nodes are used more often. Edges show common teammates, and thicker edges mean
            stronger co-usage.
          </p>
        </div>
        <StoryCallouts
          items={[
              {
                label: "03",
                title: "Incineroar breaks the simple stats story",
                body: "The default selection starts with the contradiction case: moderate stats, high usage, and unusually visible team connections.",
              },
              {
                label: "04",
                title: "Usage is relational",
                body: "Thick links and repeated partners show where support roles create value through team fit, not only individual stats.",
              },
          ]}
        />

        <div className="network-layout">
          <div className="network-panel">
            <NetworkRevealCallout selectedPokemon={selectedPokemon} />
            <div className="network-toolbar">
              <button
                className="reset-button"
                type="button"
                onClick={() => {
                  setSelectedName(null);
                  setBrushedNames([]);
                }}
              >
                Reset selection
              </button>
              <span id="network-note">{networkNote}</span>
            </div>
            <NetworkLegend />
            <NetworkGraph
              nodes={subset.nodes}
              links={subset.links}
              imageLookup={data.imageLookup}
              selectedName={selectedName}
              brushedNames={brushedNames}
              onSelect={handleSelectName}
            />
          </div>
          <DetailPanel pokemon={selectedPokemon} builds={data.builds} edges={data.edges} imageLookup={data.imageLookup} />
        </div>
      </section>

      <section className="exploration-prompt" aria-labelledby="exploration-title">
        <p className="section-label">Reader task</p>
        <h2 id="exploration-title">Find the high-value connectors.</h2>
        <p>
          Look for Pokémon that are not statistical giants, but still sit near the center of the team network. Those are
          the strongest evidence that competitive value is built through synergy.
        </p>
        <PokemonPicker
          pokemon={enrichedPokemon}
          imageLookup={data.imageLookup}
          selectedPokemon={selectedPokemon}
          selectedName={selectedName}
          onSelect={(name) => handleSelectName(name, { scrollToNetwork: true })}
        />
      </section>
    </main>
  );
}
