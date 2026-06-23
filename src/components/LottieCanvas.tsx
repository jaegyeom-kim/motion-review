import { useEffect, useRef } from 'react'
import { DotLottie } from '@lottiefiles/dotlottie-web'

// Render Lottie with the ThorVG-based dotLottie engine (same renderer
// LottieFiles uses) instead of lottie-web's SVG renderer — it interpolates
// eased / time-offset layers more faithfully. The WASM is bundled locally
// (Vite asset URL, package exports block a bare ?url specifier) so the app
// stays fully client-side/offline.
const wasmUrl = new URL(
  '../../node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm',
  import.meta.url,
).href
DotLottie.setWasmUrl(wasmUrl)

const clampFrame = (frame: number, total: number) =>
  total > 0 ? Math.max(0, Math.min(frame, total - 0.001)) : Math.max(0, frame)

/** Renders a Lottie animation to a <canvas> and exposes a single controlled
 *  `frame`. Playback is owned by the parent's playhead clock (setFrame per
 *  frame), so syncing N canvases in compare mode falls out for free. */
export function LottieCanvas({
  data,
  frame,
  opacity = 1,
  onTotalFrames,
}: {
  data: unknown
  frame: number
  opacity?: number
  onTotalFrames?: (n: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dlRef = useRef<DotLottie | null>(null)
  const totalRef = useRef(0)
  const loadedRef = useRef(false)
  const frameRef = useRef(frame)
  frameRef.current = frame

  // (Re)load whenever the animation data changes.
  useEffect(() => {
    if (!canvasRef.current || !data) return
    loadedRef.current = false
    const dl = new DotLottie({
      canvas: canvasRef.current,
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
      onTotalFrames?.(dl.totalFrames)
      dl.setFrame(clampFrame(frameRef.current, totalRef.current))
    })
    return () => {
      try {
        dl.destroy()
      } catch {
        /* noop */
      }
      dlRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Drive the frame.
  useEffect(() => {
    const dl = dlRef.current
    if (!dl || !loadedRef.current) return
    dl.setFrame(clampFrame(frame, totalRef.current))
  }, [frame])

  return <canvas ref={canvasRef} className="lottie-canvas" style={{ opacity }} />
}
