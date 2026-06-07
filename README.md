# What Really Makes a Pokémon Strong?

ECS 163 Final Project, Team 13

## Overview

This project is a narrative data visualization about competitive Pokémon usage. The central research question is:

**Do raw base stats explain competitive success, or does team connectivity explain usage better?**

The visualization tests the common assumption that stronger Pokémon should be used more often. It then shows a contradiction: some high-stat Pokémon have low usage, while Incineroar has moderate stats but very high competitive adoption. The main insight is that teammate connectivity and repeated team structure explain usage better than raw stat total alone.

The system uses a Martini Glass storytelling structure:

1. Start with an authored story about the raw-stats assumption.
2. Show a contradiction in the stats-vs-usage scatterplot.
3. Compare explanatory signals with a correlation scan.
4. Reveal the team synergy network as the main evidence.
5. Let readers explore additional examples through guided missions and a ranked picker.

The committed processed dataset contains:

- 1,098 Pokémon forms in the cleaned source table.
- 2,606 teammate co-usage links.
- 2,967 move, item, and ability build records.

## Repository Structure

```text
src/
  components/    Reusable UI components
  data/          Story configuration and data loading
  utils/         Metrics, filtering, and network helpers
  App.jsx        Main visualization orchestration

public/
  data/processed/ Runtime CSV data
  assets/pokemon/ Local Pokémon sprites

scripts/         Optional preprocessing utilities
```

The application follows a coordinated-view architecture. App.jsx manages shared state, D3 visualizations provide the primary analytical views, components contain reusable UI elements, data contains story configuration and loading logic, and utils contains metric, filtering, and network helper functions.

## Visualization System

The application is organized as coordinated views. All major views share selected Pokémon state so that user actions in one view update the rest of the story.

### Scatterplot: Stats vs. Usage

- D3 scatterplot showing the relationship between base stats and competitive usage.
- Color encodes Pokémon type.
- Brushing selects a subset for focus.
- Clicking selects a Pokémon for detailed evidence.

### Signal Scan

- D3 correlation comparison of candidate explanations for usage.
- Highlights which signals best explain competitive adoption.

### Team Synergy Network

- D3 force-directed network showing teammate relationships.
- Node size encodes usage.
- Edge width encodes teammate co-usage strength.
- Supports hover, click, and linked highlighting.

### Ego Network Comparison

- Compares the local teammate structures of two Pokémon.
- Summarizes usage, stats, connectivity, and teammate footprint.

### Selected Pokémon Detail Panel

- Evidence view for moves, items, abilities, and teammates.
- Role explanation view.
- Team core mini-network view.

### Guided Exploration Missions and Picker

- Guided missions provide example analyses.
- Search and ranking modes support open exploration.

## Major Interactions

- **Hover:** network nodes and team-core nodes provide compact contextual tooltips.
- **Click selection:** scatterplot points, network nodes, hero cards, and picker results update the selected Pokémon.
- **Brushing:** scatterplot brushing creates a focused subset and highlights related network nodes.
- **Linked highlighting:** selections and brushed subsets propagate across scatterplot, network, comparison, and detail views.
- **Comparison selector:** first and second selected Pokémon can be changed independently.
- **Ranking mode switches:** picker can rank by usage, raw stats, or teammate footprint.
- **Guided missions:** buttons jump to prepared exploration states that test the thesis.

## Installation

### Requirements

- Node.js 18 or newer is recommended.
- npm is required. This repository includes `package-lock.json`, so `npm install` is the expected install command.
- Python is not required for normal demo execution. Python is only needed if regenerating processed data.

### Clone Repository

```bash
git clone <repository-url>
cd ECS_163_final
```

Replace `<repository-url>` with the submitted repository URL.

### Install Dependencies

```bash
npm install
```

## Data

The runnable visualization uses the committed CSV files in:

```text
public/data/processed/
```

These files are already included and are sufficient for a fresh-clone run:

- `public/data/processed/pokemon_clean.csv`
- `public/data/processed/team_edges_clean.csv`
- `public/data/processed/build_usage_clean.csv`
- `public/data/processed/image_lookup.csv`

No preprocessing is required for grading. The committed processed files are sufficient to run the visualization from a fresh clone.

Optional preprocessing scripts are included under scripts/ for regenerating the processed datasets from the original raw sources.

## Running the Application

Start the Vite development server:

```bash
npm run dev
```

Open the local URL printed by Vite. With the current script, it is usually:

```text
http://127.0.0.1:5173/
```

If port `5173` is busy, Vite may choose the next available port. Use the URL shown in the terminal.

To verify that the project builds for production:

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

Open the local preview URL printed by Vite.

## Demo Walkthrough

Use this sequence to reproduce the main story shown in the final report:

1. Explore the scatterplot.
2. Select Incineroar.
3. Compare connectivity and usage patterns.
4. Inspect the team synergy network.
5. Compare Incineroar and Zacian.
6. Open the Detail Panel tabs.
7. Complete the guided missions.
8. Use search and ranking modes to explore additional Pokémon.

## Reproducibility Notes

Expected successful startup:

- the hero section loads first.
- the scatterplot appears with axes, labels, legend, highlighted case-study labels, and a trend line.
- the Signal Scan shows correlation bars.
- the Team Synergy Network renders as a force-directed graph.
- mission cards and the ranked picker appear in the Explore section.

Common issues:

- If the app does not start, run `npm install` again and then retry `npm run dev`.
- If Vite reports that port `5173` is unavailable, use the alternate local URL printed in the terminal.
- If charts appear empty, confirm that the CSV files exist under `public/data/processed/`.
- If local Pokémon sprites do not appear, confirm that `public/assets/pokemon/` is present.
- If optional preprocessing fails, confirm that `pandas` is installed and the original source data folders are present.

Copy-paste verification commands:

```bash
npm install
npm run build
npm run dev
```

## Technologies Used

- React 19
- Vite 6
- D3.js 7
- JavaScript ES modules
- CSS
- Python 3 with pandas for optional preprocessing
