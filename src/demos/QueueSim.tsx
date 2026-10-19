import { useMemo, useState } from 'react'
import { FaStream } from 'react-icons/fa'
import { DemoFrame } from '../components/ui'
import { simulateQueue, type QueuePolicy, type SimRun } from '../lib/queue'

const HORIZON = 60

const POLICIES: { value: QueuePolicy; label: string; plain: string; names: string[] }[] = [
  {
    value: 'parallel',
    label: 'Run in parallel',
    plain: 'Start a new copy even if the last one is still running. Copies can clash.',
    names: [
      'Task Scheduler: “If the task is already running” → Run a new instance in parallel',
      'Linux cron: the default (cron never checks)',
      'Kubernetes: concurrencyPolicy: Allow (the default)',
    ],
  },
  {
    value: 'queue',
    label: 'Queue',
    plain: 'Wait in line until the last copy finishes, then start. Nothing clashes, but runs drift later.',
    names: [
      'Task Scheduler: “If the task is already running” → Queue a new instance',
      'Linux: flock /tmp/job.lock command (without -n, it waits)',
      'GitHub Actions: concurrency: with cancel-in-progress: false (keeps at most one run waiting)',
    ],
  },
  {
    value: 'skip',
    label: 'Skip if running',
    plain: 'If the last copy is still busy, skip this turn and try again next time.',
    names: [
      'Task Scheduler: “If the task is already running” → Do not start a new instance (the default)',
      'Linux: flock -n /tmp/job.lock command',
      'Kubernetes: concurrencyPolicy: Forbid',
    ],
  },
]

/** Put each run on the first lane that is free, so parallel copies stack up visibly. */
function assignLanes(runs: SimRun[]): number[] {
  const laneEnds: number[] = []
  return runs.map((r) => {
    if (r.start === null || r.end === null) return 0
    let lane = laneEnds.findIndex((end) => end <= r.start!)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(r.end)
    } else {
      laneEnds[lane] = r.end
    }
    return lane
  })
}

