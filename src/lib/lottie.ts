import { unzipSync, strFromU8 } from 'fflate'
import lottie from 'lottie-web'
import type { LottieMeta } from '../types'

/** Minimal shape of the bits of bodymovin JSON we read. */
interface RawLottie {
  v?: string
  w?: number
  h?: number
  fr?: number
  ip?: number
  op?: number
  layers?: Array<{ nm?: string }>
  nm?: string
}

export class LottieParseError extends Error {}

/** Accepts a `.json` or `.lottie` (dotLottie zip) file and returns the
 *  bodymovin animationData object plus derived metadata. */
export async function parseLottieFile(
  file: File,
): Promise<{ data: RawLottie; meta: LottieMeta }> {
  const name = file.name.toLowerCase()
  let raw: RawLottie

  if (name.endsWith('.lottie')) {
    raw = await parseDotLottie(file)
  } else {
    const text = await file.text()
    try {
      raw = JSON.parse(text)
    } catch {
      throw new LottieParseError('JSON 파싱 실패 — 올바른 Lottie 파일 아님.')
    }
  }

  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    raw.op == null ||
    raw.ip == null
  ) {
    throw new LottieParseError(
      'Lottie 형식 아님 (ip/op 누락). bodymovin JSON 또는 .lottie 필요.',
    )
  }

  // External image refs we couldn't inline (a bare .json that points at image
  // files, or a .lottie missing its images) would render as broken images.
  if (hasUnresolvedImages(raw)) {
    throw new LottieParseError(
      '이 Lottie는 외부 이미지를 참조하는데 이미지가 포함돼 있지 않습니다. ' +
        '이미지를 내장한 .lottie 파일(또는 이미지가 base64로 임베드된 JSON)로 업로드해주세요.',
    )
  }

  return { data: raw, meta: extractMeta(raw, file.name, file.size) }
}

/** True if the Lottie has image assets whose data isn't embedded (a filename/
 *  path instead of a `data:` URI), so lottie-web would draw broken images. */
function hasUnresolvedImages(raw: RawLottie): boolean {
  const assets = (raw as { assets?: unknown }).assets
  if (!Array.isArray(assets)) return false
  return assets.some(
    (a) =>
      a &&
      typeof (a as { p?: unknown }).p === 'string' &&
      (a as { p: string }).p.length > 0 &&
      !(a as { p: string }).p.startsWith('data:'),
  )
}

async function parseDotLottie(file: File): Promise<RawLottie> {
  const buf = new Uint8Array(await file.arrayBuffer())
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(buf)
  } catch {
    throw new LottieParseError('.lottie 압축 해제 실패.')
  }
  // dotLottie spec: animations live under "animations/<id>.json".
  const animPath = Object.keys(files).find(
    (p) => p.startsWith('animations/') && p.endsWith('.json'),
  )
  if (!animPath) throw new LottieParseError('.lottie 안에 애니메이션 JSON 없음.')
  let anim: RawLottie
  try {
    anim = JSON.parse(strFromU8(files[animPath]))
  } catch {
    throw new LottieParseError('.lottie 내부 JSON 파싱 실패.')
  }
  // dotLottie keeps images as separate files under "images/"; inline them as
  // data-URIs so lottie-web can render them (otherwise it draws broken <image>).
  inlineLottieImages(anim, files)
  return anim
}

const IMG_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
}

function u8ToBase64(u8: Uint8Array): string {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode(...u8.subarray(i, i + chunk))
  }
  return btoa(s)
}

/** Replace external image-asset references in a Lottie's `assets` with base64
 *  data-URIs pulled from the dotLottie zip's bundled image files. */
function inlineLottieImages(anim: RawLottie, files: Record<string, Uint8Array>) {
  const assets = (anim as { assets?: unknown }).assets
  if (!Array.isArray(assets)) return
  const byBase = new Map<string, string>()
  for (const path of Object.keys(files)) {
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    if (IMG_MIME[ext]) byBase.set(path.split('/').pop()!.toLowerCase(), path)
  }
  if (!byBase.size) return
  for (const a of assets as Array<Record<string, unknown>>) {
    if (!a || typeof a.p !== 'string') continue
    if (a.p.startsWith('data:')) continue // already embedded
    const base = a.p.split('/').pop()!.toLowerCase()
    const path = byBase.get(base)
    if (!path) continue
    const ext = base.split('.').pop() ?? 'png'
    a.p = `data:${IMG_MIME[ext] ?? 'image/png'};base64,${u8ToBase64(files[path])}`
    a.u = ''
    a.e = 1
  }
}

export function extractMeta(
  raw: RawLottie,
  fileName: string,
  fileSize: number,
): LottieMeta {
  const fr = raw.fr ?? 30
  const ip = raw.ip ?? 0
  const op = raw.op ?? 0
  const totalFrames = Math.max(0, op - ip)
  const layers = Array.isArray(raw.layers) ? raw.layers : []
  return {
    width: raw.w ?? 0,
    height: raw.h ?? 0,
    frameRate: fr,
    inPoint: ip,
    outPoint: op,
    totalFrames,
    durationSec: fr ? totalFrames / fr : 0,
    layerCount: layers.length,
    layerNames: layers.map((l, i) => l.nm || `Layer ${i + 1}`),
    fileName,
    fileSize,
    bodymovinVersion: raw.v,
  }
}

/** Render one frame of an animation headlessly and return a PNG data URL.
 *  Used for asset/version thumbnails. Resolves to '' on failure. */
export function renderThumbnail(
  data: unknown,
  frameRatio = 0.35,
  size = 320,
): Promise<string> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    container.style.cssText = `position:absolute;left:-99999px;top:0;width:${size}px;height:${size}px;`
    document.body.appendChild(container)

    let done = false
    const finish = (url: string) => {
      if (done) return
      done = true
      try {
        anim.destroy()
      } catch {
        /* noop */
      }
      container.remove()
      resolve(url)
    }

    const anim = lottie.loadAnimation({
      container,
      renderer: 'canvas',
      loop: false,
      autoplay: false,
      animationData: structuredCloneSafe(data),
    })

    const timeout = setTimeout(() => finish(''), 4000)

    anim.addEventListener('DOMLoaded', () => {
      try {
        const total = anim.getDuration(true) // in frames
        anim.goToAndStop(Math.floor(total * frameRatio), true)
        // Allow the canvas a tick to paint, then snapshot.
        requestAnimationFrame(() => {
          clearTimeout(timeout)
          const canvas = container.querySelector('canvas')
          let url = ''
          if (canvas && canvas.width > 0 && canvas.height > 0) {
            try {
              const d = canvas.toDataURL('image/png')
              // Reject trivially-empty results ("data:," / blank) so callers
              // fall back to a kind glyph instead of a broken image.
              if (d && d.length > 64) url = d
            } catch {
              /* tainted canvas etc. */
            }
          }
          finish(url)
        })
      } catch {
        clearTimeout(timeout)
        finish('')
      }
    })
  })
}

/** structuredClone if available; lottie mutates animationData in place, so we
 *  never hand it the canonical copy held in the store. */
function structuredCloneSafe<T>(v: T): T {
  try {
    return structuredClone(v)
  } catch {
    return JSON.parse(JSON.stringify(v))
  }
}

export const cloneAnimationData = structuredCloneSafe
