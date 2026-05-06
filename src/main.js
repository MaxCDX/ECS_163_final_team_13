import * as d3 from "d3";
import "./styles.css";

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

const typeColors = new Map([
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

const networkEl = document.querySelector("#network-graph");
const comparisonEl = document.querySelector("#comparison-view");
const detailPanel = document.querySelector("#detail-panel");
const tooltip = document.querySelector("#tooltip");
const resetButton = document.querySelector("#reset-selection");
const networkNote = document.querySelector("#network-note");
const networkCount = document.querySelector("#network-count");

const formatPercent = d3.format(".0f");
const formatNumber = d3.format(",");
const formatWeighted = d3.format(",.0f");

let state = {
  pokemon: [],
  edges: [],
  builds: [],
  imageLookup: new Map(),
  nodes: [],
  links: [],
  selectedName: "Incineroar",
};

let activeSimulation = null;

function escapeHtml(value) {
  return String(value ?? "Unknown")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imageFor(name) {
  return state.imageLookup.get(name) || "";
}

function typeLabel(d) {
  return d.Type2 ? `${d.Type1} / ${d.Type2}` : d.Type1;
}

function typeColor(type) {
  return typeColors.get(type) || "#8b949e";
}

function usageValue(d) {
  return Number.isFinite(d.usagePercent) ? d.usagePercent : 0;
}

function buildNetworkSubset(pokemon, edges) {
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

  for (const d of pokemon) {
    const metric = metrics.get(d.Name) || { degree: 0, weightedDegree: 0 };
    d.degree = metric.degree;
    d.weightedDegree = metric.weightedDegree;
  }

  const byName = new Map(pokemon.map((d) => [d.Name, d]));
  const selected = new Set(CASE_STUDIES.filter((name) => byName.has(name)));

  const ranked = [...pokemon]
    .filter((d) => !d.missingBaseStats && (d.hasUsageData || d.weightedDegree > 0))
    .sort((a, b) => d3.descending(a.weightedDegree + usageValue(a) * 65, b.weightedDegree + usageValue(b) * 65));

  for (const d of ranked) {
    if (selected.size >= 52) break;
    selected.add(d.Name);
  }

  const nodes = [...selected].map((name) => ({ ...byName.get(name) })).filter(Boolean);
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

function getBuildRows(name, category) {
  return state.builds
    .filter((row) => row.pokemon === name && row.category === category)
    .sort((a, b) => d3.descending(a.usagePercent, b.usagePercent));
}

function getTopTeammates(name) {
  return state.edges
    .filter((edge) => edge.source === name || edge.target === name)
    .map((edge) => ({
      name: edge.source === name ? edge.target : edge.source,
      percent: edge.coUsagePercent,
    }))
    .sort((a, b) => d3.descending(a.percent, b.percent))
    .slice(0, 5);
}

function renderComparison() {
  const data = COMPARISON_NAMES.map((name) => state.pokemon.find((d) => d.Name === name)).filter(Boolean);
  const width = comparisonEl.clientWidth || 620;
  const height = 330;
  const margin = { top: 28, right: 26, bottom: 56, left: 64 };

  comparisonEl.innerHTML = "";

  const svg = d3
    .select(comparisonEl)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);

  const x = d3
    .scaleLinear()
    .domain([450, 740])
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleLinear()
    .domain([0, 70])
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
    .append("line")
    .attr("class", "comparison-guide")
    .attr("x1", x(530))
    .attr("x2", x(720))
    .attr("y1", y(59))
    .attr("y2", y(0));

  svg
    .append("g")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("class", "comparison-dot")
    .attr("cx", (d) => x(d.Total))
    .attr("cy", (d) => y(usageValue(d)))
    .attr("r", (d) => (d.Name === "Incineroar" ? 11 : 9))
    .attr("fill", (d) => typeColor(d.Type1));

  svg
    .append("g")
    .selectAll("text")
    .data(data)
    .join("text")
    .attr("class", "comparison-label")
    .attr("x", (d) => x(d.Total) + 12)
    .attr("y", (d) => y(usageValue(d)) - 10)
    .text((d) => d.Name.replace(" Crowned Sword", "").replace(" Crowned Shield", ""));
}

function connectedNames(selectedName) {
  if (!selectedName) return new Set();
  const connected = new Set([selectedName]);
  for (const edge of state.links) {
    if (edge.sourceName === selectedName) connected.add(edge.targetName);
    if (edge.targetName === selectedName) connected.add(edge.sourceName);
  }
  return connected;
}

function updateSelection(selectedName) {
  state.selectedName = selectedName;
  const connected = connectedNames(selectedName);

  d3.select(networkEl)
    .selectAll(".link")
    .classed("is-muted", (d) => selectedName && d.sourceName !== selectedName && d.targetName !== selectedName)
    .classed("is-active", (d) => selectedName && (d.sourceName === selectedName || d.targetName === selectedName));

  d3.select(networkEl)
    .selectAll(".node")
    .classed("is-muted", (d) => selectedName && !connected.has(d.Name))
    .classed("is-selected", (d) => d.Name === selectedName)
    .classed("is-neighbor", (d) => selectedName && d.Name !== selectedName && connected.has(d.Name));

  renderDetail(selectedName ? state.nodes.find((d) => d.Name === selectedName) : null);
  networkNote.textContent = selectedName
    ? `${selectedName} is selected. Its brightest links show common teammates.`
    : "Click a Pokemon to lock its team relationships.";
}

function renderNetwork() {
  if (activeSimulation) activeSimulation.stop();

  const width = networkEl.clientWidth || 820;
  const height = Math.max(560, Math.min(720, width * 0.72));

  networkEl.innerHTML = "";
  tooltip.hidden = true;

  const svg = d3
    .select(networkEl)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);

  const links = state.links.map((d) => ({
    ...d,
    source: d.sourceName,
    target: d.targetName,
  }));
  const nodes = state.nodes.map((d) => ({ ...d }));

  const radius = d3
    .scaleSqrt()
    .domain([0, d3.max(nodes, usageValue) || 1])
    .range([6, 24]);

  const edgeWidth = d3
    .scaleLinear()
    .domain(d3.extent(links, (d) => d.coUsagePercent))
    .range([0.8, 4.5]);

  const link = svg
    .append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "link")
    .attr("stroke-width", (d) => edgeWidth(d.coUsagePercent))
    .attr("stroke-opacity", (d) => Math.min(0.55, 0.14 + d.coUsagePercent / 180));

  const node = svg
    .append("g")
    .attr("class", "nodes")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("class", "node")
    .attr("r", (d) => radius(usageValue(d)))
    .attr("fill", (d) => typeColor(d.Type1))
    .attr("stroke-width", (d) => (CASE_STUDIES.includes(d.Name) ? 2.4 : 1.2))
    .on("mouseenter", (event, d) => showTooltip(event, d))
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .on("click", (event, d) => {
      event.stopPropagation();
      updateSelection(d.Name === state.selectedName ? null : d.Name);
    })
    .call(
      d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) activeSimulation.alphaTarget(0.25).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) activeSimulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

  const label = svg
    .append("g")
    .attr("class", "labels")
    .selectAll("text")
    .data(nodes.filter((d) => CASE_STUDIES.includes(d.Name) || usageValue(d) >= 20))
    .join("text")
    .attr("class", "node-label")
    .text((d) => d.Name.replace(" Crowned Sword", "").replace(" Crowned Shield", ""));

  activeSimulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
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
      nodes.forEach((d) => {
        d.x = Math.max(34, Math.min(width - 34, d.x));
        d.y = Math.max(34, Math.min(height - 34, d.y));
      });

      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

      label.attr("x", (d) => d.x + radius(usageValue(d)) + 5).attr("y", (d) => d.y + 4);
    });

  svg.on("click", () => updateSelection(null));
  updateSelection(state.selectedName);
}

