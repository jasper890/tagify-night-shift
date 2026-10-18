import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { C, GRAD_COOL, GRAD_WARM, PIXEL, SANS, pxShadow } from './theme'
import { OVERLAP, type Cue } from './timeline'

export type SceneProps = { duration: number; cue: Cue }

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
/** Apple-style ease-out: quick start, long gentle settle. No overshoot, no "pop". */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1)
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1)

/** Snap a 0..1 value to a few steps, so motion moves like an old game console (no smooth glides). */
export const stepped = (p: number, steps = 5) => (p >= 1 ? 1 : Math.floor(p * steps) / steps)

/** 0 → 1 over `len` frames starting at `at`, eased. */
export function useEase(at: number, len = 20) {
  return interpolate(useCurrentFrame(), [at, at + len], [0, 1], { ...clamp, easing: EASE_OUT })
}

/** Text and cards pop up into place at frame `at`, in a few pixel steps. */
export function Reveal({ at = 0, y = 28, len = 14, children, style }: { at?: number; y?: number; blur?: number; len?: number; children: ReactNode; style?: CSSProperties }) {
  const p = stepped(useEase(at, len), 4)
  return <div style={{ opacity: p > 0 ? 0.35 + 0.65 * p : 0, transform: `translateY(${Math.round((1 - p) * y)}px)`, ...style }}>{children}</div>
}

/** Accent text: a flat gold (warm) or cyan (cool) color. */
export function Gradient({ children, bg = GRAD_WARM }: { children: ReactNode; bg?: string }) {
  return <span style={{ color: bg === GRAD_COOL ? C.teal : C.amber }}>{children}</span>
}

/** A headline built from parts that each appear at their own frame (usually when the narrator says them). */
export function Headline({
  parts,
  size = 120,
  align = 'center',
  style,
}: {
  parts: { t: string; at: number; grad?: string; color?: string; br?: boolean }[]
  size?: number
  weight?: number
  align?: 'center' | 'left'
  style?: CSSProperties
}) {
  return (
    // Press Start 2P is about twice as wide as a normal font, so headlines are drawn at half the size.
    <div style={{ fontFamily: PIXEL, fontSize: Math.round(size * 0.5), fontWeight: 400, lineHeight: 1.45, textAlign: align, textShadow: pxShadow(size * 0.5), ...style }}>
      {parts.map((p, i) => (
        <span key={i}>
          {p.br ? <br /> : null}
          <Reveal at={p.at} y={size * 0.2} style={{ display: 'inline-block', marginRight: '0.5em', paddingBottom: '0.08em' }}>
            {p.grad ? <Gradient bg={p.grad}>{p.t}</Gradient> : <span style={{ color: p.color }}>{p.t}</span>}
          </Reveal>
        </span>
      ))}
    </div>
  )
}

export function Kicker({ children, color = C.amber, at = 0 }: { children: ReactNode; color?: string; at?: number }) {
  return (
    <Reveal at={at} y={12}>
      <div style={{ fontFamily: PIXEL, fontSize: 24, color, textShadow: pxShadow(24) }}>{children}</div>
    </Reveal>
  )
}

/** A classic RPG window: dark blue fill, white pixel border, black outline and a hard drop shadow. */
export const glass: CSSProperties = {
  background: C.window,
  border: `6px solid ${C.frame}`,
  borderRadius: 0,
  boxShadow: `0 0 0 6px ${C.bg}, 16px 16px 0 6px rgba(0,0,0,0.5)`,
}

/** How "lit" something is: 0 before frame `at`, easing to 1 just after. */
export function useLit(at: number, len = 12) {
  return interpolate(useCurrentFrame(), [at, at + len], [0, 1], { ...clamp, easing: EASE_IN_OUT })
}

/**
 * Wraps a scene. Scenes overlap by OVERLAP frames: each one steps in while the previous one
 * steps out, like a game changing rooms, so the picture never cuts or goes black.
 * The space at the top is for the HUD and at the bottom for the Old Admin's dialog box.
 */
