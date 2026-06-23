import { useState } from 'react'
import { useStore } from '../store/useStore'
import { authEnabled } from '../lib/supabase'
import { NotificationBell } from './NotificationBell'
import { AccountMenu } from './AccountMenu'
import { Login } from '../pages/Login'

/** Topbar auth cluster. Logged in → bell + account menu. Anonymous in hybrid
 *  mode → a "로그인" button that opens the login as a dismissible overlay.
 *  Renders nothing when auth features are off. */
export function AuthControls() {
  const session = useStore((s) => s.session)
  const [loginOpen, setLoginOpen] = useState(false)

  if (!authEnabled) return null
  if (session)
    return (
      <>
        <NotificationBell />
        <AccountMenu />
      </>
    )
  return (
    <>
      <button className="btn" onClick={() => setLoginOpen(true)}>
        로그인
      </button>
      {loginOpen && <Login onClose={() => setLoginOpen(false)} />}
    </>
  )
}
