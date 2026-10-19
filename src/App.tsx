import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { PortfolioSnapshot, Position, Profile, Quote, Trade, TradeOrder, TradeSide, WatchlistItem } from './types'
import { signIn, signUp, signOut, getMyProfile } from './lib/auth'
import { supabase } from './lib/supabase'
import { getMyPortfolioData } from './lib/portfolio'
import { StockPriceChart } from './components/charts/StockPriceChart'
import { PortfolioValueChart } from './components/charts/PortfolioValueChart'
import { PortfolioProfitLossChart } from './components/charts/PortfolioProfitLossChart'
import './App.css'

type Page = 'portfolio' | 'trade' | 'history'
type LoadState = 'loading' | 'ready' | 'error'

const quotes: Quote[] = [
  { symbol: 'AAPL', price: 237.49, currency: 'USD', asOf: '2026-10-19T15:30:00Z' },
  { symbol: 'NVDA', price: 184.28, currency: 'USD', asOf: '2026-10-19T15:30:00Z' },
  { symbol: 'MSFT', price: 521.17, currency: 'USD', asOf: '2026-10-19T15:30:00Z' },
  { symbol: 'TSLA', price: 348.12, currency: 'USD', asOf: '2026-10-19T15:30:00Z' },
  { symbol: 'AMZN', price: 226.84, currency: 'USD', asOf: '2026-10-19T15:30:00Z' },
]
const stockPriceHistory = [
  { timestamp: '2026-10-13T14:30:00Z', price: 228.42 },
  { timestamp: '2026-10-14T14:30:00Z', price: 231.18 },
  { timestamp: '2026-10-15T14:30:00Z', price: 233.04 },
  { timestamp: '2026-10-16T14:30:00Z', price: 230.76 },
  { timestamp: '2026-10-17T14:30:00Z', price: 235.21 },
  { timestamp: '2026-10-18T14:30:00Z', price: 237.49 },
]
const initialProfile: Profile = { userId: 'demo-user', nickname: 'Alex Morgan', startingBalance: 10_000, cashBalance: 4_713.5 }
const initialPositions: Position[] = [
  { symbol: 'AAPL', quantity: 10, averageCost: 198.4 },
  { symbol: 'NVDA', quantity: 12, averageCost: 142.75 },
  { symbol: 'MSFT', quantity: 5, averageCost: 476.2 },
]
const initialWatchlist: WatchlistItem[] = ['TSLA', 'AMZN', 'AAPL'].map((symbol) => ({ userId: initialProfile.userId, symbol }))
const initialTrades: Trade[] = [
  { id: 't-1', userId: initialProfile.userId, symbol: 'NVDA', side: 'BUY', quantity: 12, price: 142.75, executedAt: '2026-10-18T14:22:00Z' },
  { id: 't-2', userId: initialProfile.userId, symbol: 'MSFT', side: 'BUY', quantity: 5, price: 476.2, executedAt: '2026-10-17T10:08:00Z' },
  { id: 't-3', userId: initialProfile.userId, symbol: 'AAPL', side: 'BUY', quantity: 10, price: 198.4, executedAt: '2026-10-15T16:41:00Z' },
  { id: 't-4', userId: initialProfile.userId, symbol: 'AAPL', side: 'SELL', quantity: 10, price: 231.18, executedAt: '2026-10-14T13:17:00Z' },
]

