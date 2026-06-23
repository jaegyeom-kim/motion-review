// Supabase Edge Function — admin invites a member.
//
// Verifies the caller is an admin, creates the auth account (so closed-signup
// login works), inserts their profile, and optionally emails an invite. The
// invitee then logs in with an email code on the normal login screen.
//
// Deno runtime. Deploy:  supabase functions deploy admin-invite
// Secrets:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected),
//           RESEND_API_KEY (optional), RESEND_FROM (optional), APP_URL (optional)
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Motion Review <onboarding@resend.dev>'
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const COLORS = ['#7c6cff', '#3ad1c4', '#ff7a59', '#ffc24b', '#5b9bff', '#ff6b9d', '#9bd35a', '#c98aff']
const colorFor = (id: string) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // 1) authenticate the caller from their bearer token + require admin role
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'missing auth' }, 401)
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData.user) return json({ error: 'invalid auth' }, 401)
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (callerProfile?.role !== 'admin') return json({ error: '관리자만 초대할 수 있습니다.' }, 403)

    // 2) parse input
    const { email, name } = await req.json()
    const e = String(email ?? '').trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({ error: '올바른 이메일이 아닙니다.' }, 400)
    const displayName = String(name ?? '').trim() || e.split('@')[0]

    // 3) create the auth user (idempotent: tolerate "already registered")
    let userId: string | null = null
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: e,
      email_confirm: true,
    })
    if (createErr) {
      // already exists → find them
      const { data: list } = await admin.auth.admin.listUsers()
      const found = list?.users?.find((u: any) => (u.email ?? '').toLowerCase() === e)
      if (!found) return json({ error: createErr.message }, 400)
      userId = found.id
    } else {
      userId = created.user?.id ?? null
    }
    if (!userId) return json({ error: '계정 생성 실패' }, 500)

    // 4) upsert their profile (don't clobber an existing one's role)
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
    if (!existing) {
      const profile = {
        id: userId,
        email: e,
        name: displayName,
        role: 'member',
        color: colorFor(userId),
        createdAt: Date.now(),
      }
      await admin.from('profiles').insert({ id: userId, email: e, role: 'member', data: profile })
    }

    // 5) optional invite email
    if (RESEND_API_KEY) {
      const link = APP_URL ? `${APP_URL}/` : ''
      const html = `
        <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:520px">
          <h2 style="margin:0 0 6px;font-size:17px">Motion Review에 초대되었어요</h2>
          <p style="margin:0 0 14px;color:#555">${escapeHtml(displayName)}님, 아래 버튼으로 들어가서
            이메일(${escapeHtml(e)})로 로그인 코드를 받아 접속하세요.</p>
          ${link ? `<a href="${link}" style="display:inline-block;background:#7c6cff;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:14px">들어가기</a>` : ''}
        </div>`
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: RESEND_FROM, to: e, subject: '[Motion Review] 초대', html }),
        })
      } catch (_) { /* best effort */ }
    }

    return json({ ok: true, userId })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  )
}
