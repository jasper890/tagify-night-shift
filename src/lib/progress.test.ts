import { afterEach, describe, expect, it, vi } from 'vitest'
import { readProgress, withDemoQuizAnswer, withDemoStepToggled, type Progress } from './progress'

// The tests run in Node, so give readProgress a pretend localStorage.
const savedAs = (raw: string | null) => vi.stubGlobal('window', { localStorage: { getItem: () => raw } })
afterEach(() => vi.unstubAllGlobals())

const base: Progress = {
  lessons: [1],
  missions: ['phone'],
  terminal: { bash: 2 },
  stars: { 1: 3 },
  challenges: { nightly: 2 },
  cronDemo: { steps: [], quiz: [] },
}

describe('readProgress: cron demo record', () => {
  it('starts empty when nothing is saved', () => {
    savedAs(null)
    expect(readProgress().cronDemo).toEqual({ steps: [], quiz: [] })
  })

  it('adds an empty record to a save from before the cron demo existed', () => {
    savedAs(JSON.stringify({ lessons: [1, 2], missions: [], terminal: {}, stars: {}, challenges: {} }))
    const p = readProgress()
    expect(p.lessons).toEqual([1, 2])
    expect(p.cronDemo).toEqual({ steps: [], quiz: [] })
  })

  it('keeps saved steps and quiz answers', () => {
    savedAs(JSON.stringify({ ...base, cronDemo: { steps: ['script', 'schedule'], quiz: ['q1'] } }))
    expect(readProgress().cronDemo).toEqual({ steps: ['script', 'schedule'], quiz: ['q1'] })
  })

  it('drops damaged entries instead of crashing', () => {
    savedAs(JSON.stringify({ ...base, cronDemo: { steps: ['script', 3, null], quiz: 'oops' } }))
    expect(readProgress().cronDemo).toEqual({ steps: ['script'], quiz: [] })
  })

  it('still works when the browser blocks storage', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked')
        },
      },
    })
    expect(readProgress().cronDemo).toEqual({ steps: [], quiz: [] })
  })
})

describe('withDemoStepToggled', () => {
  it('ticks a step and un-ticks it again', () => {
    const on = withDemoStepToggled(base, 'script')
    expect(on.cronDemo.steps).toEqual(['script'])
    expect(withDemoStepToggled(on, 'script').cronDemo.steps).toEqual([])
  })

  it('leaves the rest of the save alone', () => {
    const next = withDemoStepToggled(base, 'script')
    expect({ ...next, cronDemo: base.cronDemo }).toEqual(base)
  })
})

describe('withDemoQuizAnswer', () => {
  it('remembers a right answer once, however often it is repeated', () => {
    const once = withDemoQuizAnswer(base, 'q1')
    expect(withDemoQuizAnswer(once, 'q1').cronDemo.quiz).toEqual(['q1'])
  })

  it('keeps the steps and everything else', () => {
    const p = withDemoStepToggled(base, 'script')
    const next = withDemoQuizAnswer(p, 'q1')
    expect(next.cronDemo).toEqual({ steps: ['script'], quiz: ['q1'] })
    expect(next.lessons).toEqual([1])
  })
})
