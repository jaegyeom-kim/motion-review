import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Version } from '../types'
import type { Playback } from '../hooks/usePlayback'
import { LottieCanvas } from './LottieCanvas'
import { useFitBox } from '../hooks/useFitBox'
import { IconClose } from './Icon'
import { useStore } from '../store/useStore'

type Mode = 'side' | 'overlay'

const aspectOf = (v: Version) =>
  v.meta.width && v.meta.height ? v.meta.width / v.meta.height : 1

export function CompareView({
  base,
  baseData,
  other,
  otherData,
  pb,
}: {
  base: Version
  baseData: unknown
  other: Version
  otherData: unknown
  pb: Playback
}) {
  const [mode, setMode] = useState<Mode>('side')
  const [opacity, setOpacity] = useState(0.5)
  const setCompare = useStore((s) => s.setCompare)
  const branches = useStore(useShallow((s) => s.branches))
  // All versions except the current/base one — selectable compare targets.
  const targets = useStore(
    useShallow((s) =>
      s.versions
        .filter((v) => v.id !== base.id)
        .sort((a, b) => b.globalNumber - a.globalNumber),
    ),
  )
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? ''

  // Sync by TIME. The shared playhead runs on the LONGER clip's clock (set in
  // Workspace), so convert pb.frame → seconds → each clip's own frame. Both stay
  // at the same wall-clock moment; the shorter clip clamps (freezes) at its end
  // while the longer one finishes, and they loop together. fps differences fall
  // out for free since each frame is derived from time.
  const longerIsOther = other.meta.durationSec > base.meta.durationSec
  const clockFps =
    (longerIsOther ? other.meta.frameRate : base.meta.frameRate) || 30
  const time = pb.frame / clockFps
  // Each clip plays at its true speed. When the shorter one ends it FREEZES on
  // its last visible frame (clamp just inside the out-point so layers stay
  // active — never blank) and shows a "종료" badge; the longer keeps playing,
  // and both reset together when the clock (longer clip) loops.
  const rawBase = time * base.meta.frameRate
  const rawOther = time * other.meta.frameRate
  const lastVisible = (total: number) => Math.max(0, total - 0.001)
  const baseFrame = Math.min(rawBase, lastVisible(base.meta.totalFrames))
  const otherFrame = Math.min(rawOther, lastVisible(other.meta.totalFrames))
  const baseEnded = rawBase >= base.meta.totalFrames
  const otherEnded = rawOther >= other.meta.totalFrames

  const fpsDiff = base.meta.frameRate !== other.meta.frameRate
  const lenDiff = base.meta.durationSec.toFixed(2) !== other.meta.durationSec.toFixed(2)
  const mismatch = fpsDiff || lenDiff

  return (
    <div className="stage compare">
      <div className="compare-bar">
        <label className="compare-pick">
          <span className="muted">비교 대상</span>
          <select
            className="filter-select"
            value={other.id}
            onChange={(e) => setCompare(e.target.value)}
          >
            {targets.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.globalNumber} · [{branchName(v.branchId)}] {v.message}
              </option>
            ))}
          </select>
        </label>
        <div className="seg">
          <button className={mode === 'side' ? 'on' : ''} onClick={() => setMode('side')}>
            나란히
          </button>
          <button
            className={mode === 'overlay' ? 'on' : ''}
            onClick={() => setMode('overlay')}
          >
            겹치기
          </button>
        </div>
        {mode === 'overlay' && (
          <label className="opacity-slider">
            <span className="mono muted">v{base.globalNumber}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
            <span className="mono muted">v{other.globalNumber}</span>
          </label>
        )}
        <span className="spacer" />
        {mismatch ? (
          <span
            className="compare-warn"
            title={`두 버전의 ${[fpsDiff && 'FPS', lenDiff && '길이'].filter(Boolean).join('·')}이(가) 다릅니다.\n긴 쪽 길이 기준으로 시간(초) 동기 재생합니다.\n· FPS: v${base.globalNumber} ${base.meta.frameRate} / v${other.globalNumber} ${other.meta.frameRate}\n· 길이: ${base.meta.durationSec.toFixed(2)}s / ${other.meta.durationSec.toFixed(2)}s\n짧은 쪽은 끝나면 마지막 프레임에서 '종료' 표시와 함께 정지하고, 긴 쪽이 끝나면 함께 루프합니다.`}
          >
            ⚠ {fpsDiff && lenDiff ? 'FPS·길이' : fpsDiff ? 'FPS' : '길이'} 다름
          </span>
        ) : (
          <span className="compare-synced muted">동기 · 같은 시간</span>
        )}
        <button className="btn sm" onClick={() => setCompare(null)} title="비교 종료">
          <IconClose size={14} /> 비교 종료
        </button>
      </div>

      {mode === 'side' ? (
        <div className="compare-grid">
          <CompareCell
            label={`v${base.globalNumber}`}
            sub="현재"
            accent="var(--accent)"
            ended={baseEnded}
            durationSec={base.meta.durationSec}
            onReplay={() => pb.seek(0)}
          >
            <FitCanvas aspect={aspectOf(base)} data={baseData} frame={baseFrame} />
          </CompareCell>
          <CompareCell
            label={`v${other.globalNumber}`}
            sub="비교 대상"
            accent="var(--teal)"
            ended={otherEnded}
            durationSec={other.meta.durationSec}
            onReplay={() => pb.seek(0)}
          >
            <FitCanvas aspect={aspectOf(other)} data={otherData} frame={otherFrame} />
          </CompareCell>
        </div>
      ) : (
        <div className="compare-overlay">
          <OverlayCanvas
            aspect={aspectOf(base)}
            baseData={baseData}
            otherData={otherData}
            baseFrame={baseFrame}
            otherFrame={otherFrame}
            opacity={opacity}
            baseEnded={baseEnded}
            otherEnded={otherEnded}
            endedLabels={[
              baseEnded && { text: `v${base.globalNumber} 종료`, color: 'var(--accent)' },
              otherEnded && { text: `v${other.globalNumber} 종료`, color: 'var(--teal)' },
            ].filter(Boolean) as { text: string; color: string }[]}
            onReplay={() => pb.seek(0)}
          />
        </div>
      )}
    </div>
  )
}

