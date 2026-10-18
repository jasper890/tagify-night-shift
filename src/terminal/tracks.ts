import type { CodeLang } from '../components/CodeBlock'
import { SAMPLE_LOGS } from '../lib/cleanup'
import { analyzeCron } from '../lib/cron'
import { inspectWorkflow, parseInventory } from './devops'
import { HOME, runLinux, saveLinuxEditor } from './linux'
import { DAY, HOUR, START_TIME, type Line, type ShellState, type VFile } from './types'
import { runWindows, saveWindowsEditor } from './windows'
import { parse as parseYaml } from 'yaml'

export interface CheckCtx {
  state: ShellState
  input: string
  lines: Line[]
  exitCode: number
  event: 'command' | 'save'
  savedPath?: string
}

export interface Step {
  title: string
  /** Short teaching paragraphs. Text in `backticks` is shown as code. */
  explain: string[]
  /** What the student should do now. */
  task: string
  /** The exact command to type (the "Type it for me" button inserts it). */
  command?: string
  /** Code to write in the editor (opened by `command`). */
  file?: { path: string; lang: CodeLang; content: string }
  hint?: string
  check: (c: CheckCtx) => boolean
  success: string
}

export interface Track {
  id: string
  title: string
  os: 'linux' | 'windows'
  level: string
  minutes: number
  summary: string
  youWillLearn: string[]
  setup: () => ShellState
  steps: Step[]
}

// ---------------------------------------------------------------------------
// Starting machines
// ---------------------------------------------------------------------------

const dir = (now: number): VFile => ({ type: 'dir', content: '', mode: 0o755, mtime: now - 30 * DAY })
const file = (content: string, now: number, extra: Partial<VFile> = {}): VFile => ({ type: 'file', content, mode: 0o644, mtime: now - 2 * DAY, ...extra })

function baseState(os: 'linux' | 'windows'): ShellState {
  return {
    os,
    cwd: os === 'linux' ? HOME : 'C:\\Users\\student',
    now: START_TIME,
    fs: {},
    crontab: '',
    atJobs: [],
    nextAtId: 1,
    tasks: [],
    history: [],
    devices: {},
    git: null,
    ghWorkflows: {},
    ghRuns: [],
  }
}

const ROUTERS: Record<string, [string, string]> = { r1: ['R1', '10.0.0.11'], r2: ['R2', '10.0.0.12'], sw1: ['SW1', '10.0.0.21'] }

export function linuxMachine(): ShellState {
  const s = baseState('linux')
  const now = s.now
  const fs: Record<string, VFile> = {
    '/home': dir(now),
    [HOME]: dir(now),
    [`${HOME}/lab`]: dir(now),
    [`${HOME}/lab/data`]: dir(now),
    [`${HOME}/lab/data/grades.csv`]: file('name,grade\n...', now, { size: 48213 }),
    [`${HOME}/lab/data/students.csv`]: file('id,name\n...', now, { size: 20480 }),
    [`${HOME}/lab/logs`]: dir(now),
    [`${HOME}/lab/backups`]: dir(now),
    [`${HOME}/lab/report.sh`]: file('#!/bin/bash\n# Write a one-line report\necho "$(date \'+%F %T\') Report made" >> /home/student/lab/logs/report.log\n', now, { mode: 0o755 }),
    [`${HOME}/netauto`]: dir(now),
    [`${HOME}/netauto/.git`]: dir(now),
    [`${HOME}/netauto/README.md`]: file('# netauto\nNetwork automation practice repo for the school lab.\n', now),
    [`${HOME}/netauto/logs`]: dir(now),
    '/var': dir(now),
    '/var/log': dir(now),
    '/var/log/syslog': file(`Oct 17 20:58:01 lab-server systemd[1]: Started cron.service - Regular background program processing daemon.\n`, now),
    '/var/mail': dir(now),
  }
  for (const log of SAMPLE_LOGS) {
    fs[`${HOME}/lab/logs/${log.name}`] = file('INFO ...\n', now, { size: log.sizeKB * 1024, mtime: now - log.ageDays * DAY - 3 * HOUR })
  }
  s.fs = fs
  s.devices = Object.fromEntries(
    Object.entries(ROUTERS).map(([h, [name, ip]]) => [h, [`hostname ${name}`, 'interface GigabitEthernet0/0', ` ip address ${ip} 255.255.255.0`, 'line vty 0 4', ' transport input ssh']]),
  )
  s.git = {
    root: `${HOME}/netauto`,
    remote: 'github.com:tagify-student/netauto.git',
    commits: [{ hash: 'a1c3f9e', message: 'Initial commit', files: { 'README.md': fs[`${HOME}/netauto/README.md`].content } }],
    staged: {},
    pushed: 1,
  }
  return s
}

export function windowsMachine(): ShellState {
  const s = baseState('windows')
  const now = s.now
  s.fs = {
    'C:\\Users': dir(now),
    'C:\\Users\\student': dir(now),
    'C:\\Windows': dir(now),
    'C:\\Windows\\System32': dir(now),
    'C:\\Lab': dir(now),
    'C:\\Lab\\Logs': dir(now),
    'C:\\Lab\\Data': dir(now),
    'C:\\Lab\\Data\\grades.csv': file('name,grade\n...', now, { size: 48213 }),
  }
  for (const log of SAMPLE_LOGS) {
    s.fs[`C:\\Lab\\Logs\\${log.name}`] = file('INFO ...\n', now, { size: log.sizeKB * 1024, mtime: now - log.ageDays * DAY - 3 * HOUR })
  }
  return s
}

// ---------------------------------------------------------------------------
// Code the students write
// ---------------------------------------------------------------------------

