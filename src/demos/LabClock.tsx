import { useState } from 'react'
import { FaBroom, FaClock, FaDatabase, FaDownload, FaHdd } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import { DemoFrame, IconCircle } from '../components/ui'
import { CodeBlock, type CodeLang } from '../components/CodeBlock'

interface LabJob {
  id: string
  when: string
  title: string
  how: string
  /** Hour on the 24-hour clock (0-24) for the marker. */
  hour: number
  color: string
  icon: IconType
  tool: string
  explain: string
  configs: { lang: CodeLang; title: string; code: string }[]
}

const JOBS: LabJob[] = [
  {
    id: 'cleanup',
    when: '10:00 PM nightly',
    title: 'Clear student files',
    how: 'Task Scheduler; only if idle',
    hour: 22,
    color: '#FCA311',
    icon: FaBroom,
    tool: 'Windows Task Scheduler',
    explain: 'Runs on every lab PC at 10 PM, but only if nobody has used the PC for 10 minutes, so it never deletes files while a student is still working.',
    configs: [
      {
        lang: 'powershell',
        title: 'Register on each lab PC',
        code: `$action   = New-ScheduledTaskAction -Execute 'powershell.exe' \`
              -Argument '-NoProfile -File C:\\Lab\\clear-student-files.ps1' -WorkingDirectory 'C:\\Lab'
$trigger  = New-ScheduledTaskTrigger -Daily -At '22:00'
$settings = New-ScheduledTaskSettingsSet -RunOnlyIfIdle \`
              -IdleDuration (New-TimeSpan -Minutes 10) -IdleWaitTimeout (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskPath '\\IT-Lab\\' -TaskName 'ClearStudentFiles' \`
  -Action $action -Trigger $trigger -Settings $settings \`
  -Principal (New-ScheduledTaskPrincipal -UserId 'LAB\\svc-labclean$' -LogonType Password)`,
      },
    ],
  },
  {
    id: 'backup',
    when: '1:30 AM daily',
    title: 'Back up the server',
    how: 'cron; service account',
    hour: 1.5,
    color: '#1F7A70',
    icon: FaDatabase,
    tool: 'Linux cron',
    explain: 'A system cron file runs the backup as the svc-backup account, not as root. Output and errors go to a log file, the job’s screen.',
    configs: [
      {
        lang: 'crontab',
        title: '/etc/cron.d/lab-backup',
        code: `# Files in /etc/cron.d have a user field after the five time fields.
# min hour dom mon dow user        command
30    1    *   *   *   svc-backup  /home/student/lab/backup.sh >> /home/student/lab/logs/backup.log 2>&1`,
      },
    ],
  },
  {
    id: 'updates',
    when: 'Sunday 2:00 AM',
    title: 'Install updates',
    how: 'Random delay so 40 PCs do not overload',
    hour: 2,
    color: '#3D5A80',
    icon: FaDownload,
    tool: 'Windows Task Scheduler',
    explain: 'All 40 PCs are scheduled for 2:00 AM Sunday, but each waits a random 0–30 minutes first, so they do not all download at the same second.',
    configs: [
      {
        lang: 'powershell',
        title: 'Weekly trigger with a random delay',
        code: `$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At '02:00' \`
             -RandomDelay (New-TimeSpan -Minutes 30)`,
      },
      {
        lang: 'ini',
        title: 'Same idea on Linux: systemd timer',
        code: `[Timer]
OnCalendar=Sun *-*-* 02:00:00
RandomizedDelaySec=30min
Persistent=true`,
      },
    ],
  },
  {
    id: 'disk',
    when: 'Every 10 minutes',
    title: 'Check disk space',
    how: 'cron; alert at 85% full',
    hour: -1,
    color: '#D1495B',
    icon: FaHdd,
    tool: 'Linux cron',
    explain: 'A small check runs 144 times a day. It stays quiet unless the disk is 85% full or more, then it writes an alert.',
    configs: [
      { lang: 'crontab', title: 'crontab -e (as svc-monitor)', code: '*/10 * * * * /home/student/lab/check-disk.sh' },
      {
        lang: 'bash',
        title: '/home/student/lab/check-disk.sh',
        code: `#!/bin/bash
use=$(df --output=pcent / | tail -1 | tr -dc '0-9')
if [ "$use" -ge 85 ]; then
  echo "$(date '+%F %T') ALERT  Disk / is \${use}% full" >> /home/student/lab/logs/disk.log
  exit 1
fi
exit 0`,
      },
    ],
  },
]

