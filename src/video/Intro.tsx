import type { FC } from 'react'
import { AbsoluteFill, Audio, interpolate, interpolateColors, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { Hook, Question, Title, WhenHow } from './scenes/Opening'
import { Cron, Orbit, Pipeline } from './scenes/HowItWorks'
import { FiveIdeas, ToolsBuiltIn, ToolsScale } from './scenes/Tools'
import { End, Habits, Site } from './scenes/Closing'
import { AudioMode, type SceneProps } from './primitives'
import { C, PIXEL, SANS, pxShadow } from './theme'
import { Sprite } from '../components/pixel/Sprite'
import { SKYLINE } from '../components/pixel/NightScene'
import { makeCue, OVERLAP, TIMELINE, TOTAL_FRAMES, type SceneId } from './timeline'

export const INTRO_DURATION = TOTAL_FRAMES

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

const SCENES: Record<SceneId, { c: FC<SceneProps>; glow: [string, string] }> = {
  hook: { c: Hook, glow: ['#29366f', '#3b2a4a'] },
  question: { c: Question, glow: ['#3b2a4a', '#5d275d'] },
  title: { c: Title, glow: ['#29366f', '#3b5dc9'] },
  whenHow: { c: WhenHow, glow: ['#29366f', '#257179'] },
  pipeline: { c: Pipeline, glow: ['#29366f', '#333c57'] },
  cron: { c: Cron, glow: ['#333c57', '#5d275d'] },
  toolsBuiltIn: { c: ToolsBuiltIn, glow: ['#29366f', '#3b5dc9'] },
  toolsScale: { c: ToolsScale, glow: ['#257179', '#29366f'] },
  fiveIdeas: { c: FiveIdeas, glow: ['#5d275d', '#29366f'] },
  orbit: { c: Orbit, glow: ['#1a1c2c', '#29366f'] },
  habits: { c: Habits, glow: ['#29366f', '#257179'] },
  site: { c: Site, glow: ['#257179', '#29366f'] },
  end: { c: End, glow: ['#3b5dc9', '#5d275d'] },
}

// Pixel stars: fixed positions, each blinking on its own beat.
const STARS = Array.from({ length: 90 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1
  return { x: Math.floor(r(1) * 320) * 6, y: Math.floor(r(2) * 120) * 6, size: r(3) < 0.15 ? 12 : 6, beat: 20 + Math.floor(r(4) * 60), gold: r(5) < 0.12 }
})

/**
 * One backdrop for the whole video: a pixel night sky over a row of server racks.
 * The sky bands change color with the scenes, in hard steps, so there is never a cut to black.
 */
function Backdrop() {
  const f = useCurrentFrame()
  const stops = TIMELINE.map((t) => t.from + t.duration / 2)
  const a = interpolateColors(f, stops, TIMELINE.map((t) => SCENES[t.id].glow[0]))
  const b = interpolateColors(f, stops, TIMELINE.map((t) => SCENES[t.id].glow[1]))
  // A "dithered" sky: 12 flat bands, each a small step from midnight down to the scene's colors.
  const BANDS = 12
  const bands = Array.from({ length: BANDS }, (_, i) => {
    const t = i / (BANDS - 1)
    const c = t < 0.5 ? interpolateColors(t * 2, [0, 1], [C.night, a]) : interpolateColors((t - 0.5) * 2, [0, 1], [a, b])
    return `${c} ${(i / BANDS) * 100}% ${((i + 1) / BANDS) * 100}%`
  })
  const sky = `linear-gradient(180deg, ${bands.join(', ')})`
  const rackScale = 1920 / 200
  return (
    <AbsoluteFill style={{ background: sky, overflow: 'hidden' }}>
      {STARS.map((st, i) => (
        <div
          key={i}
          style={{ position: 'absolute', left: st.x, top: st.y, width: st.size, height: st.size, background: st.gold ? C.amber : C.ink, opacity: Math.floor(f / st.beat) % 3 === 0 ? 0.25 : 0.75 }}
        />
      ))}
      {/* Server racks along the bottom, with blinking status lights */}
      <svg viewBox="0 0 200 40" width={1920} height={40 * rackScale} shapeRendering="crispEdges" style={{ position: 'absolute', left: 0, bottom: 36, opacity: 0.55 }}>
        {SKYLINE.racks.map((r) => (
          <g key={r.x}>
            <rect x={r.x} y={40 - r.h} width={r.w} height={r.h} fill="#20233f" />
            <rect x={r.x} y={40 - r.h} width={r.w} height={1} fill="#333c57" />
          </g>
        ))}
        {SKYLINE.leds.map((l, i) => (
          <rect key={i} x={l.x} y={l.y} width={1} height={1} fill={l.c} opacity={Math.floor((f + l.d * 30) / 24) % 2 ? 1 : 0.3} />
        ))}
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 36, borderTop: `6px solid ${C.bg}`, background: 'repeating-linear-gradient(90deg, #3d4766 0 48px, #333c57 48px 96px)' }} />
      {/* CRT scanlines */}
      <AbsoluteFill style={{ background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 3px, transparent 3px 6px)' }} />
    </AbsoluteFill>
  )
}

