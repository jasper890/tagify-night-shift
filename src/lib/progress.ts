import { useEffect, useState } from 'react'

// Progress is saved only in this browser (localStorage). Nothing is sent anywhere.
const KEY = 'tsa-progress-v1'
const EVENT = 'tsa-progress-change'

export interface CronDemoProgress {
  /** Cron & at demo: ids of the steps marked as done. */
  steps: string[]
  /** Cron & at demo: ids of the quiz questions answered right at least once (each pays XP once). */
  quiz: string[]
}

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
  /** Linux cron & at demo page: steps ticked and quiz questions answered. */
  cronDemo: CronDemoProgress
}

const EMPTY: Progress = { lessons: [], missions: [], terminal: {}, stars: {}, challenges: {}, cronDemo: { steps: [], quiz: [] } }

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

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
      cronDemo: { steps: strings(p.cronDemo?.steps), quiz: strings(p.cronDemo?.quiz) },
    }
  } catch {
    return EMPTY
  }
}

/** Tick a demo step, or un-tick it if it was already ticked. */
export const withDemoStepToggled = (p: Progress, id: string): Progress => ({
  ...p,
  cronDemo: { ...p.cronDemo, steps: p.cronDemo.steps.includes(id) ? p.cronDemo.steps.filter((s) => s !== id) : [...p.cronDemo.steps, id] },
})

/** Remember a right quiz answer. Repeating it changes nothing, so XP is paid once per question. */
export const withDemoQuizAnswer = (p: Progress, id: string): Progress =>
  p.cronDemo.quiz.includes(id) ? p : { ...p, cronDemo: { ...p.cronDemo, quiz: [...p.cronDemo.quiz, id] } }

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
    toggleDemoStep: (id: string) => update((p) => withDemoStepToggled(p, id)),
    answerDemoQuiz: (id: string) => update((p) => withDemoQuizAnswer(p, id)),
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
