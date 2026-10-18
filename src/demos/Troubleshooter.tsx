import { useState } from 'react'
import { FaCheckCircle, FaStethoscope, FaTimesCircle, FaWrench } from 'react-icons/fa'
import { DemoFrame } from '../components/ui'
import { CodeBlock, type CodeLang } from '../components/CodeBlock'

interface StepFinding {
  ok: boolean
  finding: string
  evidence?: { lang: CodeLang; code: string; title?: string }
}

interface Symptom {
  id: string
  label: string
  steps: [StepFinding, StepFinding, StepFinding, StepFinding]
  cause: string
  fix: string
  fixCode?: { lang: CodeLang; code: string }
}

const STEP_TITLES = [
  'Did the scheduler start it?',
  'Did the script start and finish? Read its log.',
  'Run the exact command by hand, as the same user.',
  'Fix one thing at a time, then test again.',
]

const SYMPTOMS: Symptom[] = [
  {
    id: 'not-found',
    label: 'command not found',
    steps: [
      { ok: true, finding: 'Yes. The cron log shows the job started at 1:30.', evidence: { lang: 'text', title: 'grep CRON /var/log/syslog', code: 'Oct 17 01:30:01 lab-server CRON[2314]: (student) CMD (/home/student/lab/backup.sh >> /home/student/lab/backup.log 2>&1)' } },
      { ok: false, finding: 'The log shows it stopped early.', evidence: { lang: 'text', title: 'backup.log', code: '/home/student/lab/backup.sh: line 4: rclone: command not found' } },
      { ok: false, finding: 'Running it with cron’s short PATH gives the same error, so we found it.', evidence: { lang: 'bash', code: "env -i HOME=/home/student PATH=/usr/bin:/bin /bin/sh -c '/home/student/lab/backup.sh'\n# rclone: command not found\nwhich rclone\n# /usr/local/bin/rclone   <- not in cron's PATH" } },
      { ok: true, finding: 'Change one thing (use the full path), run again: it works.' },
    ],
    cause: 'cron gives jobs a very short PATH (usually /usr/bin:/bin). Programs in /usr/local/bin or your own folders are not found.',
    fix: 'Use full paths in the script, or set PATH at the top of the crontab.',
    fixCode: { lang: 'bash', code: '# in the script\n/usr/local/bin/rclone copy /home/student/lab/backups remote:lab\n\n# or at the top of crontab -e\nPATH=/usr/local/bin:/usr/bin:/bin' },
  },
  {
    id: 'denied',
    label: 'permission denied',
    steps: [
      { ok: true, finding: 'Yes, the scheduler started it.' },
      { ok: false, finding: 'The log shows a permission error.', evidence: { lang: 'text', title: 'backup.log', code: '/bin/sh: 1: /home/student/lab/backup.sh: Permission denied' } },
      { ok: false, finding: 'As the same user, the error repeats. The file is not executable.', evidence: { lang: 'bash', code: 'sudo -u svc-backup /home/student/lab/backup.sh\n# Permission denied\nls -l /home/student/lab/backup.sh\n# -rw-r--r-- 1 student student 412 Oct 16 backup.sh   <- no x' } },
      { ok: true, finding: 'Add execute permission for the owner only, test again: it works.' },
    ],
    cause: 'The script has no execute permission, or the job’s account cannot read the folder. The job runs as a service account, not as you.',
    fix: 'Give the job’s account exactly the rights it needs: make the script executable and let only that account read it.',
    fixCode: { lang: 'bash', code: 'sudo chown svc-backup: /home/student/lab/backup.sh\nsudo chmod 700 /home/student/lab/backup.sh' },
  },
  {
    id: '0x1',
    label: 'Last Run Result 0x1',
    steps: [
      { ok: true, finding: 'History shows Task Started (100) and Action completed (201) with return code 1.' },
      { ok: false, finding: 'The script log stops after the first line.', evidence: { lang: 'text', title: 'C:\\Lab\\Logs\\report.log', code: '2026-10-17 18:00:01 INFO  Report started\n2026-10-17 18:00:02 ERROR Cannot find path C:\\Windows\\System32\\template.xlsx' } },
      { ok: false, finding: 'Running the exact action as the service account repeats the error.', evidence: { lang: 'powershell', code: "# In a PowerShell window started as the task's account\nSet-Location C:\\Windows\\System32   # where the task really starts\npowershell.exe -NoProfile -File C:\\Lab\\report.ps1" } },
      { ok: true, finding: 'Fill in Start in (C:\\Lab) and run the task again: 0x0.' },
    ],
    cause: 'The script failed and returned exit code 1. Here, a relative path (template.xlsx) was looked up in System32 because Start in was empty.',
    fix: 'Fill in Start in, or better, use full paths inside the script. Make the script exit 1 only on real failure.',
    fixCode: { lang: 'powershell', code: "$template = Join-Path $PSScriptRoot 'template.xlsx'   # folder of the script itself" },
  },
  {
    id: '0x2',
    label: 'Last Run Result 0x2',
    steps: [
      { ok: true, finding: 'History shows the task was triggered.' },
      { ok: false, finding: 'There is no script log at all: the script never started.' },
      { ok: false, finding: 'Copying the action (Program/script: C:\\Lab\\reprot.bat) into a Command Prompt shows the typo.', evidence: { lang: 'batch', code: "C:\\Lab\\reprot.bat\n:: 'C:\\Lab\\reprot.bat' is not recognized as an internal or external command,\n:: operable program or batch file." } },
      { ok: true, finding: 'Fix the spelling (report.bat), run again: 0x0.' },
    ],
    cause: '0x2 means “file not found”: the program or script path in the action is wrong, or a relative path broke because Start in is empty.',
    fix: 'Check the path and spelling in the Actions tab. Paths with spaces need quotes. Fill in Start in.',
  },
  {
    id: 'nothing',
    label: 'Nothing happens',
    steps: [
      { ok: false, finding: 'No. There is no cron line in the log and no History entry. The scheduler never started it.', evidence: { lang: 'bash', code: 'grep CRON /var/log/syslog | grep backup   # nothing\ncrontab -l                                 # is the job there?\nsystemctl status cron                      # is cron running?' } },
      { ok: false, finding: 'No log, because it never started.' },
      { ok: true, finding: 'By hand it works, so the problem is the schedule, not the script.' },
      { ok: true, finding: 'Fix the schedule, then test with a time two minutes from now.' },
    ],
    cause: 'Common reasons: the task is disabled; a condition was false (on battery, not idle); “Run only when user is logged on” and nobody was; cron service stopped; the crontab’s last line has no newline at the end; the time zone is not what you think.',
    fix: 'Check the schedule side first. On Windows: is it Enabled, which account, which conditions? On Linux: crontab -l, cron service status, and end the file with a new line.',
  },
  {
    id: 'twice',
    label: 'Runs twice',
    steps: [
      { ok: true, finding: 'Yes, and the log shows two starts at the same time.', evidence: { lang: 'text', title: 'grep CRON /var/log/syslog', code: 'Oct 17 02:00:01 lab-server CRON[881]: (root) CMD (/home/student/lab/backup.sh)\nOct 17 02:00:01 lab-server CRON[882]: (student) CMD (/home/student/lab/backup.sh)' } },
      { ok: true, finding: 'Both copies finished, but they fought over the same file.' },
      { ok: true, finding: 'List every place a job can be defined.', evidence: { lang: 'bash', code: 'crontab -l                 # student\nsudo crontab -l            # root\nls /etc/cron.d /etc/cron.daily\ngrep -r backup.sh /etc/crontab /etc/cron.d' } },
      { ok: true, finding: 'Remove the duplicate entry, and add a lock so copies can never overlap.' },
    ],
    cause: 'The same job is scheduled in two places (two crontabs, or two triggers on one task), or a run lasts longer than the interval.',
    fix: 'Keep each job in one place, and protect it with a lock.',
    fixCode: { lang: 'crontab', code: '0 2 * * * /usr/bin/flock -n /tmp/backup.lock /home/student/lab/backup.sh' },
  },
  {
    id: 'crlf',
    label: '^M: bad interpreter',
    steps: [
      { ok: true, finding: 'Yes, the scheduler started it.' },
      { ok: false, finding: 'The error comes before the first line of the script.', evidence: { lang: 'text', title: 'backup.log', code: '/bin/bash^M: bad interpreter: No such file or directory' } },
      { ok: false, finding: 'By hand it fails the same way. cat -A shows ^M at the end of each line.', evidence: { lang: 'bash', code: 'head -1 /home/student/lab/backup.sh | cat -A\n# #!/bin/bash^M$' } },
      { ok: true, finding: 'Convert the line endings, run again: it works.' },
    ],
    cause: 'The script was saved on Windows with CRLF line endings. Linux reads “/bin/bash” plus an invisible carriage return (^M) and cannot find that program.',
    fix: 'Convert to LF line endings, and set your editor to save .sh files as LF.',
    fixCode: { lang: 'bash', code: "sed -i 's/\\r$//' /home/student/lab/backup.sh   # or: dos2unix backup.sh" },
  },
]

