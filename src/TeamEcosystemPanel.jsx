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

const AUTHORED_CORES = new Map([
  [
    "Incineroar",
    {
      members: ["Incineroar", "Amoonguss", "Zacian Crowned Sword"],
      interpretation: "Support, positioning, and offense reinforce each other across this core.",
    },
  ],
  [
    "Amoonguss",
    {
      members: ["Amoonguss", "Incineroar", "Zacian Crowned Sword"],
      interpretation: "Protection, tempo control, and damage form a stable team core.",
    },
  ],
  [
    "Zacian Crowned Sword",
    {
      members: ["Zacian Crowned Sword", "Incineroar", "Amoonguss"],
      interpretation: "Protected offense gives Zacian safer paths to close games.",
    },
  ],
]);

const NODE_POSITIONS = [
  { x: 144, y: 100, labelAnchor: "middle", labelDx: 0, labelDy: 36 },
  { x: 74, y: 48, labelAnchor: "start", labelDx: -50, labelDy: -18 },
  { x: 218, y: 48, labelAnchor: "end", labelDx: 50, labelDy: -18 },
];

function compactName(name) {
  return name.replace(" Crowned Sword", "").replace(" Crowned Shield", "");
}

function typeColor(type) {
  return TYPE_COLORS.get(type) || "#8b949e";
}

function usageValue(pokemon) {
  return Number.isFinite(pokemon?.usagePercent) ? pokemon.usagePercent : 0;
}

function linkStrength(edges, source, target, fallbackPercent = 0) {
  const edge = edges.find(
    (item) =>
      (item.source === source && item.target === target) ||
      (item.source === target && item.target === source),
  );
  return Number.isFinite(edge?.coUsagePercent) ? edge.coUsagePercent : fallbackPercent;
}

function fallbackCore(selectedPokemon, teammates) {
  if (!selectedPokemon) return null;
  return {
    members: [selectedPokemon.Name, ...teammates.slice(0, 2).map((teammate) => teammate.name)],
    interpretation: "This team core repeats because the selected Pokémon keeps fitting with the same partners.",
  };
}

function coreFor(selectedPokemon, teammates) {
  return AUTHORED_CORES.get(selectedPokemon?.Name) || fallbackCore(selectedPokemon, teammates);
}

export default function TeamEcosystemPanel({ selectedPokemon, teammates = [], pokemon = [], edges = [] }) {
  const core = coreFor(selectedPokemon, teammates);
  if (!core) return null;

  const pokemonByName = new Map(pokemon.map((entry) => [entry.Name, entry]));
  const fallbackPercentByName = new Map(teammates.map((teammate) => [teammate.name, teammate.percent]));
  const nodes = core.members.slice(0, 3).map((name, index) => {
    const entry = pokemonByName.get(name) || (name === selectedPokemon?.Name ? selectedPokemon : null);
    return {
      name,
      pokemon: entry,
      selected: name === selectedPokemon?.Name,
      ...NODE_POSITIONS[index],
    };
  });
  const links = [
    [0, 1],
    [0, 2],
    [1, 2],
  ]
    .filter(([sourceIndex, targetIndex]) => nodes[sourceIndex] && nodes[targetIndex])
    .map(([sourceIndex, targetIndex]) => {
      const source = nodes[sourceIndex];
      const target = nodes[targetIndex];
      const fallbackPercent = source.selected ? fallbackPercentByName.get(target.name) : target.selected ? fallbackPercentByName.get(source.name) : 0;
      return {
        source,
        target,
        strength: linkStrength(edges, source.name, target.name, fallbackPercent),
      };
    });

  // Node size encodes usage; edge width encodes teammate co-usage strength.
  const nodeRadius = d3
    .scaleSqrt()
    .domain([0, Math.max(70, d3.max(nodes, (node) => usageValue(node.pokemon)) || 0)])
    .range([8, 18]);
  const edgeWidth = d3
    .scaleLinear()
    .domain([0, Math.max(100, d3.max(links, (link) => link.strength) || 0)])
    .range([1.5, 7.5]);

  return (
    <section className="team-ecosystem-panel" aria-label="Team core visualization">
      <h4>Why this team core works</h4>
      <svg className="ecosystem-graph" viewBox="0 0 288 168" role="img" aria-label="Mini team core graph">
        <g className="ecosystem-links">
          {links.map((link) => (
            <line
              key={`${link.source.name}-${link.target.name}`}
              x1={link.source.x}
              y1={link.source.y}
              x2={link.target.x}
              y2={link.target.y}
              strokeWidth={edgeWidth(link.strength)}
              strokeDasharray={link.strength ? undefined : "4 5"}
            />
          ))}
        </g>
        <g className="ecosystem-nodes">
          {nodes.map((node) => (
            <g className={`ecosystem-node${node.selected ? " is-selected" : ""}`} key={node.name}>
              <circle
                cx={node.x}
                cy={node.y}
                r={Math.max(10, nodeRadius(usageValue(node.pokemon))) + (node.selected ? 3 : 0)}
                fill={typeColor(node.pokemon?.Type1)}
              />
              <text x={node.x + node.labelDx} y={node.y + node.labelDy} textAnchor={node.labelAnchor}>
                {compactName(node.name)}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <p className="ecosystem-interpretation">{core.interpretation}</p>
    </section>
  );
}
