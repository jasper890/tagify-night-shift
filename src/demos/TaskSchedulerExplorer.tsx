import { useMemo, useState, type ReactNode } from 'react'
import { FaExclamationTriangle, FaWindows } from 'react-icons/fa'
import { DemoFrame } from '../components/ui'
import { CodeBlock } from '../components/CodeBlock'

type TabKey = 'general' | 'triggers' | 'actions' | 'conditions' | 'settings' | 'history'

const TABS: { key: TabKey; label: string; question: string }[] = [
  { key: 'general', label: 'General', question: 'WHO runs it?' },
  { key: 'triggers', label: 'Triggers', question: 'WHEN does it run?' },
  { key: 'actions', label: 'Actions', question: 'WHAT does it run?' },
  { key: 'conditions', label: 'Conditions', question: 'ONLY IF…?' },
  { key: 'settings', label: 'Settings', question: 'WHAT IF IT FAILS?' },
  { key: 'history', label: 'History', question: 'DID IT RUN?' },
]

type Account = 'gmsa' | 'system' | 'user'
type TriggerType = 'daily' | 'weekly' | 'startup' | 'logon'
type Multi = 'IgnoreNew' | 'Parallel' | 'Queue' | 'StopExisting'

const ACCOUNTS: Record<Account, { label: string; ps: string; note: string }> = {
  gmsa: {
    label: 'LAB\\svc-report$ (group managed service account)',
    ps: "New-ScheduledTaskPrincipal -UserId 'LAB\\svc-report$' -LogonType Password",
    note: 'Best choice: a service account with only the rights this job needs. Windows manages its password, so nobody types or stores it.',
  },
  system: {
    label: 'SYSTEM',
    ps: "New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest",
    note: 'SYSTEM can do anything on this PC. That is far more power than a report job needs (see least privilege, Lesson 7).',
  },
  user: {
    label: 'LAB\\student (only when this user is logged on)',
    ps: "New-ScheduledTaskPrincipal -UserId 'LAB\\student' -LogonType Interactive",
    note: 'Runs only while the student is logged on. Fine for testing, but it will not run at 2 AM if nobody is logged on.',
  },
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const
const DAY_NAMES: Record<(typeof DAYS)[number], string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
}

