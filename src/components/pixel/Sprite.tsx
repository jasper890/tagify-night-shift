import { memo } from 'react'
import { SPRITES, type SpriteId } from './sprites'

/** Merge each row into horizontal runs so a sprite is a few dozen rects, not 256. */
function runs(rows: string[]) {
  const out: { x: number; y: number; w: number; c: string }[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      let w = 1
      while (row[x + w] === c) w++
      if (c !== '.') out.push({ x, y, w, c })
      x += w
    }
  })
  return out
}

const CACHE = new Map<SpriteId, ReturnType<typeof runs>>()

/** A pixel-art sprite drawn with crisp SVG rects. Decorative by default. */
export const Sprite = memo(function Sprite({
  id,
  size = 64,
  className = '',
  label,
  silhouette = false,
}: {
  id: SpriteId
  size?: number
  className?: string
  /** Accessible name; leave empty for decorative sprites. */
  label?: string
  /** Draw every pixel in one dark color, for locked or unknown things. */
  silhouette?: boolean
}) {
  const def = SPRITES[id]
  let rects = CACHE.get(id)
  if (!rects) {
    rects = runs(def.rows)
    CACHE.set(id, rects)
  }
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`sprite ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={silhouette ? (r.c === 'k' ? '#0d0e1a' : '#333c57') : def.palette[r.c]} />
      ))}
    </svg>
  )
})
