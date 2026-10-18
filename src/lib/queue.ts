export type QueuePolicy = 'parallel' | 'queue' | 'skip'

export type RunStatus = 'ok' | 'overlap' | 'delayed' | 'skipped'

export interface SimRun {
  /** Minute the trigger fired. */
  triggeredAt: number
  /** Minute the job really started (null if skipped). */
  start: number | null
  end: number | null
  status: RunStatus
}

export interface SimResult {
  runs: SimRun[]
  overlaps: number
  skipped: number
  delayed: number
  maxRunning: number
}

/**
 * Simulate a job triggered every `intervalMin` minutes that runs for
 * `durationMin` minutes, over `horizonMin` minutes, with an overlap policy.
 */
export function simulateQueue(
  intervalMin: number,
  durationMin: number,
  policy: QueuePolicy,
  horizonMin = 60,
): SimResult {
  if (intervalMin <= 0) throw new Error('interval must be positive')
  const runs: SimRun[] = []
  let busyUntil = 0 // end of the last accepted run (queue and skip policies)

  for (let t = 0; t < horizonMin; t += intervalMin) {
    if (policy === 'parallel') {
      const overlapping = runs.some((r) => r.start !== null && r.end !== null && r.start <= t && t < r.end)
      runs.push({ triggeredAt: t, start: t, end: t + durationMin, status: overlapping ? 'overlap' : 'ok' })
    } else if (policy === 'skip') {
      if (t < busyUntil) {
        runs.push({ triggeredAt: t, start: null, end: null, status: 'skipped' })
      } else {
        runs.push({ triggeredAt: t, start: t, end: t + durationMin, status: 'ok' })
        busyUntil = t + durationMin
      }
    } else {
      const start = Math.max(t, busyUntil)
      runs.push({ triggeredAt: t, start, end: start + durationMin, status: start > t ? 'delayed' : 'ok' })
      busyUntil = start + durationMin
    }
  }

  let maxRunning = 0
  for (const r of runs) {
    if (r.start === null) continue
    const at = r.start
    const running = runs.filter((o) => o.start !== null && o.end !== null && o.start <= at && at < o.end).length
    maxRunning = Math.max(maxRunning, running)
  }

  return {
    runs,
    overlaps: runs.filter((r) => r.status === 'overlap').length,
    skipped: runs.filter((r) => r.status === 'skipped').length,
    delayed: runs.filter((r) => r.status === 'delayed').length,
    maxRunning,
  }
}
