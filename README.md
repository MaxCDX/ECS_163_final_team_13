# ECS 163 Final Project

## Project Description

This repository contains a React + D3 data-story about competitive Pokemon team success. The central claim is that competitive value is not explained by raw stats alone; it also depends on teammate structure, usage patterns, build choices, and network position.

The application combines authored storytelling with guided exploration. It starts from a raw-stats assumption, introduces a contradiction through usage data, shows stronger connectivity evidence, reveals a force-directed teammate network, and then lets users test the claim through comparison and exploration missions.

## Repository Structure

- `src/`
  React components, D3-driven views, interaction logic, and application state.
- `public/data/processed/`
  Processed CSV files used directly by the front-end demo.
- `public/assets/pokemon/`
  Local Pokemon image assets used in key authored views.
- `scripts/`
  Data preprocessing and presentation-support scripts.
- `report/`
  Proposal/progress report files and exported figure assets.

## Dataset / Preprocessing

The app loads processed data from:

- `public/data/processed/pokemon_clean.csv`
- `public/data/processed/team_edges_clean.csv`
- `public/data/processed/build_usage_clean.csv`
- `public/data/processed/image_lookup.csv`

These processed files are already included in the repository and are sufficient to run the demo.

Original data sources:

- [Complete Competitive Pokemon Database (2022)](https://www.kaggle.com/datasets/giorgiocarbone/complete-competitive-pokmon-datasets-may-2022)
- [Dataset of 32000 Pokemon Images & CSV, JSON](https://www.kaggle.com/datasets/divyanshusingh369/complete-pokemon-library-32k-images-and-csv)

Preprocessing support scripts exist in `scripts/`, including `scripts/preprocess_pokemon_data.py`, but running preprocessing is not required to reproduce the current front-end demo.

## Installation

Install dependencies:

```bash
npm install
```

## Running the Demo

Start the development server:

```bash
npm run dev
```

Vite serves the app on a local URL such as:

```text
http://127.0.0.1:5173/
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Implemented Visualizations

- D3 scatterplot: base stats vs usage
- D3 correlation signal scan
- D3 force-directed teammate network
- D3 evidence bar chart
- Ego network comparison view
- Team core mini-graph
- Role causality flow
- Guided exploration missions and ranked picker

Notes:

- The scatterplot, correlation scan, force-directed network, and evidence chart are direct D3-rendered views.
- The ego comparison and team-core views use real data with SVG rendering and D3 scales.
- The role causality flow is an authored explanatory SVG tied to selected Pokemon.

## Interactions

The demo includes:

- selection
- brushing
- hover tooltips
- linked highlighting
- ranking mode switches
- guided mission buttons
- comparison selector

Concrete behaviors:

- Scatterplot brushing highlights matching Pokemon in the network.
- Network node selection updates the detail panel and comparison state.
- Hovering the network shows per-Pokemon tooltip details.
- Hovering team-core nodes shows compact role explanations.
- Guided exploration missions jump to specific hypothesis-driven states.
- The ranked picker supports usage, stats, and synergy ranking modes.

## Storytelling Flow

The page is structured as a Martini Glass narrative:

1. Assumption: raw power looks like the answer.
2. Contradiction: high stats do not guarantee high usage.
3. Network reveal: team context explains the gap.
4. Explore: guided missions help users test the claim themselves.

Within that flow, the main analytical sequence is:

Scatterplot contradiction -> signal scan -> force-directed network -> ego comparison -> compact evidence/detail -> guided exploration

## Reproducibility Notes

- The demo runs from the committed processed CSV files in `public/data/processed/`.
- No external API, database, or backend service is required.
- The current package scripts are:
  - `npm run dev`
  - `npm run build`
  - `npm run preview`
- Python preprocessing scripts are included for reference and regeneration workflows, but they are not required for normal demo setup.
