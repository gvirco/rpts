import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from './supabase'
import { addWatchlistSymbol, removeWatchlistSymbol } from './watchlist'

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}))

const getUser = vi.mocked(supabase.auth.getUser)
const from = vi.mocked(supabase.from)

function signInAsBob() {
  getUser.mockResolvedValue({ data: { user: { id: 'bob-user-id' } }, error: null } as never)
}

describe('persisted watchlist', () => {
  beforeEach(() => vi.resetAllMocks())

  it('validates tickers before attempting Supabase calls', async () => {
    await expect(addWatchlistSymbol('AAPL;DROP')).rejects.toThrow('valid stock symbol')
    expect(getUser).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it('adds an uppercased symbol scoped to the signed-in account', async () => {
    signInAsBob()
    const single = vi.fn().mockResolvedValue({
      data: { user_id: 'bob-user-id', symbol: 'AAPL' }, error: null,
    })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    from.mockReturnValue({ insert } as never)

    const result = await addWatchlistSymbol(' aapl ')

    expect(from).toHaveBeenCalledWith('watchlist')
    expect(insert).toHaveBeenCalledWith({ user_id: 'bob-user-id', symbol: 'AAPL' })
    expect(result).toEqual({ userId: 'bob-user-id', symbol: 'AAPL' })
  })

  it('returns an understandable message when the stock already exists', async () => {
    signInAsBob()
    const single = vi.fn().mockResolvedValue({
      data: null, error: { code: '23505', message: 'duplicate key' },
    })
    from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single }),
      }),
    } as never)

    await expect(addWatchlistSymbol('aapl')).rejects.toThrow(
      'AAPL is already on your watchlist.',
    )
  })

  it('removes only the signed-in user\'s matching symbol', async () => {
    signInAsBob()
    const lastEq = vi.fn().mockResolvedValue({ error: null })
    const firstEq = vi.fn().mockReturnValue({ eq: lastEq })
    const remove = vi.fn().mockReturnValue({ eq: firstEq })
    from.mockReturnValue({ delete: remove } as never)

    await removeWatchlistSymbol('aapl')

    expect(from).toHaveBeenCalledWith('watchlist')
    expect(firstEq).toHaveBeenCalledWith('user_id', 'bob-user-id')
    expect(lastEq).toHaveBeenCalledWith('symbol', 'AAPL')
  })

  it('rejects changes for an unauthenticated visitor', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null } as never)
    await expect(addWatchlistSymbol('AAPL')).rejects.toThrow(
      'You must be signed in to edit your watchlist.',
    )
    expect(from).not.toHaveBeenCalled()
  })
})
