# Nexora

A complete premium sportsbook prototype. Dark fintech aesthetic, live-looking markets, a full betting slip, wallet, account area, casino lobby, and an admin control room.

This is a **demonstration product**. It does not accept real-money wagers and is not licensed by any regulator.

## Run

```bash
npm install
npm run dev
```

## Demo accounts

| Role  | Email                | Password   | 2FA    |
| ----- | -------------------- | ---------- | ------ |
| User  | alex@nexora.demo     | demo1234   | 847291 |
| Admin | admin@nexora.demo    | admin1234  | 847291 |

## Stack

- React 19 + TypeScript + Vite
- React Router
- Zustand (auth, slip, wallet, UI, notifications, favorites)
- Recharts (admin)
- Mock data layer in `src/data` and `src/lib/api.ts`

Live scores and odds tick every 3.2s via `useLiveEngine`. Swap `api.*` for a real odds/wallet backend later.

## Responsible gambling

Limits, cooling-off, self-exclusion and help resources live at `/responsible-gambling`, also linked from the main nav and footer.