// Replace these mock functions with an API or auth provider without changing the screens.
const mockApi = {
  async signIn(email: string, password: string) { await delay(450); if (!password) throw new Error('Password is required.'); return { ...initialProfile, nickname: email.split('@')[0] || initialProfile.nickname } },
  async signUp(name: string, email: string, password: string) { await delay(450); if (!email || !password) throw new Error('Email and password are required.'); return { ...initialProfile, nickname: name || initialProfile.nickname } },
  async getPortfolio(): Promise<{ profile: Profile; positions: Position[]; watchlist: WatchlistItem[]; snapshot: PortfolioSnapshot }> {
    await delay(650)
    const positionsValue = initialPositions.reduce((sum, position) => sum + position.quantity * priceFor(position.symbol), 0)
    const snapshot: PortfolioSnapshot = { id: 'snapshot-demo', userId: initialProfile.userId, timestamp: new Date().toISOString(), cashBalance: initialProfile.cashBalance, positionsValue, totalValue: initialProfile.cashBalance + positionsValue, profitLoss: initialProfile.cashBalance + positionsValue - initialProfile.startingBalance }
    return { profile: initialProfile, positions: [...initialPositions], watchlist: [...initialWatchlist], snapshot }
  },
  async getTrades(): Promise<Trade[]> { await delay(650); return [...initialTrades] },
  async getQuote(symbol: string) { await delay(250); const quote = quotes.find((item) => item.symbol === symbol.toUpperCase()); if (!quote) throw new Error('No mock quote for that symbol. Try AAPL, NVDA, MSFT, TSLA or AMZN.'); return quote },
  async submitTrade(order: TradeOrder, cashBalance: number, holdings: Position[]): Promise<Trade> {
    await delay(500)
    const price = priceFor(order.symbol)
    const existing = holdings.find((position) => position.symbol === order.symbol)
    if (order.side === 'BUY' && price * order.quantity > cashBalance) throw new Error('Insufficient demo cash for this order.')
    if (order.side === 'SELL' && (!existing || existing.quantity < order.quantity)) throw new Error('Not enough demo shares to sell.')
    return { ...order, id: `demo-${Date.now()}`, userId: initialProfile.userId, price, executedAt: new Date().toISOString() }
  },
}
function delay(ms: number) { return new Promise((resolve) => window.setTimeout(resolve, ms)) }
function priceFor(symbol: string) { return quotes.find((quote) => quote.symbol === symbol)?.price ?? 0 }
function money(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) }
function dateLabel(value: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>,
    trade: <><path d="M7 7h13l-3-3"/><path d="M17 17H4l3 3"/><path d="M20 7l-3 3M4 17l3-3"/></>,
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z"/>,
    down: <path d="m7 10 5 5 5-5"/>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
  }
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>
}

