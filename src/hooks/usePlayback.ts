import { useCallback, useEffect, useRef, useState } from 'react'

export interface Playback {
  frame: number
  playing: boolean
  loop: boolean
  speed: number
  totalFrames: number
  fps: number
  seek: (f: number) => void
  step: (delta: number) => void
  toggle: () => void
  pause: () => void
  setLoop: (v: boolean) => void
  setSpeed: (v: number) => void
}

/** A single rAF-driven playhead clock. One clock can drive any number of
 *  LottieCanvas instances by passing `frame` down — which makes synced
 *  compare-mode playback fall out for free. */
export function usePlayback(totalFrames: number, fps: number): Playback {
  const [frame, setFrame] = useState(0)
  // Default to playing — the workspace opens with the animation running.
  const [playing, setPlaying] = useState(true)
  const [loop, setLoop] = useState(true)
  const [speed, setSpeed] = useState(1)

  const frameRef = useRef(0)
  const rafRef = useRef(0)
  const lastRef = useRef(0)

  const setBoth = useCallback((f: number) => {
    frameRef.current = f
    setFrame(f)
  }, [])

  // Keep the playhead valid when the underlying clip length changes.
  useEffect(() => {
    if (frameRef.current > totalFrames) setBoth(totalFrames)
  }, [totalFrames, setBoth])

  useEffect(() => {
    if (!playing || totalFrames <= 0) return
    lastRef.current = performance.now()
    const tick = (now: number) => {
      const dt = (now - lastRef.current) / 1000
      lastRef.current = now
      let next = frameRef.current + dt * fps * speed
      if (next >= totalFrames) {
        if (loop) {
          next = next % totalFrames
        } else {
          setBoth(totalFrames)
          setPlaying(false)
          return
        }
      }
      setBoth(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, fps, speed, loop, totalFrames, setBoth])

  const seek = useCallback(
    (f: number) => setBoth(Math.max(0, Math.min(totalFrames, f))),
    [totalFrames, setBoth],
  )
  const step = useCallback(
    (delta: number) => {
      setPlaying(false)
      setBoth(Math.max(0, Math.min(totalFrames, Math.round(frameRef.current) + delta)))
    },
    [totalFrames, setBoth],
  )
  const toggle = useCallback(() => setPlaying((p) => !p), [])
  const pause = useCallback(() => setPlaying(false), [])

  return {
    frame,
    playing,
    loop,
    speed,
    totalFrames,
    fps,
    seek,
    step,
    toggle,
    pause,
    setLoop,
    setSpeed,
  }
}
