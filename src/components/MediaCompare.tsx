import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { MediaKind, Version } from '../types'
import type { Playback } from '../hooks/usePlayback'
import { useFitBox } from '../hooks/useFitBox'
import { VideoCanvas } from './VideoCanvas'
import { useStore } from '../store/useStore'
import { IconClose } from './Icon'

const aspectOf = (v: Version) =>
  v.meta.width && v.meta.height ? v.meta.width / v.meta.height : 16 / 9

type ImgMode = 'wipe' | 'side'
type VidMode = 'side' | 'overlay'

/** Compare two versions of an IMAGE (wipe / side) or VIDEO (side / overlay)
 *  asset. Videos share the playhead clock (both seek to pb time) so they stay
 *  in sync; the shorter clip clamps to its last frame automatically. */
export function MediaCompare({
  kind,
  base,
  baseFile,
  other,
  otherFile,
  pb,
}: {
  kind: MediaKind
  base: Version
  baseFile: Blob
  other: Version
  otherFile: Blob
  pb: Playback
}) {
  const setCompare = useStore((s) => s.setCompare)
  const branches = useStore(useShallow((s) => s.branches))
  const targets = useStore(
    useShallow((s) =>
      s.versions
        .filter((v) => v.assetId === base.assetId && v.id !== base.id)
        .sort((a, b) => b.globalNumber - a.globalNumber),
    ),
  )
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? ''

  const [imgMode, setImgMode] = useState<ImgMode>('wipe')
  const [vidMode, setVidMode] = useState<VidMode>('side')
  const [opacity, setOpacity] = useState(0.5)

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
        {kind === 'image' ? (
          <div className="seg">
            <button className={imgMode === 'wipe' ? 'on' : ''} onClick={() => setImgMode('wipe')}>
              와이프
            </button>
            <button className={imgMode === 'side' ? 'on' : ''} onClick={() => setImgMode('side')}>
              나란히
            </button>
          </div>
        ) : (
          <div className="seg">
            <button className={vidMode === 'side' ? 'on' : ''} onClick={() => setVidMode('side')}>
              나란히
            </button>
            <button className={vidMode === 'overlay' ? 'on' : ''} onClick={() => setVidMode('overlay')}>
              겹치기
            </button>
          </div>
        )}
        {kind === 'video' && vidMode === 'overlay' && (
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
        <span className="compare-synced muted">
          v{base.globalNumber} ↔ v{other.globalNumber}
        </span>
        <button className="btn sm" onClick={() => setCompare(null)} title="비교 종료">
          <IconClose size={14} /> 비교 종료
        </button>
      </div>

      {kind === 'image' ? (
        imgMode === 'wipe' ? (
          <WipeCompare
            aspect={aspectOf(base)}
            baseFile={baseFile}
            otherFile={otherFile}
            baseLabel={`v${base.globalNumber}`}
            otherLabel={`v${other.globalNumber}`}
          />
        ) : (
          <div className="compare-grid">
            <SideCell label={`v${base.globalNumber}`} sub="현재" accent="var(--accent)">
              <FitImage aspect={aspectOf(base)} file={baseFile} />
            </SideCell>
            <SideCell label={`v${other.globalNumber}`} sub="비교 대상" accent="var(--teal)">
              <FitImage aspect={aspectOf(other)} file={otherFile} />
            </SideCell>
          </div>
        )
      ) : vidMode === 'side' ? (
        <div className="compare-grid">
          <SideCell label={`v${base.globalNumber}`} sub="현재" accent="var(--accent)">
            <FitVideo aspect={aspectOf(base)} file={baseFile} frame={pb.frame} fps={pb.fps} playing={pb.playing} speed={pb.speed} />
          </SideCell>
          <SideCell label={`v${other.globalNumber}`} sub="비교 대상" accent="var(--teal)">
            <FitVideo aspect={aspectOf(other)} file={otherFile} frame={pb.frame} fps={pb.fps} playing={pb.playing} speed={pb.speed} />
          </SideCell>
        </div>
      ) : (
        <div className="compare-overlay">
          <OverlayVideo
            aspect={aspectOf(base)}
            baseFile={baseFile}
            otherFile={otherFile}
            frame={pb.frame}
            fps={pb.fps}
            playing={pb.playing}
            speed={pb.speed}
            opacity={opacity}
          />
        </div>
      )}
    </div>
  )
}

function FitImage({ aspect, file }: { aspect: number; file: Blob }) {
  const fit = useFitBox(aspect)
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return (
    <div className="stage-fit" ref={fit.ref}>
      <div className="stage-box" style={{ width: fit.w || undefined, height: fit.h || undefined }}>
        <div className="stage-checker" />
        {url && <img className="media-image" src={url} alt="" draggable={false} />}
      </div>
    </div>
  )
}

function FitVideo({
  aspect,
  file,
  frame,
  fps,
  playing,
  speed,
}: {
  aspect: number
  file: Blob
  frame: number
  fps: number
  playing: boolean
  speed: number
}) {
  const fit = useFitBox(aspect)
  return (
    <div className="stage-fit" ref={fit.ref}>
      <div className="stage-box" style={{ width: fit.w || undefined, height: fit.h || undefined }}>
        <div className="stage-checker" />
        <VideoCanvas file={file} frame={frame} fps={fps} playing={playing} speed={speed} />
      </div>
    </div>
  )
}

function OverlayVideo({
  aspect,
  baseFile,
  otherFile,
  frame,
  fps,
  playing,
  speed,
  opacity,
}: {
  aspect: number
  baseFile: Blob
  otherFile: Blob
  frame: number
  fps: number
  playing: boolean
  speed: number
  opacity: number
}) {
  const fit = useFitBox(aspect)
  return (
    <div className="stage-fit" ref={fit.ref}>
      <div className="stage-box" style={{ width: fit.w || undefined, height: fit.h || undefined }}>
        <div className="stage-checker" />
        <VideoCanvas file={baseFile} frame={frame} fps={fps} playing={playing} speed={speed} opacity={1 - opacity} />
        <div className="overlay-top">
          <VideoCanvas file={otherFile} frame={frame} fps={fps} playing={playing} speed={speed} opacity={opacity} />
        </div>
      </div>
    </div>
  )
}

function WipeCompare({
  aspect,
  baseFile,
  otherFile,
  baseLabel,
  otherLabel,
}: {
  aspect: number
  baseFile: Blob
  otherFile: Blob
  baseLabel: string
  otherLabel: string
}) {
  const fit = useFitBox(aspect)
  const boxRef = useRef<HTMLDivElement>(null)
  const [wipe, setWipe] = useState(50)
  const [baseUrl, setBaseUrl] = useState('')
  const [otherUrl, setOtherUrl] = useState('')
  const dragging = useRef(false)

  useEffect(() => {
    const u = URL.createObjectURL(baseFile)
    setBaseUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [baseFile])
  useEffect(() => {
    const u = URL.createObjectURL(otherFile)
    setOtherUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [otherFile])

  const moveTo = (clientX: number) => {
    const r = boxRef.current!.getBoundingClientRect()
    setWipe(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }

  return (
    <div className="stage-fit" ref={fit.ref}>
      <div
        className="stage-box wipe-box"
        ref={boxRef}
        style={{ width: fit.w || undefined, height: fit.h || undefined }}
        onPointerDown={(e) => {
          dragging.current = true
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          moveTo(e.clientX)
        }}
        onPointerMove={(e) => dragging.current && moveTo(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
      >
        <div className="stage-checker" />
        {baseUrl && <img className="media-image wipe-base" src={baseUrl} alt="" draggable={false} />}
        {otherUrl && (
          <img
            className="media-image wipe-other"
            src={otherUrl}
            alt=""
            draggable={false}
            style={{ clipPath: `inset(0 0 0 ${wipe}%)` }}
          />
        )}
        <div className="wipe-divider" style={{ left: `${wipe}%` }}>
          <span className="wipe-handle" />
        </div>
        <span className="wipe-tag left" style={{ ['--ec' as string]: 'var(--accent)' }}>{baseLabel}</span>
        <span className="wipe-tag right" style={{ ['--ec' as string]: 'var(--teal)' }}>{otherLabel}</span>
      </div>
    </div>
  )
}

function SideCell({
  label,
  sub,
  accent,
  children,
}: {
  label: string
  sub: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div className="compare-cell">
      <div className="compare-cell-head">
        <span className="chip" style={{ background: `${accent}1f`, color: accent }}>
          {label}
        </span>
        <span className="muted">{sub}</span>
      </div>
      <div className="compare-cell-body">{children}</div>
    </div>
  )
}
