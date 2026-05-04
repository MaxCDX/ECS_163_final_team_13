import * as d3 from "d3";
import "./styles.css";

const DATA_PATH = "/ai_impact_jobs_2010_2025.csv";

const columns = {
  year: "posting_year",
  country: "country",
  region: "region",
  industry: "industry",
  jobTitle: "job_title",
  salary: "salary_usd",
  automationRisk: "automation_risk_score",
  displacementRisk: "ai_job_displacement_risk",
};

const chartEl = document.querySelector("#scatter-plot");
const tooltip = document.querySelector("#tooltip");
const industryFilter = document.querySelector("#industry-filter");
const yearSlider = document.querySelector("#year-slider");
const yearValue = document.querySelector("#year-value");
const yearControl = document.querySelector("#year-control");
const allYearsButton = document.querySelector("#all-years-button");
const recordCount = document.querySelector("#record-count");
const chartNote = document.querySelector("#chart-note");
const legend = document.querySelector("#legend");

const formatSalary = d3.format("$,.0f");
const formatRisk = d3.format(".2f");
const formatCount = d3.format(",");
const DEFAULT_SAMPLE_SIZE = 1200;
const FILTERED_POINT_CAP = 1500;
const HIGH_RISK_CUTOFF = 0.6;

let allData = [];
let selectedIndustry = "All industries";
let selectedYear = "All years";
let highlightedIndustry = null;

function valueOrFallback(value, fallback = "Unknown") {
  return value === undefined || value === null || value === "" ? fallback : value;
}

