// Turns move, ability, and team-role evidence into a short causal story.
// This explains team fit instead of treating raw stats as the whole answer.
const ROLE_CAUSALITY_EXPLANATIONS = new Map([
  [
    "Incineroar",
    {
      steps: [
        ["Intimidate", "reduces opponent pressure"],
        ["Fake Out", "creates safe turns"],
        ["Parting Shot", "resets positioning"],
        ["Team Fit", "works across many team styles"],
      ],
      outcome: "repeatedly appears on successful teams",
    },
  ],
  [
    "Amoonguss",
    {
      steps: [
        ["Spore", "slows opposing plans"],
        ["Rage Powder", "protects teammates"],
        ["Regenerator", "stays useful over time"],
      ],
      outcome: "supports steady team play",
    },
  ],
  [
    "Zacian Crowned Sword",
    {
      steps: [
        ["High attack", "creates offensive pressure"],
        ["Strong coverage", "threatens many targets"],
        ["Consistent damage", "closes games reliably"],
      ],
      outcome: "anchors direct attacking teams",
    },
  ],
  [
    "Kyogre",
    {
      steps: [
        ["Drizzle", "powers rain-based offense"],
        ["Water Spout", "rewards safe positioning"],
        ["Team Support", "preserves full-power attacks"],
      ],
      outcome: "turns team support into sweeping pressure",
    },
  ],
  [
    "Landorus Therian Forme",
    {
      steps: [
        ["Intimidate", "lowers physical pressure"],
        ["Earthquake", "threatens broad damage"],
        ["Flexible Coverage", "fits many board states"],
      ],
      outcome: "blends disruption with repeated offensive value",
    },
  ],
  [
    "Regieleki",
    {
      steps: [
        ["Extreme Speed", "moves before many threats"],
        ["Fast Pressure", "forces immediate responses"],
        ["Team Support", "helps partners keep momentum"],
      ],
      outcome: "creates value through speed and tempo",
    },
  ],
  [
    "Rillaboom",
    {
      steps: [
        ["Grassy Surge", "adds recovery and terrain"],
        ["Fake Out", "creates safe turns"],
        ["Grassy Glide", "adds priority pressure"],
      ],
      outcome: "fits many teams as flexible utility",
    },
  ],
  [
    "Grimmsnarl",
    {
      steps: [
        ["Prankster", "moves support actions first"],
        ["Dual Screens", "reduces incoming damage"],
        ["Disruption", "slows opposing plans"],
      ],
      outcome: "extends the life of offensive teammates",
    },
  ],
  [
    "Calyrex Shadow Rider",
    {
      steps: [
        ["Astral Barrage", "pressures both opponents"],
        ["Elite Speed", "acts before many threats"],
        ["Partner Support", "creates safer attack windows"],
      ],
      outcome: "converts tempo into fast offensive wins",
    },
  ],
  [
    "Calyrex Ice Rider",
    {
      steps: [
        ["Glacial Lance", "pressures both opponents"],
        ["Trick Room", "turns low speed into priority"],
        ["Bulky Partners", "help it survive setup turns"],
      ],
      outcome: "anchors slow, durable attacking teams",
    },
  ],
  [
    "Thundurus Incarnate Forme",
    {
      steps: [
        ["Prankster", "enables fast disruption"],
        ["Speed Control", "helps attackers move first"],
        ["Team Support", "opens safer damage windows"],
      ],
      outcome: "raises the consistency of offensive cores",
    },
  ],
  [
    "Tornadus Incarnate Forme",
    {
      steps: [
        ["Prankster", "acts before many threats"],
        ["Speed Control", "lets partners move first"],
        ["Flexible Support", "fits many offensive teams"],
      ],
      outcome: "improves the tempo of fast team cores",
    },
  ],
  [
    "Zamazenta Crowned Shield",
    {
      steps: [
        ["Dauntless Shield", "adds immediate bulk"],
        ["Coaching", "strengthens physical partners"],
        ["Wide Guard", "blocks spread attacks"],
      ],
      outcome: "offers support, but sees limited team demand",
    },
  ],
  [
    "Groudon",
    {
      steps: [
        ["Drought", "powers sun-based pressure"],
        ["Spread Damage", "threatens both opponents"],
        ["Weather Core", "works with dedicated partners"],
      ],
      outcome: "anchors high-pressure sun teams",
    },
  ],
  [
    "Gastrodon",
    {
      steps: [
        ["Storm Drain", "redirects water pressure"],
        ["Board Stability", "covers key team weaknesses"],
        ["Slow Utility", "supports heavier team styles"],
      ],
      outcome: "stays relevant by protecting valuable partners",
    },
  ],
  [
    "Indeedee Female",
    {
      steps: [
        ["Psychic Terrain", "blocks priority pressure"],
        ["Follow Me", "protects key attackers"],
        ["Support Core", "creates safer setup turns"],
      ],
      outcome: "enables fragile teammates to execute plans",
    },
  ],
  [
    "Whimsicott",
    {
      steps: [
        ["Prankster", "delivers support immediately"],
        ["Tailwind", "raises team speed"],
        ["Utility Moves", "opens favorable board states"],
      ],
      outcome: "turns speed control into team-wide value",
    },
  ],
]);

