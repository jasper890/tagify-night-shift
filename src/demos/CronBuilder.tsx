import { useMemo, useState } from 'react'
import { FaCalendarCheck, FaCheckCircle, FaExclamationTriangle, FaMagic, FaTimesCircle } from 'react-icons/fa'
import { DemoFrame, Segmented } from '../components/ui'
import { analyzeCron, describeSchedule, FIELD_SPECS, formatRun, nextRuns, splitCronLine, type FieldKey, type TimeMode } from '../lib/cron'

const PRESETS = [
  { expr: '*/15 * * * *', label: 'Every 15 minutes' },
  { expr: '0 * * * *', label: 'Every hour' },
  { expr: '0 2 * * *', label: 'Every day at 2:00 AM' },
  { expr: '30 18 * * 1-5', label: 'Weekdays at 6:30 PM' },
  { expr: '0 3 * * 0', label: 'Sundays at 3:00 AM' },
  { expr: '0 0 1 * *', label: 'First day of every month' },
]

const MISTAKES = [
  { expr: '* 2 * * *', label: 'The big mistake' },
  { expr: '0 0 1 * 1', label: 'Day + weekday' },
  { expr: '0 24 * * *', label: 'Hour 24' },
]

const BOX_COLORS: Record<FieldKey | 'command', string> = {
  minute: 'bg-amber text-navy',
  hour: 'bg-teal text-white',
  dom: 'bg-slate text-white',
  month: 'bg-navy text-white',
  dow: 'bg-[#5b4a8a] text-white',
  command: 'bg-card text-navy border border-line-strong',
}

const QUICK_VALUES: Record<FieldKey, string[]> = {
  minute: ['*', '0', '15', '30', '45', '*/5', '*/10', '*/15'],
  hour: ['*', '0', '1', '2', '3', '6', '12', '18', '*/2', '9-17'],
  dom: ['*', '1', '15', '28', '1,15'],
  month: ['*', '1', '6', '12', '1-6', '*/3'],
  dow: ['*', '0', '1', '5', '6', '1-5', '0,6'],
}

const DEFAULT_COMMAND = '/home/student/lab/backup.sh'

