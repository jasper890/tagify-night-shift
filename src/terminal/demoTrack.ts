// The Cron & at demo as a hands-on lab. Step i here is step i of DEMO_STEPS (same id, same title,
// same commands), so doing it in the simulated terminal earns the demo page's XP.
// `explain` is what the Old Admin says. Every check looks at the machine, not at what was typed.
import { DEMO_STEPS } from '../data/cronDemo'
import { followTick, runBlock } from './block'
import { HOME } from './linux'
import { linuxMachine, type CheckCtx, type Step, type Track } from './tracks'
import type { ShellState } from './types'

const LAB = `${HOME}/lab`

/** A fresh server: your home folder exists, ~/lab does not (step 1 builds it). */
export function demoMachine(): ShellState {
  const s = linuxMachine()
  for (const k of Object.keys(s.fs)) if (k.startsWith(`${HOME}/lab`) || k.startsWith(`${HOME}/netauto`)) delete s.fs[k]
  s.git = null
  return s
}

const code = (id: string) => DEMO_STEPS.find((s) => s.id === id)!.code
const title = (id: string) => DEMO_STEPS.find((s) => s.id === id)!.title

export const backupsOf = (s: ShellState) => Object.keys(s.fs).filter((k) => new RegExp(`^${LAB}/backups/[^/]+\\.tar\\.gz$`).test(k))
const ran = (s: ShellState, re: RegExp) => s.history.some((h) => re.test(h))
const saw = (c: CheckCtx, text: string) => c.lines.some((l) => l.text.includes(text))
const isExecutable = (s: ShellState, path: string) => ((s.fs[path]?.mode ?? 0) & 0o100) !== 0

function lastIndex<T>(items: T[], test: (item: T) => boolean) {
  for (let i = items.length - 1; i >= 0; i--) if (test(items[i])) return i
  return -1
}