function escapeHtml(value) {
  return String(valueOrFallback(value))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stableHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function normalizeRow(row, index) {
  const jobTitle = row[columns.jobTitle];
  const salary = Number(row[columns.salary]);
  const year = Number(row[columns.year]);
  const country = row[columns.country];

  return {
    year,
    country: row[columns.country],
    region: row[columns.region],
    industry: row[columns.industry],
    jobTitle,
    salary,
    automationRisk: Number(row[columns.automationRisk]),
    displacementRisk: row[columns.displacementRisk],
    sampleScore: stableHash(`${jobTitle}-${salary}-${year}-${country}-${index}`),
  };
}

function getFilteredData() {
  return allData.filter((d) => {
    const industryMatches = selectedIndustry === "All industries" || d.industry === selectedIndustry;
    const yearMatches = selectedYear === "All years" || d.year === selectedYear;
    return industryMatches && yearMatches;
  });
}

function stableSample(data, targetSize, balancedLayers = false) {
  if (data.length <= targetSize) return data;

  const highRisk = data.filter((d) => d.automationRisk >= HIGH_RISK_CUTOFF);
  const lowRisk = data.filter((d) => d.automationRisk < HIGH_RISK_CUTOFF);
  const byScore = (a, b) => a.sampleScore - b.sampleScore;
  const sortedHigh = [...highRisk].sort(byScore);
  const sortedLow = [...lowRisk].sort(byScore);

  let highTarget = balancedLayers
    ? Math.min(highRisk.length, Math.round(targetSize / 2))
    : Math.round(targetSize * (highRisk.length / data.length));
  let lowTarget = Math.min(lowRisk.length, targetSize - highTarget);
  highTarget = Math.min(highRisk.length, targetSize - lowTarget);

  const sampled = [
    ...sortedHigh.slice(0, highTarget),
    ...sortedLow.slice(0, lowTarget),
  ];

  return sampled.sort(byScore);
}

function getDisplayData(filteredData) {
  const isOverview = selectedIndustry === "All industries" && selectedYear === "All years";
  if (isOverview) return stableSample(filteredData, DEFAULT_SAMPLE_SIZE, true);
  return stableSample(filteredData, FILTERED_POINT_CAP);
}

function setupControls(data) {
  const industries = ["All industries", ...Array.from(new Set(data.map((d) => d.industry))).sort()];
  industryFilter.replaceChildren(
    ...industries.map((industry) => {
      const option = document.createElement("option");
      option.value = industry;
      option.textContent = industry;
      return option;
    }),
  );

  industryFilter.addEventListener("change", (event) => {
    selectedIndustry = event.target.value;
    highlightedIndustry = null;
    render();
  });

  const years = Array.from(new Set(data.map((d) => d.year))).sort((a, b) => a - b);
  if (years.length > 1) {
    yearSlider.min = years[0];
    yearSlider.max = years.at(-1);
    yearSlider.step = 1;
    yearSlider.value = years.at(-1);
    selectedYear = "All years";
    yearValue.textContent = "All years";

    yearSlider.addEventListener("input", (event) => {
      selectedYear = Number(event.target.value);
      yearValue.textContent = selectedYear;
      render();
    });

    allYearsButton.addEventListener("click", () => {
      selectedYear = "All years";
      yearValue.textContent = "All years";
      yearSlider.value = years.at(-1);
      render();
    });
  } else {
    yearControl.hidden = true;
    allYearsButton.hidden = true;
  }
}

function showTooltip(event, d) {
  tooltip.hidden = false;
  tooltip.innerHTML = `
    <strong>${escapeHtml(d.jobTitle)}</strong>
    <span>${escapeHtml(d.industry)} · ${escapeHtml(d.displacementRisk)} displacement risk</span>
    <dl>
      <dt>Salary</dt><dd>${formatSalary(d.salary)}</dd>
      <dt>Automation risk</dt><dd>${formatRisk(d.automationRisk)}</dd>
      <dt>Year</dt><dd>${escapeHtml(d.year)}</dd>
      <dt>Location</dt><dd>${escapeHtml(d.region)}, ${escapeHtml(d.country)}</dd>
    </dl>
  `;
  moveTooltip(event);
}

function moveTooltip(event) {
  const bounds = chartEl.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  const maxX = Math.max(12, bounds.width - 250);
  tooltip.style.transform = `translate(${Math.max(12, Math.min(x + 18, maxX))}px, ${Math.max(y - 30, 12)}px)`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function pointOpacity(d) {
  if (highlightedIndustry) return d.industry === highlightedIndustry ? 0.82 : 0.06;
  return selectedIndustry === "All industries" ? 0.28 : 0.55;
}

function pointColor(d, color) {
  if (highlightedIndustry) return d.industry === highlightedIndustry ? color(d.industry) : "#aeb8bf";
  if (selectedIndustry !== "All industries") return color(d.industry);
  return "#68737d";
}

function pointRadius() {
  return selectedIndustry === "All industries" && !highlightedIndustry ? 2.8 : 3.5;
}

function setIndustryHighlight(industry, color) {
  highlightedIndustry = industry;

  d3.select(chartEl)
    .selectAll(".dot")
    .attr("fill", (d) => pointColor(d, color))
    .attr("r", pointRadius())
    .attr("fill-opacity", pointOpacity)
    .attr("stroke-opacity", (d) => (highlightedIndustry && d.industry !== highlightedIndustry ? 0.04 : 0.14));

  legend.querySelectorAll(".legend__item").forEach((item) => {
    item.classList.toggle("is-muted", highlightedIndustry && item.dataset.industry !== highlightedIndustry);
    item.classList.toggle("is-active", item.dataset.industry === highlightedIndustry);
  });
}

function render() {
  if (!allData.length || !chartEl.clientWidth) return;

  const filteredData = getFilteredData();
  const data = getDisplayData(filteredData);
  const width = chartEl.clientWidth;
  const height = Math.max(460, Math.min(620, width * 0.58));
  const margin = { top: 56, right: 32, bottom: 68, left: 78 };

  chartEl.innerHTML = "";
  tooltip.hidden = true;

  const svg = d3
    .select(chartEl)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);

  const x = d3
    .scaleLinear()
    .domain(d3.extent(allData, (d) => d.salary))
    .nice()
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(allData, (d) => d.automationRisk)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const industries = Array.from(new Set(allData.map((d) => d.industry))).sort();
  const color = d3.scaleOrdinal(industries, d3.schemeTableau10);
  renderLegend(industries, color);

  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickSize(-(height - margin.top - margin.bottom)).tickFormat(""))
    .call((g) => g.select(".domain").remove());

  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickSize(-(width - margin.left - margin.right)).tickFormat(""))
    .call((g) => g.select(".domain").remove());

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(formatSalary));

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 20)
    .attr("text-anchor", "middle")
    .text("Annual salary (USD)");

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", -height / 2)
    .attr("y", 24)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Automation risk score");

  const highBandTop = y(y.domain()[1]);
  const highBandBottom = y(HIGH_RISK_CUTOFF);

  // A light reference band makes the high-risk threshold visible without adding another chart.
  svg
    .append("rect")
    .attr("class", "risk-band")
    .attr("x", margin.left)
    .attr("y", highBandTop)
    .attr("width", width - margin.left - margin.right)
    .attr("height", highBandBottom - highBandTop);

  const bandLabelX = margin.left;
  const bandLabelY = 24;

  svg
    .append("rect")
    .attr("class", "band-label-bg")
    .attr("x", bandLabelX - 8)
    .attr("y", bandLabelY - 20)
    .attr("width", 286)
    .attr("height", 28)
    .attr("rx", 6);

  svg
    .append("text")
    .attr("class", "band-label")
    .attr("x", bandLabelX)
    .attr("y", bandLabelY)
    .text("High exposure zone: automation risk ≥ 0.6");

  const dots = svg
    .append("g")
    .selectAll("circle")
    .data(data, (d) => `${d.jobTitle}-${d.salary}-${d.year}-${d.country}`);

  dots
    .join("circle")
    .attr("class", "dot")
    .attr("cx", (d) => x(d.salary))
    .attr("cy", (d) => y(d.automationRisk))
    .attr("r", pointRadius())
    .attr("fill", (d) => pointColor(d, color))
    .attr("fill-opacity", pointOpacity)
    .attr("stroke", "#101820")
    .attr("stroke-opacity", (d) => (highlightedIndustry && d.industry !== highlightedIndustry ? 0.04 : 0.14))
    .on("mouseenter", function (event, d) {
      d3.select(this).attr("r", 6).attr("fill", color(d.industry)).attr("fill-opacity", 0.95);
      showTooltip(event, d);
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function () {
      d3.select(this).attr("r", pointRadius()).attr("fill", (d) => pointColor(d, color)).attr("fill-opacity", pointOpacity);
      hideTooltip();
    });

  setIndustryHighlight(highlightedIndustry, color);

  const sampleText =
    data.length < filteredData.length ? `${formatCount(data.length)} of ${formatCount(filteredData.length)} postings shown` : `${formatCount(data.length)} postings shown`;
  chartNote.textContent = `${sampleText}. Risk forms visible layers rather than a smooth salary gradient.`;
}

