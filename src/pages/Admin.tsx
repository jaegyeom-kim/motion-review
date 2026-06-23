import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/useStore'
import { requireAuth, supabase } from '../lib/supabase'
import type { Role } from '../types'
import { IconBack, IconShield, IconPlus, IconCheck, IconFolder } from '../components/Icon'

export function Admin() {
  const navigate = useNavigate()
  const profile = useStore((s) => s.profile)
  const members = useStore(useShallow((s) => s.members))
  const projects = useStore(useShallow((s) => s.projects))
  const projectMembers = useStore(useShallow((s) => s.projectMembers))
  const setMemberRole = useStore((s) => s.setMemberRole)
  const assignMember = useStore((s) => s.assignMember)
  const unassignMember = useStore((s) => s.unassignMember)
  const refreshMembers = useStore((s) => s.refreshMembers)

  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (requireAuth) void refreshMembers()
  }, [refreshMembers])

  if (!requireAuth)
    return (
      <Gate msg="인증 모드가 아닙니다." onHome={() => navigate('/')} />
    )
  if (profile && profile.role !== 'admin')
    return <Gate msg="관리자만 접근할 수 있습니다." onHome={() => navigate('/')} />

  const isAssigned = (projectId: string, userId: string) =>
    projectMembers.some((pm) => pm.projectId === projectId && pm.userId === userId)

  const sorted = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" onClick={() => navigate('/')} title="홈으로">
          <IconBack />
        </button>
        <div className="brand">
          <IconShield size={18} /> 멤버 관리
        </div>
        <div className="spacer" />
      </div>

      <div className="dash-scroll">
        <div className="dash-inner admin-inner">
          <InviteForm onInvited={() => refreshMembers()} />

          <h2 className="dash-h" style={{ marginTop: 28 }}>
            멤버 <span className="muted">{members.length}</span>
          </h2>

          <div className="member-table">
            <div className="member-row member-head">
              <span>이름</span>
              <span>이메일</span>
              <span>역할</span>
              <span>프로젝트</span>
            </div>
            {sorted.map((m) => {
              const assignedCount = projects.filter((p) => isAssigned(p.id, m.id)).length
              const self = m.id === profile?.id
              return (
                <div key={m.id} className="member-block">
                  <div className="member-row">
                    <span className="member-name">
                      <span className="account-avatar sm" style={{ background: m.color }}>
                        {(m.name || m.email || '?').charAt(0).toUpperCase()}
                      </span>
                      {m.name}
                      {self && <span className="member-you">나</span>}
                    </span>
                    <span className="member-email muted">{m.email}</span>
                    <span>
                      <select
                        className="filter-select"
                        value={m.role}
                        disabled={self}
                        title={self ? '본인 역할은 바꿀 수 없습니다' : '역할 변경'}
                        onChange={(e) => setMemberRole(m.id, e.target.value as Role)}
                      >
                        <option value="member">멤버</option>
                        <option value="admin">관리자</option>
                      </select>
                    </span>
                    <span>
                      <button
                        className="btn sm"
                        onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                      >
                        <IconFolder size={13} /> {assignedCount}/{projects.length}
                      </button>
                    </span>
                  </div>
                  {expanded === m.id && (
                    <div className="member-projects">
                      {projects.length === 0 ? (
                        <span className="muted">프로젝트가 없습니다.</span>
                      ) : (
                        projects.map((p) => {
                          const on = isAssigned(p.id, m.id)
                          return (
                            <button
                              key={p.id}
                              className={`assign-chip ${on ? 'on' : ''}`}
                              onClick={() =>
                                on ? unassignMember(p.id, m.id) : assignMember(p.id, m.id)
                              }
                            >
                              {on && <IconCheck size={12} />}
                              <span className="assign-dot" style={{ background: p.color }} />
                              {p.name}
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="admin-note muted">
            프로젝트에 배정된 멤버는 그 프로젝트의 새 댓글 알림(인앱·이메일)을 받습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function Gate({ msg, onHome }: { msg: string; onHome: () => void }) {
  return (
    <div className="loading">
      {msg} <button className="btn sm" onClick={onHome}>홈으로</button>
    </div>
  )
}

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const invite = async () => {
    const e = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      setMsg({ ok: false, text: '올바른 이메일을 입력하세요.' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      if (!supabase) throw new Error('cloud not configured')
      const { data, error } = await supabase.functions.invoke('admin-invite', {
        body: { email: e, name: name.trim() || e.split('@')[0] },
      })
      if (error) throw error
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error)
      setMsg({ ok: true, text: `${e} 초대 완료. 로그인 화면에서 코드로 접속하면 됩니다.` })
      setEmail('')
      setName('')
      onInvited()
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="invite-card">
      <h2 className="dash-h">멤버 초대</h2>
      <div className="invite-row">
        <input
          className="input"
          type="email"
          value={email}
          placeholder="초대할 이메일"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && invite()}
        />
        <input
          className="input"
          value={name}
          placeholder="이름 (선택)"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && invite()}
        />
        <button className="btn primary" onClick={invite} disabled={busy}>
          <IconPlus size={15} /> {busy ? '초대 중…' : '초대'}
        </button>
      </div>
      {msg && (
        <div className={msg.ok ? 'invite-ok' : 'invite-err'}>{msg.text}</div>
      )}
    </div>
  )
}