function App() {
  const [signedIn, setSignedIn] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [page, setPage] = useState<Page>('portfolio')
  const [profile, setProfile] = useState<Profile>(initialProfile)
  // The portfolio is loaded from user-scoped Supabase tables; no shared demo account data.
  const [positions, setPositions] = useState<Position[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null)
  const [portfolioSnapshots, setPortfolioSnapshots] = useState<PortfolioSnapshot[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)

  // Supabase emits INITIAL_SESSION and subsequent sign-in/sign-out events.
  // Perform async Supabase queries outside the auth callback to avoid auth-lock deadlocks.
  useEffect(() => {
    let active = true
    let generation = 0
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const request = ++generation
      setAuthLoading(true)

      window.setTimeout(() => {
        if (!active || request !== generation) return

        if (!session) {
          setSignedIn(false)
          setProfile(initialProfile)
          setPositions([])
          setWatchlist([])
          setTrades([])
          setSnapshot(null)
          setPortfolioSnapshots([])
          setLoadState('ready')
          setAuthLoading(false)
          return
        }

        void Promise.all([getMyProfile(), getMyPortfolioData()]).then(([userProfile, portfolio]) => {
          if (!active || request !== generation) return
          if (!userProfile) throw new Error('Account profile not found in Supabase.')
          setProfile(userProfile)
          setPositions(portfolio.positions)
          setTrades(portfolio.trades)
          setWatchlist(portfolio.watchlist)
          setPortfolioSnapshots(portfolio.snapshots)
          setSnapshot(portfolio.snapshots.at(-1) ?? null)
          setLoadError('')
          setAuthError('')
          setLoadState('ready')
          setSignedIn(true)
          setAuthLoading(false)
        }).catch((error: unknown) => {
          if (!active || request !== generation) return
          setSignedIn(false)
          setAuthError(error instanceof Error ? error.message : 'Unable to load account profile.')
          setAuthLoading(false)
        })
      }, 0)
    })

    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3500); return () => window.clearTimeout(timer) }, [toast])

  const totals = useMemo(() => {
    if (snapshot) return { positionsValue: snapshot.positionsValue, totalValue: snapshot.totalValue, profitLoss: snapshot.profitLoss }
    const positionsValue = positions.reduce((sum, item) => sum + item.quantity * (item.lastPrice ?? item.averageCost), 0)
    const totalValue = profile.cashBalance + positionsValue
    return { positionsValue, totalValue, profitLoss: totalValue - profile.startingBalance }
  }, [snapshot, positions, profile])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    setAuthError('')
    setAuthSubmitting(true)
    try {
      const response = authMode === 'signup'
        ? await signUp(email, password, String(form.get('name') ?? '').trim())
        : await signIn(email, password)
      if (response.error) throw response.error
      if (!response.data.session) {
        setAuthError('Check your email to confirm your account, then sign in.')
      }
      // A signed-in session is handled by the auth-state listener above.
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed. Please try again.')
    } finally {
      setAuthSubmitting(false)
    }
  }

  async function handleSignOut() {
    const { error } = await signOut()
    if (error) setToast(error.message)
  }

  if (authLoading) return <LoadingState />
  if (!signedIn) return <AuthScreen mode={authMode} onModeChange={(mode) => { setAuthMode(mode); setAuthError('') }} onSubmit={handleAuth} error={authError} submitting={authSubmitting} />

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#portfolio" onClick={(event) => { event.preventDefault(); setPage('portfolio') }}><span className="brand-mark">r<span>.</span></span><span>paper<span className="brand-light">trade</span></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <NavItem icon="grid" label="Portfolio" active={page === 'portfolio'} onClick={() => { setPage('portfolio'); setMobileMenu(false) }} />
        <NavItem icon="trade" label="Trade" active={page === 'trade'} onClick={() => { setPage('trade'); setMobileMenu(false) }} />
        <NavItem icon="history" label="History" count={trades.length} active={page === 'history'} onClick={() => { setPage('history'); setMobileMenu(false) }} />
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><span className="help-spark">✳</span><strong>Getting started</strong><p>Explore investing with zero risk.</p><button onClick={() => setToast('Everything here uses mock data. Simulated trades never reach a market.')}>Learn more <Icon name="arrow" size={14} /></button></div>
        <button className="profile-button" onClick={() => void handleSignOut()}><span className="avatar">{profile.nickname.slice(0, 1).toUpperCase()}</span><span className="profile-name"><b>{profile.nickname}</b><small>Sign out</small></span><Icon name="down" size={16} /></button>
      </div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="menu-toggle" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><span></span><span></span></button><div className="breadcrumb">Workspace <span>/</span> <b>{page[0].toUpperCase() + page.slice(1)}</b></div><div className="topbar-right"><span className="market-status">Demo market data</span><button className="icon-button" aria-label="Notifications" onClick={() => setToast('You’re all caught up.')}><Icon name="bell" /></button><span className="top-avatar">{profile.nickname.slice(0, 1).toUpperCase()}</span></div></header>
      <div className="content-wrap">
        <div className="demo-banner"><span className="demo-dot">i</span><span><b>Demo mode</b> — Mock data and simulated trades. No real money or orders.</span><button aria-label="Dismiss demo message" onClick={(event) => event.currentTarget.parentElement?.remove()}><Icon name="close" size={15} /></button></div>
        {loadState === 'loading' ? <LoadingState /> : loadState === 'error' ? <ErrorState message={loadError} onRetry={() => { setSignedIn(false); window.setTimeout(() => setSignedIn(true), 10) }} /> : <>
          {page === 'portfolio' && <PortfolioScreen profile={profile} positions={positions} watchlist={watchlist} snapshot={snapshot} totals={totals} onTrade={() => setPage('trade')} onWatchlistChange={setWatchlist} />}
          {page === 'trade' && <TradeScreen onTrade={async () => { throw new Error('Trade submission is being connected to the secure backend. No order was placed.') }} />}
          {page === 'history' && <HistoryScreen trades={trades} />}
        </>}
        <footer className="page-footer"><span>© 2026 Papertrade</span><span><i></i> All systems operational</span><span>For education only</span></footer>
      </div>
    </main>
    {toast && <div className="toast" role="status"><span className="toast-check">✓</span>{toast}<button aria-label="Dismiss message" onClick={() => setToast('')}><Icon name="close" size={15} /></button></div>}
  </div>
}