function renderDetail(d) {
  if (!d) {
    detailPanel.innerHTML = `
      <p class="section-label">Selected Pokemon</p>
      <h3>Choose a node</h3>
      <p class="panel-copy">Click a Pokemon in the network to see its team role, common partners, and build choices.</p>
    `;
    return;
  }

  const moves = getBuildRows(d.Name, "move").slice(0, 4);
  const items = getBuildRows(d.Name, "item").slice(0, 1);
  const abilities = getBuildRows(d.Name, "ability").slice(0, 1);
  const teammates = getTopTeammates(d.Name);

  detailPanel.innerHTML = `
    <div class="pokemon-heading">
      <img src="${escapeHtml(imageFor(d.Name))}" alt="" />
      <div>
        <p class="section-label">Selected Pokemon</p>
        <h3>${escapeHtml(d.Name)}</h3>
        <div class="type-row">
          <span style="--type-color:${typeColor(d.Type1)}">${escapeHtml(d.Type1)}</span>
          ${d.Type2 ? `<span style="--type-color:${typeColor(d.Type2)}">${escapeHtml(d.Type2)}</span>` : ""}
        </div>
      </div>
    </div>

    <dl class="metric-grid">
      <div><dt>Total stats</dt><dd>${formatNumber(d.Total)}</dd></div>
      <div><dt>Usage</dt><dd>${formatPercent(usageValue(d))}%</dd></div>
      <div><dt>Rank</dt><dd>${Number.isFinite(d.monthlyRank) ? formatNumber(d.monthlyRank) : "N/A"}</dd></div>
      <div><dt>Partners</dt><dd>${formatNumber(d.degree)}</dd></div>
      <div><dt>Synergy weight</dt><dd>${formatWeighted(d.weightedDegree)}</dd></div>
    </dl>

    ${renderList("Common moves", moves)}
    ${renderList("Top item", items)}
    ${renderList("Top ability", abilities)}
    ${renderTeammates(teammates)}
  `;
}

