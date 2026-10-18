import { describe, expect, it } from 'vitest'
import { simulateQueue } from './queue'

describe('job queue / overlap simulator', () => {
  it('has no overlap when the job is shorter than the interval', () => {
    const r = simulateQueue(5, 3, 'parallel')
    expect(r.runs).toHaveLength(12)
    expect(r.overlaps).toBe(0)
    expect(r.maxRunning).toBe(1)
  })

  it('shows overlaps in parallel mode for a 5-minute interval and 8-minute job', () => {
    const r = simulateQueue(5, 8, 'parallel')
    expect(r.runs[0].status).toBe('ok')
    expect(r.runs[1].status).toBe('overlap') // starts at 5 while run 0 is busy until 8
    expect(r.overlaps).toBe(11)
    expect(r.maxRunning).toBe(2)
  })

  it('skips runs while one is still running (flock -n / Forbid)', () => {
    const r = simulateQueue(5, 8, 'skip')
    expect(r.runs.map((x) => x.status).slice(0, 4)).toEqual(['ok', 'skipped', 'ok', 'skipped'])
    expect(r.overlaps).toBe(0)
    expect(r.maxRunning).toBe(1)
    expect(r.skipped).toBe(6)
  })

  it('queues runs so they never overlap but drift later', () => {
    const r = simulateQueue(5, 8, 'queue')
    expect(r.maxRunning).toBe(1)
    expect(r.runs[1].start).toBe(8)
    expect(r.runs[2].start).toBe(16)
    expect(r.delayed).toBe(11)
    for (let i = 1; i < r.runs.length; i++) {
      expect(r.runs[i].start!).toBeGreaterThanOrEqual(r.runs[i - 1].end!)
    }
  })

  it('treats a job ending exactly at the next trigger as no overlap', () => {
    expect(simulateQueue(10, 10, 'parallel').overlaps).toBe(0)
    expect(simulateQueue(10, 10, 'skip').skipped).toBe(0)
  })

  it('rejects a zero interval', () => {
    expect(() => simulateQueue(0, 5, 'queue')).toThrow()
  })
})
