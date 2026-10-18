import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import audio from './audio.json'

// Every animation is cued on a word the narrator says (cue('cron')). If the narration in
// scripts/generate-audio.py changes, this test catches cues whose word is no longer spoken.

const DIR = fileURLToPath(new URL('.', import.meta.url))
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Scene component -> scene id, from the SCENES table in Intro.tsx.
const intro = readFileSync(join(DIR, 'Intro.tsx'), 'utf8')
const sceneOf = Object.fromEntries([...intro.matchAll(/(\w+): \{ c: (\w+),/g)].map((m) => [m[2], m[1]]))

// cue('word', n) calls inside each exported scene function.
const cues: { scene: string; word: string; nth: number }[] = []
for (const file of readdirSync(join(DIR, 'scenes'))) {
  const src = readFileSync(join(DIR, 'scenes', file), 'utf8')
  const parts = src.split(/^export function /m).slice(1)
  for (const part of parts) {
    const name = part.match(/^(\w+)/)![1]
    const scene = sceneOf[name]
    if (!scene) continue
    for (const m of part.matchAll(/cue\('([^']+)'(?:,\s*(\d+))?\)/g)) cues.push({ scene, word: m[1], nth: Number(m[2] ?? 0) })
    // Cues looked up from data tables, e.g. cue(t.word) or cue(fd.name[0], fd.name[1]), are checked through the tables below.
  }
}

// Words used through data tables in the scenes (word: '…' fields and [word, n] pairs).
for (const file of readdirSync(join(DIR, 'scenes'))) {
  const src = readFileSync(join(DIR, 'scenes', file), 'utf8')
  for (const m of src.matchAll(/word: '([^']+)'/g)) cues.push({ scene: '*', word: m[1], nth: 0 })
  for (const m of src.matchAll(/\['([a-z]+)', (\d+)\]/g)) cues.push({ scene: '*', word: m[1], nth: Number(m[2]) })
}

const vo = audio.vo as unknown as Record<string, { words: [string, number, number][] }>

describe('intro video cues', () => {
  it('finds the scenes and their cues', () => {
    expect(Object.keys(sceneOf).length).toBe(13)
    expect(cues.length).toBeGreaterThan(30)
  })

  it.each(cues)('"$word" (#$nth) is spoken in $scene', ({ scene, word, nth }) => {
    const target = norm(word)
    const scenes = scene === '*' ? Object.keys(vo) : [scene]
    const found = scenes.some((s) => vo[s].words.filter(([w]) => norm(w) === target).length > nth)
    expect(found).toBe(true)
  })
})