const STEPS: Step[] = [
  {
    id: 'script',
    title: title('script'),
    explain: [
      'Hi, I’m the Old Admin. Let’s build a tiny backup robot. A script is just a text file full of commands that the computer runs for you.',
      '`mkdir -p` makes the folders. `echo … >` puts a sample file inside. `cat > backup.sh << \'EOF\'` writes the script. `tar -czf` squeezes the `data` folder into one `.tar.gz` file named after the time.',
      '`chmod +x` lets the file run as a program. Then we run it once by hand.',
    ],
    task: 'Press “Run it for me”, or paste the whole block into the terminal.',
    command: code('script'),
    hint: 'Typing it yourself? End the cat line with << \'EOF\', type the script lines, then EOF on its own line. Or open the editor with nano ~/lab/backup.sh.',
    check: (c) => isExecutable(c.state, `${LAB}/backup.sh`) && (c.state.fs[`${LAB}/backup.sh`]?.content ?? '').includes('tar -czf') && backupsOf(c.state).length >= 1,
    success: 'Backup robot built. One .tar.gz is now sitting in ~/lab/backups.',
  },
  {
    id: 'schedule',
    title: title('schedule'),
    explain: [
      'Now the alarm clock. cron is the part that decides WHEN. The five stars `* * * * *` mean: every minute of every hour of every day.',
      'We add one line to your crontab: the time first, then the command. `>> backup.log 2>&1` saves everything the script prints into a log file, so we can read it later.',
    ],
    task: 'Add the every-minute job, then list your crontab to see it.',
    command: code('schedule'),
    hint: 'Or type crontab -e, paste the line * * * * * /home/student/lab/backup.sh >> /home/student/lab/backup.log 2>&1 and press Save.',
    check: (c) => /^\*\s+\*\s+\*\s+\*\s+\*\s/m.test(c.state.crontab) && c.state.crontab.includes('backup.sh'),
    success: 'cron now knows: run backup.sh every single minute.',
  },
  {
    id: 'check',
    title: title('check'),
    explain: [
      'On a real server you would wait one minute. This lab has a cheat the real world does not: `timewarp` jumps the clock ahead and runs whatever cron had due. Here it skips 5 minutes.',
      'Then we collect the evidence: `cat` shows the log, `ls` lists the backup files.',
    ],
    task: 'Jump 5 minutes ahead, then read the log and list the backups.',
    command: `timewarp 5m\n${code('check')}`,
    hint: 'Type timewarp 5m first. After that, cat ~/lab/backup.log and ls ~/lab/backups.',
    check: (c) => ran(c.state, /timewarp/) && ran(c.state, /(cat|tail)\s+\S*backup\.log/) && backupsOf(c.state).length >= 3,
    success: 'Look at that: nobody pressed anything, yet backups keep appearing. That is cron at work.',
  },
  {
    id: 'automate',
    title: title('automate'),
    explain: [
      'So far the script does one thing. Real automation also CHECKS, VERIFIES, CLEANS UP and LOGS. Let’s upgrade the same file.',
      'cron is the WHEN. The script is the HOW. We do not touch cron at all: it already runs backup.sh, so it will pick up the new version by itself.',
    ],
    task: 'Overwrite backup.sh with the upgraded version.',
    command: code('automate'),
    hint: 'Same trick as step 1: cat > ~/lab/backup.sh << \'EOF\' … EOF. Or use nano ~/lab/backup.sh.',
    check: (c) => (c.state.fs[`${LAB}/backup.sh`]?.content ?? '').includes('Automated backup workflow') && isExecutable(c.state, `${LAB}/backup.sh`),
    success: 'Upgraded. cron will run this new version on its next tick.',
  },
  {
    id: 'show-code',
    title: title('show-code'),
    explain: [
      'Read it top to bottom. It does 4 steps by itself: 1 check the folder is there, 2 make the backup, 3 verify the file is not empty, 4 delete old copies so the disk never fills up.',
      'Every step writes a log line with a time and a level, INFO or ERROR. `exit 1` means failure and `exit 0` means success.',
    ],
    task: 'Show the script with cat.',
    command: code('show-code'),
    check: (c) => saw(c, '4. Clean up'),
    success: 'That is the whole automation part: check, back up, verify, clean up, log.',
  },
  {
    id: 'run-cleanup',
    title: title('run-cleanup'),
    explain: [
      'Let’s run it by hand and watch the cleanup. Look at the backups, run the script, then look again.',
      '`$?` holds the exit code of the last command. 0 means success, anything else means failure.',
    ],
    task: 'List the backups, run the script, list them again.',
    command: code('run-cleanup'),
    hint: 'Run it with ~/lab/backup.sh. The ls lines before and after show the difference.',
    check: (c) => saw(c, 'Backup finished') && backupsOf(c.state).length === 3,
    success: 'Before there were many backups. Now only the newest 3 are kept, so the disk will not fill up. Exit code 0 means success.',
  },
  {
    id: 'fail',
    title: title('fail'),
    explain: [
      'Good automation also fails loudly. Let’s break it on purpose: hide the `data` folder, then run the script.',
      'Watch for the ERROR line and exit code 1. That is how a monitoring system knows the job failed. Then we put the folder back.',
    ],
    task: 'Hide ~/lab/data, run the script, then put the folder back.',
    command: code('fail'),
    hint: 'mv ~/lab/data ~/lab/data_hidden, then ~/lab/backup.sh, then move it back.',
    check: (c) => {
      const h = c.state.history
      const hid = lastIndex(h, (x) => /\bmv\b.*\bdata\b\s+\S*data_hidden/.test(x))
      return hid >= 0 && h.slice(hid + 1).some((x) => /backup\.sh/.test(x)) && !!c.state.fs[`${LAB}/data`] && !c.state.fs[`${LAB}/data_hidden`]
    },
    success: 'The folder was missing, so the script stopped, logged an ERROR and returned exit code 1. That is how the system knows the job failed.',
  },
  {
    id: 'watch',
    title: title('watch'),
    explain: [
      'Now watch it work with nobody touching anything. `tail -f` follows a file and prints new lines as they arrive.',
      'Every few seconds the lab clock jumps one minute. Watch cron wake up and the script write its log lines. Press Ctrl+C when you have seen enough.',
    ],
    task: 'Run tail -f, wait for a new line to appear, then press Ctrl+C.',
    command: code('watch'),
    check: (c) => c.event === 'follow',
    success: 'cron decides WHEN, every minute. The script decides HOW, with all 4 steps. Nobody touched anything, and the log proves it ran.',
  },
  {
    id: 'at',
    title: title('at'),
    explain: [
      'cron repeats forever. For a job that should run just ONCE, there is `at`.',
      'We queue one for 11 PM, list the queue with `atq`, then cancel it with `atrm` using the job number.',
    ],
    task: 'Queue a one-time job, list it, then remove it.',
    command: code('at'),
    check: (c) => c.state.nextAtId > 1 && c.state.atJobs.length === 0 && ran(c.state, /\batrm\b/),
    success: 'at is for one-time jobs, cron is for repeating ones.',
  },
  {
    id: 'remove',
    title: title('remove'),
    explain: [
      'Last job: stop the cron job, safely. The trap is `crontab -r`. It deletes ALL your cron jobs without asking.',
      'Instead we list the crontab, filter out only the backup line with `grep -v`, and load the rest back.',
    ],
    task: 'Remove only the backup line from your crontab.',
    command: code('remove'),
    hint: 'crontab -l | grep -v backup.sh | crontab -',
    check: (c) => !c.state.crontab.includes('backup.sh') && ran(c.state, /grep\s+-v/),
    success: 'The backup job is gone and nothing else was touched. Demo complete!',
  },
]

/** Rebuild the server as if the first `upTo` steps had been done (used when you come back to the page). */
export function replayDemo(upTo: number): ShellState {
  let state = demoMachine()
  for (const step of STEPS.slice(0, upTo)) {
    const r = runBlock(state, step.command!)
    state = r.follow ? followTick(r.state, r.follow).state : r.state
  }
  return state
}

export const DEMO_TRACK: Track = {
  id: 'cron-demo',
  title: 'Linux cron & at demo',
  os: 'linux',
  level: 'Beginner',
  minutes: 15,
  summary: 'Build a backup script, schedule it with cron, upgrade it into a full automated workflow, and watch it run.',
  youWillLearn: ['cron decides WHEN, the script decides HOW', 'A script that checks, backs up, verifies, cleans up and logs', 'Exit codes: 0 is success, 1 is failure', 'at for one-time jobs and a safe way to remove a cron job'],
  setup: demoMachine,
  steps: STEPS,
}