export function CronBuilder({ initial = `30 18 * * 1-5 ${DEFAULT_COMMAND}` }: { initial?: string }) {
  const [line, setLine] = useState(initial)
  const [mode, setMode] = useState<TimeMode>('local')

  const analysis = useMemo(() => analyzeCron(line), [line])
  const parts = analysis.parts ?? splitCronLine('* * * * *')!
  const meaning = analysis.valid && analysis.schedule ? describeSchedule(analysis.schedule) : null
  const runs = useMemo(
    () => (analysis.valid && analysis.schedule ? nextRuns(analysis.schedule, 5, mode) : []),
    [analysis.valid, analysis.schedule, mode],
  )

  const setField = (key: FieldKey | 'command', value: string) => {
    const next = { ...parts, [key]: value.replace(/\s+/g, key === 'command' ? ' ' : '') }
    const fields = [next.minute, next.hour, next.dom, next.month, next.dow].map((v) => v || '*')
    setLine([...fields, next.command].join(' ').trim())
  }

  const applyPreset = (expr: string) => {
    setLine(`${expr} ${parts.command || DEFAULT_COMMAND}`)
  }

  const errors = analysis.issues.filter((i) => i.severity === 'error')
  const warnings = analysis.issues.filter((i) => i.severity === 'warning')

  return (
    <DemoFrame
      title="Cron Explainer & Builder"
      icon={FaCalendarCheck}
      hint={
        <>
          Type a crontab line, or edit the five fields below. Try the big mistake: <code className="inline-code">* 2 * * *</code>.
        </>
      }
    >
      <label htmlFor="cron-line" className="text-sm font-bold text-navy">
        crontab line (five time fields, then the command)
      </label>
      <input
        id="cron-line"
        className="field-input mt-1 w-full font-mono text-lg"
        value={line}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setLine(e.target.value)}
        aria-describedby="cron-meaning"
      />

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Presets from slide 12">
        {PRESETS.map((p) => (
          <button key={p.expr} type="button" className="btn btn-ghost font-mono text-xs" onClick={() => applyPreset(p.expr)} title={p.label}>
            {p.expr}
          </button>
        ))}
        {MISTAKES.map((p) => (
          <button
            key={p.expr}
            type="button"
            className="btn border border-danger/50 bg-danger-soft font-mono text-xs text-danger-dark hover:border-danger"
            onClick={() => applyPreset(p.expr)}
            title={p.label}
          >
            {p.expr}
          </button>
        ))}
      </div>

      {/* Colored field boxes like slide 11 */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {FIELD_SPECS.map((spec) => (
          <div key={spec.key} className={`rounded-xl p-3 ${BOX_COLORS[spec.key]}`}>
            <label htmlFor={`f-${spec.key}`} className="block text-xs font-bold uppercase opacity-90">
              {spec.label}
            </label>
            <input
              id={`f-${spec.key}`}
              list={`list-${spec.key}`}
              className="mt-1 w-full rounded-md border-0 bg-white/95 px-2 py-1 text-center font-mono text-xl font-bold text-navy"
              value={parts[spec.key]}
              spellCheck={false}
              onChange={(e) => setField(spec.key, e.target.value)}
            />
            <datalist id={`list-${spec.key}`}>
              {QUICK_VALUES[spec.key].map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <span className="mt-1 block text-center text-xs opacity-90">{spec.rangeText}</span>
          </div>
        ))}
        <div className={`col-span-2 rounded-xl p-3 sm:col-span-3 lg:col-span-1 ${BOX_COLORS.command}`}>
          <label htmlFor="f-command" className="block text-xs font-bold uppercase">
            command
          </label>
          <input
            id="f-command"
            className="mt-1 w-full rounded-md border border-line-strong bg-white px-2 py-1 font-mono text-sm"
            value={parts.command}
            spellCheck={false}
            onChange={(e) => setField('command', e.target.value)}
          />
          <span className="mt-1 block text-center text-xs">use the full path</span>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink/75">
        <code className="inline-code">*</code> means “every” · <code className="inline-code">,</code> makes a list ·{' '}
        <code className="inline-code">-</code> makes a range · <code className="inline-code">/</code> means “every so many”
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-navy p-4 text-white" id="cron-meaning" aria-live="polite">
          <p className="text-xs font-bold tracking-[0.14em] text-amber uppercase">Meaning</p>
          {meaning ? (
            <p className="mt-1 text-xl font-bold">{meaning}</p>
          ) : (
            <p className="mt-1 text-lg text-white/80">Fix the errors below to see the meaning.</p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold tracking-[0.14em] text-amber uppercase">Next 5 runs</p>
            <div className="text-navy">
              <Segmented
                label="Time zone"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'local', label: 'Local' },
                  { value: 'utc', label: 'UTC' },
                ]}
              />
            </div>
          </div>
          <ol className="mt-2 space-y-1 font-mono text-sm">
            {runs.length ? (
              runs.map((d, i) => (
                <li key={d.toISOString()} className="flex gap-2">
                  <span className="text-amber">{i + 1}.</span> {formatRun(d, mode)}
                </li>
              ))
            ) : (
              <li className="text-white/70">—</li>
            )}
          </ol>
        </div>

        <div aria-live="polite">
          <p className="kicker">Mistake detector</p>
          {analysis.issues.length === 0 ? (
            <p className="mt-2 flex items-center gap-2 rounded-xl border border-ok/40 bg-teal-soft p-3 font-bold text-ok">
              <FaCheckCircle aria-hidden /> Looks good. No common mistakes found.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {[...errors, ...warnings].map((issue) => (
                <li
                  key={issue.id + issue.message}
                  className={`rounded-xl border p-3 ${issue.severity === 'error' ? 'border-danger/50 bg-danger-soft' : 'border-amber/70 bg-amber-soft'}`}
                >
                  <p className={`flex items-start gap-2 ${issue.severity === 'error' ? 'text-danger-dark' : 'text-amber-dark'}`}>
                    {issue.severity === 'error' ? (
                      <FaTimesCircle className="mt-1 shrink-0" aria-hidden />
                    ) : (
                      <FaExclamationTriangle className="mt-1 shrink-0" aria-hidden />
                    )}
                    <span className="font-bold">{issue.severity === 'error' ? 'Error' : 'Warning'}</span>
                  </p>
                  <p className="mt-1 text-ink">{issue.message}</p>
                  {issue.suggestion ? (
                    <button type="button" className="btn btn-primary mt-2 text-xs" onClick={() => applyPreset(issue.suggestion!)}>
                      <FaMagic aria-hidden /> Fix it: use <span className="font-mono">{issue.suggestion}</span>
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DemoFrame>
  )
}
