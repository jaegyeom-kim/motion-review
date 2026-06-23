import { useEffect, useRef, useState } from 'react'
import { DotLottie } from '@lottiefiles/dotlottie-web'
import type { MediaKind } from '../types'
import { KIND_LABEL } from '../lib/media'
import { fmtDuration } from '../lib/labels'
import { loadAssetPreview, isScrubbable, type AssetPreview } from '../lib/preview'
import { IconLottie, IconImage, IconVideo, IconPdf, IconAudio } from './Icon'

export function KindGlyph({ kind, size = 18 }: { kind: MediaKind; size?: number }) {
  switch (kind) {
    case 'lottie':
      return <IconLottie size={size} />
    case 'image':
      return <IconImage size={size} />
    case 'video':
      return <IconVideo size={size} />
    case 'pdf':
      return <IconPdf size={size} />
    case 'audio':
      return <IconAudio size={size} />
  }
}

/** Kind-aware thumbnail. For video/lottie with `scrub`, hovering scrubs the clip
 *  by mouse X (Frame.io-style) with a red playhead line + duration badge. */
export function AssetThumb({
  thumbnail,
  kind,
  name,
  assetId,
  scrub = false,
}: {
  thumbnail?: string
  kind: MediaKind
  name: string
  assetId?: string
  scrub?: boolean
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [thumbnail])

  const canScrub = scrub && !!assetId && isScrubbable(kind)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState<number | null>(null)
  const [preview, setPreview] = useState<AssetPreview | null>(null)

  const onEnter = () => {
    if (canScrub && !preview) loadAssetPreview(assetId!).then(setPreview)
  }
  const onMove = (e: React.MouseEvent) => {
    if (!canScrub) return
    const r = wrapRef.current!.getBoundingClientRect()
    setRatio(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)))
  }
  const onLeave = () => setRatio(null)

  const showImg = !!thumbnail && !failed
  const scrubbing = canScrub && ratio != null && preview
  const dur = preview?.meta.durationSec

  return (
    <div
      className={`asset-thumb-inner kind-${kind}`}
      ref={wrapRef}
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {showImg ? (
        <img src={thumbnail} alt={name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="asset-thumb-glyph">
          <KindGlyph kind={kind} size={40} />
        </div>
      )}

      {scrubbing && (
        <>
          {preview.kind === 'video' && preview.file ? (
            <VideoScrub file={preview.file} durationSec={dur || 0} ratio={ratio!} />
          ) : preview.kind === 'lottie' && preview.data ? (
            <LottieScrub data={preview.data} ratio={ratio!} />
          ) : null}
          <div className="scrub-line" style={{ left: `${ratio! * 100}%` }} />
        </>
      )}

      {canScrub && preview && dur ? (
        <span className="dur-badge">{fmtDuration(dur)}</span>
      ) : null}

      <span className="kind-chip">
        <KindGlyph kind={kind} size={12} /> {KIND_LABEL[kind]}
      </span>
    </div>
  )
}

function VideoScrub({
  file,
  durationSec,
  ratio,
}: {
  file: Blob
  durationSec: number
  ratio: number
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  useEffect(() => {
    const v = ref.current
    if (v && durationSec) {
      try {
        v.currentTime = ratio * durationSec
      } catch {
        /* not seekable yet */
      }
    }
  }, [ratio, durationSec])
  return <video ref={ref} className="scrub-media" src={url} muted playsInline preload="auto" />
}

function LottieScrub({ data, ratio }: { data: unknown; ratio: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const dlRef = useRef<DotLottie | null>(null)
  const totalRef = useRef(0)
  const loadedRef = useRef(false)
  const ratioRef = useRef(ratio)
  ratioRef.current = ratio

  useEffect(() => {
    if (!ref.current) return
    const dl = new DotLottie({
      canvas: ref.current,
      data: data as Record<string, unknown>,
      autoplay: false,
      loop: false,
      backgroundColor: 'transparent',
      renderConfig: { autoResize: true, devicePixelRatio: window.devicePixelRatio || 1 },
    })
    dlRef.current = dl
    dl.addEventListener('load', () => {
      loadedRef.current = true
      totalRef.current = dl.totalFrames
      dl.setFrame(ratioRef.current * Math.max(0, totalRef.current - 0.001))
    })
    return () => {
      try {
        dl.destroy()
      } catch {
        /* noop */
      }
      dlRef.current = null
    }
  }, [data])

  useEffect(() => {
    const dl = dlRef.current
    if (dl && loadedRef.current) dl.setFrame(ratio * Math.max(0, totalRef.current - 0.001))
  }, [ratio])

  return <canvas ref={ref} className="scrub-media" />
}
