import { parseLottieFile, renderThumbnail } from './lottie'
import { MEDIA_KINDS, type LottieMeta, type MediaKind } from '../types'

/** Extension → kind map. `.json` is treated as Lottie (validated on parse). */
const EXT: Record<MediaKind, string[]> = {
  lottie: ['json', 'lottie', 'dotlottie'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'bmp'],
  video: ['mp4', 'webm', 'mov', 'm4v', 'ogv'],
  pdf: ['pdf'],
  audio: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac'],
}

/** Accept attribute for file inputs across every supported kind. */
export const ACCEPT_ALL =
  '.json,.lottie,.dotlottie,.png,.jpg,.jpeg,.webp,.gif,.svg,.avif,.bmp,' +
  '.mp4,.webm,.mov,.m4v,.ogv,.pdf,.mp3,.m4a,.aac,.wav,.ogg,.oga,.flac,' +
  'image/*,video/*,audio/*,application/pdf,application/json'

export const KIND_LABEL: Record<MediaKind, string> = {
  lottie: 'Lottie',
  image: '이미지',
  video: '비디오',
  pdf: 'PDF',
  audio: '오디오',
}

export class MediaParseError extends Error {}

/** Detect a file's media kind by extension, falling back to MIME type. */
export function detectKind(file: File): MediaKind | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  for (const k of MEDIA_KINDS) if (EXT[k].includes(ext)) return k
  const m = file.type
  if (m === 'application/pdf') return 'pdf'
  if (m === 'application/json') return 'lottie'
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  return null
}

export interface ParsedMedia {
  kind: MediaKind
  meta: LottieMeta
  /** PNG/JPEG data-URL thumbnail (''=use a kind glyph instead). */
  thumbnail: string
  /** parsed bodymovin JSON — lottie only; other kinds store the raw File. */
  data?: unknown
}

/** Universal upload parser: detect kind, extract per-version meta, and produce
 *  a thumbnail in one pass. Throws MediaParseError on unsupported/invalid. */
export async function parseMedia(file: File): Promise<ParsedMedia> {
  const kind = detectKind(file)
  if (!kind) throw new MediaParseError('지원하지 않는 파일 형식입니다.')

  if (kind === 'lottie') {
    const { data, meta } = await parseLottieFile(file)
    const thumbnail = await renderThumbnail(data)
    return { kind, meta, thumbnail, data }
  }

  const base = (w = 0, h = 0, durationSec = 0): LottieMeta => {
    const frameRate = durationSec ? 30 : 0
    return {
      width: w,
      height: h,
      frameRate,
      inPoint: 0,
      outPoint: 0,
      totalFrames: durationSec ? Math.round(durationSec * frameRate) : 0,
      durationSec,
      layerCount: 0,
      layerNames: [],
      fileName: file.name,
      fileSize: file.size,
    }
  }

  if (kind === 'image') {
    const { width, height } = await imageSize(file)
    const thumbnail = await imageThumbnail(file, width, height)
    return { kind, meta: base(width, height), thumbnail }
  }
  if (kind === 'video') {
    const { width, height, duration, fps } = await videoMeta(file)
    const thumbnail = await videoThumbnail(file, duration)
    const m = base(width, height, duration)
    // base() assumes 30fps; replace with the measured rate so frame numbers and
    // the fps readout are accurate (HTML5 doesn't expose fps directly).
    m.frameRate = fps
    m.totalFrames = Math.round(duration * fps)
    m.outPoint = m.totalFrames
    return { kind, meta: m, thumbnail }
  }
  if (kind === 'audio') {
    const duration = await audioDuration(file)
    return { kind, meta: base(0, 0, duration), thumbnail: '' }
  }
  // pdf — preview-only (no pageCount without pdfjs); glyph thumbnail.
  return { kind, meta: base(0, 0, 0), thumbnail: '' }
}

// ---- per-kind probes (all revoke their object URLs) ----

function withUrl<T>(file: Blob, fn: (url: string) => Promise<T>): Promise<T> {
  const url = URL.createObjectURL(file)
  return fn(url).finally(() => URL.revokeObjectURL(url))
}

function imageSize(file: Blob): Promise<{ width: number; height: number }> {
  return withUrl(
    file,
    (url) =>
      new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () =>
          resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 })
        img.onerror = () => reject(new MediaParseError('이미지를 읽을 수 없습니다.'))
        img.src = url
      }),
  )
}

function videoMeta(
  file: Blob,
): Promise<{ width: number; height: number; duration: number; fps: number }> {
  return withUrl(
    file,
    (url) =>
      new Promise((resolve, reject) => {
        const v = document.createElement('video')
        v.preload = 'auto'
        v.muted = true
        ;(v as HTMLVideoElement).playsInline = true
        const to = setTimeout(
          () => reject(new MediaParseError('비디오 메타데이터를 읽을 수 없습니다.')),
          15000,
        )
        v.onloadedmetadata = async () => {
          const width = v.videoWidth || 0
          const height = v.videoHeight || 0
          const duration = isFinite(v.duration) ? v.duration : 0
          const fps = await measureFps(v)
          clearTimeout(to)
          resolve({ width, height, duration, fps })
        }
        v.onerror = () => {
          clearTimeout(to)
          reject(new MediaParseError('비디오 코덱을 재생할 수 없습니다.'))
        }
        v.src = url
      }),
  )
}

