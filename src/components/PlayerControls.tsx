import { useRef } from 'react'
import type { Comment } from '../types'
import type { Playback } from '../hooks/usePlayback'
import { fmtTimecode } from '../lib/labels'
import {
  IconPlay,
  IconPause,
  IconStepF,
  IconStepB,
  IconLoop,
  IconChat,
} from './Icon'

const SPEEDS = [0.25, 0.5, 1, 2]

export function PlayerControls({
  pb,
  pins,
  selectedId,
  onSelectPin,
  onCommentHere,
  placing,
  canComment,
  endMarker,
}: {
  pb: Playback
  pins: Comment[]
  selectedId: string | null
  onSelectPin: (id: string) => void
  onCommentHere: () => void
  placing: boolean
  canComment: boolean
  endMarker?: { pct: number; label: string; color: string } | null
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const scrubbing = useRef(false)
  const total = pb.totalFrames || 1

  const seekAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    pb.seek(ratio * pb.totalFrames)
  }

  return (
    <div className="player-controls">
      <div className="transport">
        <button className="icon-btn" onClick={() => pb.step(-1)} title="이전 프레임 (←)">
          <IconStepB />
        </button>
        <button
          className="icon-btn play"
          onClick={pb.toggle}
          title="재생/일시정지 (space)"
        >
          {pb.playing ? <IconPause size={20} /> : <IconPlay size={20} />}
        </button>
        <button className="icon-btn" onClick={() => pb.step(1)} title="다음 프레임 (→)">
          <IconStepF />
        </button>
        <button
          className={`icon-btn ${pb.loop ? 'active' : ''}`}
          onClick={() => pb.setLoop(!pb.loop)}
          title="반복"
        >
          <IconLoop />
        </button>

        <div className="timecode mono">
          {fmtTimecode(pb.frame, pb.fps)}
          <span className="muted">
            {' '}
            / {fmtTimecode(pb.totalFrames, pb.fps)}
          </span>
        </div>
      </div>

      <div
        className="timeline"
        ref={trackRef}
        onPointerDown={(e) => {
          scrubbing.current = true
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          pb.pause()
          seekAt(e.clientX)
        }}
        onPointerMove={(e) => scrubbing.current && seekAt(e.clientX)}
        onPointerUp={() => (scrubbing.current = false)}
      >
        <div className="timeline-track" />
        {/* compare: faint "tail" band where the shorter clip has already ended */}
        {endMarker && (
          <>
            <div
              className="timeline-tail"
              style={{ left: `${endMarker.pct}%`, right: 0 }}
            />
            <div
              className="timeline-endtick"
              style={{ left: `${endMarker.pct}%`, ['--ec' as string]: endMarker.color }}
              title={`${endMarker.label} (${endMarker.pct.toFixed(0)}%)`}
            >
              <span className="endtick-label">{endMarker.label}</span>
            </div>
          </>
        )}
        <div
          className="timeline-fill"
          style={{ width: `${(pb.frame / total) * 100}%` }}
        />
        {pins.map((p) => (
          <button
            key={p.id}
            className={`tl-marker ${p.id === selectedId ? 'active' : ''} ${
              p.status === 'resolved' || p.status === 'wont_fix' ? 'done' : ''
            }`}
            style={{
              left: `${(p.frame / total) * 100}%`,
              ['--pin' as string]: p.authorColor,
            }}
            title={`#${p.number} · ${p.author}: ${p.body}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onSelectPin(p.id)
              pb.pause()
              pb.seek(p.frame)
            }}
          />
        ))}
        <div
          className="timeline-head"
          style={{ left: `${(pb.frame / total) * 100}%` }}
        />
      </div>

      <div className="transport-right">
        {canComment && !pb.playing && (
          <button
            className={`btn sm comment-here ${placing ? 'primary' : ''}`}
            onClick={onCommentHere}
            title="현재 프레임에 코멘트 달기"
          >
            <IconChat size={14} /> 이 프레임에 코멘트
          </button>
        )}
        <span className="frame-readout mono">
          f<b>{Math.round(pb.frame)}</b>
          <span className="muted">/{pb.totalFrames}</span>
        </span>
        <select
          className="speed-select"
          value={pb.speed}
          onChange={(e) => pb.setSpeed(Number(e.target.value))}
          title="재생 속도"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
        <span className="fps-readout mono muted">{pb.fps}fps</span>
      </div>
    </div>
  )
}