const SIZE = 300
const C = SIZE / 2
const R = 112

function point(hour: number, radius: number) {
  const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2 // midnight at the top
  return { x: C + radius * Math.cos(angle), y: C + radius * Math.sin(angle) }
}

export function LabClock() {
  const [selected, setSelected] = useState('backup')
  const job = JOBS.find((j) => j.id === selected)!

  return (
    <DemoFrame title="24-Hour Lab Automation Clock" icon={FaClock} hint="Midnight is at the top. Click a job on the clock or in the list to see how it is set up.">
      <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <div className="mx-auto w-full max-w-[320px]">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="group" aria-label="24-hour clock of lab jobs">
            <circle cx={C} cy={C} r={R + 24} fill="#14213D" />
            <circle cx={C} cy={C} r={R - 22} fill="#EEF2F7" />
            {/* disk check every 10 min: 144 ticks */}
            {Array.from({ length: 144 }, (_, i) => {
              const h = (i * 10) / 60
              const a = point(h, R - 16)
              const b = point(h, R - 10)
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#D1495B" strokeWidth={selected === 'disk' ? 1.6 : 0.8} opacity={selected === 'disk' ? 1 : 0.55} />
            })}
            {Array.from({ length: 24 }, (_, h) => {
              const p = point(h, R + 12)
              const a = point(h, R - 2)
              const b = point(h, R + 3)
              return (
                <g key={h}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8D99AE" strokeWidth={1} />
                  {h % 3 === 0 ? (
                    <text x={p.x} y={p.y} fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="middle">
                      {h === 0 ? '12AM' : h === 12 ? '12PM' : h > 12 ? `${h - 12}PM` : `${h}AM`}
                    </text>
                  ) : null}
                </g>
              )
            })}
            {JOBS.filter((j) => j.hour >= 0).map((j) => {
              const p = point(j.hour, R - 40)
              const line = point(j.hour, R - 18)
              const active = j.id === selected
              return (
                <g
                  key={j.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${j.when}: ${j.title}`}
                  aria-pressed={active}
                  onClick={() => setSelected(j.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelected(j.id)
                    }
                  }}
                  className="cursor-pointer"
                >
                  <line x1={C} y1={C} x2={line.x} y2={line.y} stroke={j.color} strokeWidth={active ? 4 : 2} strokeLinecap="round" />
                  <circle cx={p.x} cy={p.y} r={active ? 17 : 14} fill={j.color} stroke="#fff" strokeWidth={active ? 3 : 2} />
                  <text x={p.x} y={p.y} fill={j.id === 'cleanup' ? '#14213D' : '#fff'} fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="middle">
                    {j.hour % 1 ? '1:30' : j.hour > 12 ? `${j.hour - 12}PM` : `${j.hour}AM`}
                  </text>
                </g>
              )
            })}
            <circle cx={C} cy={C} r={6} fill="#14213D" />
          </svg>
        </div>

        <div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {JOBS.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  aria-pressed={j.id === selected}
                  onClick={() => setSelected(j.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left ${j.id === selected ? 'border-navy bg-white shadow-md' : 'border-transparent bg-card'}`}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: j.color, color: j.id === 'cleanup' ? '#14213D' : '#fff' }} aria-hidden>
                    <j.icon />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-teal uppercase">{j.when}</span>
                    <span className="block font-bold text-navy">{j.title}</span>
                    <span className="block text-sm text-ink/75">{j.how}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4" aria-live="polite">
            <div className="flex items-center gap-3">
              <IconCircle icon={job.icon} tone="navy" size="sm" />
              <div>
                <p className="kicker">{job.tool}</p>
                <p className="text-lg font-bold text-navy">
                  {job.when}: {job.title}
                </p>
              </div>
            </div>
            <p className="mt-2">{job.explain}</p>
            {job.configs.map((c) => (
              <CodeBlock key={c.title} lang={c.lang} title={c.title} code={c.code} />
            ))}
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