function renderLegend(industries, color) {
  const visibleIndustries =
    selectedIndustry === "All industries" ? industries : industries.filter((d) => d === selectedIndustry);

  legend.innerHTML = visibleIndustries
    .map(
      (industry) => `
        <span class="legend__item" data-industry="${escapeHtml(industry)}" role="button" tabindex="0">
          <span class="legend__swatch" style="background:${color(industry)}"></span>
          ${escapeHtml(industry)}
        </span>
      `,
    )
    .join("");

  legend.querySelectorAll(".legend__item").forEach((item, index) => {
    const industry = visibleIndustries[index];
    const toggleIndustry = () => {
      setIndustryHighlight(highlightedIndustry === industry ? null : industry, color);
    };

    item.addEventListener("click", toggleIndustry);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleIndustry();
      }
    });
  });

  setIndustryHighlight(highlightedIndustry, color);
}

async function init() {
  const raw = await d3.csv(DATA_PATH);
  allData = raw
    .map(normalizeRow)
    .filter((d) => Number.isFinite(d.salary) && Number.isFinite(d.automationRisk));

  recordCount.textContent = formatCount(allData.length);
  setupControls(allData);
  render();
}

window.addEventListener("resize", render);
init().catch((error) => {
  chartEl.innerHTML = `<p class="load-error">Could not load the CSV dataset. ${error.message}</p>`;
});