function NavItem({ icon, label, active, onClick, count }: { icon: string; label: string; active: boolean; onClick: () => void; count?: number }) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon name={icon} /><span>{label}</span>{label === 'History' && <span className="nav-count">{count ?? 0}</span>}</button> }

function AuthScreen({ mode, onModeChange, onSubmit, error, submitting }: { mode: 'signin' | 'signup'; onModeChange: (mode: 'signin' | 'signup') => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string; submitting: boolean }) {
  return <div className="auth-page"><div className="auth-left"><a className="brand auth-brand" href="#"><span className="brand-mark">r<span>.</span></span><span>paper<span className="brand-light">trade</span></span></a><div className="auth-copy"><div className="eyebrow"><span></span> YOUR MONEY, YOUR MOVES</div><h1>Invest in your<br /><em>own future.</em></h1><p>A calm place to learn the market, build conviction, and practice investing — without the risk.</p><div className="auth-stats"><div><b>$0</b><span>real money at risk</span></div><div><b>100%</b><span>your pace, your rules</span></div></div></div><div className="auth-footer">Papertrade is a simulated investing experience.</div></div><div className="auth-right"><div className="auth-form-wrap"><div className="auth-mobile-brand"><span className="brand-mark">r<span>.</span></span> papertrade</div><div className="form-kicker">GET STARTED</div><h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2><p className="form-subtitle">{mode === 'signin' ? 'Sign in to your paper trading account.' : 'Start practicing with your free demo account.'}</p><form className="auth-form" onSubmit={onSubmit}>{error && <div className="inline-error" role="alert">{error}</div>}{mode === 'signup' && <label>Your name<input name="name" placeholder="Alex Morgan" autoComplete="name" required /></label>}<label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label><label>Password<input name="password" type="password" placeholder="At least 8 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required /></label><div className="auth-options"><label className="remember"><input type="checkbox" defaultChecked /> <span>Remember me</span></label>{mode === 'signin' && <button type="button" className="text-link" onClick={() => alert('Password reset will be added after the MVP.')}>Forgot password?</button>}</div><button className="button-primary auth-submit" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'} <Icon name="arrow" size={17} /></button></form><div className="auth-switch">{mode === 'signin' ? 'New to Papertrade?' : 'Already have an account?'} <button className="text-link" onClick={() => onModeChange(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></div><div className="mock-note"><span>✳</span> Authentication powered by Supabase</div></div><div className="auth-legal">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</div></div></div>
}