export function Troubleshooter() {
  const [symptomId, setSymptomId] = useState(SYMPTOMS[0].id)
  const [shown, setShown] = useState(1)
  const symptom = SYMPTOMS.find((s) => s.id === symptomId)!

  return (
    <DemoFrame title="“Works by Hand, Fails When Scheduled” Troubleshooter" icon={FaStethoscope} hint="Pick a symptom, then walk the 4-step method one step at a time.">
      <fieldset>
        <legend className="font-bold text-navy">What do you see?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === symptomId}
              className="btn btn-ghost font-mono text-xs"
              onClick={() => {
                setSymptomId(s.id)
                setShown(1)
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <ol className="mt-5 space-y-3">
        {symptom.steps.slice(0, shown).map((step, i) => (
          <li key={i} className="rounded-xl border border-line p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber font-bold text-navy">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-navy">{STEP_TITLES[i]}</p>
                <p className={`mt-1 flex items-start gap-2 ${step.ok ? 'text-teal' : 'text-danger-dark'}`}>
                  {step.ok ? <FaCheckCircle className="mt-1 shrink-0" aria-hidden /> : <FaTimesCircle className="mt-1 shrink-0" aria-hidden />}
                  <span className="text-ink">{step.finding}</span>
                </p>
                {step.evidence ? <CodeBlock lang={step.evidence.lang} title={step.evidence.title} code={step.evidence.code} /> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {shown < 4 ? (
        <button type="button" className="btn btn-primary mt-3" onClick={() => setShown((n) => n + 1)}>
          Next step ({shown + 1} of 4)
        </button>
      ) : (
        <div className="mt-4 rounded-xl bg-navy p-4 text-white" aria-live="polite">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-amber uppercase">
            <FaWrench aria-hidden /> Likely cause
          </p>
          <p className="mt-1">{symptom.cause}</p>
          <p className="mt-3 text-xs font-bold tracking-[0.14em] text-amber uppercase">Fix</p>
          <p className="mt-1">{symptom.fix}</p>
          {symptom.fixCode ? <CodeBlock lang={symptom.fixCode.lang} code={symptom.fixCode.code} /> : null}
        </div>
      )}
    </DemoFrame>
  )
}
