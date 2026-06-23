import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cloud mode turns on only when both env vars are present (.env.local in dev,
// or build-time env on the host). Otherwise the app stays fully local
// (IndexedDB) so nothing breaks without a backend.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudEnabled = !!(url && anonKey)

// Auth modes (cloud only):
//   VITE_REQUIRE_AUTH=true  → login REQUIRED. The whole app is gated and RLS is
//                             locked to `authenticated` (apply schema-auth.sql).
//   VITE_AUTH_OPTIONAL=true → HYBRID. Anonymous link-share still works, but
//                             anyone who logs in gets a profile + notifications.
//                             RLS keeps anon open (apply schema-auth-hybrid.sql).
//   neither                 → pure anonymous link-share (current live behavior).
export const requireAuth =
  cloudEnabled && (import.meta.env.VITE_REQUIRE_AUTH as string | undefined) === 'true'

// Auth *features* (login UI, profiles, bell, admin) are available whenever auth
// is required OR optional. The difference is only whether the app is gated.
export const authEnabled =
  requireAuth ||
  (cloudEnabled && (import.meta.env.VITE_AUTH_OPTIONAL as string | undefined) === 'true')

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, anonKey!, {
      // persist the session (localStorage) so logins survive reloads once auth
      // is on. Harmless when auth is off (no session is ever created).
      auth: { persistSession: authEnabled, autoRefreshToken: authEnabled },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

export const MEDIA_BUCKET = 'media'
