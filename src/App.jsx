import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import EgoNetworkComparisonView from "./EgoNetworkComparisonView.jsx";
import RoleCausalityCard from "./RoleCausalityCard.jsx";
import TeamEcosystemPanel from "./TeamEcosystemPanel.jsx";

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
  { id: "synergy", label: "Synergy", metricLabel: "Teammate footprint" },
];
const DETAIL_TABS = [
  { id: "evidence", label: "Evidence" },
  { id: "role", label: "Role" },
  { id: "team", label: "Team Core" },
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
const CORRELATION_SCAN_SIGNALS = [
  {
    id: "defensive",
    label: "Defense",
    accessor: (d) => d.defensiveScore,
  },
  {
    id: "specialization",
    label: "Stat focus",
    accessor: (d) => d.statSpecialization,
  },
  {
    id: "stats",
    label: "Total stats",
    accessor: (d) => d.Total,
    storyValue: STORY_STATS_USAGE_CORRELATION,
  },
  {
    id: "offense",
    label: "Offense",
    accessor: (d) => d.offensiveScore,
  },
  {
    id: "topPartner",
    label: "Strongest partner link",
    accessor: (d) => d.maxTeammateLink,
  },
  {
    id: "connectivity",
    label: "Connectivity degree",
    accessor: (d) => d.degree,
    storyValue: STORY_CONNECTIVITY_USAGE_CORRELATION,
    isWinner: true,
  },
];
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
const EXPLORATION_MISSIONS = [
  {
    id: "another-incineroar",
    title: "Find another Incineroar",
    description: "Find a Pokemon with moderate stats but unusually strong teammate footprint.",
  },
  {
    id: "failed-stat-monster",
    title: "Find a failed stat monster",
    description: "Find a Pokemon with elite stats that does not dominate usage.",
  },
  {
    id: "support-vs-attacker",
    title: "Compare support vs attacker",
    description: "Does a support Pokemon rely on team fit differently from a restricted attacker?",
  },
  {
    id: "test-network-claim",
    title: "Test the network claim",
    description: "Switch between Usage, Stats, and Synergy rankings. Do the same Pokemon stay on top?",
  },
];
const EXPLORATION_MISSION_INSIGHTS = new Map([
  [
    "another-incineroar",
    {
      title: "Another Incineroar Found",
      subjectName: "Amoonguss",
      conclusion: "Amoonguss succeeds with moderate raw stats but strong teammate connectivity.",
      whyItMatters: [
        "Amoonguss ranks much higher in Synergy than in raw Stats.",
        "Like Incineroar, its value comes from repeated team connections rather than elite base stats.",
        "This supports the claim that team fit can outweigh raw power.",
      ],
      nextStep: "Open the Role tab below to see how support value creates usage.",
    },
  ],
  [
    "failed-stat-monster",
    {
      title: "Failed Stat Monster",
      subjectName: "Zamazenta Crowned Shield",
      conclusion: "Zamazenta has elite raw stats but very low competitive adoption.",
      whyItMatters: [
        "Zamazenta's raw stats are among the highest in the dataset, yet its usage remains near the bottom.",
        "This demonstrates that power alone does not guarantee competitive success.",
      ],
      nextStep: "Compare Stats and Synergy rankings to see why raw power is not enough.",
    },
  ],
  [
    "support-vs-attacker",
    {
      title: "Different Paths to Success",
      subjectName: "Incineroar",
      comparisonName: "Zacian Crowned Sword",
      conclusion: "Zacian and Incineroar reach high usage through different competitive roles.",
      whyItMatters: [
        "Zacian combines elite raw stats with direct offensive pressure.",
        "Incineroar reaches similar network importance through positioning, support, and repeated teammate value.",
        "Competitive value can come from team fit as well as individual power.",
      ],
      nextStep: "Inspect Team Core to see which teammates reinforce Zacian's success.",
    },
  ],
  [
    "test-network-claim",
    {
      title: "Compare the Rankings",
      subjectName: "Incineroar",
      conclusion: "Usage, Stats, and Synergy rankings do not reward the same Pokémon.",
      whyItMatters: [
        "A Pokémon can rank highly in Synergy while sitting far lower in raw Stats.",
        "The difference reveals value that is visible in network position but missed by base stat total.",
      ],
      nextStep: "Open the Evidence tab to connect ranking differences to build and teammate signals.",
    },
  ],
]);
const ROLE_NOTES = new Map([
  [
    "Incineroar",
    "Support pivot: Intimidate, Fake Out, and Parting Shot create value by buying turns and resetting board position.",
  ],
  [
    "Zacian Crowned Sword",
    "Restricted attacker: high stats and direct pressure make it one of the cases where raw power and usage align.",
  ],
  [
    "Zamazenta Crowned Shield",
    "Defensive restricted: huge stats do not automatically translate into repeated team demand in this format.",
  ],
  [
    "Mewtwo",
    "Raw attacker: strong individual stats are less convincing when the build and teammate footprint are not as central.",
  ],
  [
    "Kyogre",
    "Weather attacker: rain pressure becomes more meaningful when teammates help protect, reposition, and exploit it.",
  ],
  [
    "Grimmsnarl",
    "Disruption support: screens and status tools help teammates survive long enough to execute a plan.",
  ],
  [
    "Amoonguss",
    "Redirection support: Spore and Rage Powder-style utility can matter more than raw stat total.",
  ],
  [
    "Rillaboom",
    "Terrain support: Fake Out pressure and Grassy Terrain make it valuable as part of repeated team structures.",
  ],
  [
    "Calyrex Shadow Rider",
    "Fast spread attacker: elite speed and Astral Barrage become more reliable when partners create safe attack windows.",
  ],
  [
    "Calyrex Ice Rider",
    "Trick Room attacker: bulk and Glacial Lance reward teams that protect setup turns and reverse the speed order.",
  ],
  [
    "Thundurus Incarnate Forme",
    "Disruption support: priority utility and speed control help powerful teammates act before opposing threats.",
  ],
]);
const NETWORK_ARCHETYPES = [
  { label: "Support pivots", anchorName: "Incineroar", dx: 24, dy: -36 },
  { label: "Restricted attackers", anchorName: "Zacian Crowned Sword", dx: 28, dy: 34 },
  { label: "Weather pressure", anchorName: "Kyogre", dx: 26, dy: -30 },
  { label: "Screen control", anchorName: "Grimmsnarl", dx: 24, dy: 32 },
  { label: "Redirection support", anchorName: "Amoonguss", dx: 24, dy: -34 },
  { label: "Terrain utility", anchorName: "Rillaboom", dx: 24, dy: 32 },
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

function shortEvidenceLabel(label) {
  return compactName(label)
    .replace(" Solo Form", " Solo")
    .replace(" Complete Forme", " Complete")
    .replace(" Shadow Rider", " Shadow")
    .replace(" Ice Rider", " Ice")
    .replace(" Incarnate Forme", " Incarnate")
    .replace(" Therian Forme", " Therian");
}

function comparisonLabelPlacement(pointX, label, chartLeft, chartRight) {
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

function pearsonCorrelation(data, getX, getY) {
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

function buildCorrelationScanRows(pokemon) {
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

function rankedPickerOptions(pokemon, query, mode) {
  const searchText = query.trim().toLowerCase();
  const hasSearch = searchText.length > 0;
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
      .attr("x", (d) => comparisonLabelPlacement(x(d.Total), compactName(d.Name), margin.left, width - margin.right).x)
      .attr("y", (d) => y(usageValue(d)) - 10)
      .attr("text-anchor", (d) => comparisonLabelPlacement(x(d.Total), compactName(d.Name), margin.left, width - margin.right).anchor)
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

function CorrelationScanChart({ rows }) {
  const [containerRef, width] = useElementWidth();

  useEffect(() => {
    if (!width || !rows.length) return undefined;

    const rowHeight = 42;
    const height = 74 + rows.length * rowHeight;
    const margin = { top: 40, right: width < 560 ? 48 : 90, bottom: 38, left: width < 560 ? 124 : 228 };
    const root = d3.select(containerRef.current);
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
    <section className="connectivity-bridge" aria-labelledby="connectivity-bridge-title">
      <div className="bridge-copy">
        <p className="section-label">Signal scan</p>
        <h2 id="connectivity-bridge-title">Usage follows team connections more closely than raw stats.</h2>
        <p>
          We compared possible predictors of usage: raw strength, role shape, partner strength, and team connectivity.
          Connectivity degree showed the strongest relationship with usage.
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
      </div>

      <div className="correlation-scan-panel">
        <CorrelationScanChart rows={rows} />
        <CorrelationScanLegend />
        <aside className="correlation-interpretation" aria-label="Signal scan interpretation">
          <h3>What does this mean?</h3>
          <p>A Pokémon's network position explains usage far better than raw power.</p>
          <p>
            Connectivity (r = {formatCorrelation(connectivityValue)}) is nearly {d3.format(".0f")(strengthRatio)} times
            stronger than total stats (r = {formatCorrelation(statsValue)}), suggesting that successful Pokémon are
            often defined by who they work with.
          </p>
        </aside>
      </div>
    </section>
  );
}

function ExplorationMissions({ activeMission, onMissionSelect }) {
  return (
    <div className="exploration-missions" aria-label="Guided exploration missions">
      {EXPLORATION_MISSIONS.map((mission) => (
        <button
          key={mission.id}
          type="button"
          className={activeMission === mission.id ? "is-active" : ""}
          onClick={() => onMissionSelect(mission.id)}
        >
          <strong>{mission.title}</strong>
          <span>{mission.description}</span>
        </button>
      ))}
    </div>
  );
}

function missionRank(pokemon, name, mode) {
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

function missionEvidence(insight, pokemon) {
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

  return [
    `Stats rank: #${missionRank(pokemon, subject.Name, "stats")}`,
    `Usage rank: #${missionRank(pokemon, subject.Name, "usage")}`,
    `Synergy rank: #${missionRank(pokemon, subject.Name, "synergy")}`,
    `Team partners: ${formatNumber(subject.degree)}`,
  ];
}

function currentFocusTakeaway({ statsRank, synergyRank, usageRank }) {
  if (!statsRank || !synergyRank || !usageRank) return "Compare its raw power, adoption, and team position.";
  if (synergyRank <= 10 && statsRank > 20) return "Moderate stats, elite team connectivity.";
  if (statsRank <= 10 && usageRank > 30) return "Elite stats, limited competitive adoption.";
  if (usageRank <= 10 && synergyRank <= 10) return "High usage backed by strong team connectivity.";
  if (synergyRank < statsRank) return "Team connectivity adds value beyond raw stats.";
  return "Raw power and team position tell different parts of the story.";
}

function formatRank(rank) {
  return rank ? `#${rank}` : "N/A";
}

function MissionInsightCard({ activeMission, pokemon }) {
  const insight = activeMission ? EXPLORATION_MISSION_INSIGHTS.get(activeMission) : null;
  if (!insight) return null;
  const evidence = missionEvidence(insight, pokemon);

  return (
    <section className="mission-insight-card" aria-live="polite" aria-label="Mission takeaway">
      <div className="mission-insight-heading">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>{insight.title}</strong>
          <p>{insight.conclusion}</p>
        </div>
      </div>
      {evidence.length ? (
        <dl className="mission-evidence" aria-label="Mission evidence">
          {evidence.map((item) => {
            const [label, ...valueParts] = item.split(": ");
            return (
              <div key={item}>
                <dt>{label}</dt>
                <dd>{valueParts.join(": ")}</dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      <div className="mission-why">
        <h4>Why it matters</h4>
        {insight.whyItMatters.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <strong>Competitive value emerges from team fit and network position, not only raw stats.</strong>
      </div>
      <p className="mission-next-step">
        <strong>Next step:</strong> {insight.nextStep}
      </p>
    </section>
  );
}

function PokemonPicker({ pokemon, imageLookup, selectedPokemon, selectedName, query, mode, onQueryChange, onModeChange, onSelect }) {
  const modeInfo = PICKER_MODES.find((item) => item.id === mode) || PICKER_MODES[0];
  const options = useMemo(() => rankedPickerOptions(pokemon, query, mode), [mode, pokemon, query]);
  const currentFocus = useMemo(() => {
    if (!selectedPokemon) return null;
    const ranks = {
      usageRank: missionRank(pokemon, selectedPokemon.Name, "usage"),
      statsRank: missionRank(pokemon, selectedPokemon.Name, "stats"),
      synergyRank: missionRank(pokemon, selectedPokemon.Name, "synergy"),
    };
    return {
      ...ranks,
      takeaway: currentFocusTakeaway(ranks),
    };
  }, [pokemon, selectedPokemon]);

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
          <div className="picker-current-identity">
            {selectedPokemon ? (
              <img src={imageLookup.get(selectedPokemon.Name) || ""} alt="" />
            ) : (
              <div className="picker-image-placeholder" />
            )}
            <div className="picker-current-name">
              <span>Current focus</span>
              <strong>{selectedPokemon?.Name || "None selected"}</strong>
              <small>{selectedPokemon ? typeLabel(selectedPokemon) : "Choose a search result or ranked option"}</small>
            </div>
          </div>
          {currentFocus ? (
            <>
              <dl className="picker-current-ranks" aria-label={`${selectedPokemon.Name} ranking summary`}>
                <div>
                  <dt>Usage rank</dt>
                  <dd>{formatRank(currentFocus.usageRank)}</dd>
                </div>
                <div>
                  <dt>Stats rank</dt>
                  <dd>{formatRank(currentFocus.statsRank)}</dd>
                </div>
                <div>
                  <dt>Synergy rank</dt>
                  <dd>{formatRank(currentFocus.synergyRank)}</dd>
                </div>
              </dl>
              <p className="picker-current-takeaway">{currentFocus.takeaway}</p>
            </>
          ) : null}
        </div>

        <label className="picker-search">
          <span>Search by name</span>
          <input
            type="search"
            value={query}
            placeholder="Try Incineroar, Kyogre, Mewtwo..."
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        <div className="picker-mode-row" aria-label="Rank suggestions by">
          {PICKER_MODES.map((item) => (
            <button
              className={item.id === mode ? "is-active" : ""}
              key={item.id}
              type="button"
              onClick={() => onModeChange(item.id)}
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
            <span className="hero-sprite-frame">
              <img
                src={imageForPokemon(d.Name, imageLookup)}
                alt=""
                className={LOCAL_IMAGE_PATHS.has(d.Name) ? "is-loaded" : ""}
                onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
                onError={(event) => event.currentTarget.remove()}
              />
            </span>
            <span className="hero-card-name">{compactName(d.Name)}</span>
            <small>{typeLabel(d)}</small>
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

    const height = Math.max(380, Math.min(440, width * 0.38));
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
    const nodeByName = new Map(graphNodes.map((d) => [d.Name, d]));
    const archetypes = NETWORK_ARCHETYPES.filter((d) => nodeByName.has(d.anchorName));
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

    const archetypeLabel = svg
      .append("g")
      .attr("class", "archetype-labels")
      .selectAll("text")
      .data(archetypes)
      .join("text")
      .attr("class", "archetype-label")
      .text((d) => d.label);

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
          .distance((d) => 112 - Math.min(52, d.coUsagePercent))
          .strength(0.42),
      )
      .force("charge", d3.forceManyBody().strength(-205))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide((d) => radius(usageValue(d)) + 6))
      .force("x", d3.forceX(width / 2).strength(0.085))
      .force("y", d3.forceY(height / 2).strength(0.1))
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
        archetypeLabel
          .attr("x", (d) => Math.max(18, Math.min(width - 160, nodeByName.get(d.anchorName).x + d.dx)))
          .attr("y", (d) => Math.max(18, Math.min(height - 18, nodeByName.get(d.anchorName).y + d.dy)));
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

    root
      .selectAll(".archetype-label")
      .classed("is-muted", (d) => selectedInGraph && d.anchorName !== selectedName && !connected.has(d.anchorName))
      .classed("is-active", (d) => selectedInGraph && (d.anchorName === selectedName || connected.has(d.anchorName)));
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

function DetailPanel({ pokemon, builds, edges, imageLookup, allPokemon }) {
  const [activeTab, setActiveTab] = useState("evidence");

  useEffect(() => {
    setActiveTab("evidence");
  }, [pokemon?.Name]);

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
  const evidenceRows = buildEvidenceRows({ moves, items, abilities, teammates });

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
  const [selectedName, setSelectedName] = useState("Incineroar");
  const [comparisonName, setComparisonName] = useState("Zacian Crowned Sword");
  const [brushedNames, setBrushedNames] = useState([]);
  const [activeStep, setActiveStep] = useState("reveal");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerMode, setPickerMode] = useState("usage");
  const [activeMission, setActiveMission] = useState(null);
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

  const handleSelectName = useCallback((name, options = {}) => {
    setSelectedName(name);
    setBrushedNames([]);
    brushedKeyRef.current = "";
    setActiveMission(null);
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
    setActiveMission(null);
    window.requestAnimationFrame(() => {
      document.getElementById(step.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleMissionSelect = useCallback((missionId) => {
    setActiveMission(missionId);
    setActiveStep("explore");
    setBrushedNames([]);
    brushedKeyRef.current = "";

    if (missionId === "another-incineroar") {
      setPickerQuery("");
      setPickerMode("usage");
      setSelectedName("Amoonguss");
      return;
    }

    if (missionId === "failed-stat-monster") {
      setPickerQuery("");
      setPickerMode("stats");
      setSelectedName("Zamazenta Crowned Shield");
      return;
    }

    if (missionId === "support-vs-attacker") {
      setPickerQuery("");
      setPickerMode("usage");
      setSelectedName("Incineroar");
      setComparisonName("Zacian Crowned Sword");
      return;
    }

    setPickerQuery("");
    setPickerMode("usage");
    window.requestAnimationFrame(() => {
      document.querySelector(".picker-mode-row button.is-active")?.focus();
      document.querySelector(".pokemon-picker-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

      <ConnectivityBridge pokemon={enrichedPokemon} />

      <section className="network-section" aria-labelledby="network-title">
        <div className="network-intro">
          <div>
            <p className="section-label">Team synergy network</p>
            <h2 id="network-title">Competitive success emerges from synergy.</h2>
          </div>
          <aside className="network-intro-explanation" aria-label="Why look at a network">
            <h3>Why look at a network?</h3>
            <p>
              If competitive success depends on team fit, important Pokémon should appear near many useful teammates.
              The network reveals these relationships directly.
            </p>
            <small>
              Larger nodes are used more often. Thicker edges show stronger teammate co-usage.
            </small>
          </aside>
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
          <EgoNetworkComparisonView
            selectedPokemon={selectedPokemon}
            comparisonPokemon={comparisonPokemon}
            pokemon={enrichedPokemon}
            edges={data.edges}
            comparisonName={comparisonPokemon?.Name || comparisonName}
            onComparisonChange={setComparisonName}
          />
          <DetailPanel
            pokemon={selectedPokemon}
            builds={data.builds}
            edges={data.edges}
            imageLookup={data.imageLookup}
            allPokemon={enrichedPokemon}
          />
        </div>
      </section>

      <section className="exploration-prompt" aria-labelledby="exploration-title">
        <p className="section-label">Reader task</p>
        <h2 id="exploration-title">Find the high-value connectors.</h2>
        <p>
          Look for Pokémon that are not statistical giants, but still sit near the center of the team network. Those are
          the strongest evidence that competitive value is built through synergy.
        </p>
        <ExplorationMissions activeMission={activeMission} onMissionSelect={handleMissionSelect} />
        <MissionInsightCard activeMission={activeMission} pokemon={enrichedPokemon} />
        <PokemonPicker
          pokemon={enrichedPokemon}
          imageLookup={data.imageLookup}
          selectedPokemon={selectedPokemon}
          selectedName={selectedName}
          query={pickerQuery}
          mode={pickerMode}
          onQueryChange={setPickerQuery}
          onModeChange={setPickerMode}
          onSelect={(name) => handleSelectName(name, { scrollToNetwork: true })}
        />
      </section>
    </main>
  );
}