/** Estimate a video's frame rate from requestVideoFrameCallback presentation
 *  times (HTML5 exposes no fps). Plays muted for a short window, takes the
 *  median inter-frame mediaTime delta, snaps to a common rate. Falls back to 30
 *  if rVFC is unavailable or measurement fails. */
function measureFps(v: HTMLVideoElement): Promise<number> {
  const FALLBACK = 30
  const STANDARD = [8, 10, 12, 15, 23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60]
  const snap = (f: number) => {
    if (!isFinite(f) || f <= 0) return FALLBACK
    let best = STANDARD[0]
    for (const s of STANDARD) if (Math.abs(s - f) < Math.abs(best - f)) best = s
    // round near-integer rates so the readout is clean (29.97→30, 23.976→24)
    return Math.abs(best - Math.round(best)) < 0.05 ? Math.round(best) : best
  }
  const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
  if (!hasRVFC) return Promise.resolve(FALLBACK)
  return new Promise((resolve) => {
    const times: number[] = []
    let done = false
    const finish = () => {
      if (done) return
      done = true
      try { v.pause() } catch { /* noop */ }
      if (times.length < 3) return resolve(FALLBACK)
      const deltas = []
      for (let i = 1; i < times.length; i++) deltas.push(times[i] - times[i - 1])
      deltas.sort((a, b) => a - b)
      const med = deltas[Math.floor(deltas.length / 2)]
      resolve(med > 0 ? snap(1 / med) : FALLBACK)
    }
    const cb = (_now: number, meta: { mediaTime: number }) => {
      times.push(meta.mediaTime)
      if (times.length >= 12) return finish()
      v.requestVideoFrameCallback(cb)
    }
    v.requestVideoFrameCallback(cb)
    const p = v.play()
    if (p && typeof p.catch === 'function') p.catch(() => finish())
    setTimeout(finish, 900) // hard cap on measurement window
  })
}

function audioDuration(file: Blob): Promise<number> {
  return withUrl(
    file,
    (url) =>
      new Promise((resolve, reject) => {
        const a = document.createElement('audio')
        a.preload = 'metadata'
        const to = setTimeout(() => resolve(0), 15000)
        a.onloadedmetadata = () => {
          clearTimeout(to)
          resolve(isFinite(a.duration) ? a.duration : 0)
        }
        a.onerror = () => {
          clearTimeout(to)
          reject(new MediaParseError('오디오를 읽을 수 없습니다.'))
        }
        a.src = url
      }),
  )
}

/** Draw a source onto a contained canvas (max 320px) and return a JPEG dataURL. */
function snapshot(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  srcW: number,
  srcH: number,
): string {
  const max = 320
  const ratio = srcW && srcH ? srcW / srcH : 1
  let w = max
  let h = Math.round(max / ratio)
  if (h > max) {
    h = max
    w = Math.round(max * ratio)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  draw(ctx, w, h)
  try {
    return canvas.toDataURL('image/jpeg', 0.78)
  } catch {
    return ''
  }
}

function imageThumbnail(file: Blob, w: number, h: number): Promise<string> {
  return withUrl(
    file,
    (url) =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () =>
          resolve(snapshot((ctx, cw, ch) => ctx.drawImage(img, 0, 0, cw, ch), w, h))
        img.onerror = () => resolve('')
        img.src = url
      }),
  )
}

function videoThumbnail(file: Blob, duration: number): Promise<string> {
  return withUrl(
    file,
    (url) =>
      new Promise((resolve) => {
        const v = document.createElement('video')
        v.preload = 'auto'
        v.muted = true
        v.playsInline = true
        let done = false
        const finish = (out: string) => {
          if (done) return
          done = true
          resolve(out)
        }
        const to = setTimeout(() => finish(''), 8000)
        v.onloadeddata = () => {
          // Seek a bit in so the poster isn't a black first frame.
          try {
            v.currentTime = Math.min(Math.max(duration * 0.25, 0.1), duration || 0.1)
          } catch {
            /* ignore */
          }
        }
        v.onseeked = () => {
          requestAnimationFrame(() => {
            clearTimeout(to)
            finish(
              snapshot(
                (ctx, cw, ch) => ctx.drawImage(v, 0, 0, cw, ch),
                v.videoWidth || 16,
                v.videoHeight || 9,
              ),
            )
          })
        }
        v.onerror = () => {
          clearTimeout(to)
          finish('')
        }
        v.src = url
      }),
  )
}

/** Decode an audio file's PCM into a normalized peak array for waveform draw.
 *  Returns null on failure. Bucketed to `buckets` columns (default 600). */
export async function decodeWaveform(file: Blob, buckets = 600): Promise<number[] | null> {
  try {
    const buf = await file.arrayBuffer()
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const ctx = new Ctor()
    const audio = await ctx.decodeAudioData(buf)
    const ch = audio.getChannelData(0)
    const block = Math.max(1, Math.floor(ch.length / buckets))
    const peaks: number[] = []
    for (let i = 0; i < buckets; i++) {
      let max = 0
      const start = i * block
      for (let j = 0; j < block; j++) {
        const v = Math.abs(ch[start + j] || 0)
        if (v > max) max = v
      }
      peaks.push(max)
    }
    ctx.close()
    const top = Math.max(...peaks, 0.0001)
    return peaks.map((p) => p / top)
  } catch {
    return null
  }
}
