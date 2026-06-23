import { useRef, useState, type ReactNode } from 'react'
import type { Comment } from '../types'
import { PinTooltip } from './PinTooltip'
import { useFitBox } from '../hooks/useFitBox'
import type { DraftPin } from '../store/useStore'

/** Generic spatial-pin stage for non-Lottie visual media (image, video). It
 *  mirrors LottieStage's pin placement/drag/overlay but renders an arbitrary
 *  `media` node (an <img> or VideoCanvas). LottieStage stays untouched.
 *  `temporal=false` (image) drops all frame logic: pins always render solid and
 *  selecting one never seeks. */
export function MediaPinStage({
  media,
  aspect,
  temporal,
  fps,
  pins,
  selectedId,
  placing,
  draft,
  hint,
  onSelect,
  onPlaceDraft,
  onQuickComment,
  onMovePin,
  onSeekToFrame,
  onCancelPlacing,
}: {
  media: ReactNode
  aspect: number
  temporal: boolean
  fps: number
  pins: Comment[]
  selectedId: string | null
  currentFrame: number
  placing: boolean
  draft: DraftPin | null
  hint: string
  onSelect: (id: string) => void
  onPlaceDraft: (x: number, y: number) => void
  onQuickComment: (x: number, y: number) => void
  onMovePin: (id: string, x: number, y: number) => void
  onSeekToFrame: (f: number) => void
  onCancelPlacing: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const didDrag = useRef(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const [hover, setHover] = useState<{ comment: Comment; left: number; top: number } | null>(null)
  const fit = useFitBox(aspect || 1)

  const showTip = (comment: Comment, el: HTMLElement) => {
    const s = stageRef.current?.getBoundingClientRect()
    if (!s) return
    const r = el.getBoundingClientRect()
    setHover({ comment, left: r.left + r.width / 2 - s.left, top: r.top - s.top })
  }

  const toNorm = (clientX: number, clientY: number) => {
    const r = boxRef.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    }
  }

  const onStageClick = (e: React.MouseEvent) => {
    if (didDrag.current) {
      didDrag.current = false
      return
    }
    if (!placing) return
    const { x, y } = toNorm(e.clientX, e.clientY)
    onPlaceDraft(x, y)
  }

  const onStageDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = toNorm(e.clientX, e.clientY)
    onQuickComment(x, y)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragId) return
    if (!didDrag.current && dragStart.current) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      if (dx * dx + dy * dy < 16) return // < 4px: still a click, not a drag
      didDrag.current = true
    }
    const { x, y } = toNorm(e.clientX, e.clientY)
    onMovePin(dragId, x, y)
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragId) return
    try {
      boxRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
    const id = dragId
    const wasDrag = didDrag.current
    setDragId(null)
    // Pointer capture steals the trailing click, so treat a no-drag pointerup
    // as the click: select the pin's comment (and jump to its frame if temporal).
    if (!wasDrag) {
      onSelect(id)
      if (temporal) {
        const p = pins.find((x) => x.id === id)
        if (p) onSeekToFrame(p.frame)
      }
    }
  }

  return (
    <div className={`stage ${placing ? 'placing' : ''}`} ref={stageRef}>
      <div className="stage-fit" ref={fit.ref}>
        <div
          className="stage-box"
          ref={boxRef}
          style={{ width: fit.w || undefined, height: fit.h || undefined }}
          onClick={onStageClick}
          onDoubleClick={onStageDoubleClick}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
        >
          <div className="stage-checker" />
          {media}

          {pins.map((p) => {
            const done = p.status === 'resolved' || p.status === 'wont_fix'
            const active = p.id === selectedId
            return (
              <button
                key={p.id}
                className={`pin ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  ['--pin' as string]: p.authorColor,
                }}
                onMouseEnter={(e) => showTip(p, e.currentTarget)}
                onMouseLeave={() => setHover(null)}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setHover(null)
                  didDrag.current = false
                  dragStart.current = { x: e.clientX, y: e.clientY }
                  setDragId(p.id)
                  try {
                    boxRef.current?.setPointerCapture(e.pointerId)
                  } catch {
                    /* noop */
                  }
                }}
                onClick={(e) => {
                  // Selection/seek happens on pointerup (endDrag).
                  e.stopPropagation()
                }}
              >
                <span className="pin-num">{p.number}</span>
              </button>
            )
          })}

          {draft && (
            <div
              className="pin draft"
              style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}
            >
              <span className="pin-num">+</span>
            </div>
          )}
        </div>
      </div>

      {hover && (
        <PinTooltip
          comment={hover.comment}
          fps={fps}
          temporal={temporal}
          left={hover.left}
          top={hover.top}
        />
      )}

      {placing ? (
        <div className="stage-hint placing-hint">
          <span>{hint}</span>
          <button className="hint-cancel" onClick={onCancelPlacing}>
            취소
          </button>
        </div>
      ) : (
        <div className="stage-hint subtle">더블클릭으로 이 위치에 코멘트</div>
      )}
    </div>
  )
}
