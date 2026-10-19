import type { Profile } from '../types'
import { supabase } from './supabase'

export function signUp(email: string, password: string, nickname: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  })
}

export function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export function signOut() {
  return supabase.auth.signOut()
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, nickname, starting_balance, cash_balance')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    userId: data.user_id,
    nickname: data.nickname,
    startingBalance: Number(data.starting_balance),
    cashBalance: Number(data.cash_balance),
  }
}
