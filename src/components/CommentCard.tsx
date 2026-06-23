import { useEffect, useRef, useState } from 'react'
import type { Comment } from '../types'
import { COMMENT_STATUSES } from '../types'
import { useStore } from '../store/useStore'
import { STATUS_META, fmtRelative, fmtTimecode } from '../lib/labels'
import { TagBadge } from './Badges'
import { IconChat, IconTrash, IconLayers, IconClock } from './Icon'

export function CommentCard({
  comment,
  fps,
  selected,
  temporal = true,
  onSelect,
}: {
  comment: Comment
  fps: number
  selected: boolean
  /** false for spatial-only media (image) — hides the frame/timecode anchor. */
  temporal?: boolean
  onSelect: () => void
}) {
  const setStatus = useStore((s) => s.setCommentStatus)
  const addReply = useStore((s) => s.addReply)
  const removeComment = useStore((s) => s.removeComment)
  const [reply, setReply] = useState('')
  const [showReply, setShowReply] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // When this card becomes selected (e.g. by clicking its pin on the canvas),
  // scroll it into view so "go to comment" reveals it in the panel.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  const statusColor = STATUS_META[comment.status].color

  return (
    <div
      ref={ref}
      className={`cmt-card ${selected ? 'selected' : ''}`}
      style={{ ['--sc' as string]: comment.authorColor }}
      onClick={onSelect}
    >
      <div className="cmt-top">
        <span
          className="cmt-num"
          style={{ background: comment.authorColor }}
          title={comment.author}
        >
          {comment.number}
        </span>
        <TagBadge tag={comment.tag} />
        <span className="spacer" />
        <span className="cmt-time muted">{fmtRelative(comment.createdAt)}</span>
        <button
          className="mini-btn danger"
          title="삭제"
          onClick={(e) => {
            e.stopPropagation()
            removeComment(comment.id)
          }}
        >
          <IconTrash size={13} />
        </button>
      </div>

      <div className="cmt-body">{comment.body}</div>

      <div className="cmt-anchor mono muted">
        {temporal ? (
          <span title="앵커 프레임">
            <IconClock size={12} /> f{Math.round(comment.frame)} ·{' '}
            {fmtTimecode(comment.frame, fps)}
          </span>
        ) : (
          <span title="위치">
            <IconLayers size={12} /> ({Math.round(comment.x * 100)}, {Math.round(comment.y * 100)})
          </span>
        )}
        {comment.layerName && (
          <span title="대상 레이어">
            <IconLayers size={12} /> {comment.layerName}
          </span>
        )}
        <span className="cmt-author">
          <span className="author-dot" style={{ background: comment.authorColor }} />
          {comment.author}
        </span>
      </div>

      {comment.replies.length > 0 && (
        <div className="cmt-replies">
          {comment.replies.map((r) => (
            <div key={r.id} className="reply">
              <span className="author-dot" style={{ background: r.authorColor }} />
              <b>{r.author}</b> <span className="muted">{fmtRelative(r.createdAt)}</span>
              <div>{r.body}</div>
            </div>
          ))}
        </div>
      )}

      <div className="cmt-foot" onClick={(e) => e.stopPropagation()}>
        <select
          className="status-select"
          value={comment.status}
          style={{ color: statusColor, borderColor: `${statusColor}55` }}
          onChange={(e) => setStatus(comment.id, e.target.value as Comment['status'])}
        >
          {COMMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <button
          className="mini-btn"
          title="답글"
          onClick={() => setShowReply((v) => !v)}
        >
          <IconChat size={13} /> {comment.replies.length || ''}
        </button>
      </div>

      {showReply && (
        <div className="reply-box" onClick={(e) => e.stopPropagation()}>
          <input
            className="input"
            placeholder="답글…"
            value={reply}
            autoFocus
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && reply.trim()) {
                addReply(comment.id, reply.trim())
                setReply('')
                setShowReply(false)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