function renderList(title, rows) {
  if (!rows.length) return "";
  return `
    <section class="detail-list">
      <h4>${title}</h4>
      <ul>
        ${rows
          .map((row) => `<li><span>${escapeHtml(row.name)}</span><strong>${formatPercent(row.usagePercent)}%</strong></li>`)
          .join("")}
      </ul>
    </section>
  `;
}

function renderTeammates(rows) {
  if (!rows.length) return "";
  return `
    <section class="detail-list">
      <h4>Common teammates</h4>
      <ul>
        ${rows
          .map((row) => `<li><span>${escapeHtml(row.name)}</span><strong>${formatPercent(row.percent)}%</strong></li>`)
          .join("")}
      </ul>
    </section>
  `;
}

function showTooltip(event, d) {
  tooltip.hidden = false;
  tooltip.innerHTML = `
    <div class="tooltip-heading">
      <img src="${escapeHtml(imageFor(d.Name))}" alt="" />
      <div>
        <strong>${escapeHtml(d.Name)}</strong>
        <span>${escapeHtml(typeLabel(d))}</span>
      </div>
    </div>
    <dl>
      <dt>Total stats</dt><dd>${formatNumber(d.Total)}</dd>
      <dt>Usage</dt><dd>${formatPercent(usageValue(d))}%</dd>
      <dt>Partners</dt><dd>${formatNumber(d.degree)}</dd>
    </dl>
  `;
  moveTooltip(event);
}

function moveTooltip(event) {
  const bounds = networkEl.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  tooltip.style.transform = `translate(${Math.min(x + 18, bounds.width - 260)}px, ${Math.max(y - 26, 12)}px)`;
}

function hideTooltip() {
  tooltip.hidden = true;
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

async function init() {
  const [pokemon, edges, builds, images] = await Promise.all([
    d3.csv(DATA_PATHS.pokemon, parsePokemon),
    d3.csv(DATA_PATHS.edges, parseEdge),
    d3.csv(DATA_PATHS.builds, parseBuild),
    d3.csv(DATA_PATHS.images, parseImage),
  ]);

  state.pokemon = pokemon.filter((d) => !d.missingBaseStats);
  state.edges = edges;
  state.builds = builds;
  state.imageLookup = new Map(images.map((d) => [d.pokemon, d.imagePathOrUrl]));

  const subset = buildNetworkSubset(state.pokemon, state.edges);
  state.nodes = subset.nodes;
  state.links = subset.links;
  networkCount.textContent = state.nodes.length;

  renderComparison();
  renderNetwork();
}

resetButton.addEventListener("click", () => updateSelection(null));
window.addEventListener("resize", () => {
  renderComparison();
  renderNetwork();
});

init().catch((error) => {
  networkEl.innerHTML = `<p class="load-error">Could not load the processed Pokemon data. ${escapeHtml(error.message)}</p>`;
});
