import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectVersionComments } from '../store/useStore'
import { COMMENT_TAGS, COMMENT_STATUSES, isTemporalKind, type Version } from '../types'
import { STATUS_META, TAG_META, isOpenComment } from '../lib/labels'
import type { Playback } from '../hooks/usePlayback'
import { CommentCard } from './CommentCard'
import { NewCommentForm } from './NewCommentForm'
import { IconPin, IconChat } from './Icon'

export function CommentPanel({
  version,
  pb,
}: {
  version: Version
  pb: Playback
}) {
  const allComments = useStore(
    useShallow((s) => selectVersionComments(s, version.id)),
  )
  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)
  const placingPin = useStore((s) => s.placingPin)
  const setPlacingPin = useStore((s) => s.setPlacingPin)
  const draftPin = useStore((s) => s.draftPin)
  const setDraftPin = useStore((s) => s.setDraftPin)
  const addComment = useStore((s) => s.addComment)
  const selectedCommentId = useStore((s) => s.selectedCommentId)
  const selectComment = useStore((s) => s.selectComment)

  const [hideResolved, setHideResolved] = useState(true)
  const temporal = isTemporalKind(version.kind)

  const visible = useMemo(() => {
    return allComments.filter((c) => {
      if (filters.status !== 'all' && c.status !== filters.status) return false
      if (filters.status === 'all' && hideResolved && !isOpenComment(c.status))
        return false
      if (filters.tag !== 'all' && c.tag !== filters.tag) return false
      return true
    })
  }, [allComments, filters, hideResolved])

  const openCount = allComments.filter((c) => isOpenComment(c.status)).length

  return (
    <aside className="sidebar right">
      <div className="sidebar-head">
        <span>
          피드백 <span className="muted">{allComments.length}</span>
        </span>
        <button
          className={`btn sm ${placingPin ? 'primary' : ''}`}
          onClick={() => setPlacingPin(!placingPin)}
        >
          <IconPin size={14} /> {placingPin ? '핀 배치중…' : '핀 추가'}
        </button>
      </div>

      <div className="filters">
        <select
          className="filter-select"
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value as never })}
        >
          <option value="all">모든 상태</option>
          {COMMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.tag}
          onChange={(e) => setFilters({ tag: e.target.value as never })}
        >
          <option value="all">모든 태그</option>
          {COMMENT_TAGS.map((t) => (
            <option key={t} value={t}>
              {TAG_META[t].label}
            </option>
          ))}
        </select>
        <label
          className={`hide-toggle ${hideResolved ? 'on' : ''}`}
          title="해결/보류 항목 숨기기"
        >
          <input
            type="checkbox"
            checked={hideResolved}
            onChange={(e) => setHideResolved(e.target.checked)}
          />
          해결 숨김
        </label>
      </div>

      <div className="cmt-scroll">
        {placingPin && draftPin && (
          <NewCommentForm
            draft={draftPin}
            fps={version.meta.frameRate}
            layerNames={version.meta.layerNames}
            temporal={temporal}
            onSubmit={(v) =>
              addComment({
                body: v.body,
                tag: v.tag,
                frame: draftPin.frame,
                x: draftPin.x,
                y: draftPin.y,
                layerName: v.layerName,
              })
            }
            onCancel={() => {
              setDraftPin(null)
              setPlacingPin(false)
            }}
          />
        )}
        {placingPin && !draftPin && (
          <div className="placing-banner">
            <IconPin size={15} /> 캔버스에서 수정할 위치를 클릭하세요.
          </div>
        )}

        {visible.length === 0 && !placingPin ? (
          <div className="empty-panel">
            <IconChat size={26} />
            <p>
              {allComments.length === 0
                ? '아직 피드백이 없습니다.\n‘핀 추가’로 첫 코멘트를 남겨보세요.'
                : '필터에 맞는 피드백이 없습니다.'}
            </p>
          </div>
        ) : (
          visible.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              fps={version.meta.frameRate}
              selected={c.id === selectedCommentId}
              temporal={temporal}
              onSelect={() => {
                selectComment(c.id)
                if (temporal) {
                  pb.pause()
                  pb.seek(c.frame)
                }
              }}
            />
          ))
        )}
      </div>

      <div className="panel-foot muted">
        미해결 <b style={{ color: 'var(--orange)' }}>{openCount}</b> · 해결{' '}
        <b style={{ color: 'var(--green)' }}>
          {allComments.length - openCount}
        </b>
      </div>
    </aside>
  )
}
