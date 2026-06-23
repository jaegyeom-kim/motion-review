import type { AssetStatus, CommentStatus, CommentTag } from '../types'
import { ASSET_STATUS_META, STATUS_META, TAG_META } from '../lib/labels'

/** Asset-level review status pill (draft / in_review / needs_changes / approved). */
export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const m = ASSET_STATUS_META[status]
  return (
    <span
      className="chip"
      style={{ background: `${m.color}1f`, color: m.color, borderColor: `${m.color}3a` }}
    >
      <span className="dot" style={{ background: m.color }} />
      {m.label}
    </span>
  )
}

export function TagBadge({ tag }: { tag: CommentTag }) {
  const m = TAG_META[tag]
  return (
    <span
      className="chip"
      style={{ background: `${m.color}1f`, color: m.color, borderColor: `${m.color}3a` }}
    >
      {m.label}
    </span>
  )
}

export function StatusBadge({ status }: { status: CommentStatus }) {
  const m = STATUS_META[status]
  return (
    <span
      className="chip"
      style={{ background: `${m.color}1f`, color: m.color, borderColor: `${m.color}3a` }}
    >
      <span className="dot" style={{ background: m.color }} />
      {m.label}
    </span>
  )
}

/** Per-version approval chip. */
export function VerdictChip({ approved }: { approved: boolean }) {
  const color = approved ? '#58c98a' : '#868a96'
  return (
    <span
      className="chip"
      style={{ background: `${color}1f`, color, borderColor: `${color}3a` }}
    >
      <span className="dot" style={{ background: color }} />
      {approved ? '승인됨' : '검토중'}
    </span>
  )
}
