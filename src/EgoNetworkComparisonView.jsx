import * as d3 from "d3";

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
const CASE_COMPARISONS = ["Zacian Crowned Sword", "Incineroar", "Amoonguss", "Zamazenta Crowned Shield", "Kyogre"];
const EGO_LAYOUTS = [
  { x: -62, y: -22, labelAnchor: "end", maxLabelChars: 14 },
  { x: 0, y: -38, labelAnchor: "middle", maxLabelChars: 16 },
  { x: 62, y: -22, labelAnchor: "start", maxLabelChars: 14 },
];
const METRICS = [
  { label: "Usage", value: (pokemon) => usageValue(pokemon), format: (value) => `${formatPercent(value)}%` },
  { label: "Total Stats", value: (pokemon) => pokemon?.Total || 0, format: formatNumber },
  { label: "Connectivity Degree", value: (pokemon) => pokemon?.degree || 0, format: formatNumber },
  { label: "Teammate Footprint", value: (pokemon) => pokemon?.weightedDegree || 0, format: formatWeighted },
];

function compactName(name = "") {
  return name.replace(" Crowned Sword", "").replace(" Crowned Shield", "");
}

function labelDisplayName(name = "") {
  const replacements = new Map([
    ["Zacian Crowned Sword", "Zacian"],
    ["Zamazenta Crowned Shield", "Zamazenta"],
    ["Calyrex Shadow Rider", "Calyrex Shadow"],
    ["Zygarde Complete Forme", "Zygarde Complete"],
    ["Wishiwashi Solo Form", "Wishiwashi Solo"],
  ]);
  return replacements.get(name) || compactName(name);
}

function splitLabelLines(name = "", maxChars = 16) {
  const displayName = labelDisplayName(name);
  if (displayName.length <= maxChars) return [displayName];

  const words = displayName.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [displayName];

  let bestSplit = [displayName];
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const first = words.slice(0, index).join(" ");
    const second = words.slice(index).join(" ");
    const score = Math.max(first.length, second.length);
    if (score < bestScore) {
      bestScore = score;
      bestSplit = [first, second];
    }
  }

  if (bestSplit.length === 2 && bestSplit[0].length <= maxChars + 2 && bestSplit[1].length <= maxChars + 2) {
    return bestSplit;
  }

  return [displayName];
}

function teammateLayout(index, name) {
  const base = EGO_LAYOUTS[index] || EGO_LAYOUTS[EGO_LAYOUTS.length - 1];
  const extra = Math.min(16, Math.max(0, compactName(name).length - 12) * 1.35);
  if (index === 0) return { ...base, x: base.x - extra };
  if (index === 2) return { ...base, x: base.x + extra };
  return base;
}

function labelPosition(teammate, radius) {
  if (teammate.labelAnchor === "end") {
    return { x: teammate.x - radius - 8, y: teammate.y + 4 };
  }
  if (teammate.labelAnchor === "start") {
    return { x: teammate.x + radius + 8, y: teammate.y + 4 };
  }
  return { x: teammate.x, y: teammate.y - radius - 8 };
}

function typeColor(type) {
  return TYPE_COLORS.get(type) || "#8b949e";
}

function usageValue(pokemon) {
  return Number.isFinite(pokemon?.usagePercent) ? pokemon.usagePercent : 0;
}

function topTeammates(edges, name, limit = 3) {
  return edges
    .filter((edge) => edge.source === name || edge.target === name)
    .map((edge) => ({
      name: edge.source === name ? edge.target : edge.source,
      strength: edge.coUsagePercent,
    }))
    .sort((a, b) => d3.descending(a.strength, b.strength))
    .slice(0, limit);
}

function buildEgo(pokemon, edges, pokemonByName) {
  if (!pokemon) return { center: null, teammates: [], links: [] };
  const teammates = topTeammates(edges, pokemon.Name).map((teammate, index) => ({
    ...teammate,
    pokemon: pokemonByName.get(teammate.name),
    ...teammateLayout(index, teammate.name),
  }));
  return {
    center: pokemon,
    teammates,
    links: teammates.map((teammate) => ({
      target: teammate.name,
      strength: teammate.strength,
    })),
  };
}

