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

## Planned For The Final Project

- Strengthen the page into a complete Martini Glass narrative visualization.
- Add guided annotations and transitions that reveal raw stats, usage, and team synergy step by step.
- Expand the advanced D3 network with brushing, linking, and carefully scoped supporting views.
- Add clearer explanation of dataset limits, VGC 2022 context, and what usage data can and cannot prove.
- Include final report notes, citations, and full execution instructions for grading.
