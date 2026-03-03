# Smart Surplus

Smart Surplus is a fintech prototype focused on capital discipline.
It turns transaction history into habit-level insights, computes deterministic surplus scenarios, and provides policy-driven decision checks for planned and recurring spend.

## What This Is

This project demonstrates a simulation-first financial workflow:
- Habit-based surplus modeling from transaction history
- Deterministic cashflow and safety-cushion simulation
- Policy evaluation for allow/warn/block decisions
- Allocation planning against synthetic portfolio assumptions

The application is designed for technical review and product validation.

## Key Product Flows

1. Habit Definition (`/habits`)
- Detect recurring and discretionary behaviors from the synthetic ledger
- Select transactions and set reduction intensity
- Review projected savings impact

2. Surplus Projection (`/surplus`)
- Compare current surplus vs projected surplus
- Inspect category-level and habit-level impact
- Explore allocation scenarios using fixed assumptions

3. Decision Mode (Dashboard)
- Parse a spend intent
- Run deterministic simulation by intent type
- Evaluate policy action (`allow`, `warn`, `block`) with reason codes

4. Allocation Logic (`/plan` + surplus allocation panel)
- Compare conservative/balanced/growth assumptions
- Project deterministic contribution growth over 1/5/10 years

## Architecture Overview

### `app/`
Next.js App Router pages and API routes.
- `app/page.tsx`: dashboard assembly
- `app/habits/page.tsx`: habit setup flow
- `app/surplus/page.tsx`: surplus analysis surface
- `app/plan/page.tsx`: commitment/progression surface
- `app/api/*`: parse, narrative, and audit endpoints

### `components/`
Presentation and interaction components for dashboard, habits, surplus, and decision mode.

### `lib/domain/`
Authoritative deterministic financial logic.
- cashflow snapshot and payday timing
- surplus math and recurring/habit detection
- intent simulation and policy evaluation
- seeded forecast and audit append utilities

### `lib/narrative/`
Structured parse/explanation adapters and client request hook.
Deterministic domain outputs remain the source of truth.

### `data/`
Synthetic dataset and local append-only audit file.
- `transactions.json`
- `user-profile.json`
- `audit-events.json`

## Determinism and Safety

- Financial math is deterministic and implemented in `lib/domain/*`.
- Policy decisions are explicit objects with machine-readable reason codes.
- Local audit events are append-only.
- No real bank linking, brokerage execution, or live order routing is implemented.

## Running Locally

### Requirements
- Node.js 20+
- npm 10+

### Install
```bash
npm install
```

### Development
```bash
npm run dev
```

### Typecheck
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

### Build
```bash
npm run build
```

### Preflight
```bash
npm run preflight
```

## Configuration

Copy `.env.example` values into `.env.local` only when needed.

- `MODEL_PROVIDER_KEY`: optional key for provider-backed parsing/narration
- `MODEL_PROVIDER_MODEL`: optional provider model name

Without environment configuration, deterministic flows and local fallbacks still run.

## Data

All repository data is synthetic demo data.
No real account data, credentials, or live trading records are included.

## Limitations

- Prototype-grade workflow and UX
- Local file-based audit storage
- No production auth model
- No live trading execution
- No external account sync beyond demo adapters

## License

MIT. See [LICENSE](./LICENSE).
