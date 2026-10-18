import { useEffect, useRef, useState } from 'react'
import { FaBolt, FaCheck, FaClock, FaDownload, FaListOl, FaMobileAlt, FaPlay, FaRedo, FaTimes, FaWifi } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import { DemoFrame, Toggle } from '../components/ui'

interface Step {
  key: string
  concept: string
  question: string
  icon: IconType
}

const STEPS: Step[] = [
  { key: 'trigger', concept: 'Trigger', question: 'It is 2:00 AM', icon: FaClock },
  { key: 'condition', concept: 'Condition', question: 'Charging and on Wi-Fi?', icon: FaWifi },
  { key: 'dependency', concept: 'Dependency', question: 'Download finished?', icon: FaDownload },
  { key: 'queue', concept: 'Queue', question: 'No other update running?', icon: FaListOl },
  { key: 'run', concept: 'Run', question: 'Install the update', icon: FaPlay },
]

type StepState = 'idle' | 'pass' | 'fail' | 'active'

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function PhoneUpdateSim() {
  const [charging, setCharging] = useState(true)
  const [wifi, setWifi] = useState(true)
  const [downloaded, setDownloaded] = useState(true)
  const [otherRunning, setOtherRunning] = useState(false)
  const [states, setStates] = useState<StepState[]>(STEPS.map(() => 'idle'))
  const [message, setMessage] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const reset = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setStates(STEPS.map(() => 'idle'))
    setMessage(null)
    setRunning(false)
  }

  const evaluate = (): { failAt: number | null; reason: string } => {
    if (!charging || !wifi) {
      const missing = [!charging && 'not charging', !wifi && 'not on Wi-Fi'].filter(Boolean).join(' and ')
      return {
        failAt: 1,
        reason: `Condition failed: the phone is ${missing}. The update waits for the next night. (Task Scheduler: "Start only if the computer is on AC power".)`,
      }
    }
    if (!downloaded) {
      return { failAt: 2, reason: 'Dependency failed: the download has not finished, so there is nothing to install yet. Job B waits for job A.' }
    }
    if (otherRunning) {
      return { failAt: 3, reason: 'Queue says wait: another update is already running. Jobs take turns so copies do not clash.' }
    }
    return { failAt: null, reason: 'Every check passed, so the update installs. Servers use the same logic.' }
  }

  const start = () => {
    reset()
    setRunning(true)
    const { failAt, reason } = evaluate()
    const last = failAt ?? STEPS.length - 1
    const delay = reducedMotion() ? 0 : 650
    for (let i = 0; i <= last; i++) {
      timers.current.push(
        window.setTimeout(() => {
          setStates((prev) => prev.map((s, j) => (j === i ? 'active' : s)))
        }, i * delay),
      )
      timers.current.push(
        window.setTimeout(() => {
          setStates((prev) => prev.map((s, j) => (j === i ? (i === failAt ? 'fail' : 'pass') : s)))
          if (i === last) {
            setMessage(reason)
            setRunning(false)
          }
        }, i * delay + delay * 0.8),
      )
    }
  }

  const outcome = states[states.length - 1] === 'pass' ? 'pass' : states.includes('fail') ? 'fail' : null

  return (
    <DemoFrame
      title="Phone Night-Update Simulator"
      icon={FaMobileAlt}
      hint="Set the phone’s situation, then press the 2:00 AM button. Try turning off Wi-Fi."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-2">
          <Toggle checked={charging} onChange={(v) => { setCharging(v); reset() }} label="Charging" description="Plugged into power" />
          <Toggle checked={wifi} onChange={(v) => { setWifi(v); reset() }} label="On Wi-Fi" description="Not using mobile data" />
          <Toggle checked={downloaded} onChange={(v) => { setDownloaded(v); reset() }} label="Download finished" description="The update file is ready" />
          <Toggle
            checked={otherRunning}
            onChange={(v) => { setOtherRunning(v); reset() }}
            label="Another update running"
            description="An app update is installing now"
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" className="btn btn-amber" onClick={start} disabled={running}>
              <FaBolt aria-hidden /> It’s 2:00 AM
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              <FaRedo aria-hidden /> Reset
            </button>
          </div>
        </div>

        <div>
          <ol className="grid gap-2 sm:grid-cols-5" aria-label="Update flow">
            {STEPS.map((step, i) => {
              const s = states[i]
              const Icon = step.icon
              const style =
                s === 'pass'
                  ? 'border-teal bg-teal-soft'
                  : s === 'fail'
                    ? 'border-danger bg-danger-soft'
                    : s === 'active'
                      ? 'border-amber bg-amber-soft'
                      : 'border-line bg-white'
              return (
                <li key={step.key} className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-colors sm:flex-col sm:text-center ${style}`}>
                  <span
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ${
                      s === 'fail' ? 'bg-danger text-white' : s === 'pass' ? 'bg-teal text-white' : 'bg-amber text-navy'
                    } ${s === 'active' ? 'pulse' : ''}`}
                    aria-hidden
                  >
                    {s === 'pass' ? <FaCheck /> : s === 'fail' ? <FaTimes /> : <Icon />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold tracking-wide text-teal uppercase">{step.concept}</span>
                    <span className="block text-sm font-bold text-navy">{step.question}</span>
                    <span className="sr-only">{s === 'idle' ? 'not checked' : s === 'active' ? 'checking' : s === 'pass' ? 'passed' : 'stopped here'}</span>
                  </span>
                </li>
              )
            })}
          </ol>
          <div aria-live="polite" className="mt-4 min-h-16">
            {message ? (
              <p
                className={`rounded-xl p-4 font-bold ${outcome === 'pass' ? 'bg-teal-soft text-teal' : 'bg-danger-soft text-danger-dark'}`}
              >
                {message}
              </p>
            ) : (
              <p className="rounded-xl bg-card p-4 text-ink/75">Press the 2:00 AM button to watch the checks happen in order.</p>
            )}
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
