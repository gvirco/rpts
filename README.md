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

## Live demo
- Public Vercel deployment: https://rpts-git-main-gvirco.vercel.app/
- Linked to GitHub `main` for continuous deployment. The current login is mock-based; live Supabase integration is tracked in Issue #8.

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

## Market data Edge Function

The `market-data` Supabase Edge Function calls Alpha Vantage from the server. Add your Alpha Vantage key as an Edge Function secret; do not put it in React code or a `VITE_` variable:

```sh
supabase secrets set ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

For local development, create `supabase/functions/.env` (already ignored by Git) with `ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key`, then start the local stack with `supabase start` or serve the function with `supabase functions serve market-data --env-file supabase/functions/.env`. Keep the key out of `.env.local`, which is intended for Vite client settings. The committed `.env.example` names the required secret but contains no key.

The function preserves the existing `withSupabase` publishable/secret authentication pattern. Send a POST request with JSON `symbol` and `type` fields:

```sh
curl --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/market-data' \
  --header 'Content-Type: application/json' \
  --header 'apiKey: YOUR_SUPABASE_PUBLISHABLE_KEY' \
  --data '{"symbol":"AAPL","type":"quote"}'
```

Use `"type":"history"` for daily history. Symbols are normalized to uppercase; `AAPL` and `MSFT` are supported along with other syntactically valid symbols available from Alpha Vantage. A quote response matches `Quote`; history is an ascending `PricePoint[]`. Alpha Vantage provides a latest trading **date** for `GLOBAL_QUOTE` and date-granular closes for `TIME_SERIES_DAILY`, not an intraday execution timestamp or real-time feed. The endpoint represents those dates as UTC midnight ISO timestamps to fit the shared contracts. Daily history uses the provider's default compact response (up to 100 trading days).

The function caches quotes for 60 seconds and daily history for 6 hours in each warm Edge Function instance. Provider free-tier limits can still apply across instances. Invalid input, missing configuration, unavailable symbols, provider rate limits, and provider failures return JSON errors with an HTTP status and error code.

## How the three-person team works
1. Share this public repository URL with teammates. Everyone can clone it; a teammate without write access can **fork** it and propose a PR.
2. Work on one GitHub Issue at a time, on a separate `feature/<issue-number>-short-name` branch. Do not directly commit feature work to `main`.
3. Sync `main`, implement one self-contained issue using shared types (mock responses until API/DB is ready), then open a PR against `main`.
4. Avoid modifying teammates' files; merge through PRs, and reserve the final 60–90 minutes for integration and demo.
5. Teammates with direct branch-push access need to be added as GitHub collaborators; **fork + PR also works without invitations**.
