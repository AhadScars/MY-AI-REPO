# Prism Path

A polished **2D brain-teaser puzzle** game: connect matching glowing crystals with paths that never cross or share cells. Levels are **generated automatically** and get harder as you climb.

## Features

- **Procedural levels** — every level is built by carving guaranteed solution paths, then showing only the endpoints
- **Premium graphics** — canvas crystals with glow, specular highlights, animated grid, particle bursts
- **Smooth animation** — path draw-in, pulse orbs, combo banners, win celebrations, screen shake
- **Rich sound** — Web Audio synth SFX (connect, error, win fanfare, stars) + soft ambient pad
- **Progression** — stars for speed & no-hints, local best level / solve count
- **Touch & mouse** — works on desktop and mobile browsers

## How to play

1. Drag from a crystal to its **matching color** twin.
2. Paths **cannot cross** or occupy the same cell.
3. Connect **every pair** to clear the level.
4. Boards grow larger and busier as levels increase.

### Controls

| Action | Input |
|--------|--------|
| Draw path | Click/drag or touch |
| Undo | Undo button or `Ctrl/Cmd+Z` |
| Hint | Hint button or `H` |
| Reset | Reset button or `R` |
| New layout | New button (same level, fresh seed) |
| Pause | Menu button or `Esc` |

## Run

No build step. Open the game in a browser:

```bash
# Option A — double-click
index.html

# Option B — local server (recommended)
cd prism-path
python3 -m http.server 8765
# then open http://localhost:8765
```

Or on Windows:

```bat
start index.html
```

## Project layout

```
prism-path/
├── index.html          # UI shell
├── css/styles.css      # Neon glassmorphism theme
├── js/
│   ├── audio.js        # Web Audio SFX + ambient
│   ├── levelgen.js     # Solvable procedural generator
│   ├── renderer.js     # Canvas graphics & particles
│   └── game.js         # Input, rules, win flow
└── README.md
```

## Tips

- Higher levels reward filling the board carefully — partial paths can be continued or undone.
- Hints flash the intended solution route for a few seconds.
- Progress is saved in `localStorage` (`prism_level`, `prism_best`, `prism_wins`).

Enjoy training your mind with **Prism Path**.
