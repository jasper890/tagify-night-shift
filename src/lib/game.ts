// Game layer on top of the saved progress: XP, player level, stars and achievements.
// Everything here is derived from Progress, so nothing new is stored except what the
// player has already been shown (see GameEvents).
import type { IconType } from 'react-icons'
import { FaBolt, FaHdd, FaCrown, FaDragon, FaDungeon, FaFlagCheckered, FaGem, FaKey, FaMap, FaMoon, FaScroll, FaStar, FaTerminal, FaWindows } from 'react-icons/fa'
import { LESSONS } from '../data/lessons'
import { MISSIONS } from '../data/missions'
import { CRON_CHALLENGES } from '../data/cronChallenges'
import type { Progress } from './progress'

export const XP = { lesson: 100, star: 25, mission: 40, terminalStep: 10, challenge: 30 } as const
export const MAX_HEARTS = 3

/** Steps in each Terminal Lab track. Kept here so the header does not load the terminal engine; a test keeps it in sync with TRACKS. */
export const TRACK_STEPS: Record<string, number> = {
  bash: 8,
  cron: 9,
  cleanup: 7,
  windows: 11,
  ansible: 12,
  'github-actions': 9,
}

/** Stars for a won battle: one per heart left, at least one. */
export const starsFor = (heartsLeft: number) => Math.max(1, Math.min(MAX_HEARTS, heartsLeft))

export const terminalSteps = (p: Progress) =>
  Object.entries(TRACK_STEPS).reduce((sum, [id, total]) => sum + Math.min(p.terminal[id] ?? 0, total), 0)

export const totalStars = (p: Progress) => LESSONS.reduce((sum, l) => sum + (p.lessons.includes(l.id) ? Math.max(1, p.stars[l.id] ?? 1) : 0), 0)

export const missionsDone = (p: Progress) => MISSIONS.filter((m) => p.missions.includes(m.id)).length

export const challengesSolved = (p: Progress) => CRON_CHALLENGES.filter((c) => (p.challenges?.[c.id] ?? 0) > 0).length

export function xpFor(p: Progress): number {
  const cleared = LESSONS.filter((l) => p.lessons.includes(l.id)).length
  return cleared * XP.lesson + totalStars(p) * XP.star + missionsDone(p) * XP.mission + terminalSteps(p) * XP.terminalStep + challengesSolved(p) * XP.challenge
}

export const TITLES = [
  'Intern',
  'Help Desk Hero',
  'Script Apprentice',
  'Cron Wrangler',
  'Junior Sysadmin',
  'Automation Knight',
  'Pipeline Mage',
  'Night Shift Legend',
]

export const MAX_LEVEL = TITLES.length

/** Total XP needed to reach a level: 0, 80, 240, 480, 800… Level 8 needs almost everything done. */
export const xpForLevel = (level: number) => 40 * level * (level - 1)

export function levelFor(xp: number) {
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++
  const floor = xpForLevel(level)
  const max = level === MAX_LEVEL
  const span = max ? 1 : xpForLevel(level + 1) - floor
  return {
    level,
    title: TITLES[level - 1],
    max,
    /** XP earned inside the current level. */
    into: max ? span : xp - floor,
    /** XP the current level spans. */
    span,
  }
}

export interface Achievement {
  id: string
  name: string
  desc: string
  icon: IconType
  unlocked: (p: Progress) => boolean
}

const cleared = (p: Progress, id: number) => p.lessons.includes(id)
const trackDone = (p: Progress, id: string) => (p.terminal[id] ?? 0) >= TRACK_STEPS[id]

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-clear', name: 'First Victory', desc: 'Defeat your first boss.', icon: FaFlagCheckered, unlocked: (p) => p.lessons.length > 0 },
  { id: 'flawless', name: 'Flawless', desc: 'Win a boss battle without losing a heart.', icon: FaGem, unlocked: (p) => Object.values(p.stars).some((s) => s >= 3) },
  { id: 'windows', name: 'Window Cleaner', desc: 'Clear Stage 3: Windows Task Scheduler.', icon: FaWindows, unlocked: (p) => cleared(p, 3) },
  { id: 'cron', name: 'Time Lord', desc: 'Clear Stage 4: Linux cron and at.', icon: FaMoon, unlocked: (p) => cleared(p, 4) },
  { id: 'halfway', name: 'Halfway There', desc: 'Clear 4 stages.', icon: FaMap, unlocked: (p) => p.lessons.length >= 4 },
  { id: 'all-clear', name: 'Dragon Slayer', desc: 'Clear all 8 stages.', icon: FaDragon, unlocked: (p) => LESSONS.every((l) => cleared(p, l.id)) },
  { id: 'perfect', name: 'Perfectionist', desc: 'Earn 3 stars on every stage.', icon: FaCrown, unlocked: (p) => LESSONS.every((l) => (p.stars[l.id] ?? 0) >= 3) },
  { id: 'side-quest', name: 'Side Quester', desc: 'Finish a Practice Lab mission.', icon: FaScroll, unlocked: (p) => missionsDone(p) > 0 },
  { id: 'all-missions', name: 'Quest Completionist', desc: 'Finish every Practice Lab mission.', icon: FaStar, unlocked: (p) => missionsDone(p) === MISSIONS.length },
  { id: 'hello-shell', name: 'Hello, Shell', desc: 'Complete a step in the Terminal Lab.', icon: FaTerminal, unlocked: (p) => terminalSteps(p) > 0 },
  { id: 'dungeon', name: 'Dungeon Cleared', desc: 'Finish a whole Terminal Lab track.', icon: FaDungeon, unlocked: (p) => Object.keys(TRACK_STEPS).some((id) => trackDone(p, id)) },
  { id: 'root', name: 'Root Access', desc: 'Finish every Terminal Lab track.', icon: FaKey, unlocked: (p) => Object.keys(TRACK_STEPS).every((id) => trackDone(p, id)) },
  { id: 'backup-hero', name: 'Backup Hero', desc: 'Solve every Cron Challenge.', icon: FaHdd, unlocked: (p) => challengesSolved(p) === CRON_CHALLENGES.length },
  { id: 'level-5', name: 'Power Surge', desc: 'Reach level 5.', icon: FaBolt, unlocked: (p) => levelFor(xpFor(p)).level >= 5 },
]

export const unlockedAchievements = (p: Progress) => ACHIEVEMENTS.filter((a) => a.unlocked(p)).map((a) => a.id)

/** Stage the player should play next: the first one not cleared yet. */
export const currentStage = (p: Progress) => LESSONS.find((l) => !p.lessons.includes(l.id)) ?? null
