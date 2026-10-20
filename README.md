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
- Production: https://rpts.vercel.app/ (Vercel GitHub integration deploys `main`).
- The completed integration uses real Supabase authentication, isolated user accounts and server-priced paper trades. Release validation is tracked in Issue #9.

## Stack
React + TypeScript + Vite · Supabase (Auth + Postgres + RLS) · Recharts · server-side market-data endpoint · Vercel

## Working agreement
- One GitHub Issue per task; pick any unassigned, unblocked issue.
- Work in feature branches, open PRs to `main`, and keep integration simple.
- Integrated UI obtains portfolio and transaction data from Supabase, stock quotes/history from the server-side market-data function, and trade execution prices from the authenticated backend.
- Never store API secrets in frontend code or in Git.
- Reserve the final ~60–90 minutes for integration and demo.

## Definition of done
Two users can independently sign up and trade; trades update balances and holdings correctly, data survives refresh, neither user can access the other's records, three charts use persisted/API data, and the deployed URL works.

_This is a learning simulator, not financial advice._

## Shared contracts
Import common frontend/backend DTO types from `src/types/index.ts`: `Profile`, `Quote`, `PricePoint`, `TradeOrder`, `Trade`, `Position`, `WatchlistItem`, and `PortfolioSnapshot`.

- Monetary values are **USD**, represented as numbers in UI payloads; backend must enforce correct cent precision and use atomic DB updates.
- Times use **ISO 8601 UTC**. `Quote.asOf` represents the latest **daily trading date** at 00:00 UTC (not an intraday execution timestamp).
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

## Integrated application setup (Issues #8–#9)

1. Configure `.env.local` using `.env.example`, with **only** `VITE_SUPABASE_URL` and the **publishable** Supabase key. Put these same two public environment variables in Vercel for the Production environment. Never use a service-role or Alpha Vantage secret in a `VITE_` variable.
2. In the existing Supabase project, apply the SQL migrations in filename order. The first two are already applied to the working team project; **the new migration** `supabase/migrations/20261020_000003_portfolio_refresh.sql` must be run in Supabase SQL Editor before the new refresh endpoint is deployed.
3. Deploy the functions to the **same** Supabase project using `npx supabase functions deploy market-data`, `npx supabase functions deploy execute-trade`, and `npx supabase functions deploy refresh-portfolio` (with `--project-ref <PROJECT_REF>` if the CLI project is not linked). The `market-data` function requires the server-only `ALPHA_VANTAGE_API_KEY` secret. Function JWT settings are in `supabase/config.toml`; the handlers independently verify auth.
4. Run `npm ci`, `npm test`, `npm run build`, `npm run lint`. Verify locally at `http://localhost:5173/`.
5. Merge Issue #8 into `main`, check the Vercel Production deployment, then complete deployed-browser acceptance tests in Issue #9 (two user accounts, RLS, price timestamps, BUY/SELL and failure paths, reload persistence, and all three charts).

**Pricing semantics:** Alpha Vantage's latest **daily close** is used for paper trade execution; it is not a live trading price. The authenticated `execute-trade` function obtains and checks the quote server-side and calls the transactional DB trade procedure. The frontend's watchlist/trade-ticket quotes are informational estimates, cached for 10 minutes; the browser never chooses an execution price. `refresh-portfolio` requests latest daily quotes for the authenticated account's holdings and securely persists a valuation snapshot when needed, reusing recent snapshots to limit free-tier API traffic. If market data fails, the previous stored valuations remain visible without being silently replaced with invented values.

## How the three-person team works
1. Share this public repository URL with teammates. Everyone can clone it; a teammate without write access can **fork** it and propose a PR.
2. Work on one GitHub Issue at a time, on a separate `feature/<issue-number>-short-name` branch. Do not directly commit feature work to `main`.
3. Sync `main`, implement one self-contained issue using shared types (mock responses until API/DB is ready), then open a PR against `main`.
4. Avoid modifying teammates' files; merge through PRs, and reserve the final 60–90 minutes for integration and demo.
5. Teammates with direct branch-push access need to be added as GitHub collaborators; **fork + PR also works without invitations**.