function comparisonOptions(pokemon, selectedName) {
  const byName = new Map(pokemon.map((entry) => [entry.Name, entry]));
  const caseOptions = CASE_COMPARISONS.map((name) => byName.get(name)).filter(Boolean);
  const topUsage = pokemon
    .filter((entry) => entry.hasUsageData && usageValue(entry) > 0)
    .sort((a, b) => d3.descending(usageValue(a), usageValue(b)))
    .slice(0, 8);
  const seen = new Set();
  return [...caseOptions, ...topUsage].filter((entry) => {
    if (!entry || entry.Name === selectedName || seen.has(entry.Name)) return false;
    seen.add(entry.Name);
    return true;
  });
}

function insightFor(a, b, sharedCount) {
  if (!a || !b) return "Select two Pokémon to compare their teammate networks.";
  if ((a.Total || 0) < (b.Total || 0) && (a.weightedDegree || 0) > (b.weightedDegree || 0)) {
    return `${compactName(a.Name)} has lower raw stats but a broader teammate footprint.`;
  }
  if ((b.Total || 0) < (a.Total || 0) && (b.weightedDegree || 0) > (a.weightedDegree || 0)) {
    return `${compactName(b.Name)} has lower raw stats but a broader teammate footprint.`;
  }
  if (sharedCount >= 2) return "Both Pokémon share several central teammates despite different roles.";
  return `${compactName(a.Name)} and ${compactName(b.Name)} rely on different teammate cores.`;
}

function EgoGraph({ ego, origin, sharedNames, radiusScale, edgeWidthScale }) {
  if (!ego.center) return null;
  const [originX, originY] = origin;
  const centerRadius = radiusScale(usageValue(ego.center)) + 3;
  const centerLabelLines = splitLabelLines(ego.center.Name, 16);

  return (
    <g className="ego-mini-network" transform={`translate(${originX},${originY})`}>
      {ego.teammates.map((teammate) => {
        const isShared = sharedNames.has(teammate.name);
        return (
          <line
            className={isShared ? "is-shared" : "is-unique"}
            key={`${ego.center.Name}-${teammate.name}`}
            x1="0"
            y1="0"
            x2={teammate.x}
            y2={teammate.y}
            strokeWidth={edgeWidthScale(teammate.strength)}
          />
        );
      })}
      <circle className="ego-center-node" cx="0" cy="0" r={centerRadius} fill={typeColor(ego.center.Type1)} />
      <text className="ego-center-label" x="0" y={centerRadius + 18} textAnchor="middle">
        {centerLabelLines.map((line, index) => (
          <tspan key={`${ego.center.Name}-${line}`} x="0" dy={index === 0 ? 0 : 11}>
            {line}
          </tspan>
        ))}
        <title>{ego.center.Name}</title>
      </text>
      {ego.teammates.map((teammate) => {
        const isShared = sharedNames.has(teammate.name);
        const teammateRadius = radiusScale(usageValue(teammate.pokemon));
        const labelLines = splitLabelLines(teammate.name, teammate.maxLabelChars);
        const labelPoint = labelPosition(teammate, teammateRadius);
        return (
          <g className={`ego-teammate-node${isShared ? " is-shared" : " is-unique"}`} key={teammate.name}>
            <circle
              cx={teammate.x}
              cy={teammate.y}
              r={teammateRadius}
              fill={isShared ? "#f2b56b" : typeColor(teammate.pokemon?.Type1)}
            />
            <text x={labelPoint.x} y={labelPoint.y} textAnchor={teammate.labelAnchor}>
              {labelLines.map((line, index) => (
                <tspan key={`${teammate.name}-${line}`} x={labelPoint.x} dy={index === 0 ? 0 : 10}>
                  {line}
                </tspan>
              ))}
              <title>{teammate.name}</title>
            </text>
          </g>
        );
      })}
    </g>
  );
}

