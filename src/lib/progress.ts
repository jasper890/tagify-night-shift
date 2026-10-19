import { useEffect, useState } from 'react'

// Progress is saved only in this browser (localStorage). Nothing is sent anywhere.
const KEY = 'tsa-progress-v1'
const EVENT = 'tsa-progress-change'

export interface Progress {
  /** Lesson ids whose quiz was passed. */
  lessons: number[]
  /** Practice-lab mission ids marked done. */
  missions: string[]
  /** Terminal Lab: track id -> number of steps completed. */
  terminal: Record<string, number>
  /** Boss battles: lesson id -> best stars earned (1 to 3). */
  stars: Record<string, number>
  /** Cron Challenge: challenge id -> best stars earned (1 to 3). */
  challenges: Record<string, number>
}

const EMPTY: Progress = { lessons: [], missions: [], terminal: {}, stars: {}, challenges: {} }

export function readProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const p = JSON.parse(raw) as Partial<Progress>
    return {
      lessons: Array.isArray(p.lessons) ? p.lessons : [],
      missions: Array.isArray(p.missions) ? p.missions : [],
      terminal: p.terminal && typeof p.terminal === 'object' ? p.terminal : {},
      stars: p.stars && typeof p.stars === 'object' ? p.stars : {},
      challenges: p.challenges && typeof p.challenges === 'object' ? p.challenges : {},
    }
  } catch {
    return EMPTY
  }
}

function write(p: Progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage blocked: progress lasts only for this visit */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(readProgress)

  useEffect(() => {
    const sync = () => setProgress(readProgress())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const update = (fn: (p: Progress) => Progress) => {
    const next = fn(readProgress())
    setProgress(next)
    write(next)
  }

  return {
    progress,
    completeLesson: (id: number) => update((p) => (p.lessons.includes(id) ? p : { ...p, lessons: [...p.lessons, id] })),
    /** Clear a lesson's boss battle, keeping the best star rating. */
    winBattle: (id: number, stars: number) =>
      update((p) => ({
        ...p,
        lessons: p.lessons.includes(id) ? p.lessons : [...p.lessons, id],
        stars: { ...p.stars, [id]: Math.max(p.stars[id] ?? 0, stars) },
      })),
    /** Solve a Cron Challenge, keeping the best star rating. */
    winChallenge: (id: string, stars: number) =>
      update((p) => ({ ...p, challenges: { ...p.challenges, [id]: Math.max(p.challenges[id] ?? 0, stars) } })),
    toggleMission: (id: string) =>
      update((p) => ({ ...p, missions: p.missions.includes(id) ? p.missions.filter((m) => m !== id) : [...p.missions, id] })),
    setTerminalStep: (track: string, steps: number) =>
      update((p) => ({ ...p, terminal: { ...p.terminal, [track]: Math.max(steps, 0) } })),
    resetTerminal: (track: string) => update((p) => ({ ...p, terminal: { ...p.terminal, [track]: 0 } })),
    reset: () => {
      // Also forget which level-up and badge popups were shown, so a new game shows them again.
      try {
        window.localStorage.removeItem('tsa-game-seen-v1')
      } catch {
        /* storage blocked */
      }
      update(() => EMPTY)
    },
  }
}
