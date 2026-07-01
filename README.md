<div align="center">

<img src="public/favicon.svg" width="72" alt="LogicForge logo" />

# ⚡ LogicForge

### A real-time digital logic & circuit simulator for the browser.

Drop in gates, switches, clocks and bulbs, wire them with auto-routed connections,
and watch signals propagate through your circuit — live, at 60fps.

[**Launch the Simulator →**](https://logicforge-bice.vercel.app/simulator) · [Landing page](https://logicforge-bice.vercel.app)

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![Dependencies](https://img.shields.io/badge/runtime%20deps-0-22c55e)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## Overview

LogicForge is an interactive digital-logic sandbox built from scratch in TypeScript.
Components are rendered as crisp SVG, wires are laid out by a grid-aware pathfinder,
and an event-driven evaluator keeps the whole circuit in sync as you toggle inputs —
no libraries, no build-time magic.

Two surfaces ship in the project:

- **A cinematic landing page** (`/`) — the marketing front door.
- **The Simulator** (`/simulator`) — the full interactive bench.

## Features

- **Nine components** — AND, OR, XOR, NOT, NAND, NOR gates plus Switch, Clock and Lightbulb.
- **Auto-routed wiring** — orthogonal, grid-aware pathfinding between pins.
- **Event-driven simulation** — only what changed is recomputed, so it stays fast.
- **Clocks & live signals** — animated state propagation across the graph.
- **Infinite canvas** — smooth pan, zoom and grid snapping.
- **Live status bar** — component/wire counts, zoom and run state.
- **Worked demo circuit** — AND, NOT and XOR examples on first load.

## Tech stack

- **TypeScript** (strict) · **Vite** · **SVG** rendering
- Custom grid pathfinding + event-driven evaluation core
- Zero runtime dependencies

## Getting started

```bash
npm install

# (optional) refresh landing imagery from Unsplash
cp .env.example .env.local        # add your UNSPLASH_ACCESS_KEY
npm run fetch:images

npm run dev            # develop
npm run build          # production build
npm run preview
```

> Images are committed under `public/media/`, so builds work with **no** API key.

## Project structure

```
logicforge/
├── index.html            # cinematic landing page
├── simulator.html        # the interactive bench
├── scripts/
│   └── fetch-images.mjs  # build-time Unsplash pipeline
├── public/
│   ├── favicon.svg
│   └── media/            # committed landing imagery
└── src/
    ├── landing/          # landing page (ts + css)
    └── app/              # the simulator
        ├── components.ts # gate/component definitions
        ├── simulation.ts # circuit store + evaluator
        ├── renderer.ts   # SVG renderer
        ├── pathfinding.ts# wire auto-routing
        ├── interaction.ts# pointer / tool handling
        ├── toolbar.ts    # palette + controls
        ├── types.ts
        └── utils.ts
```

## Deployment

Deployed on [Vercel](https://vercel.com) as a static Vite build. Any push to `main`
triggers an automatic production deploy.

## Credits

- Simulation engine, UI and design — hand-built.
- Landing imagery — [Unsplash](https://unsplash.com) (see `public/media/credits.json`).

## License

[MIT](LICENSE) © Shahriar Ahmed
