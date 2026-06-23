import { useEffect, useRef } from 'react'

/** Renders a video from a Blob, kept in step with the shared rAF playhead.
 *
 *  Two modes, because continuously assigning currentTime on a PAUSED <video>
 *  every frame cancels each pending seek before it can paint — the video would
 *  stay blank. So:
 *   • playing  → let the element play natively (smooth, always paints); only
 *               nudge currentTime back if it drifts from the playhead.
 *   • paused   → seek exactly to frame/fps (single seek → paints that frame).
 *  Compare mode passes the same frame/playing to N videos, so they stay synced
 *  and the shorter clip clamps to its last frame on its own. */
export function VideoCanvas({
  file,
  frame,
  fps,
  playing = false,
  speed = 1,
  opacity = 1,
  onReady,
}: {
  file: Blob
  frame: number
  fps: number
  playing?: boolean
  speed?: number
  opacity?: number
  onReady?: (v: HTMLVideoElement) => void
}) {
  const ref = useRef<HTMLVideoElement>(null)

  // (Re)create the object URL whenever the blob changes; revoke on cleanup.
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const url = URL.createObjectURL(file)
    v.src = url
    v.load()
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  // Play / pause to match the shared clock.
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (playing) {
      const p = v.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } else {
      v.pause()
    }
  }, [playing])

  // Match playback speed.
  useEffect(() => {
    const v = ref.current
    if (v) v.playbackRate = speed || 1
  }, [speed])

  // Drive currentTime. Paused → exact seek (so frame-stepping/scrubbing shows
  // the right frame). Playing → only correct large drift, so we don't thrash.
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const t = frame / (fps || 30)
    if (!isFinite(t)) return
    if (!playing) {
      if (Math.abs(v.currentTime - t) > 1 / ((fps || 30) * 2)) {
        try {
          v.currentTime = t
        } catch {
          /* not seekable yet */
        }
      }
    } else if (Math.abs(v.currentTime - t) > 0.3) {
      try {
        v.currentTime = t
      } catch {
        /* not seekable yet */
      }
    }
  }, [frame, fps, playing])

  return (
    <video
      ref={ref}
      className="media-video"
      style={{ opacity }}
      muted
      playsInline
      preload="auto"
      onLoadedData={(e) => {
        const v = e.currentTarget
        // Guarantee a painted first frame even if autoplay is blocked.
        if (!playing) {
          try {
            v.currentTime = frame / (fps || 30)
          } catch {
            /* noop */
          }
        } else {
          const p = v.play()
          if (p && typeof p.catch === 'function') p.catch(() => {})
        }
        onReady?.(v)
      }}
    />
  )
}
