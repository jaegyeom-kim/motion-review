import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectBranchVersions } from '../store/useStore'
import { fmtRelative } from '../lib/labels'
import { IconChevron, IconCheck } from './Icon'

export function VersionSelector() {
  const currentBranchId = useStore((s) => s.currentBranchId)
  const currentVersionId = useStore((s) => s.currentVersionId)
  const versions = useStore(
    useShallow((s) =>
      currentBranchId ? selectBranchVersions(s, currentBranchId) : [],
    ),
  )
  const setCurrentVersion = useStore((s) => s.setCurrentVersion)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const current = versions.find((v) => v.id === currentVersionId)
  const newestFirst = [...versions].reverse()
  const latestId = versions[versions.length - 1]?.id

  if (!current) return null

  return (
    <div className="ver-select" ref={ref}>
      <button className="ver-select-btn" onClick={() => setOpen((o) => !o)}>
        <span className="mono ver-select-num">v{current.globalNumber}</span>
        <span className="ver-select-msg">{current.message}</span>
        <IconChevron size={15} />
      </button>
      {open && (
        <div className="ver-dropdown">
          {newestFirst.map((v) => {
            const dot = v.approved
              ? 'var(--green)'
              : v.id === latestId
                ? 'var(--amber)'
                : 'var(--text-3)'
            return (
              <button
                key={v.id}
                className={`ver-opt ${v.id === currentVersionId ? 'on' : ''}`}
                onClick={() => {
                  setCurrentVersion(v.id)
                  setOpen(false)
                }}
              >
                <span className="dot" style={{ background: dot }} />
                <span className="mono ver-opt-num">v{v.globalNumber}</span>
                <span className="ver-opt-msg">{v.message}</span>
                <span className="muted ver-opt-time">{fmtRelative(v.createdAt)}</span>
                {v.id === currentVersionId && <IconCheck size={14} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