function PortfolioScreen({ profile, positions, watchlist, snapshot, totals, onTrade, onWatchlistChange }: { profile: Profile; positions: Position[]; watchlist: WatchlistItem[]; snapshot: PortfolioSnapshot | null; totals: { positionsValue: number; totalValue: number; profitLoss: number }; onTrade: () => void; onWatchlistChange: (items: WatchlistItem[]) => void }) {
  return <section className="screen"><div className="screen-heading"><div><div className="eyebrow">MONDAY, OCTOBER 19, 2026 <span className="heading-dot">•</span> MARKET OPEN</div><h1>Good morning, {profile.nickname.split(' ')[0]} <span className="wave">✳</span></h1><p>Here’s what’s happening with your portfolio today.</p></div><button className="button-primary" onClick={onTrade}>New trade <Icon name="arrow" size={17} /></button></div>
    <div className="metrics-grid"><MetricCard label="Total portfolio value" value={money(totals.totalValue)} caption="Last recorded valuation" icon="grid" /><MetricCard label="Total profit / loss" value={`${totals.profitLoss >= 0 ? '+' : ''}${money(totals.profitLoss)}`} caption="all time" positive={totals.profitLoss >= 0} icon="trade" /><MetricCard label="Cash available" value={money(profile.cashBalance)} caption="Ready to invest" icon="history" /><MetricCard label="Buying power" value={money(profile.cashBalance)} caption="Simulated account" icon="star" /></div>
    <div className="portfolio-grid"><div className="panel holdings-panel"><div className="panel-heading"><div><h2>Your holdings</h2><p>Stocks and shares in your portfolio</p></div><button className="subtle-link" onClick={onTrade}>Trade <Icon name="arrow" size={14} /></button></div>{positions.length ? <div className="table-scroll"><table><thead><tr><th>ASSET</th><th>SHARES</th><th>AVG. COST</th><th>PRICE</th><th>MARKET VALUE</th><th>RETURN</th></tr></thead><tbody>{positions.map((item) => { const current = item.lastPrice ?? item.averageCost; const pnl = (current - item.averageCost) * item.quantity; const change = (current - item.averageCost) / item.averageCost * 100; return <tr key={item.symbol}><td><div className="asset-cell"><AssetIcon symbol={item.symbol} /><span><b>{item.symbol}</b><small>{companyName(item.symbol)}</small></span></div></td><td>{item.quantity}</td><td>{money(item.averageCost)}</td><td>{money(current)}</td><td className="cell-strong">{money(current * item.quantity)}</td><td><span className={`return-pill ${pnl >= 0 ? 'positive' : 'negative'}`}>{pnl >= 0 ? '+' : ''}{change.toFixed(2)}%</span><small className="return-money">{pnl >= 0 ? '+' : ''}{money(pnl)}</small></td></tr> })}</tbody></table></div> : <EmptyState title="No holdings yet" body="Your purchased assets will appear here." action="Explore trading" onAction={onTrade} />}<div className="holdings-foot"><span>{positions.length} assets</span><span>Portfolio value <b>{money(totals.positionsValue)}</b></span></div></div>
      <div className="panel watchlist-panel"><div className="panel-heading"><div><h2>Watchlist</h2><p>Keep an eye on what matters</p></div><button className="icon-button plain" aria-label="Edit watchlist" onClick={() => onWatchlistChange([])}><Icon name="star" size={18} /></button></div>{watchlist.length ? <div className="watchlist-list">{watchlist.map((item) => { const quote = quotes.find((entry) => entry.symbol === item.symbol); if (!quote) return null; return <div className="watch-row" key={item.symbol}><AssetIcon symbol={item.symbol} /><div className="watch-name"><b>{item.symbol}</b><small>{companyName(item.symbol)}</small></div><div className="watch-price"><b>{money(quote.price)}</b><small className="positive-text">+{(2 + item.symbol.length * .23).toFixed(2)}%</small></div></div> })}</div> : <EmptyState title="Your watchlist is empty" body="Assets you follow will show up here." action="Restore demo list" onAction={() => onWatchlistChange(initialWatchlist)} />}<button className="watchlist-add" onClick={() => onWatchlistChange(initialWatchlist)}><span>+</span> Add to watchlist</button></div></div>
    <div className="charts-grid"><StockPriceChart data={stockPriceHistory} symbol="AAPL" /><PortfolioValueChart data={portfolioSnapshots} /><PortfolioProfitLossChart data={portfolioSnapshots} /></div>
    <div className="demo-footnote"><span>ⓘ</span> Last recorded portfolio snapshot: {snapshot ? dateLabel(snapshot.timestamp) : 'not available'}. Position prices are last observed, not live quotes.</div>
  </section>
}
function MetricCard({ label, value, change, caption, positive, icon }: { label: string; value: string; change?: string; caption: string; positive?: boolean; icon: string }) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon name={icon} size={17} /></span></div><b className="metric-value">{value}</b><div className="metric-bottom">{change && <span className={`metric-change ${positive === false ? 'negative' : ''}`}>↗ {change}</span>}<span>{caption}</span></div></div> }
function AssetIcon({ symbol }: { symbol: string }) { return <span className={`asset-icon asset-${symbol.toLowerCase()}`}>{symbol.slice(0, 1)}</span> }
function companyName(symbol: string) { return ({ AAPL: 'Apple Inc.', NVDA: 'NVIDIA Corp.', MSFT: 'Microsoft', TSLA: 'Tesla, Inc.', AMZN: 'Amazon.com' } as Record<string, string>)[symbol] ?? symbol }

