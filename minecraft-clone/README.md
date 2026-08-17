# BlockCraft — Minecraft Clone

A browser-based mini Minecraft clone built with **Three.js** and **Vite**.

## Features

| Feature | Details |
|--------|---------|
| **Limited world** | 48×48 block playable area with stone borders |
| **Camera** | Switch **FPP / TPP** with `V` |
| **Animals** | Random cube cows, pigs, chickens, sheep — wander, hit, kill |
| **Day / night** | Sun & moon orbit; full cycle = **20 real minutes** |
| **Time split** | **10 min day** · **1 min sunset** · **8 min night** · **1 min sunrise** |
| **Dig & build** | Left-click break · right-click place · hotbar inventory |

## Controls

| Key | Action |
|-----|--------|
| **WASD** | Move |
| **Space** | Jump |
| **Mouse** | Look (pointer lock) |
| **Left click** | Dig block / hit animal |
| **Right click** | Place selected block |
| **V** | Toggle first / third person |
| **1–9** / **Scroll** | Select hotbar slot |
| **Esc** | Unlock mouse (pause) |

## Run

```bash
cd minecraft-clone
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`), click **Play**, and enjoy.

```bash
npm run build    # production build → dist/
npm run preview  # preview production build
```

## Project layout

```
src/
  main.js       — game loop, HUD, pointer lock
  world.js      — terrain gen, voxels, dig/place, collision
  player.js     — movement, FPP/TPP, combat, inventory
  animals.js    — cube animals + AI
  daynight.js   — 20-minute sun/moon cycle
  blocks.js     — block types & colors
  style.css     — HUD / overlay
```

## Notes

- World regenerates mesh instances when you dig or place (small map keeps this cheap).
- Animals respawn slowly if few remain.
- Starting inventory gives dirt, cobble, planks, and other blocks to build with.
