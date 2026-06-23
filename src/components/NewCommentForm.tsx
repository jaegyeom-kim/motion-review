import { useState } from 'react'
import { COMMENT_TAGS, type CommentTag } from '../types'
import { TAG_META, fmtTimecode } from '../lib/labels'
import type { DraftPin } from '../store/useStore'

export function NewCommentForm({
  draft,
  fps,
  layerNames,
  temporal = true,
  onSubmit,
  onCancel,
}: {
  draft: DraftPin
  fps: number
  layerNames: string[]
  /** false for spatial-only media (image) — hides the frame/timecode anchor. */
  temporal?: boolean
  onSubmit: (v: { body: string; tag: CommentTag; layerName?: string }) => void
  onCancel: () => void
}) {
  const [body, setBody] = useState('')
  const [tag, setTag] = useState<CommentTag>('fix')
  const [layerName, setLayerName] = useState('')

  return (
    <div className="composer">
      <div className="composer-anchor mono">
        <span className="dot" style={{ background: 'var(--accent)' }} />
        {temporal && (
          <>
            프레임 {Math.round(draft.frame)} · {fmtTimecode(draft.frame, fps)} ·{' '}
          </>
        )}
        ({Math.round(draft.x * 100)}, {Math.round(draft.y * 100)})
      </div>
      <textarea
        className="textarea"
        autoFocus
        placeholder="수정이 필요한 부분을 적어주세요…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && body.trim())
            onSubmit({ body: body.trim(), tag, layerName: layerName || undefined })
        }}
      />
      <div className="tag-row">
        {COMMENT_TAGS.map((t) => (
          <button
            key={t}
            className={`tag-pick ${tag === t ? 'on' : ''}`}
            style={{ ['--tc' as string]: TAG_META[t].color }}
            onClick={() => setTag(t)}
          >
            {TAG_META[t].label}
          </button>
        ))}
      </div>
      {layerNames.length > 0 && (
        <select
          className="select"
          value={layerName}
          onChange={(e) => setLayerName(e.target.value)}
        >
          <option value="">레이어 지정 안 함</option>
          {layerNames.map((n) => (
            <option key={n} value={n}>
              🎞 {n}
            </option>
          ))}
        </select>
      )}
      <div className="composer-foot">
        <button className="btn sm" onClick={onCancel}>
          취소
        </button>
        <button
          className="btn primary sm"
          disabled={!body.trim()}
          onClick={() =>
            onSubmit({ body: body.trim(), tag, layerName: layerName || undefined })
          }
        >
          핀 등록 <span className="kbd">⌘↵</span>
        </button>
      </div>
    </div>
  )
}
