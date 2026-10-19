import { describe, expect, it } from 'vitest'
import { TRACKS } from '../terminal/tracks'
import { SPRITES } from '../components/pixel/sprites'
import { BOSSES } from '../data/bosses'
import { LESSONS } from '../data/lessons'
import { MISSIONS } from '../data/missions'
import { CRON_CHALLENGES } from '../data/cronChallenges'
import type { Progress } from './progress'
import { ACHIEVEMENTS, MAX_LEVEL, TRACK_STEPS, XP, currentStage, levelFor, starsFor, totalStars, unlockedAchievements, xpFor, xpForLevel } from './game'

const empty: Progress = { lessons: [], missions: [], terminal: {}, stars: {}, challenges: {} }

describe('game data', () => {
  it('keeps TRACK_STEPS in sync with the Terminal Lab tracks', () => {
    expect(TRACK_STEPS).toEqual(Object.fromEntries(TRACKS.map((t) => [t.id, t.steps.length])))
  })

  it('has one boss per lesson, each with a real sprite', () => {
    expect(BOSSES.map((b) => b.lesson)).toEqual(LESSONS.map((l) => l.id))
    for (const b of BOSSES) expect(SPRITES[b.sprite]).toBeDefined()
  })

  it('draws every sprite on a 16x16 grid with known colors', () => {
    for (const [id, s] of Object.entries(SPRITES)) {
      expect(s.rows, id).toHaveLength(16)
      for (const row of s.rows) {
        expect(row, `${id}: "${row}"`).toHaveLength(16)
        for (const c of row) if (c !== '.') expect(s.palette[c], `${id} uses "${c}"`).toBeDefined()
      }
    }
  })

  it('gives every achievement a unique id', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
  })
})

describe('XP and levels', () => {
  it('starts a new player at level 1 with no XP', () => {
    expect(xpFor(empty)).toBe(0)
    expect(levelFor(0)).toMatchObject({ level: 1, title: 'Intern', into: 0, span: 80, max: false })
  })

  it('uses growing level thresholds', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 80, 240, 480, 800])
    expect(levelFor(79).level).toBe(1)
    expect(levelFor(80).level).toBe(2)
    expect(levelFor(300)).toMatchObject({ level: 3, into: 60, span: 240 })
  })

  it('adds XP for stages, stars, missions and terminal steps', () => {
    const p: Progress = { lessons: [1, 2], missions: ['phone'], terminal: { bash: 3 }, stars: { 1: 3, 2: 1 }, challenges: { nightly: 2, nope: 3 } }
    expect(totalStars(p)).toBe(4)
    expect(xpFor(p)).toBe(2 * XP.lesson + 4 * XP.star + XP.mission + 3 * XP.terminalStep + XP.challenge)
  })

  it('counts an old save without stars as one star per cleared stage', () => {
    expect(totalStars({ ...empty, lessons: [1, 4] })).toBe(2)
  })

  it('ignores unknown missions and steps beyond a track', () => {
    const p: Progress = { ...empty, missions: ['nope'], terminal: { bash: 999, nope: 5 } }
    expect(xpFor(p)).toBe(TRACK_STEPS.bash * XP.terminalStep)
  })

  it('makes the top level reachable and caps it there', () => {
    const all: Progress = {
      lessons: LESSONS.map((l) => l.id),
      missions: MISSIONS.map((m) => m.id),
      terminal: { ...TRACK_STEPS },
      stars: Object.fromEntries(LESSONS.map((l) => [l.id, 3])),
      challenges: Object.fromEntries(CRON_CHALLENGES.map((c) => [c.id, 3])),
    }
    expect(levelFor(xpFor(all))).toMatchObject({ level: MAX_LEVEL, title: 'Night Shift Legend', max: true })
    expect(levelFor(99999).level).toBe(MAX_LEVEL)
  })

  it('rates a battle by hearts left', () => {
    expect([3, 2, 1, 0].map(starsFor)).toEqual([3, 2, 1, 1])
  })
})

describe('achievements and stages', () => {
  it('unlocks nothing for a new player', () => {
    expect(unlockedAchievements(empty)).toEqual([])
  })

  it('unlocks the right badges as the player progresses', () => {
    const p: Progress = { lessons: [3, 4], missions: [], terminal: {}, stars: { 3: 3, 4: 2 }, challenges: {} }
    expect(unlockedAchievements(p)).toEqual(['first-clear', 'flawless', 'windows', 'cron'])
    const shell: Progress = { ...empty, terminal: { bash: TRACK_STEPS.bash } }
    expect(unlockedAchievements(shell)).toEqual(['hello-shell', 'dungeon'])
  })

  it('unlocks everything for a full playthrough', () => {
    const all: Progress = {
      lessons: LESSONS.map((l) => l.id),
      missions: MISSIONS.map((m) => m.id),
      terminal: { ...TRACK_STEPS },
      stars: Object.fromEntries(LESSONS.map((l) => [l.id, 3])),
      challenges: Object.fromEntries(CRON_CHALLENGES.map((c) => [c.id, 3])),
    }
    expect(unlockedAchievements(all)).toHaveLength(ACHIEVEMENTS.length)
    expect(currentStage(all)).toBeNull()
  })

  it('points to the first stage not cleared yet', () => {
    expect(currentStage(empty)?.id).toBe(1)
    expect(currentStage({ ...empty, lessons: [1, 2, 4] })?.id).toBe(3)
  })
})
