import { useLayoutEffect, useRef, useState } from 'react'

/** Measures a container and returns the largest box of the given aspect ratio
 *  that fits inside it ("contain"). Returned in px so the pin overlay can map
 *  normalized coords to the exact rendered art rectangle. */
export function useFitBox(aspect: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const compute = () => {
      // clientWidth/Height INCLUDE padding — subtract it so the fitted box uses
      // the real content area (otherwise the box overflows the padded container
      // and gets clipped to the wrong aspect, letterboxing the media).
      const cs = getComputedStyle(el)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      const cw = el.clientWidth - padX
      const ch = el.clientHeight - padY
      if (!cw || !ch || !aspect) return
      let w = cw
      let h = w / aspect
      if (h > ch) {
        h = ch
        w = h * aspect
      }
      setSize({ w: Math.round(w), h: Math.round(h) })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [aspect])

  return { ref, ...size }
}
