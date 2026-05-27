# ECS 163 Final Project Prototype

This repository contains the first front-end prototype for an ECS 163 Data Visualization final project about competitive Pokémon strength.

The current prototype is intentionally small: it is a React + D3 data-story page with a hook, a guided comparison, one interactive D3 force-directed network, and a short exploration prompt. It is not the final implementation yet.

## What The Prototype Shows

The prototype uses cleaned Pokémon competitive data from `public/data/processed/`. The main visualization shows:

- node: Pokémon
- node size: usage percent
- node color: primary type
- edge: common teammate relationship
- edge width/opacity: co-usage strength
- interaction: hover tooltip, click-to-select highlighting, reset button, and detail panel

React manages the page structure, loaded data, selected Pokémon, tooltip state, and detail panel. D3 handles CSV parsing, scales, axes, and the force-directed network layout.

The narrative claim is:

> Competitive success emerges from synergy, not just raw stats.

The proposal demo focuses on Incineroar: a Pokémon with moderate base stats but unusually strong team-network centrality.

## Install

Install Node.js if needed, then run:

```bash
npm install
```

## Run Locally

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://127.0.0.1:5173/
```

## Build

Create a production build:

```bash
npm run build
```

Preview the build locally:

```bash
npm run preview
```
## Dataset
- [Complete Competitive Pokémon Database (2022)](https://www.kaggle.com/datasets/giorgiocarbone/complete-competitive-pokmon-datasets-may-2022)

- [Dataset of 32000 Pokemon Images & CSV, JSON](https://www.kaggle.com/datasets/divyanshusingh369/complete-pokemon-library-32k-images-and-csv)

## Final Project Checklist

The project should stay focused on one argument: competitive strength is not only a raw stat total; it also depends on team context, usage, and build choices.

### Completed

- [x] Build a React + D3 prototype with cleaned CSV data.
- [x] Load Pokemon, teammate edges, build usage, and image lookup data.
- [x] Show a guided intro around the main claim.
- [x] Add a small stats-vs-usage comparison for Zacian, Zamazenta, and Incineroar.
- [x] Expand the comparison chart into a fuller stats-vs-usage context view.
- [x] Link the comparison view, network, and detail panel through the same selected Pokemon.
- [x] Add legends for node size, node color, edge thickness, and selection highlighting.
- [x] Add short annotations that guide the viewer through the main story beats.
- [x] Add an easier Pokemon picker with name search and ranked suggestions for usage, stat total, and synergy.
- [x] Add an interactive force-directed team synergy network.
- [x] Support hover tooltips, click selection, linked highlighting, and reset behavior.
- [x] Add a selected Pokemon detail panel with stats, usage, rank, teammates, moves, item, and ability.

### In Progress

- [ ] Strengthen the focus + context structure so the overview and detail views clearly work together.

### Still Needed

- [ ] Add a compact selected-Pokemon ranking summary for stats, usage, and network centrality.
- [ ] Add a methodology and data limits section explaining VGC 2022, usage as a proxy, and co-usage limits.
- [ ] Improve responsive layout and label readability for the final presentation.
- [ ] Update the final report and README after the app is finished.