export function Scene({ duration, fadeOut = true, children }: { duration: number; push?: number; fadeOut?: boolean; children: ReactNode }) {
  const f = useCurrentFrame()
  const pin = stepped(interpolate(f, [0, OVERLAP], [0, 1], { ...clamp, easing: EASE_IN_OUT }), 4)
  const pout = fadeOut ? stepped(interpolate(f, [duration - OVERLAP, duration], [0, 1], { ...clamp, easing: EASE_IN_OUT }), 4) : 0
  return (
    <AbsoluteFill
      style={{
        fontFamily: SANS,
        color: C.ink,
        opacity: pin * (1 - pout),
        transform: `translateY(${Math.round((1 - pin) * 24 - pout * 24)}px)`,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 70,
        paddingBottom: 230,
      }}
    >
      {children}
    </AbsoluteFill>
  )
}

export type SfxName = 'typing' | 'tick' | 'chime' | 'tap' | 'whoosh' | 'swell' | 'hit' | 'blip1' | 'blip2' | 'blip3' | 'blip4' | 'blip5'

/** How many frames each effect needs (its audible length), so finished effects unmount and free their audio tag. */
const SFX_FRAMES: Record<SfxName, number> = { typing: 240, tick: 12, chime: 54, tap: 14, whoosh: 28, swell: 56, hit: 60, blip1: 20, blip2: 20, blip3: 20, blip4: 20, blip5: 20 }

/** 'stems': every clip plays (rendering). 'none': visuals only (the website plays the pre-mixed soundtrack itself). */
export const AudioMode = createContext<'stems' | 'none'>('stems')

/** 8-bit square-wave effects sound louder than soft ones at the same level, so every effect is scaled down by this much. */
const SFX_GAIN = 0.55

/** Plays a sound effect at frame `at` (relative to the enclosing scene). `dur` cuts it off with a short fade, e.g. for typing. */
export function Sfx({ name, at, volume: rawVolume = 0.5, dur }: { name: SfxName; at: number; volume?: number; dur?: number }) {
  const volume = rawVolume * SFX_GAIN
  if (useContext(AudioMode) === 'none') return null
  return (
    <Sequence from={Math.round(at)} durationInFrames={dur ?? SFX_FRAMES[name]} layout="none" name={`sfx:${name}`}>
      <Audio src={staticFile(`video/sfx/${name}.mp3`)} volume={(f) => (dur ? interpolate(f, [dur - 4, dur], [volume, 0], clamp) : volume)} />
    </Sequence>
  )
}

/** Characters of `text` typed out from `start` at `speed` characters per frame. */
export function typed(text: string, frame: number, start: number, speed = 1) {
  return text.slice(0, Math.max(0, Math.floor((frame - start) * speed)))
}

export function AnalogClock({ size, hour, minute, accent = C.amber }: { size: number; hour: number; minute: number; accent?: string }) {
  const r = size / 2
  const hand = (deg: number, len: number, w: number, color: string) => (
    <line x1={r} y1={r} x2={r + Math.sin((deg * Math.PI) / 180) * len} y2={r - Math.cos((deg * Math.PI) / 180) * len} stroke={color} strokeWidth={w} strokeLinecap="square" />
  )
  return (
    <svg width={size} height={size} shapeRendering="crispEdges">
      <circle cx={r} cy={r} r={r - 6} fill="#ffe9b0" stroke={C.bg} strokeWidth={8} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180
        const inner = r - (i % 3 ? 28 : 40)
        return (
          <line
            key={i}
            x1={r + Math.sin(a) * (r - 16)}
            y1={r - Math.cos(a) * (r - 16)}
            x2={r + Math.sin(a) * inner}
            y2={r - Math.cos(a) * inner}
            stroke={i % 3 ? '#c9a45a' : '#9a5a08'}
            strokeWidth={i % 3 ? 4 : 8}
            strokeLinecap="butt"
          />
        )
      })}
      {hand(((hour % 12) + minute / 60) * 30, r * 0.5, 12, C.bg)}
      {hand(minute * 6, r * 0.75, 8, accent === C.amber ? C.pink : accent)}
      <rect x={r - 10} y={r - 10} width={20} height={20} fill={C.pink} />
    </svg>
  )
}