const NODE_WIDTH = 178;
const NODE_HEIGHT = 30;
const NODE_X = 31;
const NODE_START_Y = 10;
const NODE_GAP = 18;
const OUTCOME_GAP = 22;

function roleCausalityFor(pokemon) {
  if (!pokemon) return null;
  return ROLE_CAUSALITY_EXPLANATIONS.get(pokemon.Name) || null;
}

function usageValue(pokemon) {
  if (Number.isFinite(pokemon?.usagePercent)) return pokemon.usagePercent;
  if (typeof pokemon?.usagePercent === "string") {
    const parsed = Number.parseFloat(pokemon.usagePercent.replace("%", "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function compactEvidenceLabel(label = "", maxLength = 20) {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 3).trimEnd()}...`;
}

function fallbackRoleFlow({ selectedPokemon, abilities = [], moves = [], items = [], teammates = [] }) {
  // Non-authored Pokemon still get an interpretable role flow from available evidence.
  if (!selectedPokemon) return null;

  const steps = [];
  const topAbility = abilities[0];
  const topMove = moves[0];
  const topTeammate = teammates[0];
  const topItem = items[0];

  if (topAbility?.name) steps.push([compactEvidenceLabel(topAbility.name), "Common ability"]);
  if (topMove?.name) steps.push([compactEvidenceLabel(topMove.name), "Common move"]);
  if (topTeammate?.name) {
    steps.push([compactEvidenceLabel(topTeammate.name), "Frequent teammate"]);
  } else if (topItem?.name) {
    steps.push([compactEvidenceLabel(topItem.name), "Common item"]);
  }

  if (steps.length < 2) {
    return {
      steps: [],
      outcome: "No role evidence available for this Pokémon.",
    };
  }

  const outcome =
    usageValue(selectedPokemon) === 0
      ? "Strong stats, limited demand"
      : (selectedPokemon.weightedDegree || 0) > (selectedPokemon.Total || 0)
        ? "Team fit drives value"
        : (selectedPokemon.degree || 0) > 50
          ? "Strong network presence"
          : "Competitive role signal";

  return { steps, outcome };
}

function flowNodes(explanation) {
  const nodes = [
    ...explanation.steps.map(([label, detail]) => ({ label, detail, kind: "step" })),
    { label: "Outcome", detail: explanation.outcome, kind: "outcome" },
  ];
  return {
    nodes,
    height: NODE_START_Y * 2 + nodes.length * NODE_HEIGHT + (nodes.length - 2) * NODE_GAP + OUTCOME_GAP,
  };
}

function nodeY(index, isOutcome) {
  return NODE_START_Y + index * (NODE_HEIGHT + NODE_GAP) + (isOutcome ? OUTCOME_GAP - NODE_GAP : 0);
}

export default function RoleCausalityCard({ selectedPokemon, abilities = [], moves = [], items = [], teammates = [] }) {
  const explanation = roleCausalityFor(selectedPokemon) || fallbackRoleFlow({ selectedPokemon, abilities, moves, items, teammates });
  const { nodes, height } = flowNodes(explanation);

  return (
    <section className="role-causality-card" aria-label="Competitive role flow diagram">
      <h4>Why this role works</h4>
      <svg className="role-flow-diagram" viewBox={`0 0 240 ${height}`} role="img" aria-label="Role causality flow">
        <g className="role-flow-connectors">
          {nodes.slice(0, -1).map((node, index) => {
            const currentY = nodeY(index, node.kind === "outcome") + NODE_HEIGHT;
            const nextNode = nodes[index + 1];
            const nextY = nodeY(index + 1, nextNode.kind === "outcome");
            return (
              <g key={`${node.label}-${nextNode.label}`}>
                <line x1="120" y1={currentY + 2} x2="120" y2={nextY - 6} />
                <path d={`M114 ${nextY - 10} L120 ${nextY - 2} L126 ${nextY - 10}`} />
              </g>
            );
          })}
        </g>
        <g className="role-flow-nodes">
          {nodes.map((node, index) => {
            const isOutcome = node.kind === "outcome";
            const y = nodeY(index, isOutcome);
            return (
              <g className={`role-flow-node${isOutcome ? " is-outcome" : ""}`} key={`${node.label}-${node.detail}`}>
                <rect x={NODE_X} y={y} width={NODE_WIDTH} height={NODE_HEIGHT} rx="7" />
                <text className="role-node-label" x="46" y={y + 13}>
                  {node.label}
                </text>
                <text className="role-node-detail" x="46" y={y + 24}>
                  {node.detail}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </section>
  );
}
