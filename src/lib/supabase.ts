import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cloud mode turns on only when both env vars are present (.env.local in dev,
// or build-time env on the host). Otherwise the app stays fully local
// (IndexedDB) so nothing breaks without a backend.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudEnabled = !!(url && anonKey)

// Auth gate. When on, the app requires a logged-in member (magic-link) and the
// backend RLS is locked to the `authenticated` role. Off by default so the
// live anonymous link-share workspace keeps working until we flip both this
// flag AND apply schema-auth.sql together (the coordinated cutover).
export const requireAuth =
  cloudEnabled && (import.meta.env.VITE_REQUIRE_AUTH as string | undefined) === 'true'

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, anonKey!, {
      // persist the session (localStorage) so magic-link logins survive reloads
      // once auth is on. Harmless when auth is off (no session is ever created).
      auth: { persistSession: requireAuth, autoRefreshToken: requireAuth },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

export const MEDIA_BUCKET = 'media'
