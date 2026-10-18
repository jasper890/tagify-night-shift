export type Support = 'yes' | 'partial' | 'no' | 'na'
export type Platform = 'windows' | 'linux' | 'cloud' | 'cross'

export interface Cell {
  v: Support
  note?: string
}

export interface ToolRow {
  name: string
  path?: string
  group: 'basic' | 'beyond'
  platforms: Platform[]
  platformText: string
  bestFor: string
  limitation: string
  recurring: Cell
  oneTime: Cell
  events: Cell
  retries: Cell
  catchUp: Cell
}

export const FEATURES = [
  { key: 'recurring', label: 'Recurring' },
  { key: 'oneTime', label: 'One-time' },
  { key: 'events', label: 'Event triggers' },
  { key: 'retries', label: 'Built-in retries' },
  { key: 'catchUp', label: 'Catch-up of missed runs' },
] as const

export type FeatureKey = (typeof FEATURES)[number]['key']

export const TOOLS: ToolRow[] = [
  {
    name: 'Task Scheduler',
    path: '/lesson/3',
    group: 'basic',
    platforms: ['windows'],
    platformText: 'Windows',
    bestFor: 'Repeating, one-time, and event tasks; GUI, conditions, retries',
    limitation: 'Windows only',
    recurring: { v: 'yes' },
    oneTime: { v: 'yes', note: 'One time trigger' },
    events: { v: 'yes', note: 'At startup, at log on, on an event log entry' },
    retries: { v: 'yes', note: '“If the task fails, restart every…”' },
    catchUp: { v: 'yes', note: '“Run task as soon as possible after a scheduled start is missed”' },
  },
  {
    name: 'cron',
    path: '/lesson/4',
    group: 'basic',
    platforms: ['linux'],
    platformText: 'Linux / Unix',
    bestFor: 'Simple repeating jobs based on time',
    limitation: 'No retries; skips runs if the PC was off',
    recurring: { v: 'yes' },
    oneTime: { v: 'no', note: 'Use at' },
    events: { v: 'partial', note: 'Only @reboot' },
    retries: { v: 'no' },
    catchUp: { v: 'no', note: 'anacron can catch up daily/weekly jobs' },
  },
  {
    name: 'at',
    path: '/lesson/4',
    group: 'basic',
    platforms: ['linux'],
    platformText: 'Linux / Unix',
    bestFor: 'Jobs that run only once',
    limitation: 'Cannot repeat',
    recurring: { v: 'no' },
    oneTime: { v: 'yes' },
    events: { v: 'no' },
    retries: { v: 'no' },
    catchUp: { v: 'partial', note: 'Overdue jobs run when atd starts again' },
  },
  {
    name: 'Scripts (PowerShell, Bash)',
    path: '/lesson/5',
    group: 'basic',
    platforms: ['windows', 'linux'],
    platformText: 'Both',
    bestFor: 'The actual steps: work, checks, and logs',
    limitation: 'Need a scheduler or a person to start them',
    recurring: { v: 'na', note: 'Started by a scheduler' },
    oneTime: { v: 'na' },
    events: { v: 'na' },
    retries: { v: 'partial', note: 'Only if you write a retry loop' },
    catchUp: { v: 'na' },
  },
  {
    name: 'GitHub Actions',
    path: '/beyond/github-actions',
    group: 'beyond',
    platforms: ['cloud'],
    platformText: 'Cloud (GitHub)',
    bestFor: 'Jobs that belong to a code repository: checks, reports, deploys',
    limitation: 'UTC only, at least 5 minutes apart, runs can be delayed',
    recurring: { v: 'yes', note: 'on: schedule (cron, UTC)' },
    oneTime: { v: 'partial', note: 'Manual run with workflow_dispatch' },
    events: { v: 'yes', note: 'push, pull_request, release, …' },
    retries: { v: 'no', note: 'Re-run failed jobs by hand' },
    catchUp: { v: 'no', note: 'Delayed or dropped at busy times' },
  },
  {
    name: 'Ansible',
    path: '/beyond/ansible',
    group: 'beyond',
    platforms: ['cross'],
    platformText: 'Cross-platform',
    bestFor: 'Installing the same jobs on many servers at once',
    limitation: 'Configures schedulers; is not a scheduler itself',
    recurring: { v: 'partial', note: 'Installs cron jobs / scheduled tasks' },
    oneTime: { v: 'yes', note: 'Run a playbook now' },
    events: { v: 'partial', note: 'Event-Driven Ansible (separate product)' },
    retries: { v: 'yes', note: 'retries: + until: on a task' },
    catchUp: { v: 'na' },
  },
  {
    name: 'systemd timers',
    path: '/beyond/systemd-timers',
    group: 'beyond',
    platforms: ['linux'],
    platformText: 'Linux',
    bestFor: 'Modern Linux replacement for cron with logs in the journal',
    limitation: 'Two files per job; Linux with systemd only',
    recurring: { v: 'yes', note: 'OnCalendar=' },
    oneTime: { v: 'yes', note: 'systemd-run --on-active=' },
    events: { v: 'yes', note: 'OnBootSec=, path and socket units' },
    retries: { v: 'yes', note: 'Restart=on-failure in the .service' },
    catchUp: { v: 'yes', note: 'Persistent=true' },
  },
  {
    name: 'Kubernetes CronJob',
    path: '/beyond/kubernetes-cronjob',
    group: 'beyond',
    platforms: ['cloud', 'cross'],
    platformText: 'Cluster / cloud',
    bestFor: 'Scheduled jobs that run in containers',
    limitation: 'Needs a Kubernetes cluster',
    recurring: { v: 'yes', note: 'schedule + timeZone' },
    oneTime: { v: 'partial', note: 'Use a plain Job' },
    events: { v: 'no' },
    retries: { v: 'yes', note: 'backoffLimit' },
    catchUp: { v: 'partial', note: 'Late start allowed within startingDeadlineSeconds' },
  },
  {
    name: 'Jenkins',
    path: '/beyond/jenkins',
    group: 'beyond',
    platforms: ['cross'],
    platformText: 'Cross-platform server',
    bestFor: 'Build, test and maintenance pipelines with a web UI',
    limitation: 'A server you must install and maintain',
    recurring: { v: 'yes', note: "triggers { cron('H 2 * * *') }" },
    oneTime: { v: 'partial', note: 'Build Now (manual)' },
    events: { v: 'yes', note: 'Code pushes, webhooks, other jobs' },
    retries: { v: 'yes', note: 'retry(3) { … } step' },
    catchUp: { v: 'no' },
  },
  {
    name: 'PowerShell ScheduledTasks',
    path: '/beyond/powershell-scheduledtasks',
    group: 'beyond',
    platforms: ['windows'],
    platformText: 'Windows',
    bestFor: 'Creating Task Scheduler jobs from a script, the same on every PC',
    limitation: 'Windows only',
    recurring: { v: 'yes' },
    oneTime: { v: 'yes', note: 'New-ScheduledTaskTrigger -Once' },
    events: { v: 'yes', note: '-AtStartup, -AtLogOn' },
    retries: { v: 'yes', note: '-RestartCount, -RestartInterval' },
    catchUp: { v: 'yes', note: '-StartWhenAvailable' },
  },
  {
    name: 'AWS EventBridge Scheduler',
    path: '/beyond/cloud-schedulers',
    group: 'beyond',
    platforms: ['cloud'],
    platformText: 'Cloud (AWS)',
    bestFor: 'Starting AWS services on a schedule, no server needed',
    limitation: 'AWS targets only',
    recurring: { v: 'yes', note: 'cron() or rate(), with a time zone' },
    oneTime: { v: 'yes', note: 'at() schedules' },
    events: { v: 'partial', note: 'Event rules are part of EventBridge' },
    retries: { v: 'yes', note: 'Retry policy' },
    catchUp: { v: 'na', note: 'Always on' },
  },
  {
    name: 'Azure Automation / Logic Apps',
    path: '/beyond/cloud-schedulers',
    group: 'beyond',
    platforms: ['cloud'],
    platformText: 'Cloud (Azure)',
    bestFor: 'Running PowerShell runbooks or workflows in Azure',
    limitation: 'Azure account needed',
    recurring: { v: 'yes', note: 'Schedules / Recurrence trigger' },
    oneTime: { v: 'yes' },
    events: { v: 'yes', note: 'Webhooks and connector triggers' },
    retries: { v: 'yes', note: 'Logic Apps retry policy' },
    catchUp: { v: 'na', note: 'Always on' },
  },
  {
    name: 'Google Cloud Scheduler',
    path: '/beyond/cloud-schedulers',
    group: 'beyond',
    platforms: ['cloud'],
    platformText: 'Cloud (Google)',
    bestFor: 'Calling a URL or Pub/Sub topic on a cron schedule',
    limitation: 'Only starts things; the work runs elsewhere',
    recurring: { v: 'yes', note: 'Unix cron + time zone' },
    oneTime: { v: 'no' },
    events: { v: 'no' },
    retries: { v: 'yes', note: 'Retry config' },
    catchUp: { v: 'na', note: 'Always on' },
  },
]