function to12h(time: string) {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

export function TaskSchedulerExplorer() {
  const [tab, setTab] = useState<TabKey>('general')
  const [name, setName] = useState('NightlyReport')
  const [account, setAccount] = useState<Account>('gmsa')
  const [highest, setHighest] = useState(false)
  const [trigger, setTrigger] = useState<TriggerType>('daily')
  const [time, setTime] = useState('18:00')
  const [days, setDays] = useState<string[]>(['MON', 'WED', 'FRI'])
  const [script, setScript] = useState('C:\\Lab\\report.ps1')
  const [startIn, setStartIn] = useState('C:\\Lab')
  const [onlyIdle, setOnlyIdle] = useState(false)
  const [acPower, setAcPower] = useState(true)
  const [network, setNetwork] = useState(false)
  const [onDemand, setOnDemand] = useState(true)
  const [missed, setMissed] = useState(true)
  const [retry, setRetry] = useState(true)
  const [timeLimit, setTimeLimit] = useState(true)
  const [multi, setMulti] = useState<Multi>('IgnoreNew')

  const taskPath = `IT-Lab\\${name || 'MyTask'}`
  const args = `-NoProfile -ExecutionPolicy Bypass -File ${script}`

  const schtasks = useMemo(() => {
    const sc =
      trigger === 'daily'
        ? `/sc daily /st ${time}`
        : trigger === 'weekly'
          ? `/sc weekly /d ${(days.length ? days : ['MON']).join(',')} /st ${time}`
          : trigger === 'startup'
            ? '/sc onstart'
            : '/sc onlogon'
    const lines = [
      `:: ${name}: created from the mock dialog above`,
      `schtasks /create /tn "${taskPath}" ^`,
      `  /tr "powershell.exe ${args}" ^`,
      `  ${sc} ^`,
    ]
    if (account === 'system') lines.push('  /ru SYSTEM ^')
    if (account === 'user') lines.push('  /ru LAB\\student /it ^')
    if (highest) lines.push('  /rl HIGHEST ^')
    lines.push('  /f')
    const notes = [
      '',
      ':: schtasks cannot set "Start in", conditions, retries or',
      ':: "If the task is already running". Use PowerShell for those.',
    ]
    if (account === 'gmsa') {
      notes.push(':: schtasks cannot register a gMSA (it has no password to type);', ':: use the PowerShell version for the service account.')
    }
    return [...lines, ...notes, '', `schtasks /run /tn "${taskPath}"`, `schtasks /query /tn "${taskPath}" /v /fo list`].join('\n')
  }, [trigger, time, days, name, taskPath, args, account, highest])

  const powershell = useMemo(() => {
    const trig =
      trigger === 'daily'
        ? `New-ScheduledTaskTrigger -Daily -At '${time}'`
        : trigger === 'weekly'
          ? `New-ScheduledTaskTrigger -Weekly -DaysOfWeek ${(days.length ? days : ['MON']).map((d) => DAY_NAMES[d as keyof typeof DAY_NAMES]).join(',')} -At '${time}'`
          : trigger === 'startup'
            ? 'New-ScheduledTaskTrigger -AtStartup'
            : "New-ScheduledTaskTrigger -AtLogOn -User 'LAB\\student'"
    const settings: string[] = [`-MultipleInstances ${multi}`]
    if (missed) settings.push('-StartWhenAvailable')
    if (!acPower) settings.push('-AllowStartIfOnBatteries')
    if (onlyIdle) settings.push('-RunOnlyIfIdle')
    if (network) settings.push('-RunOnlyIfNetworkAvailable')
    if (!onDemand) settings.push('-DisallowDemandStart')
    if (retry) settings.push('-RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)')
    if (timeLimit) settings.push('-ExecutionTimeLimit (New-TimeSpan -Hours 1)')
    let principal = ACCOUNTS[account].ps
    if (highest && account !== 'system') principal += ' -RunLevel Highest'
    return [
      `# ${name}: created from the mock dialog above`,
      `$action    = New-ScheduledTaskAction -Execute 'powershell.exe' \``,
      `               -Argument '${args}' \``,
      `               -WorkingDirectory '${startIn || 'C:\\Windows\\System32'}'   # "Start in"`,
      `$trigger   = ${trig}`,
      `$settings  = New-ScheduledTaskSettingsSet ${settings.join(' `\n               ')}`,
      `$principal = ${principal}`,
      '',
      `Register-ScheduledTask -TaskName '${name || 'MyTask'}' -TaskPath '\\IT-Lab\\' \``,
      '  -Action $action -Trigger $trigger -Settings $settings -Principal $principal',
      '',
      `Start-ScheduledTask -TaskPath '\\IT-Lab\\' -TaskName '${name || 'MyTask'}'   # test it now`,
      `Get-ScheduledTaskInfo -TaskPath '\\IT-Lab\\' -TaskName '${name || 'MyTask'}'  # LastTaskResult`,
    ].join('\n')
  }, [trigger, time, days, multi, missed, acPower, onlyIdle, network, onDemand, retry, timeLimit, account, highest, name, args, startIn])

  const toggleDay = (d: string) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  const whenText =
    trigger === 'daily'
      ? `Every day at ${to12h(time)}`
      : trigger === 'weekly'
        ? `Every ${days.map((d) => DAY_NAMES[d as keyof typeof DAY_NAMES]).join(', ') || 'Monday'} at ${to12h(time)}`
        : trigger === 'startup'
          ? 'When the computer starts'
          : 'When LAB\\student logs on'

  return (
    <DemoFrame
      title="Task Scheduler Tab Explorer"
      icon={FaWindows}
      hint="A pretend “Create Task” window. Click each tab; change settings and watch the commands below update."
    >
      <div className="overflow-hidden rounded-lg border border-[#9aa7bf] bg-[#f3f3f3] font-[family-name:'Segoe_UI',system-ui,sans-serif] shadow">
        <div className="flex items-center justify-between bg-white px-3 py-1.5 text-sm">
          <span className="flex items-center gap-2">
            <FaWindows className="text-[#0067c0]" aria-hidden /> Create Task
          </span>
          <span className="text-ink/60" aria-hidden>
            ✕
          </span>
        </div>
        <div role="tablist" aria-label="Task Scheduler tabs" className="flex overflow-x-auto border-b border-[#c8c8c8] bg-[#f3f3f3] px-2 pt-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              id={`ts-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`ts-panel-${t.key}`}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => {
                const i = TABS.findIndex((x) => x.key === tab)
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  e.stopPropagation()
                  const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
                  setTab(next.key)
                  document.getElementById(`ts-tab-${next.key}`)?.focus()
                }
              }}
              tabIndex={tab === t.key ? 0 : -1}
              className={`-mb-px shrink-0 rounded-t border px-3 py-1.5 text-sm ${
                tab === t.key ? 'border-[#c8c8c8] border-b-white bg-white font-semibold text-ink' : 'border-transparent text-ink/80 hover:bg-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`ts-panel-${tab}`} aria-labelledby={`ts-tab-${tab}`} className="grid gap-4 bg-white p-4 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3 text-sm">
            {tab === 'general' && (
              <>
                <WinField label="Name:">
                  <input className="field-input w-full" value={name} onChange={(e) => setName(e.target.value.replace(/[\\/:*?"<>|]/g, ''))} />
                </WinField>
                <WinField label="Location:">
                  <span className="font-mono">\IT-Lab</span>
                </WinField>
                <WinField label="When running the task, use the following user account:">
                  <select className="field-input w-full" value={account} onChange={(e) => setAccount(e.target.value as Account)}>
                    {(Object.keys(ACCOUNTS) as Account[]).map((k) => (
                      <option key={k} value={k}>
                        {ACCOUNTS[k].label}
                      </option>
                    ))}
                  </select>
                </WinField>
                <p className="text-ink/80">
                  {account === 'user' ? '◉ Run only when user is logged on   ○ Run whether user is logged on or not' : '○ Run only when user is logged on   ◉ Run whether user is logged on or not'}
                </p>
                <WinCheck checked={highest} onChange={setHighest} label="Run with highest privileges" />
              </>
            )}
            {tab === 'triggers' && (
              <>
                <WinField label="Begin the task:">
                  <select className="field-input w-full" value={trigger} onChange={(e) => setTrigger(e.target.value as TriggerType)}>
                    <option value="daily">On a schedule: Daily</option>
                    <option value="weekly">On a schedule: Weekly</option>
                    <option value="startup">At startup</option>
                    <option value="logon">At log on</option>
                  </select>
                </WinField>
                {(trigger === 'daily' || trigger === 'weekly') && (
                  <WinField label="Start time:">
                    <input type="time" className="field-input" value={time} onChange={(e) => setTime(e.target.value || '18:00')} />
                  </WinField>
                )}
                {trigger === 'weekly' && (
                  <fieldset>
                    <legend className="font-semibold">Recur on:</legend>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {DAYS.map((d) => (
                        <label key={d} className="flex items-center gap-1">
                          <input type="checkbox" checked={days.includes(d)} onChange={() => toggleDay(d)} /> {DAY_NAMES[d]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <p className="rounded bg-card p-2">
                  <strong>Summary:</strong> {whenText}
                </p>
              </>
            )}
            {tab === 'actions' && (
              <>
                <WinField label="Action:">
                  <span>Start a program</span>
                </WinField>
                <WinField label="Program/script:">
                  <span className="font-mono">powershell.exe</span>
                </WinField>
                <WinField label="Add arguments (optional):">
                  <input className="field-input w-full font-mono text-xs" value={`-NoProfile -ExecutionPolicy Bypass -File ${script}`} readOnly aria-readonly />
                </WinField>
                <WinField label="Script file:">
                  <input className="field-input w-full font-mono" value={script} onChange={(e) => setScript(e.target.value)} />
                </WinField>
                <div className="relative rounded-lg p-2 ring-4 ring-amber">
                  <WinField label="Start in (optional):">
                    <input
                      className="field-input w-full font-mono"
                      value={startIn}
                      placeholder="(empty)"
                      onChange={(e) => setStartIn(e.target.value)}
                      aria-describedby="startin-callout"
                    />
                  </WinField>
                </div>
                <div id="startin-callout" className={`rounded-lg p-3 ${startIn ? 'bg-amber-soft' : 'bg-danger-soft'}`}>
                  <p className="flex items-center gap-2 font-bold text-navy">
                    <FaExclamationTriangle className={startIn ? 'text-amber-dark' : 'text-danger'} aria-hidden /> Why “Start in” matters
                  </p>
                  {startIn ? (
                    <p className="mt-1">
                      The script starts in <span className="font-mono">{startIn}</span>, so a line like <span className="font-mono">Get-Content data.csv</span> opens{' '}
                      <span className="font-mono">{startIn.replace(/\\$/, '')}\data.csv</span>.
                    </p>
                  ) : (
                    <p className="mt-1">
                      Empty! The task will start in <span className="font-mono">C:\Windows\System32</span>. A line like <span className="font-mono">Get-Content data.csv</span> now looks for{' '}
                      <span className="font-mono">C:\Windows\System32\data.csv</span>, which does not exist, and the task fails with <strong>0x2</strong> (file not found) or <strong>0x1</strong>.
                    </p>
                  )}
                </div>
              </>
            )}
            {tab === 'conditions' && (
              <>
                <p className="font-semibold">Idle</p>
                <WinCheck checked={onlyIdle} onChange={setOnlyIdle} label="Start the task only if the computer is idle for 10 minutes" />
                <p className="font-semibold">Power</p>
                <WinCheck checked={acPower} onChange={setAcPower} label="Start the task only if the computer is on AC power" />
                <p className="font-semibold">Network</p>
                <WinCheck checked={network} onChange={setNetwork} label="Start only if any network connection is available" />
              </>
            )}
            {tab === 'settings' && (
              <>
                <WinCheck checked={onDemand} onChange={setOnDemand} label="Allow task to be run on demand" />
                <WinCheck checked={missed} onChange={setMissed} label="Run task as soon as possible after a scheduled start is missed" />
                <WinCheck checked={retry} onChange={setRetry} label="If the task fails, restart every: 5 minutes. Attempt to restart up to: 3 times" />
                <WinCheck checked={timeLimit} onChange={setTimeLimit} label="Stop the task if it runs longer than: 1 hour" />
                <WinField label="If the task is already running, then the following rule applies:">
                  <select className="field-input w-full" value={multi} onChange={(e) => setMulti(e.target.value as Multi)}>
                    <option value="IgnoreNew">Do not start a new instance</option>
                    <option value="Parallel">Run a new instance in parallel</option>
                    <option value="Queue">Queue a new instance</option>
                    <option value="StopExisting">Stop the existing instance</option>
                  </select>
                </WinField>
              </>
            )}
            {tab === 'history' && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead className="bg-[#f3f3f3]">
                    <tr>
                      <th className="p-1.5">Date and Time</th>
                      <th className="p-1.5">Event ID</th>
                      <th className="p-1.5">Task Category</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {[
                      ['18:00:00', '107', 'Task triggered on scheduler'],
                      ['18:00:00', '100', 'Task Started'],
                      ['18:00:00', '129', 'Created Task Process'],
                      ['18:00:00', '200', 'Action started'],
                      ['18:00:07', '201', 'Action completed'],
                      ['18:00:07', '102', 'Task completed'],
                    ].map(([t, id, cat]) => (
                      <tr key={id} className="border-t border-[#e5e5e5]">
                        <td className="p-1.5">{t}</td>
                        <td className="p-1.5">{id}</td>
                        <td className="p-1.5">{cat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2">
                  Event 201 shows the action’s <strong>return code</strong>; 0 means the script reported success. Empty History tab? In the right pane, click{' '}
                  <strong>“Enable All Tasks History”</strong>.
                </p>
              </div>
            )}
          </div>

          <Explanation tab={tab} account={account} whenText={whenText} />
        </div>
      </div>

      <div className="mt-5 grid gap-x-4 lg:grid-cols-2">
        <CodeBlock lang="batch" title="schtasks (Command Prompt)" code={schtasks} />
        <CodeBlock lang="powershell" title="ScheduledTasks module" code={powershell} />
      </div>
    </DemoFrame>
  )
}

function Explanation({ tab, account, whenText }: { tab: TabKey; account: Account; whenText: string }) {
  const t = TABS.find((x) => x.key === tab)!
  const body: Record<TabKey, ReactNode> = {
    general: (
      <>
        <p>The account that runs the job. Remember: it is <strong>not you</strong>, so it may not see your folders or mapped drives.</p>
        <p className="mt-2 rounded bg-white/10 p-2">{ACCOUNTS[account].note}</p>
      </>
    ),
    triggers: (
      <>
        <p>What starts the task: a time, startup, or logon. A task can have several triggers.</p>
        <p className="mt-2 rounded bg-white/10 p-2">Now: {whenText}.</p>
      </>
    ),
    actions: <p>The program to start. For a PowerShell script, the program is <span className="font-mono">powershell.exe</span> and the script goes in the arguments. Always fill in <strong>Start in</strong>.</p>,
    conditions: <p>“Only if” rules, checked when the trigger fires. If a condition is false, the task does not start, just like the phone that waits for Wi-Fi.</p>,
    settings: <p>Your safety net: allow manual runs, catch up a missed start, retry on failure, stop a stuck job, and decide what to do if a copy is still running (the job queue).</p>,
    history: <p>The scheduler’s own record. This is evidence level 1: the scheduler started it. You still need the script’s log (level 2) and the result (level 3).</p>,
  }
  return (
    <aside className="rounded-lg bg-navy p-4 text-sm text-white" aria-live="polite">
      <p className="text-xs font-bold tracking-[0.14em] text-amber uppercase">{t.label} tab</p>
      <p className="mt-1 text-2xl font-bold">{t.question}</p>
      <div className="mt-2 text-white/90">{body[tab]}</div>
    </aside>
  )
}

function WinField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-semibold">{label}</span>
      {children}
    </label>
  )
}

function WinCheck({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-2">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
