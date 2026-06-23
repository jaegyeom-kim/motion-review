import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/useStore'
import { fmtRelative } from '../lib/labels'
import { IconBell } from './Icon'

/** Topbar notification bell: unread count badge + dropdown of recent items.
 *  Clicking an item marks it read and deep-links to the asset. */
export function NotificationBell() {
  const navigate = useNavigate()
  const notifications = useStore(useShallow((s) => s.notifications))
  const markNotifRead = useStore((s) => s.markNotifRead)
  const markAllNotifsRead = useStore((s) => s.markAllNotifsRead)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const openItem = (id: string, assetId?: string) => {
    void markNotifRead(id)
    setOpen(false)
    if (assetId) navigate(`/asset/${assetId}`)
  }

  return (
    <div className="notif" ref={ref}>
      <button
        className="icon-btn notif-btn"
        onClick={() => setOpen((o) => !o)}
        title="알림"
      >
        <IconBell size={17} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-pop">
          <div className="notif-head">
            <span>알림</span>
            {unread > 0 && (
              <button className="notif-readall" onClick={() => markAllNotifsRead()}>
                모두 읽음
              </button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty muted">새 알림이 없습니다.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  className={`notif-item ${n.read ? '' : 'unread'}`}
                  onClick={() => openItem(n.id, n.assetId)}
                >
                  {!n.read && <span className="notif-dot" />}
                  <div className="notif-item-body">
                    <div className="notif-title">{n.title}</div>
                    {n.body && <div className="notif-text muted">{n.body}</div>}
                    <div className="notif-time muted mono">{fmtRelative(n.createdAt)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
