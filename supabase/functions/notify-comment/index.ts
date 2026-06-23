// Supabase Edge Function — fan out comment notifications (in-app + email).
//
// Triggered by a Database Webhook on public.comments (INSERT and UPDATE).
//   INSERT  → a brand-new comment.
//   UPDATE  → a reply was appended (data.replies grew) — comments store their
//             replies inside the jsonb doc, so a reply is an UPDATE.
//
// Recipients = members assigned to the comment's project, minus the actor.
// For each recipient we insert a notifications row (the in-app bell picks it up
// via Realtime) and send an email through Resend.
//
// Deno runtime. Deploy:  supabase functions deploy notify-comment --no-verify-jwt
// Secrets needed:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected),
//                  RESEND_API_KEY, RESEND_FROM, APP_URL
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Motion Review <onboarding@resend.dev>'
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const TAG_LABEL: Record<string, string> = {
  fix: '수정', timing: '타이밍', color: '색상', shape: '형태',
  easing: '이징', question: '질문', idea: '아이디어',
}

function deepLink(assetId: string) {
  // HashRouter route
  return APP_URL ? `${APP_URL}/#/asset/${assetId}` : ''
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
    })
  } catch (e) {
    console.error('resend failed', e)
  }
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const type: string = payload.type // INSERT | UPDATE
    const record = payload.record
    const old = payload.old_record
    if (!record?.data) return json({ ok: true, skipped: 'no record' })

    const comment = record.data
    const assetId: string = comment.assetId
    let kind: 'comment' | 'reply' = 'comment'
    let actorId: string | undefined = comment.authorId
    let actorName: string = comment.author ?? '누군가'
    let bodyText: string = comment.body ?? ''

    if (type === 'UPDATE') {
      const before = (old?.data?.replies ?? []) as any[]
      const after = (comment.replies ?? []) as any[]
      if (after.length <= before.length) return json({ ok: true, skipped: 'no new reply' })
      const reply = after[after.length - 1]
      kind = 'reply'
      actorId = reply.authorId
      actorName = reply.author ?? '누군가'
      bodyText = reply.body ?? ''
    } else if (type !== 'INSERT') {
      return json({ ok: true, skipped: `type ${type}` })
    }

    // asset → project + name
    const { data: assetRow } = await admin
      .from('assets')
      .select('project_id, data')
      .eq('id', assetId)
      .maybeSingle()
    const projectId: string | undefined = assetRow?.project_id
    const assetName: string = assetRow?.data?.name ?? '애셋'
    if (!projectId) return json({ ok: true, skipped: 'asset/project missing' })

    // recipients = project members − actor
    const { data: pmRows } = await admin
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
    let recipientIds = (pmRows ?? []).map((r: any) => r.user_id as string)

    // for replies, also notify the original comment author even if not a member
    if (kind === 'reply' && comment.authorId) recipientIds.push(comment.authorId)
    recipientIds = [...new Set(recipientIds)].filter((id) => id && id !== actorId)
    if (!recipientIds.length) return json({ ok: true, recipients: 0 })

    // recipient emails
    const { data: profs } = await admin
      .from('profiles')
      .select('id, email')
      .in('id', recipientIds)
    const emailById = new Map((profs ?? []).map((p: any) => [p.id, p.email as string]))

    const tag = TAG_LABEL[comment.tag] ?? comment.tag ?? ''
    const title = kind === 'reply'
      ? `${actorName}님이 답글을 남겼어요`
      : `${actorName}님이 댓글을 남겼어요`
    const snippet = bodyText.length > 140 ? bodyText.slice(0, 140) + '…' : bodyText
    const body = `${assetName}${tag ? ` · ${tag}` : ''} — "${snippet}"`
    const link = deepLink(assetId)
    const nowMs = Date.now()

    const notifRows = recipientIds.map((uid) => {
      // one uuid used for BOTH the row id and the jsonb data.id, so the client
      // (which reads data.id) and read-status updates (which key on the row id)
      // agree.
      const id = crypto.randomUUID()
      return {
        id,
        user_id: uid,
        read: false,
        data: {
          id,
          userId: uid,
          type: kind,
          title,
          body,
          assetId,
          projectId,
          commentId: comment.id,
          actor: actorName,
          read: false,
          createdAt: nowMs,
        },
      }
    })
    await admin.from('notifications').insert(notifRows)

    // emails (best-effort, parallel)
    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:520px">
        <h2 style="margin:0 0 4px;font-size:17px">${escapeHtml(title)}</h2>
        <p style="margin:0 0 14px;color:#555">${escapeHtml(body)}</p>
        ${link ? `<a href="${link}" style="display:inline-block;background:#7c6cff;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:14px">열어서 보기</a>` : ''}
        <p style="margin:18px 0 0;color:#999;font-size:12px">Motion Review</p>
      </div>`
    await Promise.all(
      recipientIds.map((uid) => {
        const to = emailById.get(uid)
        return to ? sendEmail(to, `[Motion Review] ${title}`, html) : Promise.resolve()
      }),
    )

    return json({ ok: true, recipients: recipientIds.length })
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  )
}
