// Authored story text, case studies, ranking modes, missions, and constants stay separate from rendering logic.
export const DATA_PATHS = {
  pokemon: "/data/processed/pokemon_clean.csv",
  edges: "/data/processed/team_edges_clean.csv",
  builds: "/data/processed/build_usage_clean.csv",
  images: "/data/processed/image_lookup.csv",
};

export const CASE_STUDIES = [
  "Incineroar",
  "Zacian Crowned Sword",
  "Kyogre",
  "Grimmsnarl",
  "Amoonguss",
  "Rillaboom",
  "Zamazenta Crowned Shield",
  "Mewtwo",
];

export const COMPARISON_NAMES = ["Zacian Crowned Sword", "Zamazenta Crowned Shield", "Incineroar"];

export const PICKER_MODES = [
  { id: "usage", label: "Usage", metricLabel: "Usage" },
  { id: "stats", label: "Stats", metricLabel: "Base stats" },
  { id: "synergy", label: "Synergy", metricLabel: "Teammate footprint" },
];

export const DETAIL_TABS = [
  { id: "evidence", label: "Evidence" },
  { id: "role", label: "Role" },
  { id: "team", label: "Team Core" },
];

export const LOCAL_IMAGE_PATHS = new Map([
  ["Incineroar", "/assets/pokemon/incineroar.png"],
  ["Zacian Crowned Sword", "/assets/pokemon/zacian-crowned-sword.png"],
  ["Kyogre", "/assets/pokemon/kyogre.png"],
  ["Grimmsnarl", "/assets/pokemon/grimmsnarl.png"],
  ["Amoonguss", "/assets/pokemon/amoonguss.png"],
  ["Rillaboom", "/assets/pokemon/rillaboom.png"],
]);

export const STORY_STATS_USAGE_CORRELATION = 0.194;
export const STORY_CONNECTIVITY_USAGE_CORRELATION = 0.903;
export const INCINEROAR_REVEAL_NAME = "Incineroar";

export const CORRELATION_SCAN_SIGNALS = [
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

export const STORY_STEPS = [
  {
    id: "assumption",
    label: "Assumption",
    title: "Raw power looks like the answer.",
    targetId: "assumption-section",
  },
  {
    id: "contradiction",
    label: "Contradiction",
    title: "High stats do not guarantee usage.",
    targetId: "contradiction-section",
    selectedName: "Zamazenta Crowned Shield",
  },
  {
    id: "reveal",
    label: "Network reveal",
    title: "Team context explains the gap.",
    targetId: "reveal-section",
    selectedName: INCINEROAR_REVEAL_NAME,
  },
  {
    id: "explore",
    label: "Explore",
    title: "Test the pattern yourself.",
    targetId: "explore-section",
  },
];

export const EXPLORATION_MISSIONS = [
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

export const EXPLORATION_MISSION_INSIGHTS = new Map([
  [
    "another-incineroar",
    {
      title: "Another Incineroar Found",
      subjectName: "Amoonguss",
      conclusion: "Amoonguss succeeds with moderate raw stats but strong teammate connectivity.",
      nextStep: "Inspect the Role tab to see how support value drives usage.",
    },
  ],
  [
    "failed-stat-monster",
    {
      title: "Failed Stat Monster",
      subjectName: "Zamazenta Crowned Shield",
      conclusion: "Zamazenta has elite raw stats but very low competitive adoption.",
      nextStep: "Compare Usage Rank and Connectivity Rank.",
    },
  ],
  [
    "support-vs-attacker",
    {
      title: "Different Paths to Success",
      subjectName: "Incineroar",
      comparisonName: "Zacian Crowned Sword",
      conclusion: "Zacian and Incineroar reach high usage through different competitive roles.",
      nextStep: "Inspect the Ego Comparison view above.",
    },
  ],
  [
    "test-network-claim",
    {
      title: "Ranking changes when team connectivity becomes the focus",
      subjectName: "Incineroar",
      conclusion:
        "The leaders shift when you rank by Synergy instead of raw Stats. That change is the thesis: network position reveals value that base stats miss.",
      nextStep: "Switch between Usage and Synergy rankings.",
    },
  ],
]);

export const ROLE_NOTES = new Map([
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

export const NETWORK_ARCHETYPES = [
  { label: "Support pivots", anchorName: "Incineroar", dx: 24, dy: -36 },
  { label: "Restricted attackers", anchorName: "Zacian Crowned Sword", dx: 28, dy: 34 },
  { label: "Weather pressure", anchorName: "Kyogre", dx: 26, dy: -30 },
  { label: "Screen control", anchorName: "Grimmsnarl", dx: 24, dy: 32 },
  { label: "Redirection support", anchorName: "Amoonguss", dx: 24, dy: -34 },
  { label: "Terrain utility", anchorName: "Rillaboom", dx: 24, dy: 32 },
];