const BACKUP_SH = `#!/bin/bash
# Back up the data folder, with today's date in the file name
tar -czf /home/student/lab/backups/data-$(date +%F).tar.gz /home/student/lab/data
echo "$(date '+%F %T') INFO  Backup finished" >> /home/student/lab/logs/backup.log
exit 0
`

const CRONTAB_GOOD = `# m  h  dom mon dow  command
30 1 * * * /home/student/lab/backup.sh >> /home/student/lab/logs/backup.log 2>&1
`

const CRONTAB_BROKEN = `# m  h  dom mon dow  command
30 1 * * * /home/student/lab/backup.sh >> /home/student/lab/logs/backup.log 2>&1
45 1 * * * backup.sh
`

const INVENTORY = `[routers]
r1  ansible_host=10.0.0.11
r2  ansible_host=10.0.0.12
sw1 ansible_host=10.0.0.21

[routers:vars]
ansible_connection=ansible.netcommon.network_cli
ansible_network_os=cisco.ios.ios
ansible_user=netadmin
ansible_password={{ lookup('ansible.builtin.env', 'ROUTER_PASSWORD') }}
`

const BACKUP_YML = `- name: Back up router configs
  hosts: routers
  gather_facts: false

  tasks:
    - name: Save the running config to a file
      cisco.ios.ios_config:
        backup: true
        backup_options:
          dir_path: ./backups
          filename: "{{ inventory_hostname }}.cfg"
`

const NTP_YML = `- name: Use the school time server on every device
  hosts: routers
  gather_facts: false

  tasks:
    - name: Set the NTP server
      cisco.ios.ios_config:
        lines:
          - ntp server 10.0.0.1
`

const CRONTAB_ANSIBLE = `# m h dom mon dow  command
0 2 * * * cd /home/student/netauto && ansible-playbook -i inventory.ini backup.yml >> /home/student/netauto/logs/backup.log 2>&1
`

const WORKFLOW = `name: Nightly router backup

on:
  schedule:
    - cron: '0 18 * * *'    # 18:00 UTC = 2:00 AM in Manila
  workflow_dispatch:          # adds a "Run workflow" button

jobs:
  backup:
    runs-on: self-hosted      # a runner inside the lab network
    steps:
      - uses: actions/checkout@v4

      - name: Install the Cisco collection
        run: ansible-galaxy collection install cisco.ios

      - name: Back up the routers
        run: ansible-playbook -i inventory.ini backup.yml
        env:
          ROUTER_PASSWORD: \${{ secrets.ROUTER_PASSWORD }}

      - name: Save the backups
        uses: actions/upload-artifact@v4
        with:
          name: router-backups
          path: backups/
`

const REPORT_PS1 = `# Write the time to a log file
Add-Content -Path C:\\Lab\\Logs\\report.log -Value "Report ran at $(Get-Date)"
exit 0
`

// ---------------------------------------------------------------------------
// Check helpers
// ---------------------------------------------------------------------------

const typed = (c: CheckCtx, re: RegExp) => c.event === 'command' && re.test(c.input.trim())
const said = (c: CheckCtx, text: string) => c.lines.some((l) => l.text.includes(text))
const content = (s: ShellState, path: string) => (s.fs[path]?.type === 'file' ? s.fs[path].content : '')
const crontabLines = (s: ShellState) =>
  s.crontab
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

function cronHas(s: ShellState, schedule: string, cmdStart: string) {
  return crontabLines(s).some((l) => {
    const a = analyzeCron(l)
    return a.valid && a.schedule === schedule && (a.parts?.command ?? '').startsWith(cmdStart)
  })
}