function TradeScreen({ onTrade }: { onTrade: (order: TradeOrder) => Promise<void> }) {
  const [symbol, setSymbol] = useState('AAPL'); const [side, setSide] = useState<TradeSide>('BUY'); const [quantity, setQuantity] = useState('10'); const [quote, setQuote] = useState<Quote | null>(quotes[0]); const [quoteState, setQuoteState] = useState<LoadState>('ready'); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false); const [success, setSuccess] = useState('')
  const total = quote ? quote.price * (Number(quantity) || 0) : 0
  async function lookup(value: string) { setSymbol(value.toUpperCase()); setSuccess(''); if (!value.trim()) { setQuote(null); setQuoteState('ready'); return }; setQuoteState('loading'); setError(''); try { const result = await mockApi.getQuote(value); setQuote(result); setQuoteState('ready') } catch (cause) { setQuote(null); setError(cause instanceof Error ? cause.message : 'Quote unavailable.'); setQuoteState('error') } }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!quote || Number(quantity) < 1 || !Number.isInteger(Number(quantity))) { setError('Enter a whole number of shares and a supported symbol.'); return }; setSubmitting(true); setError(''); try { await onTrade({ symbol: quote.symbol, side, quantity: Number(quantity) }); setSuccess(`${side} ${quantity} ${quote.symbol} · ${money(total)} simulated`); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Trade preview failed. Please try again.') } finally { setSubmitting(false) } }
  return <section className="screen"><div className="screen-heading"><div><div className="eyebrow">PAPER TRADING</div><h1>Make a trade</h1><p>Practice your strategy with simulated orders.</p></div></div><div className="trade-layout"><div className="panel trade-panel"><div className="panel-heading"><div><h2>Order ticket</h2><p>Build a simulated trade</p></div><span className="simulated-badge">SIMULATED</span></div><form className="trade-form" onSubmit={submit}><div className="form-label-row"><label htmlFor="trade-symbol">Stock symbol</label><span>Mock quote</span></div><div className="symbol-input-wrap"><Icon name="search" size={18} /><input id="trade-symbol" value={symbol} onChange={(event) => void lookup(event.target.value)} placeholder="Search symbol" autoComplete="off" /><button type="button" className="clear-input" aria-label="Clear symbol" onClick={() => void lookup('')}><Icon name="close" size={15} /></button></div>{quoteState === 'loading' && <div className="inline-state">Fetching mock quote…</div>}{quoteState === 'error' && <div className="inline-error">{error}</div>}{quote && quoteState === 'ready' && <div className="quote-preview"><AssetIcon symbol={quote.symbol} /><div><b>{quote.symbol}</b><small>{companyName(quote.symbol)}</small></div><div className="quote-current"><b>{money(quote.price)}</b><small>Latest mock price</small></div></div>}<label className="field-label">Order type</label><div className="side-toggle"><button className={side === 'BUY' ? 'selected buy' : ''} type="button" onClick={() => setSide('BUY')}>Buy</button><button className={side === 'SELL' ? 'selected sell' : ''} type="button" onClick={() => setSide('SELL')}>Sell</button></div><label className="field-label" htmlFor="trade-quantity">Quantity <span>Shares</span></label><div className="quantity-wrap"><input id="trade-quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /><span>SHARES</span></div><div className="order-summary"><div><span>Estimated price</span><b>{quote ? money(quote.price) : '—'}</b></div><div><span>Estimated total</span><b>{quote ? money(total) : '—'}</b></div><small>Final execution price may differ. This is only a simulation.</small></div>{error && quoteState !== 'error' && <div className="inline-error">{error}</div>}{success && <div className="success-message"><span>✓</span>{success}</div>}<button className={`button-primary submit-trade ${side === 'SELL' ? 'sell-button' : ''}`} type="submit" disabled={submitting || !quote || quoteState === 'loading'}>{submitting ? 'Simulating…' : `Preview ${side.toLowerCase()} order`} <Icon name="arrow" size={17} /></button></form></div><div className="trade-aside"><div className="panel market-panel"><div className="panel-heading"><div><h2>Popular stocks</h2><p>Mock market prices</p></div></div><div className="popular-list">{quotes.map((item, index) => <button className="popular-row" key={item.symbol} onClick={() => void lookup(item.symbol)}><AssetIcon symbol={item.symbol} /><span><b>{item.symbol}</b><small>{companyName(item.symbol)}</small></span><strong>{money(item.price)}</strong><span className="positive-text">+{(1.2 + index * .57).toFixed(2)}%</span></button>)}</div><div className="market-footnote">Prices are illustrative mock data.</div></div><div className="info-card"><span className="info-icon">✳</span><div><b>Practice makes progress</b><p>Orders are simulated using the mock quote shown above. Nothing is sent to a real exchange.</p></div></div></div></div></section>
}