function FitCanvas({
  aspect,
  data,
  frame,
}: {
  aspect: number
  data: unknown
  frame: number
}) {
  const fit = useFitBox(aspect)
  return (
    <div className="stage-fit" ref={fit.ref}>
      <div className="stage-box" style={{ width: fit.w || undefined, height: fit.h || undefined }}>
        <div className="stage-checker" />
        {!!data && <LottieCanvas data={data} frame={frame} />}
      </div>
    </div>
  )
}

function OverlayCanvas({
  aspect,
  baseData,
  otherData,
  baseFrame,
  otherFrame,
  opacity,
  baseEnded,
  otherEnded,
  endedLabels,
  onReplay,
}: {
  aspect: number
  baseData: unknown
  otherData: unknown
  baseFrame: number
  otherFrame: number
  opacity: number
  baseEnded: boolean
  otherEnded: boolean
  endedLabels: { text: string; color: string }[]
  onReplay: () => void
}) {
  const fit = useFitBox(aspect)
  return (
    <div className="stage-fit" ref={fit.ref}>
      <div className="stage-box" style={{ width: fit.w || undefined, height: fit.h || undefined }}>
        <div className="stage-checker" />
        {/* ended layer is ghosted so a held frame is attributable to its version */}
        {!!baseData && (
          <div className={baseEnded ? 'overlay-held' : undefined}>
            <LottieCanvas data={baseData} frame={baseFrame} opacity={1 - opacity} />
          </div>
        )}
        {!!otherData && (
          <div className={`overlay-top ${otherEnded ? 'overlay-held' : ''}`}>
            <LottieCanvas data={otherData} frame={otherFrame} opacity={opacity} />
          </div>
        )}
        {endedLabels.length > 0 && (
          <div className="overlay-ended">
            {endedLabels.map((l) => (
              <span
                key={l.text}
                className="ended-pill"
                style={{ ['--ec' as string]: l.color }}
              >
                <span className="ended-pill-dot" />
                {l.text} · 마지막 프레임
              </span>
            ))}
            <button className="replay-btn sm" onClick={onReplay}>
              ↺ 다시 재생
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CompareCell({
  label,
  sub,
  accent,
  ended,
  durationSec,
  onReplay,
  children,
}: {
  label: string
  sub: string
  accent: string
  ended?: boolean
  durationSec?: number
  onReplay?: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`compare-cell ${ended ? 'ended' : ''}`}>
      <div className="compare-cell-head">
        <span className="chip" style={{ background: `${accent}1f`, color: accent }}>
          {label}
        </span>
        <span className="muted">{sub}</span>
      </div>
      <div className="compare-cell-body">
        {children}
        {ended && (
          <div className="ended-overlay">
            <div className="ended-pill" style={{ ['--ec' as string]: accent }}>
              <span className="ended-pill-dot" />
              {label} 종료 · {durationSec?.toFixed(2)}s · 마지막 프레임
            </div>
            {onReplay && (
              <button className="replay-btn" onClick={onReplay}>
                ↺ 처음부터 다시 재생
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
