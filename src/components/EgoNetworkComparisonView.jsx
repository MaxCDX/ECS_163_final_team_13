import * as d3 from "d3";

// Compares two local teammate neighborhoods after the full network reveal.
// Node size reflects usage; edge thickness reflects teammate co-usage strength.
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
const EGO_LAYOUTS = [
  { x: -110, y: -12, labelAnchor: "end", maxLabelChars: 14 },
  { x: 0, y: -78, labelAnchor: "middle", maxLabelChars: 16 },
  { x: 110, y: -12, labelAnchor: "start", maxLabelChars: 14 },
];
const METRICS = [
  { label: "Usage", value: (pokemon) => usageValue(pokemon), format: (value) => `${formatPercent(value)}%` },
  { label: "Total Stats", value: (pokemon) => pokemon?.Total || 0, format: formatNumber },
  { label: "Partners", value: (pokemon) => pokemon?.degree || 0, format: formatNumber },
  { label: "Footprint", value: (pokemon) => pokemon?.weightedDegree || 0, format: formatWeighted },
];

function compactName(name = "") {
  return name.replace(" Crowned Sword", "").replace(" Crowned Shield", "");
}

function labelDisplayName(name = "") {
  const replacements = new Map([
    ["Zacian Crowned Sword", "Zacian"],
    ["Zamazenta Crowned Shield", "Zamazenta"],
    ["Calyrex Shadow Rider", "Calyrex Shadow"],
    ["Calyrex Ice Rider", "Calyrex Ice"],
    ["Zygarde Complete Forme", "Zygarde Complete"],
    ["Wishiwashi Solo Form", "Wishiwashi Solo"],
    ["Thundurus Incarnate Forme", "Thundurus"],
  ]);
  return replacements.get(name) || compactName(name);
}

function splitLabelLines(name = "", maxChars = 15) {
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

  return bestSplit;
}

function typeColor(type) {
  return TYPE_COLORS.get(type) || "#8b949e";
}

function usageValue(pokemon) {
  return Number.isFinite(pokemon?.usagePercent) ? pokemon.usagePercent : 0;
}

function topTeammates(edges, name, pokemonByName, limit = 3) {
  // Use strongest visible teammate links so pairwise comparison stays readable.
  if (!name) return [];
  const byName = new Map();
  edges
    .filter((edge) => edge.source === name || edge.target === name)
    .forEach((edge) => {
      const teammateName = edge.source === name ? edge.target : edge.source;
      const current = byName.get(teammateName);
      if (!current || edge.coUsagePercent > current.strength) {
        byName.set(teammateName, {
          name: teammateName,
          pokemon: pokemonByName.get(teammateName),
          strength: edge.coUsagePercent,
        });
      }
    });

  return [...byName.values()]
    .sort((a, b) => d3.descending(a.strength, b.strength))
    .slice(0, limit)
    .map((teammate, index) => ({
      ...teammate,
      ...EGO_LAYOUTS[index],
      rank: index + 1,
    }));
}

function buildEgo(pokemon, edges, pokemonByName) {
  // A compact ego network bridges the global graph and side-by-side local evidence.
  if (!pokemon) return { center: null, teammates: [] };
  return {
    center: pokemon,
    teammates: topTeammates(edges, pokemon.Name, pokemonByName),
  };
}

function labelPoint(teammate, radius) {
  if (teammate.labelAnchor === "end") return { x: teammate.x - radius - 9, y: teammate.y + 4 };
  if (teammate.labelAnchor === "start") return { x: teammate.x + radius + 9, y: teammate.y + 4 };
  return { x: teammate.x, y: teammate.y - radius - 10 };
}

function insightFor(a, b, sharedCount) {
  if (!a || !b) return "Select two Pokémon in the network to compare their teammate structures.";
  if ((a.Total || 0) < (b.Total || 0) && (a.weightedDegree || 0) > (b.weightedDegree || 0)) {
    return `${compactName(a.Name)} has lower raw stats but a broader teammate footprint.`;
  }
  if ((b.Total || 0) < (a.Total || 0) && (b.weightedDegree || 0) > (a.weightedDegree || 0)) {
    return `${compactName(b.Name)} has lower raw stats but a broader teammate footprint.`;
  }
  if (sharedCount >= 2) return "Both selections share several central teammates despite different roles.";
  if (sharedCount === 1) return "The two selections overlap through one visible teammate link.";
  return `${compactName(a.Name)} and ${compactName(b.Name)} rely on different visible teammate cores.`;
}