export function QueueSim({ initialInterval = 5, initialDuration = 8 }: { initialInterval?: number; initialDuration?: number }) {
  const [interval, setIntervalMin] = useState(initialInterval)
  const [duration, setDuration] = useState(initialDuration)
  const [policy, setPolicy] = useState<QueuePolicy>('parallel')

  const result = useMemo(() => simulateQueue(interval, duration, policy, HORIZON), [interval, duration, policy])
  const lanes = useMemo(() => assignLanes(result.runs), [result])
  const laneCount = Math.max(1, ...lanes.map((l) => l + 1))
  const current = POLICIES.find((p) => p.value === policy)!
  const pct = (m: number) => `${(Math.min(m, HORIZON) / HORIZON) * 100}%`

  return (
    <DemoFrame
      title="Job Queue / Overlap Simulator"
      icon={FaStream}
      hint="What happens when a job takes longer than the gap between runs? Try a 5-minute interval with an 8-minute job."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="q-interval" className="flex justify-between font-bold text-navy">
            <span>Runs every</span>
            <span className="text-teal">{interval} min</span>
          </label>
          <input id="q-interval" type="range" min={1} max={30} value={interval} onChange={(e) => setIntervalMin(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <label htmlFor="q-duration" className="flex justify-between font-bold text-navy">
            <span>Each run takes</span>
            <span className="text-teal">{duration} min</span>
          </label>
          <input id="q-duration" type="range" min={1} max={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full" />
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="font-bold text-navy">If the job is still running when the next run is due…</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {POLICIES.map((p) => (
            <label
              key={p.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 font-bold ${
                policy === p.value ? 'border-navy bg-navy text-white' : 'border-line-strong bg-white text-navy'
              }`}
            >
              <input type="radio" name="policy" value={p.value} checked={policy === p.value} onChange={() => setPolicy(p.value)} className="accent-amber" />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Timeline */}
      <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Job timeline (scrolls sideways)">
        <div className="min-w-[560px]">
          <div className="relative h-6 text-xs text-ink/70" aria-hidden>
            {[0, 10, 20, 30, 40, 50, 60].map((m) => (
              <span key={m} className="absolute -translate-x-1/2" style={{ left: pct(m) }}>
                {m === 60 ? '60 min' : `:${String(m).padStart(2, '0')}`}
              </span>
            ))}
          </div>
          <div
            className="relative rounded-lg border border-line bg-card"
            style={{ height: `${laneCount * 34 + 30}px` }}
            role="img"
            aria-label={`Timeline: ${result.runs.length} triggers, ${result.overlaps} overlaps, ${result.skipped} skipped, ${result.delayed} delayed.`}
          >
            {[10, 20, 30, 40, 50].map((m) => (
              <span key={m} className="absolute top-0 bottom-0 border-l border-dashed border-line-strong" style={{ left: pct(m) }} aria-hidden />
            ))}
            {/* trigger ticks */}
            {result.runs.map((r, i) => (
              <span
                key={`t${i}`}
                className={`absolute bottom-0 h-5 w-0.5 ${r.status === 'skipped' ? 'bg-muted' : 'bg-navy'}`}
                style={{ left: pct(r.triggeredAt) }}
                aria-hidden
              >
                {r.status === 'skipped' ? (
                  <span className="absolute bottom-5 -translate-x-1/2 text-xs font-bold text-ink/70">✕</span>
                ) : null}
              </span>
            ))}
            {result.runs.map((r, i) => {
              if (r.start === null || r.end === null || r.start >= HORIZON) return null
              const color = r.status === 'overlap' ? 'bg-danger text-white' : r.status === 'delayed' ? 'bg-amber text-navy' : 'bg-teal text-white'
              return (
                <div key={i}>
                  {r.status === 'delayed' ? (
                    <span
                      className="absolute h-0 border-t-2 border-dotted border-amber-dark"
                      style={{ left: pct(r.triggeredAt), width: `calc(${pct(r.start)} - ${pct(r.triggeredAt)})`, top: `${lanes[i] * 34 + 18}px` }}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`absolute flex h-7 items-center overflow-hidden rounded-md px-1.5 text-xs font-bold whitespace-nowrap ${color} ${r.end > HORIZON ? 'rounded-r-none' : ''}`}
                    style={{ left: pct(r.start), width: `calc(${pct(r.end)} - ${pct(r.start)} - 2px)`, top: `${lanes[i] * 34 + 4}px` }}
                    title={`Run ${i + 1}: triggered :${r.triggeredAt}, ran :${r.start}–:${r.end}${r.status === 'overlap' ? ' (overlap!)' : ''}`}
                  >
                    #{i + 1}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink/80">
            <span className="flex items-center gap-1"><span className="h-3 w-5 rounded bg-teal" /> ran normally</span>
            <span className="flex items-center gap-1"><span className="h-3 w-5 rounded bg-danger" /> overlap (two copies at once)</span>
            <span className="flex items-center gap-1"><span className="h-3 w-5 rounded bg-amber" /> waited in the queue</span>
            <span className="flex items-center gap-1"><span className="font-bold">✕</span> skipped</span>
            <span className="flex items-center gap-1"><span className="h-3 w-0.5 bg-navy" /> trigger</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4" aria-live="polite">
        <Stat label="Triggers in 1 hour" value={result.runs.length} />
        <Stat label="Overlaps" value={result.overlaps} danger={result.overlaps > 0} />
        <Stat label="Skipped" value={result.skipped} />
        <Stat label="Waited in queue" value={result.delayed} />
      </div>

      <div className="mt-4 rounded-xl bg-navy p-4 text-white">
        <p className="font-bold text-amber">{current.label}</p>
        <p className="mt-1">{current.plain}</p>
        {policy === 'queue' && result.delayed > 0 && duration > interval ? (
          <p className="mt-2 text-sm text-white/85">
            Careful: the job is slower than the interval, so the line keeps growing. A queue only helps if most runs finish in time.
          </p>
        ) : null}
        <p className="mt-3 text-xs font-bold tracking-[0.14em] text-amber uppercase">Real names for this policy</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
          {current.names.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </DemoFrame>
  )
}

function Stat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${danger ? 'bg-danger text-white' : 'bg-card text-navy'}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-bold uppercase">{label}</p>
    </div>
  )
}
