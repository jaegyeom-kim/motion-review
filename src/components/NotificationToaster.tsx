import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import type { AppNotification } from '../types'
import { IconBell, IconClose } from './Icon'

/** Fleeting toasts for notifications that arrive while the app is open. Watches
 *  the store's notification list and pops a card for each newly-seen unread
 *  item, auto-dismissing after a few seconds. */
export function NotificationToaster() {
  const navigate = useNavigate()
  const notifications = useStore((s) => s.notifications)
  const markNotifRead = useStore((s) => s.markNotifRead)
  const [toasts, setToasts] = useState<AppNotification[]>([])
  // ids we've already shown (or that existed at mount) so we never re-toast.
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (seen.current === null) {
      // first run — treat everything already loaded as "seen", don't toast it.
      seen.current = new Set(notifications.map((n) => n.id))
      return
    }
    const fresh = notifications.filter((n) => !n.read && !seen.current!.has(n.id))
    if (!fresh.length) return
    fresh.forEach((n) => seen.current!.add(n.id))
    setToasts((prev) => [...fresh, ...prev].slice(0, 4))
    const timers = fresh.map((n) =>
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== n.id)), 6000),
    )
    return () => timers.forEach(clearTimeout)
  }, [notifications])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))
  const open = (n: AppNotification) => {
    void markNotifRead(n.id)
    dismiss(n.id)
    if (n.assetId) navigate(`/asset/${n.assetId}`)
  }

  if (!toasts.length) return null
  return (
    <div className="toaster">
      {toasts.map((n) => (
        <div key={n.id} className="toast" onClick={() => open(n)}>
          <span className="toast-ico"><IconBell size={15} /></span>
          <div className="toast-body">
            <div className="toast-title">{n.title}</div>
            {n.body && <div className="toast-text muted">{n.body}</div>}
          </div>
          <button
            className="toast-x"
            onClick={(e) => {
              e.stopPropagation()
              dismiss(n.id)
            }}
            title="닫기"
          >
            <IconClose size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
