import type { Comment } from '../types'
import { fmtTimecode } from '../lib/labels'
import { TagBadge } from './Badges'

/** Hover preview for a canvas pin. Rendered at the stage level (not inside the
 *  overflow-hidden stage-box) so it never gets clipped near an edge. */
export function PinTooltip({
  comment,
  fps,
  temporal,
  left,
  top,
}: {
  comment: Comment
  fps: number
  temporal: boolean
  left: number
  top: number
}) {
  return (
    <div className="pin-tip" style={{ left, top }}>
      <div className="pin-tip-head">
        <span className="pin-tip-num" style={{ background: comment.authorColor }}>
          {comment.number}
        </span>
        <b className="pin-tip-author">{comment.author}</b>
        <TagBadge tag={comment.tag} />
      </div>
      <div className="pin-tip-body">{comment.body}</div>
      <div className="pin-tip-meta mono muted">
        {temporal
          ? `f${Math.round(comment.frame)} · ${fmtTimecode(comment.frame, fps)}`
          : `위치 (${Math.round(comment.x * 100)}, ${Math.round(comment.y * 100)})`}
        {comment.layerName ? ` · ${comment.layerName}` : ''}
      </div>
    </div>
  )
}