function yamlOf(s: ShellState, path: string): unknown {
  try {
    return parseYaml(content(s, path))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export const TRACKS: Track[] = [
  {
    id: 'bash',
    title: 'Your first Bash script',
    os: 'linux',
    level: 'Beginner',
    minutes: 10,
    summary: 'Move around a Linux server, write a backup script, make it runnable, and check its log.',
    youWillLearn: ['pwd, cd and ls -l', 'Writing a script with a shebang', 'chmod +x and why “Permission denied” happens', 'Checking the result and the log'],
    setup: linuxMachine,
    steps: [
      {
        title: 'Where am I?',
        explain: [
          'The text before the cursor is the prompt: `student@lab-server:~$` means user student, on the computer lab-server, in the folder ~ (your home folder).',
          '`pwd` means “print working directory”. It shows the full path of the folder you are in.',
        ],
        task: 'Type pwd and press Enter.',
        command: 'pwd',
        check: (c) => typed(c, /^pwd$/),
        success: 'You are in /home/student. That is what ~ stands for.',
      },
      {
        title: 'Go into the lab folder',
        explain: ['`cd` means “change directory”. Watch the prompt change from ~ to ~/lab.'],
        task: 'Move into the lab folder.',
        command: 'cd lab',
        check: (c) => c.state.cwd === `${HOME}/lab`,
        success: 'The prompt now shows ~/lab.',
      },
      {
        title: 'Look around',
        explain: [
          '`ls -l` lists files in “long” form. Read each row left to right: permissions (who can read r, write w, run x), owner, size in bytes, date, and name.',
          'Folders end with /. The data folder is what we want to back up.',
        ],
        task: 'List the files in long form.',
        command: 'ls -l',
        check: (c) => typed(c, /^ls\b.*-l/) && said(c, 'data/'),
        success: 'You can see data/, logs/, backups/ and a script called report.sh (notice its x permissions).',
      },
      {
        title: 'Write a backup script',
        explain: [
          'A script is a text file with commands, run from top to bottom.',
          'Line 1 `#!/bin/bash` (the “shebang”) says which program runs the file. Lines starting with # are comments.',
          '`tar -czf FILE FOLDER` packs a folder into one compressed file. `$(date +%F)` is replaced by today’s date, like 2026-10-17.',
          '`>>` adds a line to the end of the log. `exit 0` tells the scheduler “success”. We use full paths everywhere, because scheduled jobs start in a different folder.',
        ],
        task: 'Open the editor with nano backup.sh, type the script below (or press “Paste example”), then press Save.',
        command: 'nano backup.sh',
        file: { path: `${HOME}/lab/backup.sh`, lang: 'bash', content: BACKUP_SH },
        check: (c) => {
          const t = content(c.state, `${HOME}/lab/backup.sh`)
          return c.event === 'save' && t.startsWith('#!/bin/bash') && /tar\s+-czf/.test(t) && t.includes('/home/student/lab/data')
        },
        hint: 'The first line must be exactly #!/bin/bash and the tar line must back up /home/student/lab/data.',
        success: 'Script saved. Now let’s try to run it.',
      },
      {
        title: 'Try to run it',
        explain: ['To run a script in the current folder, type `./` before its name. The ./ means “this folder”.', 'Something is going to go wrong. That is on purpose!'],
        task: 'Run the script.',
        command: './backup.sh',
        check: (c) => typed(c, /^\.\/backup\.sh$/) && said(c, 'Permission denied'),
        success: '“Permission denied”: new files are not runnable until you allow it. Look at ls -l: there is no x.',
      },
      {
        title: 'Make it runnable',
        explain: ['`chmod +x` adds the x (execute) permission.', 'For real servers, `chmod 700` is even safer: only the owner can read, change or run it (least privilege).'],
        task: 'Give the script execute permission.',
        command: 'chmod +x backup.sh',
        check: (c) => ((c.state.fs[`${HOME}/lab/backup.sh`]?.mode ?? 0) & 0o100) !== 0,
        success: 'Now it has x. Run ls -l backup.sh if you want to see -rwxr-xr-x.',
      },
      {
        title: 'Run it for real',
        explain: ['No output means no errors. Most good scripts are quiet and write to a log instead.'],
        task: 'Run the script again.',
        command: './backup.sh',
        check: (c) => typed(c, /backup\.sh$/) && c.exitCode === 0 && Object.keys(c.state.fs).some((k) => k.startsWith(`${HOME}/lab/backups/data-`)),
        success: 'Exit code 0 = success. A backup file was created.',
      },
      {
        title: 'Check the evidence',
        explain: ['Never trust “no errors” alone. Check the log (did the script finish?) and the result (does the file exist, and is it not empty?).'],
        task: 'Read the log file.',
        command: 'cat logs/backup.log',
        check: (c) => typed(c, /^cat\b/) && said(c, 'Backup finished'),
        success: 'The log proves the script finished. Bonus: run ls -l backups to see the file size. Track complete!',
      },
    ],
  },
  {
    id: 'cron',
    title: 'Schedule it with cron',
    os: 'linux',
    level: 'Beginner',
    minutes: 12,
    summary: 'Schedule the backup at 1:30 AM, fast-forward time, read the evidence, then fix a broken job.',
    youWillLearn: ['crontab -l and crontab -e', 'Writing a cron line with a log', 'Reading the cron log (evidence level 1)', 'Why cron needs full paths'],
    setup: () => {
      const s = linuxMachine()
      s.fs[`${HOME}/lab/backup.sh`] = { type: 'file', content: BACKUP_SH, mode: 0o755, mtime: s.now - HOUR }
      return s
    },
    steps: [
      {
        title: 'Do I have any cron jobs?',
        explain: ['Each user has their own list of scheduled jobs, called a crontab. `crontab -l` lists it.', 'Your backup.sh from the last track is already in ~/lab.'],
        task: 'List your cron jobs.',
        command: 'crontab -l',
        check: (c) => typed(c, /^crontab\s+-l$/),
        success: '“no crontab for student”: nothing is scheduled yet.',
      },
      {
        title: 'Add the 1:30 AM backup',
        explain: [
          'A cron line has five time fields, then the command: minute, hour, day of month, month, day of week.',
          '`30 1 * * *` = minute 30, hour 1, every day = 1:30 AM daily.',
          '`>> logfile 2>&1` saves normal output AND errors in the log. Without it you never see why a job failed.',
          'Try typing `* 1 * * *` first and press Save: the editor will warn you it runs 60 times!',
        ],
        task: 'Open your crontab with crontab -e, add the line below, then Save.',
        command: 'crontab -e',
        file: { path: 'crontab', lang: 'crontab', content: CRONTAB_GOOD },
        check: (c) => cronHas(c.state, '30 1 * * *', '/home/student/lab/backup.sh'),
        hint: 'The line must start with 30 1 * * * and then the full path /home/student/lab/backup.sh',
        success: '“installing new crontab”: cron will now run your backup every night at 1:30.',
      },
      {
        title: 'Fast-forward to tomorrow morning',
        explain: ['It is 9:00 PM now. Waiting for 1:30 AM would take hours, so this simulator has a special command: `timewarp` jumps the clock and runs any jobs that are due. (Real Linux has no timewarp!)'],
        task: 'Jump 6 hours ahead, to 3:00 AM.',
        command: 'timewarp 6h',
        check: (c) => typed(c, /^timewarp/) && content(c.state, '/var/log/syslog').includes('backup.sh'),
        success: 'cron ran the job at 01:30. But did it really work? Let’s collect evidence.',
      },
      {
        title: 'Evidence level 1: did cron start it?',
        explain: ['cron writes a line to the system log each time it starts a job. `grep` shows only the lines that contain a word.'],
        task: 'Search the system log for CRON.',
        command: 'grep CRON /var/log/syslog',
        check: (c) => typed(c, /^grep\b/) && said(c, 'CRON'),
        success: 'There it is: (student) CMD (/home/student/lab/backup.sh …) at 01:30:00.',
      },
      {
        title: 'Evidence levels 2 and 3: did it work?',
        explain: ['Level 2: the script’s own log says it finished. Level 3: the backup file exists and is not empty. `tail -n 3` shows the last 3 lines.'],
        task: 'Show the last lines of the backup log.',
        command: 'tail -n 3 ~/lab/logs/backup.log',
        check: (c) => typed(c, /^tail\b/) && said(c, 'Backup finished'),
        success: 'Finished at 01:30. Now run ls -l ~/lab/backups to check the file size (level 3).',
      },
      {
        title: 'Make a classic mistake (on purpose)',
        explain: [
          'Many students write just `backup.sh` in cron. It works when you are in the right folder, but cron starts in your home folder with a very short PATH, so it cannot find it.',
          'Let’s add a broken line and watch it fail.',
        ],
        task: 'Open crontab -e again and add the second line below, then Save.',
        command: 'crontab -e',
        file: { path: 'crontab', lang: 'crontab', content: CRONTAB_BROKEN },
        check: (c) => crontabLines(c.state).some((l) => /\s(\.\/)?backup\.sh$/.test(l) && !l.includes('/home/')),
        success: 'Saved. Notice the warning about a relative path? Let’s see what happens anyway.',
      },
      {
        title: 'Let a day pass',
        explain: ['The broken job prints an error, and it has no log redirect, so cron emails the output to the user instead.'],
        task: 'Jump ahead 24 hours.',
        command: 'timewarp 24h',
        check: (c) => typed(c, /^timewarp/) && content(c.state, '/var/mail/student').includes('not found'),
        success: 'One job ✓, one job ✗. cron saved the error in your mailbox.',
      },
      {
        title: 'Read the error',
        explain: ['`/var/mail/student` is where cron sends output that was not redirected to a log.'],
        task: 'Read your mail file.',
        command: 'cat /var/mail/student',
        check: (c) => typed(c, /^(cat|tail)\b.*mail/) && said(c, 'not found'),
        success: '“/bin/sh: 1: backup.sh: not found”: works by hand, fails when scheduled.',
      },
      {
        title: 'Fix it',
        explain: ['The fix is always the same: use the full path, and redirect the output to a log.'],
        task: 'Open crontab -e, delete the broken line (keep only the good one), then Save.',
        command: 'crontab -e',
        file: { path: 'crontab', lang: 'crontab', content: CRONTAB_GOOD },
        check: (c) => c.event === 'save' && !crontabLines(c.state).some((l) => /\s(\.\/)?backup\.sh$/.test(l) && !l.includes('/home/')) && cronHas(c.state, '30 1 * * *', '/home/student/lab/backup.sh'),
        success: 'Fixed! You just did the 4-step method: did it start → read the log → find the cause → fix one thing. Track complete!',
      },
    ],
  },
  {
    id: 'cleanup',
    title: 'Clean up safely + one-time jobs',
    os: 'linux',
    level: 'Beginner',
    minutes: 8,
    summary: 'Preview and delete old logs with find, then schedule a one-time report with at.',
    youWillLearn: ['find -mtime +7 -print (preview)', 'find -delete (only after previewing)', 'at, atq and one-time jobs'],
    setup: linuxMachine,
    steps: [
      {
        title: 'Go to the logs folder',
        explain: ['Log files pile up every day. Our job: delete logs older than 7 days, safely.'],
        task: 'Move into the logs folder.',
        command: 'cd ~/lab/logs',
        check: (c) => c.state.cwd === `${HOME}/lab/logs`,
        success: 'You are in ~/lab/logs.',
      },
      {
        title: 'Look at the dates',
        explain: ['Look at the date column in `ls -l`. Some logs are almost three weeks old.'],
        task: 'List the logs in long form.',
        command: 'ls -l',
        check: (c) => typed(c, /^ls\b.*-l/),
        success: '10 log files, from 2 to 20 days old.',
      },
      {
        title: 'Preview first (golden habit)',
        explain: [
          '`find FOLDER -name \'*.log\' -mtime +7 -print` lists .log files changed more than 7 days ago. It only prints; it deletes nothing.',
          'Always read this list before deleting. A delete cannot be undone.',
        ],
        task: 'Preview which logs are older than 7 days.',
        command: "find /home/student/lab/logs -name '*.log' -mtime +7 -print",
        check: (c) => typed(c, /^find\b.*-mtime\s+\+\d+/) && !/-delete/.test(c.input) && c.lines.length > 0,
        success: 'Six old files would go. The newer ones are not in the list, so they are safe.',
      },
      {
        title: 'Now delete them',
        explain: ['The list looked right, so change -print to -delete. Same command, same filter, so you delete exactly what you previewed.'],
        task: 'Delete logs older than 7 days.',
        command: "find /home/student/lab/logs -name '*.log' -mtime +7 -delete",
        check: (c) => !Object.entries(c.state.fs).some(([k, f]) => k.startsWith(`${HOME}/lab/logs/`) && k.endsWith('.log') && c.state.now - f.mtime > 8 * DAY),
        success: 'Old logs gone. Run ls -l to confirm (always verify!).',
      },
      {
        title: 'Schedule a one-time job with at',
        explain: [
          'cron repeats. `at` runs something ONE time later.',
          'Here we send the command into at with a pipe `|`: run report.sh 2 hours from now.',
        ],
        task: 'Schedule report.sh to run once, 2 hours from now.',
        command: 'echo "/home/student/lab/report.sh" | at now + 2 hours',
        check: (c) => c.state.atJobs.length > 0,
        success: '“job 1 at Sat Oct 17 23:00:00 2026”. It is waiting in the queue.',
      },
      {
        title: 'See the waiting jobs',
        explain: ['`atq` lists waiting at jobs. `atrm NUMBER` would cancel one.'],
        task: 'List the waiting jobs.',
        command: 'atq',
        check: (c) => typed(c, /^atq$/),
        success: 'Job 1 is queued for 11:00 PM.',
      },
      {
        title: 'Let it run',
        explain: ['Jump ahead 3 hours, then check the report log.'],
        task: 'Jump ahead 3 hours.',
        command: 'timewarp 3h',
        check: (c) => content(c.state, `${HOME}/lab/logs/report.log`).includes('Report made'),
        success: 'The at job ran once at 23:00 and is gone from the queue (try atq). Run cat ~/lab/logs/report.log to see it. Track complete!',
      },
    ],
  },
  {
    id: 'windows',
    title: 'PowerShell & Task Scheduler',
    os: 'windows',
    level: 'Beginner',
    minutes: 12,
    summary: 'Clean logs with a PowerShell pipeline, write a .ps1 script, schedule it with schtasks and read the Last Result.',
    youWillLearn: ['Get-ChildItem, Where-Object, Remove-Item -WhatIf', 'Writing a .ps1 script', 'schtasks /create /run /query /delete', 'Reading Last Result (0 vs 2)'],
    setup: windowsMachine,
    steps: [
      {
        title: 'Go to the lab folder',
        explain: ['PowerShell commands use a Verb-Noun style. `Set-Location` (short: cd) changes folder.'],
        task: 'Move to C:\\Lab.',
        command: 'Set-Location C:\\Lab',
        check: (c) => c.state.cwd.toLowerCase() === 'c:\\lab',
        success: 'The prompt now shows PS C:\\Lab>.',
      },
      {
        title: 'List the logs',
        explain: ['`Get-ChildItem` (short: dir or ls) lists files. `-Filter *.log` keeps only .log files.'],
        task: 'List the .log files in C:\\Lab\\Logs.',
        command: 'Get-ChildItem C:\\Lab\\Logs -Filter *.log',
        check: (c) => typed(c, /^(get-childitem|gci|dir|ls)\b/i) && said(c, '.log'),
        success: 'Look at LastWriteTime: some files are weeks old.',
      },
      {
        title: 'Preview the cleanup',
        explain: [
          'The pipe `|` passes files from one command to the next.',
          '`Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) }` keeps files older than 7 days. `$_` means “the current file”.',
          '`Remove-Item -WhatIf` only shows what WOULD be deleted.',
        ],
        task: 'Preview which logs would be deleted.',
        command: 'Get-ChildItem C:\\Lab\\Logs -Filter *.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -WhatIf',
        check: (c) => said(c, 'What if:'),
        success: 'Six “What if” lines. Nothing was deleted yet.',
      },
      {
        title: 'Delete for real',
        explain: ['The preview looked right. Run the same pipeline without -WhatIf (press ↑ to bring back the last command and remove -WhatIf).'],
        task: 'Delete the old logs.',
        command: 'Get-ChildItem C:\\Lab\\Logs -Filter *.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item',
        check: (c) => !Object.entries(c.state.fs).some(([k, f]) => k.startsWith('C:\\Lab\\Logs\\') && c.state.now - f.mtime > 8 * DAY),
        success: 'Done. Remove-Item is silent when it works. Run dir C:\\Lab\\Logs to verify.',
      },
      {
        title: 'Write a PowerShell script',
        explain: [
          'A .ps1 file holds PowerShell commands. `Add-Content` adds a line to a file. `$(Get-Date)` inserts the current date and time.',
          'Use the FULL path to the log. Scheduled tasks start in C:\\Windows\\System32, not in C:\\Lab!',
        ],
        task: 'Open notepad C:\\Lab\\report.ps1, type the script, then Save.',
        command: 'notepad C:\\Lab\\report.ps1',
        file: { path: 'C:\\Lab\\report.ps1', lang: 'powershell', content: REPORT_PS1 },
        check: (c) => c.event === 'save' && /add-content/i.test(content(c.state, 'C:\\Lab\\report.ps1')) && /C:\\Lab\\Logs\\/i.test(content(c.state, 'C:\\Lab\\report.ps1')),
        hint: 'Use Add-Content -Path C:\\Lab\\Logs\\report.log with the full path.',
        success: 'Saved. Always test by hand before scheduling.',
      },
      {
        title: 'Test it by hand',
        explain: ['To run a script in the current folder, type `.\\` before its name.'],
        task: 'Run the script, then read the log with Get-Content.',
        command: '.\\report.ps1',
        check: (c) => /report ran/i.test(content(c.state, 'C:\\Lab\\Logs\\report.log')),
        success: 'It works by hand. Now let’s schedule it.',
      },
      {
        title: 'Create a scheduled task',
        explain: [
          '`/tn` = task name (in an IT-Lab folder), `/tr` = what to run, `/sc daily /st 18:00` = every day at 6:00 PM.',
          'To run a .ps1 file, the program is powershell.exe and the script goes after -File.',
        ],
        task: 'Create the task.',
        command: 'schtasks /create /tn "IT-Lab\\Report" /tr "powershell.exe -NoProfile -File C:\\Lab\\report.ps1" /sc daily /st 18:00',
        check: (c) => c.state.tasks.some((t) => t.name.toLowerCase() === '\\it-lab\\report'),
        success: 'SUCCESS. The task exists, but we have not tested it yet.',
      },
      {
        title: 'Run it now and read the result',
        explain: ['`schtasks /run` starts the task right away, exactly like the scheduler would (as the task’s user, in System32).'],
        task: 'Run the task.',
        command: 'schtasks /run /tn "IT-Lab\\Report"',
        check: (c) => c.state.tasks.some((t) => t.name.toLowerCase() === '\\it-lab\\report' && t.lastResult === 0),
        success: 'Now check: schtasks /query /tn "IT-Lab\\Report" /v /fo list → Last Result: 0 (= 0x0, success).',
      },
      {
        title: 'Break one on purpose',
        explain: ['Let’s see what a typo looks like. This task points to reprot.bat, a file that does not exist.'],
        task: 'Create a task with a wrong path.',
        command: 'schtasks /create /tn "IT-Lab\\Broken" /tr "C:\\Lab\\reprot.bat" /sc daily /st 18:30',
        check: (c) => c.state.tasks.some((t) => t.name.toLowerCase() === '\\it-lab\\broken'),
        success: 'Created. Windows does not check the path when you create a task.',
      },
      {
        title: 'Let a day pass',
        explain: ['`timewarp` is a simulator-only command that jumps the clock and runs tasks that are due.'],
        task: 'Jump ahead 24 hours.',
        command: 'timewarp 24h',
        check: (c) => c.state.tasks.some((t) => t.name.toLowerCase() === '\\it-lab\\broken' && t.lastResult === 2),
        success: 'Report: 0 (success). Broken: 2 = 0x2 = file not found. Check the path in the action!',
      },
      {
        title: 'Clean up',
        explain: ['Delete the broken task. `/f` means “do not ask me to confirm”.'],
        task: 'Delete the broken task.',
        command: 'schtasks /delete /tn "IT-Lab\\Broken" /f',
        check: (c) => !c.state.tasks.some((t) => t.name.toLowerCase() === '\\it-lab\\broken'),
        success: 'Deleted. Track complete! Bonus: try Get-ScheduledTaskInfo -TaskPath \\IT-Lab\\ -TaskName Report',
      },
    ],
  },
  {
    id: 'ansible',
    title: 'Ansible for network automation',
    os: 'linux',
    level: 'Intermediate',
    minutes: 15,
    summary: 'Write an inventory and playbooks for 3 Cisco devices, back up their configs, see idempotence, and schedule it nightly.',
    youWillLearn: ['Inventory files and groups', 'ansible -m ping', 'Playbooks in YAML', '--check (preview) and --diff', 'Idempotence (changed=0)', 'Scheduling a playbook with cron'],
    setup: linuxMachine,
    steps: [
      {
        title: 'Go to the project folder',
        explain: [
          'Network engineers use Ansible to configure many routers and switches at once, instead of logging in to each one.',
          'You manage the devices from a “control node” (this Linux server). Our lab has 3 Cisco devices: r1, r2 and sw1.',
        ],
        task: 'Move into the netauto folder.',
        command: 'cd ~/netauto',
        check: (c) => c.state.cwd === `${HOME}/netauto`,
        success: 'You are in ~/netauto, a git repository for your automation code.',
      },
      {
        title: 'Write the inventory',
        explain: [
          'The inventory lists your devices. `[routers]` is a group name; each line is one device and its IP address.',
          '`[routers:vars]` sets settings for the whole group: connect with network_cli (SSH to a network CLI), the device OS is Cisco IOS, and the username.',
          'The password is NOT typed here. The lookup reads it from an environment variable, so it never ends up in your files or in Git.',
        ],
        task: 'Open nano inventory.ini, type the inventory, then Save.',
        command: 'nano inventory.ini',
        file: { path: `${HOME}/netauto/inventory.ini`, lang: 'ini', content: INVENTORY },
        check: (c) => {
          const inv = parseInventory(content(c.state, `${HOME}/netauto/inventory.ini`))
          const v = inv.hostVars.r1 ?? {}
          return (inv.groups.routers?.length ?? 0) >= 2 && /network_cli/.test(v.ansible_connection ?? '') && /ios/.test(v.ansible_network_os ?? '')
        },
        hint: 'You need a [routers] group with r1 and r2, and ansible_connection / ansible_network_os under [routers:vars].',
        success: 'Inventory saved. Let’s test the connection.',
      },
      {
        title: 'Can Ansible reach the devices?',
        explain: ['`ansible GROUP -i INVENTORY -m ping` connects to every device in the group. “pong” means it worked.', 'Try removing ansible_network_os from the inventory later to see a real error message.'],
        task: 'Ping the routers group.',
        command: 'ansible routers -i inventory.ini -m ping',
        check: (c) => typed(c, /^ansible\s/) && said(c, '"ping": "pong"') && !said(c, 'FAILED'),
        success: 'All three devices answered pong.',
      },
      {
        title: 'Write your first playbook',
        explain: [
          'A playbook is a YAML file: a list of plays. Each play says which `hosts` and which `tasks` to run.',
          'YAML uses indentation (2 spaces) to show what belongs to what. Never use tabs.',
          'The task uses the module `cisco.ios.ios_config` with `backup: true`, which saves each device’s running config to backups/DEVICE.cfg.',
        ],
        task: 'Open nano backup.yml, type the playbook, then Save.',
        command: 'nano backup.yml',
        file: { path: `${HOME}/netauto/backup.yml`, lang: 'yaml', content: BACKUP_YML },
        check: (c) => {
          const y = yamlOf(c.state, `${HOME}/netauto/backup.yml`)
          if (!Array.isArray(y) || typeof y[0] !== 'object' || y[0] === null) return false
          const play = y[0] as Record<string, unknown>
          const tasks = Array.isArray(play.tasks) ? play.tasks : []
          return play.hosts === 'routers' && tasks.some((t) => typeof t === 'object' && t !== null && ('cisco.ios.ios_config' in t || 'ios_config' in t))
        },
        hint: 'Check the indentation: hosts and tasks line up under name; the module is indented under the task.',
        success: 'Valid YAML. Preview before you touch real devices.',
      },
      {
        title: 'Preview with --check',
        explain: ['`--check` is a dry run, like -WhatIf in PowerShell. Ansible shows what it would do and changes nothing.'],
        task: 'Run the playbook in check mode.',
        command: 'ansible-playbook -i inventory.ini backup.yml --check',
        check: (c) => typed(c, /^ansible-playbook\b.*backup\.yml.*(--check|-C)/) && said(c, 'PLAY RECAP'),
        success: 'Read the PLAY RECAP: three devices, no failures. Nothing was written.',
      },
      {
        title: 'Run it for real',
        explain: ['Same command without --check.'],
        task: 'Run the playbook.',
        command: 'ansible-playbook -i inventory.ini backup.yml',
        check: (c) => !!c.state.fs[`${HOME}/netauto/backups/r1.cfg`],
        success: 'Three config backups were saved in backups/. Try: ls backups',
      },
      {
        title: 'Look at a backup',
        explain: ['This is the router’s running configuration, saved as text. If a router breaks, you can restore it from here.'],
        task: 'Show the r1 backup.',
        command: 'cat backups/r1.cfg',
        check: (c) => typed(c, /^cat\b/) && said(c, 'hostname R1'),
        success: 'That is R1’s configuration.',
      },
      {
        title: 'Change config on every device',
        explain: [
          'Now a playbook that changes something: every device should use the school time server.',
          '`lines:` lists the config commands that must exist. Ansible only adds them if they are missing.',
        ],
        task: 'Open nano ntp.yml, type the playbook, then Save.',
        command: 'nano ntp.yml',
        file: { path: `${HOME}/netauto/ntp.yml`, lang: 'yaml', content: NTP_YML },
        check: (c) => /ntp server/.test(content(c.state, `${HOME}/netauto/ntp.yml`)) && Array.isArray(yamlOf(c.state, `${HOME}/netauto/ntp.yml`)),
        success: 'Saved. Let’s apply it and see the difference.',
      },
      {
        title: 'Apply it and see the changes',
        explain: ['`--diff` shows exactly which lines were added. Look for changed=1 on each device.'],
        task: 'Run the NTP playbook with --diff.',
        command: 'ansible-playbook -i inventory.ini ntp.yml --diff',
        check: (c) => Object.values(c.state.devices).every((lines) => lines.includes('ntp server 10.0.0.1')),
        success: 'changed=1 on every device. The NTP line was added.',
      },
      {
        title: 'Run it again: idempotence',
        explain: [
          'Run the exact same playbook a second time. A good playbook changes nothing the second time, because the devices already match.',
          'This is called idempotence. It means you can run your automation every night without fear.',
        ],
        task: 'Run the NTP playbook again.',
        command: 'ansible-playbook -i inventory.ini ntp.yml',
        check: (c) => typed(c, /ntp\.yml/) && said(c, 'changed=0') && !c.lines.some((l) => /changed=[1-9]/.test(l.text)),
        success: 'changed=0 everywhere. Nothing to do: the devices are already correct.',
      },
      {
        title: 'Back up every night at 2 AM',
        explain: [
          'Combine Ansible with cron: every night, go to the project folder and run the backup playbook, saving the output to a log.',
          '`cd FOLDER && command` runs the command only if cd worked.',
          '(In real life the cron job also needs the ROUTER_PASSWORD, for example from Ansible Vault. The simulator skips that part.)',
        ],
        task: 'Open crontab -e, add the line, then Save.',
        command: 'crontab -e',
        file: { path: 'crontab', lang: 'crontab', content: CRONTAB_ANSIBLE },
        check: (c) => crontabLines(c.state).some((l) => /^0\s+2\s+\*\s+\*\s+\*\s+/.test(l) && /ansible-playbook/.test(l) && /backup\.yml/.test(l)),
        success: 'Scheduled. Let’s fast-forward.',
      },
      {
        title: 'Fast-forward and check the log',
        explain: ['Jump to 3:00 AM, then read the end of the log.'],
        task: 'Jump ahead 6 hours.',
        command: 'timewarp 6h',
        check: (c) => content(c.state, `${HOME}/netauto/logs/backup.log`).includes('PLAY RECAP'),
        success: 'The playbook ran at 02:00. Run tail -n 5 logs/backup.log to see the recap. Track complete!',
      },
    ],
  },
  {
    id: 'github-actions',
    title: 'GitHub Actions: automation in the cloud',
    os: 'linux',
    level: 'Intermediate',
    minutes: 12,
    summary: 'Write a workflow that runs your Ansible backup on a schedule, push it, run it by hand, and read the logs.',
    youWillLearn: ['Workflow YAML: on, jobs, steps', 'cron in UTC', 'Secrets', 'git add / commit / push', 'gh workflow run and gh run view'],
    setup: () => {
      const s = linuxMachine()
      const root = `${HOME}/netauto`
      s.cwd = root
      s.fs[`${root}/inventory.ini`] = { type: 'file', content: INVENTORY, mode: 0o644, mtime: s.now - DAY }
      s.fs[`${root}/backup.yml`] = { type: 'file', content: BACKUP_YML, mode: 0o644, mtime: s.now - DAY }
      s.git!.commits.push({ hash: '5d2e8b1', message: 'Add Ansible inventory and backup playbook', files: { 'README.md': s.fs[`${root}/README.md`].content, 'inventory.ini': INVENTORY, 'backup.yml': BACKUP_YML } })
      s.git!.pushed = 2
      return s
    },
    steps: [
      {
        title: 'Check the repository',
        explain: [
          'Your inventory.ini and backup.yml are already in this Git repository and on GitHub.',
          '`git status` shows what changed since the last commit.',
        ],
        task: 'Check the status.',
        command: 'git status',
        check: (c) => typed(c, /^git\s+status$/),
        success: '“nothing to commit, working tree clean”.',
      },
      {
        title: 'Make the workflows folder',
        explain: ['GitHub looks for workflows in `.github/workflows`. `mkdir -p` creates a folder and any missing parent folders.'],
        task: 'Create the folder.',
        command: 'mkdir -p .github/workflows',
        check: (c) => !!c.state.fs[`${HOME}/netauto/.github/workflows`],
        success: 'Folder created.',
      },
      {
        title: 'Write the workflow',
        explain: [
          '`on:` says WHEN it runs: `schedule` with a cron line, plus `workflow_dispatch` for a manual “Run workflow” button.',
          'GitHub reads cron in UTC. Manila is UTC+8, so 2:00 AM Manila = `0 18 * * *` (18:00 UTC the day before).',
          '`runs-on: self-hosted` uses a runner inside the lab network. A cloud runner (ubuntu-latest) cannot reach routers at 10.0.0.x.',
          'The password comes from `${{ secrets.ROUTER_PASSWORD }}`, stored encrypted in GitHub. It never appears in the file or the logs.',
        ],
        task: 'Open nano .github/workflows/nightly-backup.yml, type the workflow, then Save.',
        command: 'nano .github/workflows/nightly-backup.yml',
        file: { path: `${HOME}/netauto/.github/workflows/nightly-backup.yml`, lang: 'yaml', content: WORKFLOW },
        check: (c) => {
          const info = inspectWorkflow(content(c.state, `${HOME}/netauto/.github/workflows/nightly-backup.yml`))
          const steps = info.jobs.flatMap((j) => j.steps)
          return c.event === 'save' && !info.problems.length && info.crons.length > 0 && info.dispatch && steps.some((s) => /ansible-playbook/.test(s.run ?? ''))
        },
        hint: 'Check the indentation. You need on: with schedule and workflow_dispatch, and a step that runs ansible-playbook.',
        success: 'Valid workflow. It only exists on your computer, though. GitHub needs it pushed.',
      },
      {
        title: 'Stage the file',
        explain: ['`git add .` stages every changed file in this folder for the next commit.'],
        task: 'Stage your changes.',
        command: 'git add .',
        check: (c) => Object.keys(c.state.git?.staged ?? {}).some((p) => p.startsWith('.github/workflows/')),
        success: 'Staged. Run git status to see “Changes to be committed”.',
      },
      {
        title: 'Commit',
        explain: ['A commit is a saved snapshot with a message that explains why.'],
        task: 'Commit with a message.',
        command: 'git commit -m "Add nightly backup workflow"',
        check: (c) => (c.state.git?.commits.length ?? 0) >= 3,
        success: 'Committed.',
      },
      {
        title: 'Push to GitHub',
        explain: ['`git push` uploads your commits. GitHub reads the workflow from the main branch and turns on the schedule.'],
        task: 'Push.',
        command: 'git push',
        check: (c) => Object.keys(c.state.ghWorkflows).length > 0,
        success: 'GitHub found your workflow and shows the UTC → Manila time.',
      },
      {
        title: 'Run it by hand',
        explain: ['Do not wait for 2 AM to find out it is broken. `workflow_dispatch` lets you start it now. `gh` is GitHub’s command-line tool.'],
        task: 'Start the workflow.',
        command: 'gh workflow run nightly-backup.yml',
        check: (c) => c.state.ghRuns.some((r) => r.event === 'workflow_dispatch'),
        success: 'The run finished. Let’s read its log.',
      },
      {
        title: 'Read the run log',
        explain: ['Each step’s output is saved. Look for the PLAY RECAP and notice the password shown as ***.'],
        task: 'View the full log of the latest run.',
        command: 'gh run view --log',
        check: (c) => typed(c, /^gh\s+run\s+view/) && said(c, 'PLAY RECAP'),
        success: 'The same Ansible output you saw in your terminal, now running in CI.',
      },
      {
        title: 'Wait for the scheduled run',
        explain: ['Jump ahead a day. The scheduled run starts at 18:00 UTC (2:00 AM Manila), often a few minutes late, which is normal on GitHub.'],
        task: 'Jump ahead 24 hours, then list the runs.',
        command: 'timewarp 24h',
        check: (c) => c.state.ghRuns.some((r) => r.event === 'schedule'),
        success: 'A run with event “schedule” appeared. Type gh run list to see both runs. Track complete! Bonus: change runs-on to ubuntu-latest, commit, push and run it to see why self-hosted matters.',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Running and replaying
// ---------------------------------------------------------------------------

export function run(state: ShellState, input: string) {
  return state.os === 'linux' ? runLinux(input, state) : runWindows(input, state)
}

export function save(state: ShellState, req: { path: string; kind: 'file' | 'crontab'; content: string }, text: string) {
  return state.os === 'linux' ? saveLinuxEditor(state, req, text) : saveWindowsEditor(state, req, text)
}

/** Rebuild the machine as if steps [0, upTo) were completed (used when resuming). */
export function replay(track: Track, upTo: number): ShellState {
  let state = track.setup()
  for (const step of track.steps.slice(0, upTo)) {
    if (step.file) {
      state = save(state, { path: step.file.path, kind: step.file.path === 'crontab' ? 'crontab' : 'file', content: '' }, step.file.content).state
    } else if (step.command) {
      state = run(state, step.command).state
    }
  }
  return state
}
