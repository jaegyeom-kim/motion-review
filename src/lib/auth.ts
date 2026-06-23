import type { Session } from '@supabase/supabase-js'
import type { Profile, Role } from '../types'
import { supabase } from './supabase'
import { IDENTITY_COLORS } from './identityColors'

// Auth layer for cloud + auth mode. Uses email OTP *codes* (6-digit) rather
// than magic-link clicks: a click-link returns the token in the URL hash, which
// collides with HashRouter on GitHub Pages. Codes need no redirect, so they're
// robust on static hosting. Signups are closed — only accounts an admin has
// created (Supabase dashboard or the admin-invite function) can request a code.

const sb = () => {
  if (!supabase) throw new Error('cloud backend not configured')
  return supabase
}

/** Send a 6-digit login code to an existing account. Closed signup: unknown
 *  emails get an error rather than a new account. */
export async function sendLoginCode(email: string): Promise<void> {
  const { error } = await sb().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: false },
  })
  if (error) throw error
}

/** Verify the emailed code and establish a session. */
export async function verifyLoginCode(email: string, token: string): Promise<Session> {
  const { data, error } = await sb().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  })
  if (error) throw error
  if (!data.session) throw new Error('로그인에 실패했습니다.')
  return data.session
}

export async function signOut(): Promise<void> {
  await sb().auth.signOut()
}

export async function getSession(): Promise<Session | null> {
  const { data } = await sb().auth.getSession()
  return data.session ?? null
}

/** Subscribe to auth changes (login / logout / token refresh). */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const { data } = sb().auth.onAuthStateChange((_event, session) => cb(session))
  return () => data.subscription.unsubscribe()
}

const colorFor = (id: string) => {
  // deterministic default color from the uid so a user looks consistent
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return IDENTITY_COLORS[h % IDENTITY_COLORS.length]
}

/** Load the signed-in user's profile, creating a default row if the admin
 *  pre-created the auth account but no profile exists yet. */
export async function ensureProfile(session: Session): Promise<Profile> {
  const c = sb()
  const uid = session.user.id
  const email = session.user.email ?? ''
  const { data: existing } = await c.from('profiles').select('data').eq('id', uid).maybeSingle()
  if (existing?.data) return existing.data as Profile

  const profile: Profile = {
    id: uid,
    email,
    name: email.split('@')[0] || '사용자',
    role: 'member',
    color: colorFor(uid),
    createdAt: Date.now(),
  }
  await c.from('profiles').upsert({ id: uid, email, role: profile.role, data: profile })
  return profile
}

export async function updateProfile(p: Profile): Promise<void> {
  const { error } = await sb()
    .from('profiles')
    .upsert({ id: p.id, email: p.email, role: p.role, data: p })
  if (error) throw error
}

export const isAdmin = (p: Profile | null): boolean => p?.role === 'admin'
export type { Role }
