import type { WatchlistItem } from '../types'
import { supabase } from './supabase'

const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,14}$/

async function getAuthenticatedUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('You must be signed in to edit your watchlist.')
  return user.id
}

/**
 * Supabase RLS restricts both operations to the authenticated user's rows.
 * Do not rely on client-only state to persist watchlist changes.
 */
export async function addWatchlistSymbol(symbol: string): Promise<WatchlistItem> {
  const normalizedSymbol = symbol.trim().toUpperCase()
  if (!SYMBOL_PATTERN.test(normalizedSymbol)) {
    throw new Error('Enter a valid stock symbol (letters, digits, dots or dashes).')
  }

  const userId = await getAuthenticatedUserId()
  const { data, error } = await supabase.from('watchlist')
    .insert({ user_id: userId, symbol: normalizedSymbol })
    .select('user_id, symbol')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error(`${normalizedSymbol} is already on your watchlist.`)
    throw error
  }

  return { userId: data.user_id, symbol: data.symbol }
}

export async function removeWatchlistSymbol(symbol: string): Promise<void> {
  const userId = await getAuthenticatedUserId()
  const { error } = await supabase.from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('symbol', symbol.trim().toUpperCase())
  if (error) throw error
}
