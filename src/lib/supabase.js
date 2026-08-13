import { createClient } from '@supabase/supabase-js'

function normalizeSupabaseUrl(url) {
  if (!url) return url
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '')
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
