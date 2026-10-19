# RPTS — Real Paper Trading Simulator

Vibe-coding course final project. A paper trading app for three-person team, built in 4–5 hours.

## MVP
- Individual accounts (sign up, sign in, sign out)
- Each account starts with **$10,000** of virtual cash
- Latest available US stock quotes and price history
- Buy/sell whole shares (no fees, no short positions)
- Portfolio with cash, holdings, total value and P/L
- Trade history, watchlist and **three charts** (stock price, portfolio value, P/L)
- Transaction data persisted and isolated by user
- Public deployment on Vercel

## Stack
React + TypeScript + Vite · Supabase (Auth + Postgres + RLS) · Recharts · server-side market-data endpoint · Vercel

## Working agreement
- One GitHub Issue per task; pick any unassigned, unblocked issue.
- Work in feature branches, open PRs to `main`, and keep integration simple.
- UI and charts use mocks matching agreed data contracts until backend is ready.
- Never store API secrets in frontend code or in Git.
- Reserve the final ~60–90 minutes for integration and demo.

## Definition of done
Two users can independently sign up and trade; trades update balances and holdings correctly, data survives refresh, neither user can access the other's records, three charts use persisted/API data, and the deployed URL works.

_This is a learning simulator, not financial advice._

## Shared contracts
Import common frontend/backend DTO types from `src/types/index.ts`: `Profile`, `Quote`, `PricePoint`, `TradeOrder`, `Trade`, `Position`, `WatchlistItem`, and `PortfolioSnapshot`.

- Monetary values are **USD**, represented as numbers in UI payloads; backend must enforce correct cent precision and use atomic DB updates.
- Times use **ISO 8601 UTC**. `Quote.asOf` is the market price timestamp displayed to users.
- APIs return **camelCase** fields; DB columns can remain snake_case with mapping at the data boundary.
- `TradeOrder` contains only `symbol`, `side`, `quantity`; **the server obtains and records the execution price**, validates funds/holdings and updates the ledger transactionally.
- All chart components take real data in these shapes; mocks must match them exactly.

## How the three-person team works
1. Share this public repository URL with teammates. Everyone can clone it; a teammate without write access can **fork** it and propose a PR.
2. Work on one GitHub Issue at a time, on a separate `feature/<issue-number>-short-name` branch. Do not directly commit feature work to `main`.
3. Sync `main`, implement one self-contained issue using shared types (mock responses until API/DB is ready), then open a PR against `main`.
4. Avoid modifying teammates' files; merge through PRs, and reserve the final 60–90 minutes for integration and demo.
5. Teammates with direct branch-push access need to be added as GitHub collaborators; **fork + PR also works without invitations**.
