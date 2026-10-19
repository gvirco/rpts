import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local')
}

// Publishable key is intentionally browser-visible. RLS protects user data.
// Never expose Supabase secret/service-role keys to the frontend.
export const supabase = createClient(url, publishableKey)
