import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cloud mode turns on only when both env vars are present (.env.local in dev,
// or build-time env on the host). Otherwise the app stays fully local
// (IndexedDB) so nothing breaks without a backend.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudEnabled = !!(url && anonKey)

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, anonKey!, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

export const MEDIA_BUCKET = 'media'
