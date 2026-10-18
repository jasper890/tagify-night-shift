import { useState } from 'react'
import { FaCheckCircle, FaClipboardCheck, FaTimesCircle } from 'react-icons/fa'
import { DemoFrame, Segmented } from '../components/ui'
import { CodeBlock } from '../components/CodeBlock'

type Scenario = 'good' | 'broken'
type Platform = 'linux' | 'windows'
type Level = 1 | 2 | 3

const SCHEDULER: Record<Platform, string> = {
  linux: `$ grep CRON /var/log/syslog | grep backup
Oct 17 01:30:01 lab-server CRON[2314]: (svc-backup) CMD (/home/student/lab/backup.sh >> /home/student/lab/logs/backup.log 2>&1)`,
  windows: `Task Scheduler > IT-Lab > NightlyBackup > History
10/17/2026 1:30:00 AM  107  Task triggered on scheduler
10/17/2026 1:30:00 AM  100  Task Started
10/17/2026 1:30:00 AM  200  Action started
10/17/2026 1:30:04 AM  201  Action completed (return code 0)
10/17/2026 1:30:04 AM  102  Task completed
Last Run Result: The operation completed successfully. (0x0)`,
}

const SCRIPT: Record<Scenario, string> = {
  good: `2026-10-17 01:30:01 INFO   Backup started
2026-10-17 01:30:01 INFO   Dumping database "school"
2026-10-17 01:30:04 INFO   Created school-2026-10-17.sql (48213 KB)
2026-10-17 01:30:04 INFO   Backup finished
exit code: 0`,
  broken: `2026-10-17 01:30:01 INFO   Backup started
2026-10-17 01:30:01 INFO   Dumping database "school"
2026-10-17 01:30:01 INFO   Backup finished
exit code: 0`,
}

const RESULT: Record<Platform, Record<Scenario, string>> = {
  linux: {
    good: `$ ls -l /home/student/lab/backups/
-rw------- 1 svc-backup svc-backup 49370112 Oct 17 01:30 school-2026-10-17.sql`,
    broken: `$ ls -l /home/student/lab/backups/
-rw------- 1 svc-backup svc-backup        0 Oct 17 01:30 school-2026-10-17.sql`,
  },
  windows: {
    good: `PS> Get-Item C:\\Lab\\Backups\\school-2026-10-17.sql | Select-Object Name, Length

Name                   Length
----                   ------
school-2026-10-17.sql  49370112`,
    broken: `PS> Get-Item C:\\Lab\\Backups\\school-2026-10-17.sql | Select-Object Name, Length

Name                   Length
----                   ------
school-2026-10-17.sql  0`,
  },
}

export function LogViewer() {
  const [scenario, setScenario] = useState<Scenario>('good')
  const [platform, setPlatform] = useState<Platform>('linux')
  const [level, setLevel] = useState<Level>(1)

  const status: Record<Level, boolean> = { 1: true, 2: true, 3: scenario === 'good' }
  const levels: { n: Level; title: string; where: string }[] = [
    { n: 1, title: 'The scheduler started it', where: platform === 'linux' ? 'cron log (syslog)' : 'History tab' },
    { n: 2, title: 'The script succeeded', where: 'Script log, exit code 0' },
    { n: 3, title: 'The result really exists', where: 'Backup file is there and not empty' },
  ]

  return (
    <DemoFrame title="Log Viewer: Three Levels of Evidence" icon={FaClipboardCheck} hint="A pretend nightly backup at 1:30 AM. Click each level. Then switch to the broken backup.">
      <div className="flex flex-wrap gap-3">
        <Segmented
          label="Scenario"
          value={scenario}
          onChange={setScenario}
          options={[
            { value: 'good', label: 'Normal night' },
            { value: 'broken', label: 'Broken backup' },
          ]}
        />
        <Segmented
          label="Platform"
          value={platform}
          onChange={setPlatform}
          options={[
            { value: 'linux', label: 'Linux (cron)' },
            { value: 'windows', label: 'Windows (Task Scheduler)' },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3" role="tablist" aria-label="Levels of evidence">
        {levels.map((l) => {
          const ok = status[l.n]
          return (
            <button
              key={l.n}
              type="button"
              role="tab"
              aria-selected={level === l.n}
              onClick={() => setLevel(l.n)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                level === l.n ? 'border-navy bg-white shadow-md' : 'border-transparent bg-card hover:border-line-strong'
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-[0.14em] text-teal uppercase">Level {l.n}</span>
                {ok ? <FaCheckCircle className="text-teal" aria-label="looks fine" /> : <FaTimesCircle className="text-danger" aria-label="problem" />}
              </span>
              <span className="mt-1 block text-lg font-bold text-navy">{l.title}</span>
              <span className="block text-sm text-ink/75">{l.where}</span>
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="mt-2">
        {level === 1 && <CodeBlock lang="text" title={platform === 'linux' ? 'Scheduler evidence: cron' : 'Scheduler evidence: Task Scheduler'} code={SCHEDULER[platform]} />}
        {level === 2 && (
          <CodeBlock
            lang="text"
            title={platform === 'linux' ? '/home/student/lab/logs/backup.log' : 'C:\\Lab\\Logs\\backup.log'}
            code={SCRIPT[scenario]}
          />
        )}
        {level === 3 && <CodeBlock lang="text" title="Result evidence" code={RESULT[platform][scenario]} />}
      </div>

      <div aria-live="polite" className={`mt-2 rounded-xl p-4 ${scenario === 'good' ? 'bg-teal-soft' : 'bg-danger-soft'}`}>
        {scenario === 'good' ? (
          <p>
            <strong className="text-teal">All three levels agree.</strong> The scheduler started it, the script reported success, and a 48 MB backup file exists. For full proof, do a
            test restore now and then.
          </p>
        ) : (
          <>
            <p>
              <strong className="text-danger-dark">It ran ≠ it worked.</strong> Levels 1 and 2 look perfect, with exit code 0, but the backup file is <strong>0 bytes</strong>. Look again
              at the log: “Backup finished” came in the same second as the dump started.
            </p>
            <p className="mt-2">
              <strong>Why?</strong> The dump command failed, but the script did not check it. It printed “finished” and exited 0 anyway, so the scheduler was happy.
            </p>
            <CodeBlock
              lang="bash"
              title="Fix: fail loudly, and check the result"
              code={`#!/bin/bash
set -euo pipefail          # stop on the first error, even inside a pipe
out=/home/student/lab/backups/school-$(date +%F).sql
mysqldump school > "$out"  # login comes from ~/.my.cnf (chmod 600), never the script
if [ ! -s "$out" ]; then   # -s = file exists and is not empty
  echo "$(date '+%F %T') ERROR  Backup file is empty" >&2
  exit 1                   # now the scheduler knows it failed
fi
echo "$(date '+%F %T') INFO   Backup finished ($(du -k "$out" | cut -f1) KB)"`}
            />
          </>
        )}
      </div>
    </DemoFrame>
  )
}
