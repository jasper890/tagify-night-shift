import { Link } from 'react-router-dom'
import { FaArrowRight, FaCheckCircle, FaFlask, FaLightbulb, FaRedo, FaRegCircle } from 'react-icons/fa'
import { Callout, PageHeader } from '../components/ui'
import { useProgress } from '../lib/progress'
import { MISSIONS } from '../data/missions'

export default function Practice() {
  const { progress, toggleMission, reset } = useProgress()
  const done = MISSIONS.filter((m) => progress.missions.includes(m.id)).length
  const pct = Math.round((done / MISSIONS.length) * 100)

  return (
    <>
      <PageHeader
        kicker="Learn by doing"
        title="Practice Lab"
        icon={FaFlask}
        intro="Hands-on missions using the simulators in each lesson. Everything is pretend and safe: no real commands run on your computer. Tick each mission when you finish it."
      />

      <div className="card flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-navy">
            {done} of {MISSIONS.length} missions done
          </p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Practice progress">
            <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <p className="text-sm text-ink/75">
          Lessons complete: <strong>{progress.lessons.length}/8</strong>
        </p>
        {done > 0 || progress.lessons.length > 0 ? (
          <button type="button" className="btn btn-ghost text-xs" onClick={reset}>
            <FaRedo aria-hidden /> Reset my progress
          </button>
        ) : null}
      </div>

      <ol className="mt-6 space-y-4">
        {MISSIONS.map((m, i) => {
          const isDone = progress.missions.includes(m.id)
          return (
            <li key={m.id} className={`rounded-2xl border-2 p-4 sm:p-5 ${isDone ? 'border-teal/50 bg-teal-soft' : 'border-line bg-white'}`}>
              <div className="flex flex-wrap items-start gap-3">
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${isDone ? 'bg-teal text-white' : 'bg-amber text-navy'}`}>
                  {isDone ? <FaCheckCircle aria-hidden /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl">{m.title}</h2>
                  <p className="text-sm font-bold text-teal">{m.pageLabel}</p>
                  <p className="mt-2">
                    <strong>Goal:</strong> {m.goal}
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    {m.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <p className="mt-2 rounded-lg bg-card p-3 text-[0.95rem]">
                    <strong>You got it if:</strong> {m.success}
                  </p>
                  {m.challenge ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-bold text-amber-dark">
                        <FaLightbulb className="mr-1 inline" aria-hidden /> Bonus challenge
                      </summary>
                      <p className="mt-1 pl-6">{m.challenge}</p>
                    </details>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to={m.page} className="btn btn-primary no-underline">
                      Open the simulator <FaArrowRight aria-hidden />
                    </Link>
                    <button type="button" className={`btn ${isDone ? 'btn-ghost' : 'bg-teal text-white hover:brightness-110'}`} aria-pressed={isDone} onClick={() => toggleMission(m.id)}>
                      {isDone ? <FaCheckCircle aria-hidden /> : <FaRegCircle aria-hidden />} {isDone ? 'Done (click to undo)' : 'Mark as done'}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <Callout tone="tip" title="Tip">
        Your ticks and quiz results are saved only in this browser, on this device. Nothing is sent anywhere, and there is no account to create.
      </Callout>
    </>
  )
}
