# FareCompare — Ola vs Uber vs Rapido

Compare estimated taxi/auto/bike fares from **Ola**, **Uber**, and **Rapido** on one screen for Indian cities.

![FareCompare](https://img.shields.io/badge/India-ride%20compare-6366f1)

## Why estimates?

Ola, Uber, and Rapido **do not offer free public APIs** for third-party fare quotes. Live prices depend on demand, traffic, promos, and tolls.

This app estimates fares using:

1. **Real road distance & time** — OpenStreetMap (Nominatim search + OSRM routing)
2. **Typical India rate cards** — base fare + per km + per minute (by vehicle type)
3. **City cost index** — Mumbai / Bengaluru slightly higher than smaller cities
4. **Time-of-day demand** — morning/evening rush multipliers

Then you can **open the official app** with your route to lock the real price.

## Features

- Pickup & drop search (India-focused)
- Map with route polyline
- Side-by-side fares: bike, auto, mini, sedan, SUV
- Cheapest option highlight
- Deep links to Ola / Uber / Rapido
- Quick preset routes (BLR / DEL / Mumbai)
- Responsive dark UI

## Run locally

```bash
cd fare-compare
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build   # production build
npm run preview # preview production build
```

## Stack

- React + TypeScript + Vite
- Leaflet / OpenStreetMap (no Google Maps key needed)
- Nominatim (geocoding) · OSRM (routing)

## Project structure

```
src/
  components/   # LocationInput, RouteMap, FareCard, CompareResults
  lib/
    types.ts    # shared types
    geo.ts      # search + route + city detect
    fares.ts    # Ola / Uber / Rapido rate cards & estimator
  App.tsx
```

## Going live with real fares later

| Platform | Path |
|----------|------|
| **Uber** | [Uber API](https://developer.uber.com/) — price estimates require approved app |
| **Ola** | No public consumer fare API; enterprise / partner only |
| **Rapido** | No public developer API |

You can replace `estimateAllFares()` in `src/lib/fares.ts` with real API calls when you get partner access.

## Disclaimer

Not affiliated with Ola, Uber, or Rapido. Estimates are for planning only — always confirm in the official apps before booking.
