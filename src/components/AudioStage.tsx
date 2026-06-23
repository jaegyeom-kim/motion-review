import { useEffect, useRef, useState } from 'react'
import type { Comment } from '../types'
import type { Playback } from '../hooks/usePlayback'
import { decodeWaveform } from '../lib/media'
import { IconAudio } from './Icon'

/** Audio review surface: a waveform that doubles as the scrubber. The playhead
 *  is driven by the shared rAF clock (pb.frame); comments anchor to time
 *  (stored as frame = time*fps like every temporal kind). */
export function AudioStage({
  file,
  pb,
  pins,
  selectedId,
  placing,
  onPlaceDraft,
  onSelect,
}: {
  file: Blob
  pb: Playback
  pins: Comment[]
  selectedId: string | null
  placing: boolean
  onPlaceDraft: (frame: number) => void
  onSelect: (id: string) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [width, setWidth] = useState(0)
  const total = pb.totalFrames || 1

  useEffect(() => {
    let alive = true
    setPeaks(null)
    decodeWaveform(file).then((p) => alive && setPeaks(p))
    return () => {
      alive = false
    }
  }, [file])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    setWidth(el.clientWidth)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Draw waveform + playhead.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !width) return
    const h = 160
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, h)
    const mid = h / 2
    const playedX = (pb.frame / total) * width

    if (peaks && peaks.length) {
      const step = width / peaks.length
      for (let i = 0; i < peaks.length; i++) {
        const x = i * step
        const amp = Math.max(2, peaks[i] * (h * 0.45))
        ctx.fillStyle = x <= playedX ? '#7c6cff' : '#3a3f52'
        ctx.fillRect(x, mid - amp, Math.max(1, step * 0.7), amp * 2)
      }
    } else {
      ctx.fillStyle = '#2a2e3e'
      ctx.fillRect(0, mid - 1, width, 2)
    }
    // playhead
    ctx.fillStyle = '#fff'
    ctx.fillRect(playedX - 1, 0, 2, h)
  }, [peaks, width, pb.frame, total])

  const seekAt = (clientX: number) => {
    const r = wrapRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    return ratio * pb.totalFrames
  }

  return (
    <div className="stage audio-stage">
      <div className="audio-head">
        <IconAudio size={22} />
        <span className="muted">오디오 파형 · 클릭해 탐색{placing ? ' · 클릭해 코멘트 지점 지정' : ''}</span>
      </div>
      <div
        className="waveform-wrap"
        ref={wrapRef}
        onClick={(e) => {
          const f = seekAt(e.clientX)
          if (placing) onPlaceDraft(Math.round(f))
          else pb.seek(f)
        }}
      >
        <canvas ref={canvasRef} className="waveform-canvas" style={{ height: 160 }} />
        {pins.map((p) => (
          <button
            key={p.id}
            className={`wave-pin ${p.id === selectedId ? 'active' : ''}`}
            style={{ left: `${(p.frame / total) * 100}%`, ['--pin' as string]: p.authorColor }}
            title={`#${p.number} ${p.author}: ${p.body}`}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(p.id)
              pb.pause()
              pb.seek(p.frame)
            }}
          >
            {p.number}
          </button>
        ))}
        {!peaks && <div className="wave-loading muted">파형 분석 중…</div>}
      </div>
      <div className="stage-hint subtle">
        ‘이 시점에 코멘트’ 또는 ‘핀 추가’ 후 파형 클릭으로 코멘트를 남기세요
      </div>
    </div>
  )
}
