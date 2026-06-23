// Programmatically builds valid bodymovin JSON so the first-run demo always
// renders without shipping a hand-written (error-prone) animation file.

interface DemoOpts {
  name: string
  color: [number, number, number] // 0..1 rgb
  accent: [number, number, number]
  spinFrames: number // duration in frames
  squash: number // 0..1 — how much the shape squashes at mid-bounce
}

const kf = (t: number, s: number[]) => ({
  t,
  s,
  i: { x: [0.66], y: [1] },
  o: { x: [0.33], y: [0] },
})

export function makeDemoLottie(o: DemoOpts) {
  const W = 240
  const H = 240
  const op = o.spinFrames
  const mid = Math.round(op / 2)

  return {
    v: '5.9.0',
    fr: 30,
    ip: 0,
    op,
    w: W,
    h: H,
    nm: o.name,
    ddd: 0,
    assets: [],
    layers: [
      // Background dot pulse
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Glow',
        sr: 1,
        ks: {
          o: { a: 0, k: 22 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [W / 2, H / 2, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: {
            a: 1,
            k: [kf(0, [70, 70, 100]), kf(mid, [110, 110, 100]), kf(op, [70, 70, 100])],
          },
        },
        ao: 0,
        shapes: [
          group([
            ellipse(180, 180),
            fill(o.accent, 100),
            transform(),
          ]),
        ],
        ip: 0,
        op,
        st: 0,
        bm: 0,
      },
      // Spinning ring
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: 'Ring',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 1, k: [kf(0, [0]), kf(op, [360])] },
          p: { a: 0, k: [W / 2, H / 2, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        ao: 0,
        shapes: [
          group([
            ellipse(150, 150),
            stroke(o.color, 16, [40, 220]),
            transform(),
          ]),
        ],
        ip: 0,
        op,
        st: 0,
        bm: 0,
      },
      // Bouncing core
      {
        ddd: 0,
        ind: 3,
        ty: 4,
        nm: 'Core',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: {
            a: 1,
            k: [
              kf(0, [W / 2, H / 2 - 18, 0]),
              kf(mid, [W / 2, H / 2 + 18, 0]),
              kf(op, [W / 2, H / 2 - 18, 0]),
            ],
          },
          a: { a: 0, k: [0, 0, 0] },
          s: {
            a: 1,
            k: [
              kf(0, [100, 100, 100]),
              kf(mid, [100 + o.squash * 40, 100 - o.squash * 40, 100]),
              kf(op, [100, 100, 100]),
            ],
          },
        },
        ao: 0,
        shapes: [group([ellipse(64, 64), fill(o.color, 100), transform()])],
        ip: 0,
        op,
        st: 0,
        bm: 0,
      },
    ],
  }
}

const c4 = ([r, g, b]: [number, number, number]) => [r, g, b, 1]

function group(it: object[]) {
  return { ty: 'gr', nm: 'Group', it }
}
function ellipse(w: number, h: number) {
  return { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [w, h] } }
}
function fill(color: [number, number, number], opacity: number) {
  return { ty: 'fl', c: { a: 0, k: c4(color) }, o: { a: 0, k: opacity } }
}
function stroke(
  color: [number, number, number],
  width: number,
  dash?: [number, number],
) {
  const base: Record<string, unknown> = {
    ty: 'st',
    c: { a: 0, k: c4(color) },
    o: { a: 0, k: 100 },
    w: { a: 0, k: width },
    lc: 2,
    lj: 2,
  }
  if (dash) {
    base.d = [
      { n: 'd', nm: 'dash', v: { a: 0, k: dash[0] } },
      { n: 'g', nm: 'gap', v: { a: 0, k: dash[1] } },
    ]
  }
  return base
}
function transform() {
  return {
    ty: 'tr',
    p: { a: 0, k: [0, 0] },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  }
}
