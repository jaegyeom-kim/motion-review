import { useEffect, useRef, useState } from 'react'
import { useStore, IDENTITY_COLORS } from '../store/useStore'

/** Topbar control where the user sets their own display name + bubble color.
 *  Persisted (localStorage) and snapshotted onto every comment they make. */
export function IdentityChip() {
  const author = useStore((s) => s.author)
  const authorColor = useStore((s) => s.authorColor)
  const setIdentity = useStore((s) => s.setIdentity)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(author)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setName(author), [author])
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="identity" ref={ref}>
      <button
        className="identity-chip"
        onClick={() => setOpen((o) => !o)}
        title="내 이름·버블 색상 설정"
      >
        <span className="identity-dot" style={{ background: authorColor }} />
        <span className="identity-name">{author}</span>
      </button>
      {open && (
        <div className="identity-pop">
          <label className="field-label">표시 이름</label>
          <input
            className="input"
            value={name}
            autoFocus
            placeholder="이름"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setIdentity(name, authorColor)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIdentity(name, authorColor)
                setOpen(false)
              }
            }}
          />
          <label className="field-label" style={{ marginTop: 12 }}>
            버블 색상
          </label>
          <div className="swatches">
            {IDENTITY_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${c === authorColor ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => setIdentity(name, c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