/** Game HUD along the top: the intro is the tutorial level, and its XP bar fills as the video plays. */
function Hud() {
  const f = useCurrentFrame()
  const pct = Math.min(1, f / (TOTAL_FRAMES - 30))
  const segs = 20
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 26, left: 40, right: 40, display: 'flex', alignItems: 'center', gap: 24, fontFamily: PIXEL, color: C.ink }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 18px', background: C.night, border: `4px solid ${C.dim}` }}>
          <Sprite id="hero" size={40} />
          <span style={{ fontSize: 18, color: C.amber }}>TUTORIAL</span>
          <span style={{ fontSize: 14, color: C.dim }}>Stage 0</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', background: C.night, border: `4px solid ${C.dim}` }}>
          <span style={{ fontSize: 16, color: C.ok }}>XP</span>
          <div style={{ display: 'flex', gap: 3, padding: 3, background: C.bg }}>
            {Array.from({ length: segs }, (_, i) => (
              <div key={i} style={{ width: 14, height: 18, background: i < Math.floor(pct * segs) ? C.ok : '#333c57' }} />
            ))}
          </div>
          <span style={{ fontSize: 16, color: C.danger, marginLeft: 6 }}>♥♥♥</span>
        </div>
      </div>
    </AbsoluteFill>
  )
}

/** Narration windows in absolute frames: used to duck the music and to place captions. */
const VO_WINDOWS = TIMELINE.map((t) => [t.from + t.lead, t.from + t.lead + t.voFrames] as const)

function musicVolume(f: number) {
  // The chiptune is dense and bright, so it sits lower than a soft pad would, and dips well under the voice.
  const base = 0.2
  const under = 0.055
  let duck = 0
  for (const [s, e] of VO_WINDOWS) duck = Math.max(duck, interpolate(f, [s - 8, s, e, e + 12], [0, 1, 1, 0], clamp))
  const fadeOut = interpolate(f, [TOTAL_FRAMES - 50, TOTAL_FRAMES], [1, 0], clamp)
  return (base - (base - under) * duck) * fadeOut
}

type CapWord = { text: string; start: number; end: number }

/** Caption lines: words grouped into short phrases, broken at pauses and kept within one scene. */
const CAPTIONS: { words: CapWord[]; start: number; end: number }[] = []
for (const t of TIMELINE) {
  let line: CapWord[] = []
  const flush = () => {
    if (line.length) CAPTIONS.push({ words: line, start: line[0].start, end: line[line.length - 1].end })
    line = []
  }
  t.words.forEach(([text, s, e], i) => {
    const w = { text, start: t.from + t.lead + Math.round(s * 30), end: t.from + t.lead + Math.round(e * 30) }
    const prev = t.words[i - 1]
    if (line.length >= 8 || (prev && s - prev[2] > 0.35 && line.length >= 3)) flush()
    line.push(w)
    // Break after a sentence, or after a comma once the line has a few words.
    if (/[.?!:]$/.test(text) || (/,$/.test(text) && line.length >= 4)) flush()
  })
  flush()
}

