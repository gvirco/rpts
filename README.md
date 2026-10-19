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
