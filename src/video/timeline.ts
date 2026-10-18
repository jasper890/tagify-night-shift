import audio from './audio.json'
import { FPS } from './theme'

/** Frames that neighbouring scenes overlap (they crossfade, so there is never a gap or a black frame). */
export const OVERLAP = 14
/** Frames a scene holds after its narration ends, before the next one takes over. */
const TAIL = 6

export type SceneId = keyof typeof audio.vo
type Word = [string, number, number]

/** Order of scenes, how long each waits before the narrator speaks, and a minimum length for scenes that need room to breathe. */
const ORDER: { id: SceneId; lead: number; min?: number }[] = [
  { id: 'hook', lead: 36 },
  { id: 'question', lead: 4 },
  { id: 'title', lead: 40 },
  { id: 'whenHow', lead: 4 },
  { id: 'pipeline', lead: 6 },
  { id: 'cron', lead: 6 },
  { id: 'toolsBuiltIn', lead: 4 },
  { id: 'toolsScale', lead: 4 },
  { id: 'fiveIdeas', lead: 4 },
  { id: 'orbit', lead: 4 },
  { id: 'habits', lead: 4 },
  { id: 'site', lead: 4 },
  { id: 'end', lead: 6, min: 120 },
]

export interface SceneTiming {
  id: SceneId
  from: number
  duration: number
  lead: number
  voFrames: number
  words: Word[]
}

export const TIMELINE: SceneTiming[] = []
{
  let from = 0
  for (const { id, lead, min = 0 } of ORDER) {
    const vo = audio.vo[id]
    const voFrames = Math.ceil(vo.duration * FPS)
    const duration = Math.max(min, lead + voFrames + TAIL + OVERLAP)
    TIMELINE.push({ id, from, duration, lead, voFrames, words: vo.words as Word[] })
    from += duration - OVERLAP
  }
}

const last = TIMELINE[TIMELINE.length - 1]
export const TOTAL_FRAMES = last.from + last.duration

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Returns the scene-relative frame at which the narrator starts saying `word` (the nth time). */
export type Cue = (word: string, nth?: number) => number

export function makeCue(t: SceneTiming): Cue {
  return (word, nth = 0) => {
    const target = norm(word)
    const hits = t.words.filter(([w]) => norm(w) === target)
    const hit = hits[nth]
    if (!hit) {
      console.warn(`[intro] cue "${word}" #${nth} not found in scene ${t.id}`)
      return t.lead
    }
    return t.lead + Math.round(hit[1] * FPS)
  }
}
