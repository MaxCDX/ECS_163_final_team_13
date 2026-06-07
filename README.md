# What Really Makes a Pokemon Strong?

ECS 163 Final Project, Team 13

## Overview

This project is a narrative data visualization about competitive Pokemon usage. The central research question is:

**Do raw base stats explain competitive success, or does team connectivity explain usage better?**

The visualization tests the common assumption that stronger Pokemon should be used more often. It then shows a contradiction: some high-stat Pokemon have low usage, while Incineroar has moderate stats but very high competitive adoption. The main insight is that teammate connectivity and repeated team structure explain usage better than raw stat total alone.

The system uses a Martini Glass storytelling structure:

1. Start with an authored story about the raw-stats assumption.
2. Show a contradiction in the stats-vs-usage scatterplot.
3. Compare explanatory signals with a correlation scan.
4. Reveal the team synergy network as the main evidence.
5. Let readers explore additional examples through guided missions and a ranked picker.

The committed processed dataset contains:

- 1,098 Pokemon forms in the cleaned source table.
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
  data/processed/ Runtime CSV data loaded by the app
  assets/pokemon/ Local Pokemon sprites

scripts/         Optional preprocessing utilities; may regenerate data/processed/
```

The application follows a coordinated-view architecture. App.jsx manages shared state, D3 visualizations provide the primary analytical views, components contain reusable UI elements, data contains story configuration and loading logic, and utils contains metric, filtering, and network helper functions.

## Visualization System

The application is organized as coordinated views. All major views share selected Pokemon state so that user actions in one view update the rest of the story.

### Scatterplot: Stats vs. Usage

- D3 scatterplot showing the relationship between base stats and competitive usage.
- Color encodes Pokemon type.
- Brushing selects a subset for focus.
- Clicking selects a Pokemon for detailed evidence.

### Signal Scan

- D3 correlation comparison of candidate explanations for usage.
- Highlights which signals best explain competitive adoption.

### Team Synergy Network

- D3 force-directed network showing teammate relationships.
- Node size encodes usage.
- Edge width encodes teammate co-usage strength.
- Supports hover, click, and linked highlighting.

### Ego Network Comparison

- Compares the local teammate structures of two Pokemon.
- Summarizes usage, stats, connectivity, and teammate footprint.

### Selected Pokemon Detail Panel

- Evidence view for moves, items, abilities, and teammates.
- Role explanation view.
- Team core mini-network view.

### Guided Exploration Missions and Picker

- Guided missions provide example analyses.
- Search and ranking modes support open exploration.

## Major Interactions

- **Hover:** network nodes and team-core nodes provide compact contextual tooltips.
- **Click selection:** scatterplot points, network nodes, hero cards, and picker results update the selected Pokemon.
- **Brushing:** scatterplot brushing creates a focused subset and highlights related network nodes.
- **Linked highlighting:** selections and brushed subsets propagate across scatterplot, network, comparison, and detail views.
- **Comparison selector:** first and second selected Pokemon can be changed independently.
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

No preprocessing is required. These small processed CSVs are included so you can run the visualization immediately.

The original datasets used during preprocessing were:

- [Complete Competitive Pokemon Database (2022)](https://www.kaggle.com/datasets/giorgiocarbone/complete-competitive-pokmon-datasets-may-2022)
- [Dataset of 32000 Pokemon Images](https://www.kaggle.com/datasets/divyanshusingh369/complete-pokemon-library-32k-images-and-csv)

Optional preprocessing scripts are included under `scripts/`. To reproduce the processed CSVs from the original raw datasets, download and extract the raw datasets into:

```text
Complete_Competitive_Pokémon_Database_(2022)/
Dataset_of_32000_Pokemon_Images/
```

The preprocessing scripts write regenerated outputs to:

```text
data/processed/
```

If you intentionally rerun preprocessing and want the app to use the regenerated files, copy the CSV outputs into the public runtime folder:

```bash
python3 scripts/preprocess_pokemon_data.py
python3 scripts/validate_pokemon_outputs.py

mkdir -p public/data/processed
cp data/processed/*.csv public/data/processed/
```

Then run:

```bash
npm run dev
```

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

Use this sequence to reproduce the main story we wrote in the final report:

1. Explore the scatterplot.
2. Select Incineroar.
3. Compare connectivity and usage patterns.
4. Inspect the team synergy network.
5. Compare Incineroar and Zacian.
6. Open the Detail Panel tabs.
7. Complete the guided missions.
8. Use search and ranking modes to explore additional Pokemon.

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
- If local Pokemon sprites do not appear, confirm that `public/assets/pokemon/` is present.
- If optional preprocessing fails, confirm that `pandas` is installed and the original source data folders are present.

To install the Python dependency needed for optional preprocessing or validation:

```bash
python3 -m pip install pandas
```

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
