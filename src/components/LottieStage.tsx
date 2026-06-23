import { useRef, useState } from 'react'
import type { Comment, LottieMeta } from '../types'
import { LottieCanvas } from './LottieCanvas'
import { PinTooltip } from './PinTooltip'
import { useFitBox } from '../hooks/useFitBox'
import type { DraftPin } from '../store/useStore'

export function LottieStage({
  data,
  frame,
  meta,
  pins,
  selectedId,
  currentFrame,
  placing,
  draft,
  onSelect,
  onPlaceDraft,
  onQuickComment,
  onMovePin,
  onSeekToFrame,
  onCancelPlacing,
}: {
  data: unknown
  frame: number
  meta: LottieMeta
  pins: Comment[]
  selectedId: string | null
  currentFrame: number
  placing: boolean
  draft: DraftPin | null
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
  // Only count as a drag once the pointer moves past a small threshold, so a
  // plain click (or a slightly imprecise tap) still selects the pin.
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const [hover, setHover] = useState<{ comment: Comment; left: number; top: number } | null>(null)
  const aspect = meta.width && meta.height ? meta.width / meta.height : 1
  const fit = useFitBox(aspect)

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
    // Swallow the click that trails a pin drag, so it never drops a draft pin.
    if (didDrag.current) {
      didDrag.current = false
      return
    }
    if (!placing) return
    const { x, y } = toNorm(e.clientX, e.clientY)
    onPlaceDraft(x, y)
  }

  // Double-click anywhere = comment here, no mode toggle needed.
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
    // Pointer capture redirects the trailing `click` to the box, so a pin's
    // own onClick is unreliable. Treat a no-drag pointerup as a click here:
    // select the pin's comment and jump to its frame.
    if (!wasDrag) {
      onSelect(id)
      const p = pins.find((x) => x.id === id)
      if (p) onSeekToFrame(p.frame)
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
        {!!data && <LottieCanvas data={data} frame={frame} />}

        {/* existing pins — fill = author bubble color; resolved/wont-fix dim */}
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
                // Capture on the box so move/up fire even outside the pin.
                try {
                  boxRef.current?.setPointerCapture(e.pointerId)
                } catch {
                  /* noop */
                }
              }}
              onClick={(e) => {
                // Selection/seek happens on pointerup (endDrag); just stop the
                // click from bubbling to the stage (draft placement).
                e.stopPropagation()
              }}
            >
              <span className="pin-num">{p.number}</span>
            </button>
          )
        })}

        {/* draft (being placed) */}
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
          fps={meta.frameRate}
          temporal
          left={hover.left}
          top={hover.top}
        />
      )}

      {placing ? (
        <div className="stage-hint placing-hint">
          <span>
            캔버스에서 위치를 클릭하세요 · 현재 프레임 {Math.round(currentFrame)}
          </span>
          <button className="hint-cancel" onClick={onCancelPlacing}>
            취소
          </button>
        </div>
      ) : (
        <div className="stage-hint subtle">더블클릭으로 이 프레임에 코멘트</div>
      )}
    </div>
  )
}