function EgoGraph({ ego, origin, sharedNames, radiusScale, edgeWidthScale }) {
  const [originX, originY] = origin;
  if (!ego.center) {
    return (
      <text className="ego-empty-label" x={originX} y={originY} textAnchor="middle">
        Empty selection
      </text>
    );
  }

  const centerRadius = 22;
  const centerLines = splitLabelLines(ego.center.Name, 18);

  return (
    <g className="ego-mini-network" transform={`translate(${originX},${originY})`}>
      {ego.teammates.map((teammate) => {
        const isShared = sharedNames.has(teammate.name);
        return (
          <line
            className={isShared ? "is-shared" : "is-unique"}
            key={`${ego.center.Name}-${teammate.name}-link`}
            x1="0"
            y1="0"
            x2={teammate.x}
            y2={teammate.y}
            strokeWidth={edgeWidthScale(teammate.strength)}
          />
        );
      })}
      {ego.teammates.map((teammate) => {
        const isShared = sharedNames.has(teammate.name);
        const teammateRadius = radiusScale(usageValue(teammate.pokemon));
        const point = labelPoint(teammate, teammateRadius);
        return (
          <g className={`ego-teammate-node${isShared ? " is-shared" : " is-unique"}`} key={`${ego.center.Name}-${teammate.name}`}>
            <circle
              cx={teammate.x}
              cy={teammate.y}
              r={teammateRadius}
              fill={isShared ? "#f2b56b" : typeColor(teammate.pokemon?.Type1)}
            >
              <title>
                {teammate.name}: {formatPercent(teammate.strength)}% co-usage
              </title>
            </circle>
            <text x={point.x} y={point.y} textAnchor={teammate.labelAnchor}>
              {splitLabelLines(teammate.name, teammate.maxLabelChars).map((line, index) => (
                <tspan key={`${ego.center.Name}-${teammate.name}-${line}`} x={point.x} dy={index === 0 ? 0 : 10}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      <circle className="ego-center-node" cx="0" cy="0" r={centerRadius} fill={typeColor(ego.center.Type1)} />
      <text className="ego-center-label" x="0" y={centerRadius + 17} textAnchor="middle">
        {centerLines.map((line, index) => (
          <tspan key={`${ego.center.Name}-${line}`} x="0" dy={index === 0 ? 0 : 11}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function metricRows(pokemonA, pokemonB) {
  return METRICS.map((metric) => {
    const valueA = metric.value(pokemonA);
    const valueB = metric.value(pokemonB);
    const maxValue = Math.max(valueA, valueB, 1);
    return {
      label: metric.label,
      valueA,
      valueB,
      formattedA: metric.format(valueA),
      formattedB: metric.format(valueB),
      widthA: (valueA / maxValue) * 100,
      widthB: (valueB / maxValue) * 100,
    };
  });
}

function MetricComparison({ pokemonA, pokemonB }) {
  const rows = metricRows(pokemonA, pokemonB);

  return (
    <dl className="ego-metric-rows" aria-label="Ego comparison metrics">
      {rows.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>
            <span className="ego-metric-track is-a">
              <i style={{ width: `${metric.widthA}%` }} />
            </span>
            <strong className="is-a">{metric.formattedA}</strong>
            <strong className="is-b">{metric.formattedB}</strong>
            <span className="ego-metric-track is-b">
              <i style={{ width: `${metric.widthB}%` }} />
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function EgoNetworkComparisonView({
  selectedPokemon,
  comparisonPokemon,
  pokemon,
  edges,
}) {
  const pokemonByName = new Map(pokemon.map((entry) => [entry.Name, entry]));
  const egoA = buildEgo(selectedPokemon, edges, pokemonByName);
  const egoB = buildEgo(comparisonPokemon, edges, pokemonByName);
  const teammateNamesA = new Set(egoA.teammates.map((teammate) => teammate.name));
  const teammateNamesB = new Set(egoB.teammates.map((teammate) => teammate.name));
  const sharedNames = new Set([...teammateNamesA].filter((name) => teammateNamesB.has(name)));
  const allNodes = [egoA.center, egoB.center, ...egoA.teammates.map((d) => d.pokemon), ...egoB.teammates.map((d) => d.pokemon)].filter(Boolean);
  const allLinks = [...egoA.teammates, ...egoB.teammates];
  const radiusScale = d3
    .scaleSqrt()
    .domain([0, Math.max(70, d3.max(allNodes, usageValue) || 0)])
    .range([7, 17]);
  const edgeWidthScale = d3
    .scaleLinear()
    .domain([0, Math.max(100, d3.max(allLinks, (link) => link.strength) || 0)])
    .range([1.4, 6.2]);
  const insight = insightFor(selectedPokemon, comparisonPokemon, sharedNames.size);

  return (
    <section className="ego-comparison-view" aria-labelledby="ego-comparison-title">
      <div className="ego-comparison-header">
        <div>
          <p className="section-label">Ego network comparison</p>
          <h3 id="ego-comparison-title">Compare two selected teammate subnetworks.</h3>
        </div>
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

      <svg className="ego-comparison-svg" viewBox="0 0 960 292" role="img" aria-label="Ego network comparison">
        <text className="ego-column-title" x="240" y="32" textAnchor="middle">
          {selectedPokemon ? compactName(selectedPokemon.Name) : "First selection"}
        </text>
        <text className="ego-column-title" x="720" y="32" textAnchor="middle">
          {comparisonPokemon ? compactName(comparisonPokemon.Name) : "Second selection"}
        </text>
        <EgoGraph ego={egoA} origin={[240, 148]} sharedNames={sharedNames} radiusScale={radiusScale} edgeWidthScale={edgeWidthScale} />
        <EgoGraph ego={egoB} origin={[720, 148]} sharedNames={sharedNames} radiusScale={radiusScale} edgeWidthScale={edgeWidthScale} />
      </svg>

      {selectedPokemon && comparisonPokemon ? <MetricComparison pokemonA={selectedPokemon} pokemonB={comparisonPokemon} /> : null}
      <p className="ego-insight-text">{insight}</p>
    </section>
  );
}
