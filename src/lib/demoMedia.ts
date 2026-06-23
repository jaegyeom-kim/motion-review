/** A self-contained SVG "key visual" used to seed a demo IMAGE asset, so the
 *  app shows multi-kind review out of the box without bundling a binary file. */
export function makeDemoPosterSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1b1640"/>
      <stop offset="1" stop-color="#0c1530"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.7" cy="0.3" r="0.7">
      <stop offset="0" stop-color="#7c6cff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#7c6cff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="800" fill="url(#bg)"/>
  <rect width="1280" height="800" fill="url(#glow)"/>
  <circle cx="930" cy="250" r="180" fill="none" stroke="#3ad1c4" stroke-width="10" stroke-opacity="0.8"/>
  <circle cx="930" cy="250" r="120" fill="#ff7a59" fill-opacity="0.9"/>
  <text x="96" y="380" font-family="Inter, Arial, sans-serif" font-size="92" font-weight="800" fill="#ffffff">MOTION</text>
  <text x="96" y="470" font-family="Inter, Arial, sans-serif" font-size="92" font-weight="800" fill="#7c6cff">REVIEW</text>
  <text x="100" y="540" font-family="Inter, Arial, sans-serif" font-size="30" fill="#aab0c0">Lottie · Image · Video · PDF · Audio</text>
  <rect x="100" y="600" width="220" height="60" rx="30" fill="#ffffff"/>
  <text x="210" y="639" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#16122e">VIEW</text>
</svg>`
}
