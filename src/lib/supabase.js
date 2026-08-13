import { createClient } from '@supabase/supabase-js'

function normalizeSupabaseUrl(url) {
  if (!url) return url
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '')
}

// Public project credentials (safe for browser + RLS). Prefer Vercel/local env when set.
const FALLBACK_SUPABASE_URL = 'https://fqguhytfhiyrwuprnalu.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZ3VoeXRmaGl5cnd1cHJuYWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0OTUzNDUsImV4cCI6MjEwMjA3MTM0NX0.XPOFfzJvwoPaivHAzfbbUmZd_EC8kQXrZy8RIpapYtY'

const supabaseUrl = normalizeSupabaseUrl(
  import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL,
)
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
)?.trim()

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