function MetricRows({ pokemonA, pokemonB }) {
  return (
    <g className="ego-metric-rows" transform="translate(0,145)">
      {METRICS.map((metric, index) => {
        const valueA = metric.value(pokemonA);
        const valueB = metric.value(pokemonB);
        const scale = d3.scaleLinear().domain([0, Math.max(valueA, valueB, 1)]).range([0, 160]);
        const y = index * 20;
        return (
          <g key={metric.label} transform={`translate(0,${y})`}>
            <text className="ego-metric-label" x="38" y="11">
              {metric.label}
            </text>
            <rect className="ego-metric-track" x="172" y="4" width="160" height="8" rx="4" />
            <rect className="ego-metric-bar is-a" x="172" y="4" width={scale(valueA)} height="8" rx="4" />
            <text className="ego-metric-value is-a" x="340" y="11">
              {metric.format(valueA)}
            </text>
            <rect className="ego-metric-track" x="430" y="4" width="160" height="8" rx="4" />
            <rect className="ego-metric-bar is-b" x={590 - scale(valueB)} y="4" width={scale(valueB)} height="8" rx="4" />
            <text className="ego-metric-value is-b" x="420" y="11" textAnchor="end">
              {metric.format(valueB)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export default function EgoNetworkComparisonView({
  selectedPokemon,
  comparisonPokemon,
  pokemon,
  edges,
  comparisonName,
  onComparisonChange,
}) {
  if (!selectedPokemon || !comparisonPokemon) return null;

  const pokemonByName = new Map(pokemon.map((entry) => [entry.Name, entry]));
  const egoA = buildEgo(selectedPokemon, edges, pokemonByName);
  const egoB = buildEgo(comparisonPokemon, edges, pokemonByName);
  const teammateNamesA = new Set(egoA.teammates.map((teammate) => teammate.name));
  const teammateNamesB = new Set(egoB.teammates.map((teammate) => teammate.name));
  const sharedNames = new Set([...teammateNamesA].filter((name) => teammateNamesB.has(name)));
  const allNodes = [egoA.center, egoB.center, ...egoA.teammates.map((d) => d.pokemon), ...egoB.teammates.map((d) => d.pokemon)].filter(Boolean);
  const allLinks = [...egoA.links, ...egoB.links];
  const radiusScale = d3
    .scaleSqrt()
    .domain([0, Math.max(70, d3.max(allNodes, usageValue) || 0)])
    .range([6, 17]);
  const edgeWidthScale = d3
    .scaleLinear()
    .domain([0, Math.max(100, d3.max(allLinks, (link) => link.strength) || 0)])
    .range([1.2, 6.8]);
  const options = comparisonOptions(pokemon, selectedPokemon.Name);
  const insight = insightFor(selectedPokemon, comparisonPokemon, sharedNames.size);

  return (
    <section className="ego-comparison-view" aria-labelledby="ego-comparison-title">
      <div className="ego-comparison-header">
        <div>
          <p className="section-label">Ego network comparison</p>
          <h3 id="ego-comparison-title">How do stats and teammate footprint differ?</h3>
        </div>
        <label className="ego-comparison-selector">
          <span>Compare with</span>
          <select value={comparisonName} onChange={(event) => onComparisonChange(event.target.value)}>
            {options.map((option) => (
              <option key={option.Name} value={option.Name}>
                {option.Name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="ego-comparison-legend" aria-label="Ego comparison encodings">
        <span>
          <i className="legend-sample legend-shared" aria-hidden="true" />
          shared teammate
        </span>
        <span>
          <i className="legend-sample legend-unique" aria-hidden="true" />
          unique teammate
        </span>
        <span>
          <i className="legend-sample legend-size" aria-hidden="true" />
          larger node = higher usage
        </span>
        <span>
          <i className="legend-sample legend-width" aria-hidden="true" />
          thicker link = stronger co-usage
        </span>
      </div>

      <svg className="ego-comparison-svg" viewBox="0 0 640 240" role="img" aria-label="Ego network comparison">
        <text className="ego-column-title" x="170" y="20" textAnchor="middle">
          {compactName(selectedPokemon.Name)}
        </text>
        <text className="ego-column-title" x="492" y="20" textAnchor="middle">
          {compactName(comparisonPokemon.Name)}
        </text>
        <EgoGraph ego={egoA} origin={[145, 102]} sharedNames={sharedNames} radiusScale={radiusScale} edgeWidthScale={edgeWidthScale} />
        <EgoGraph ego={egoB} origin={[495, 102]} sharedNames={sharedNames} radiusScale={radiusScale} edgeWidthScale={edgeWidthScale} />
        <MetricRows pokemonA={selectedPokemon} pokemonB={comparisonPokemon} />
        <text className="ego-insight" x="320" y="232" textAnchor="middle">
          {insight}
        </text>
      </svg>
    </section>
  );
}
