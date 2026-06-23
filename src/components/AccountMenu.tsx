import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { IconLogout, IconShield } from './Icon'

/** Topbar account control: avatar initial → dropdown with name/role, an Admin
 *  link (admins only), and sign out. Only meaningful in auth mode. */
export function AccountMenu() {
  const navigate = useNavigate()
  const profile = useStore((s) => s.profile)
  const signOut = useStore((s) => s.signOut)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!profile) return null
  const initial = (profile.name || profile.email || '?').trim().charAt(0).toUpperCase()
  const isAdmin = profile.role === 'admin'

  return (
    <div className="account" ref={ref}>
      <button
        className="account-avatar"
        style={{ background: profile.color }}
        onClick={() => setOpen((o) => !o)}
        title={profile.name}
      >
        {initial}
      </button>
      {open && (
        <div className="account-pop">
          <div className="account-id">
            <span className="account-avatar sm" style={{ background: profile.color }}>
              {initial}
            </span>
            <div className="account-id-text">
              <div className="account-name">{profile.name}</div>
              <div className="account-email muted">{profile.email}</div>
            </div>
          </div>
          <div className="account-role">
            <span className={`role-pill ${isAdmin ? 'admin' : ''}`}>
              {isAdmin ? '관리자' : '멤버'}
            </span>
          </div>
          <div className="account-menu">
            {isAdmin && (
              <button
                onClick={() => {
                  setOpen(false)
                  navigate('/admin')
                }}
              >
                <IconShield size={15} /> 멤버 관리
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false)
                void signOut()
              }}
            >
              <IconLogout size={15} /> 로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
