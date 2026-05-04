# ECS 163 Final Project Prototype

This repository contains the first front-end prototype for an ECS 163 Data Visualization final project about uneven AI impact on jobs.

The current prototype is intentionally small: it is a data-story page with a hook, dataset context, one interactive D3 scatter plot, and a short future-plan section. It is not the final implementation yet.

## What The Prototype Shows

The prototype uses `ai_impact_jobs_2010_2025.csv`, a 5,000-row dataset of job postings from 2010-2025. The implemented visualization compares:

- x-axis: `salary_usd`
- y-axis: `automation_risk_score`
- color: `industry`
- tooltip details: job title, industry, salary, automation risk, year, region, and country
- interaction: industry dropdown and year slider

The narrative claim is:

> AI risk is not evenly distributed. Salary alone does not determine whether a job is safe or exposed.

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

## Planned For The Final Project

- Strengthen the page into a complete narrative visualization rather than a standalone chart.
- Add guided annotations and transitions that move from salary to industry, region, and displacement-risk patterns.
- Design one advanced D3 visualization as the main feature of the final story.
- Add more careful visual explanation of uncertainty, dataset limits, and what the risk scores should and should not imply.
- Include final report notes, citations, and full execution instructions for grading.