/** The Old Admin explains everything in an RPG dialog box, word by word, as the narrator speaks. */
function Captions() {
  const f = useCurrentFrame()
  const idx = CAPTIONS.findIndex((c, i) => f >= c.start - 2 && f < Math.min(c.end + 18, CAPTIONS[i + 1]?.start ?? Infinity))
  // Keep the box on screen between lines in the same stretch of talk, so it does not flicker.
  const prev = idx < 0 ? [...CAPTIONS].reverse().find((c) => c.end <= f) : undefined
  const next = idx < 0 ? CAPTIONS.find((c) => c.start > f) : undefined
  const gap = prev && next ? next.start - prev.end : Infinity
  const open = idx >= 0 || gap < 40
  if (!open || f < 4 || f > TOTAL_FRAMES - 20) return null
  const cap = idx >= 0 ? CAPTIONS[idx] : null
  const talking = cap ? f < cap.end : false
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 54, pointerEvents: 'none' }}>
      <div
        style={{
          width: 1640,
          height: 168,
          display: 'flex',
          alignItems: 'stretch',
          gap: 0,
          background: C.window,
          border: `6px solid ${C.frame}`,
          boxShadow: `0 0 0 6px ${C.bg}, 14px 14px 0 6px rgba(0,0,0,0.55)`,
        }}
      >
        <div style={{ width: 168, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, borderRight: `6px solid ${C.frame}`, background: C.night }}>
          {/* The portrait bobs while the Old Admin talks. */}
          <div style={{ transform: `translateY(${talking && Math.floor(f / 6) % 2 ? -4 : 0}px)` }}>
            <Sprite id="sage" size={96} />
          </div>
        </div>
        <div style={{ flex: 1, padding: '18px 34px', position: 'relative' }}>
          <div style={{ fontFamily: PIXEL, fontSize: 18, color: C.amber, textShadow: pxShadow(18) }}>Old Admin</div>
          <div style={{ fontFamily: SANS, fontSize: 40, lineHeight: 1.3, marginTop: 12 }}>
            {cap?.words.map((w, i) => (
              <span key={i} style={{ color: f >= w.start ? C.ink : 'rgba(244,244,244,0.28)' }}>
                {w.text}
                {i < cap.words.length - 1 ? ' ' : ''}
              </span>
            ))}
          </div>
          {!talking ? (
            <div style={{ position: 'absolute', right: 26, bottom: 14, fontFamily: PIXEL, fontSize: 20, color: C.amber, opacity: Math.floor(f / 10) % 2 ? 1 : 0 }}>▼</div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  )
}

export type IntroProps = { audio?: 'stems' | 'none' }

/**
 * The narrated intro. Graphics are cued to the narrator's words; scenes crossfade with no gaps.
 * audio='stems' (default, for rendering) plays every voice clip, effect and the music.
 * audio='none' renders visuals only: the website plays the pre-mixed public/video/soundtrack.mp3 next to the player.
 */
export function Intro({ audio = 'stems' }: IntroProps) {
  const f = useCurrentFrame()
  return (
    <AudioMode.Provider value={audio}>
    <AbsoluteFill style={{ background: C.bg, fontFamily: SANS }}>
      <Backdrop />
      {TIMELINE.map((t) => {
        const S = SCENES[t.id].c
        return (
          <Sequence key={t.id} from={t.from} durationInFrames={t.duration} name={t.id}>
            <S duration={t.duration} cue={makeCue(t)} />
          </Sequence>
        )
      })}
      <Hud />
      <Captions />

      {audio === 'stems' ? <Stems /> : null}

      {/* Gentle fade to black on the very last frames. */}
      <AbsoluteFill style={{ background: '#000', opacity: interpolate(f, [TOTAL_FRAMES - 24, TOTAL_FRAMES - 1], [0, 1], clamp), pointerEvents: 'none' }} />
    </AbsoluteFill>
    </AudioMode.Provider>
  )
}

/** Music (ducked under the voice), narration and scene-change whooshes as separate tracks. */
function Stems() {
  return (
    <>
      <Audio src={staticFile('video/music.mp3')} volume={musicVolume} />
      {TIMELINE.map((t) => (
        <Sequence key={`vo-${t.id}`} from={t.from + t.lead} durationInFrames={t.voFrames + 10} layout="none" name={`vo:${t.id}`}>
          <Audio src={staticFile(`video/vo/${t.id}.mp3`)} volume={1} />
        </Sequence>
      ))}
      {TIMELINE.slice(1).map((t) => (
        <Sequence key={`wh-${t.id}`} from={t.from - 10} durationInFrames={OVERLAP + 20} layout="none" name="sfx:whoosh">
          <Audio src={staticFile('video/sfx/whoosh.mp3')} volume={0.12} />
        </Sequence>
      ))}
    </>
  )
}