function HistoryScreen({ trades }: { trades: Trade[] }) { const [filter, setFilter] = useState<'ALL' | TradeSide>('ALL'); const [query, setQuery] = useState(''); const visible = trades.filter((trade) => (filter === 'ALL' || trade.side === filter) && trade.symbol.toLowerCase().includes(query.toLowerCase())); return <section className="screen"><div className="screen-heading"><div><div className="eyebrow">YOUR ACTIVITY</div><h1>Trade history</h1><p>Review your simulated orders and activity.</p></div><span className="simulated-badge history-badge">MOCK DATA</span></div><div className="panel history-panel"><div className="history-tools"><div className="history-tabs"><button className={filter === 'ALL' ? 'selected' : ''} onClick={() => setFilter('ALL')}>All activity</button><button className={filter === 'BUY' ? 'selected' : ''} onClick={() => setFilter('BUY')}>Buys</button><button className={filter === 'SELL' ? 'selected' : ''} onClick={() => setFilter('SELL')}>Sells</button></div><label className="history-search"><Icon name="search" size={17} /><input aria-label="Search symbols" placeholder="Search symbol" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>{visible.length ? <div className="table-scroll"><table className="history-table"><thead><tr><th>ASSET</th><th>TYPE</th><th>QUANTITY</th><th>PRICE / SHARE</th><th>TOTAL VALUE</th><th>DATE & TIME</th><th>STATUS</th></tr></thead><tbody>{visible.map((trade) => <tr key={trade.id}><td><div className="asset-cell"><AssetIcon symbol={trade.symbol} /><span><b>{trade.symbol}</b><small>{companyName(trade.symbol)}</small></span></div></td><td><span className={`trade-type ${trade.side.toLowerCase()}`}>{trade.side}</span></td><td>{trade.quantity} shares</td><td>{money(trade.price)}</td><td className="cell-strong">{money(trade.price * trade.quantity)}</td><td>{dateLabel(trade.executedAt)}</td><td><span className="status-complete"><i></i> Simulated</span></td></tr>)}</tbody></table></div> : <EmptyState title={trades.length ? 'No matching activity' : 'No trades yet'} body={trades.length ? 'Try another symbol or activity filter.' : 'Your simulated trades will appear here.'} />}{visible.length > 0 && <div className="history-foot"><span>Showing {visible.length} of {trades.length} transactions</span><span>Demo activity only</span></div>}</div><div className="demo-footnote"><span>ⓘ</span> This history contains simulated orders for demonstration purposes.</div></section> }

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) { return <div className="empty-state"><span className="empty-icon"><Icon name="search" size={22} /></span><b>{title}</b><p>{body}</p>{action && onAction && <button className="subtle-link" onClick={onAction}>{action} <Icon name="arrow" size={14} /></button>}</div> }
function LoadingState() { return <div className="loading-state"><span className="spinner"></span><b>Loading your account</b><p>Checking your Supabase session…</p></div> }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="error-state"><span className="error-icon">!</span><h2>Something went wrong</h2><p>{message}</p><button className="button-primary" onClick={onRetry}>Try again</button></div> }

export default App
