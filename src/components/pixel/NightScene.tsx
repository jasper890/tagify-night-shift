import { memo } from 'react'

// Title-screen scenery: a moon that is also a clock stuck at 2:00 AM, and a skyline of
// server racks with blinking status lights. All drawn as crisp pixel rects.

function moonPixels() {
  const px: { x: number; y: number; c: string }[] = []
  const r = 13.5
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      const d = Math.hypot(x - 14.5, y - 14.5)
      if (d <= r) px.push({ x, y, c: d > r - 1.5 ? '#e0b860' : '#ffe9b0' })
    }
  }
  // Craters
  for (const [x, y] of [
    [7, 9],
    [8, 9],
    [20, 21],
    [21, 21],
    [21, 22],
    [9, 20],
  ])
    px.push({ x, y, c: '#f2d48a' })
  // Hour marks at 12, 3, 6, 9
  for (const [x, y] of [
    [14, 3],
    [15, 3],
    [26, 14],
    [26, 15],
    [14, 26],
    [15, 26],
    [3, 14],
    [3, 15],
  ])
    px.push({ x, y, c: '#9a5a08' })
  // Minute hand straight up (00), hour hand toward the 2.
  for (let y = 6; y <= 14; y++) px.push({ x: 14, y, c: '#1a1c2c' }, { x: 15, y, c: '#1a1c2c' })
  for (let i = 0; i <= 6; i++) {
    const x = Math.round(15 + i * 0.87)
    const y = Math.round(14 - i * 0.5)
    px.push({ x, y, c: '#1a1c2c' }, { x, y: y + 1, c: '#1a1c2c' })
  }
  px.push({ x: 14, y: 14, c: '#b13e53' }, { x: 15, y: 14, c: '#b13e53' }, { x: 14, y: 15, c: '#b13e53' }, { x: 15, y: 15, c: '#b13e53' })
  return px
}

const MOON = moonPixels()

export const MoonClock = memo(function MoonClock({ size = 120, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} shapeRendering="crispEdges" className={`sprite ${className}`} role="img" aria-label="A moon clock showing 2:00 AM">
      {MOON.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={1} height={1} fill={p.c} />
      ))}
    </svg>
  )
})

// Deterministic "random" so the skyline is the same on every visit.
function rng(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

function buildSkyline() {
  const rand = rng(7)
  const racks: { x: number; w: number; h: number }[] = []
  const leds: { x: number; y: number; c: string; d: number }[] = []
  let x = 0
  while (x < 200) {
    const w = 8 + Math.floor(rand() * 4) * 2
    const h = 14 + Math.floor(rand() * 18)
    racks.push({ x, w, h })
    for (let row = 4; row < h - 2; row += 4) {
      if (rand() < 0.55) {
        const c = rand() < 0.75 ? '#a7f070' : rand() < 0.5 ? '#ffcd75' : '#ef5d6b'
        leds.push({ x: x + 2 + Math.floor(rand() * (w - 4)), y: 40 - h + row, c, d: Math.round(rand() * 24) / 10 })
      }
    }
    x += w + (rand() < 0.4 ? 2 : 0)
  }
  return { racks, leds }
}

/** Server racks and their status lights, shared with the intro video. */
export const SKYLINE = buildSkyline()

export const ServerSkyline = memo(function ServerSkyline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 40" preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges" className={`sprite block w-full ${className}`} aria-hidden>
      {SKYLINE.racks.map((r) => (
        <g key={r.x}>
          <rect x={r.x} y={40 - r.h} width={r.w} height={r.h} fill="#20233f" />
          <rect x={r.x} y={40 - r.h} width={r.w} height={1} fill="#333c57" />
          {Array.from({ length: Math.floor((r.h - 2) / 4) }, (_, i) => (
            <rect key={i} x={r.x + 1} y={40 - r.h + 3 + i * 4} width={r.w - 2} height={1} fill="#181a30" />
          ))}
        </g>
      ))}
      {SKYLINE.leds.map((l, i) => (
        <rect key={i} x={l.x} y={l.y} width={1} height={1} fill={l.c} className="anim-twinkle" style={{ animationDelay: `${l.d}s` }} />
      ))}
    </svg>
  )
})
