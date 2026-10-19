// Cron Challenge puzzles: write one crontab line that backs up the right device at the right time.
// Every `answer` is checked by a test, so each puzzle is solvable with its own answer.

export type DeviceKind = 'server' | 'pc' | 'laptop'

export interface Device {
  /** The name you type after backup.sh, also shown on the network map. */
  id: string
  kind: DeviceKind
  /** What it is, for screen readers and the device list. */
  name: string
  /** Size of one backup, for the log. */
  size: string
}

export const DEVICES: Device[] = [
  { id: 'files', kind: 'server', name: 'File server', size: '4.2 GB' },
  { id: 'db', kind: 'server', name: 'Database server', size: '1.8 GB' },
  { id: 'web', kind: 'server', name: 'Web server', size: '650 MB' },
  { id: 'mail', kind: 'server', name: 'Mail server', size: '2.6 GB' },
  { id: 'lab1', kind: 'pc', name: 'Lab PC 1', size: '900 MB' },
  { id: 'lab2', kind: 'pc', name: 'Lab PC 2', size: '870 MB' },
  { id: 'lab3', kind: 'pc', name: 'Lab PC 3', size: '910 MB' },
  { id: 'teacher', kind: 'laptop', name: 'Teacher’s laptop', size: '320 MB' },
]

/** Group names that back up several devices at once. */
export const GROUPS: Record<string, string[]> = {
  lab: ['lab1', 'lab2', 'lab3'],
}

export const BACKUP_SCRIPT = '/home/student/lab/backup.sh'
export const BACKUP_LOG = '/home/student/lab/backup.log'

export interface CronChallenge {
  id: string
  title: string
  /** The problem, told like a ticket from the Old Admin. */
  story: string
  /** One-line summary of what to build. */
  goal: string
  /** What the input box starts with. */
  start: string
  /** A correct crontab line, shown as the last hint. */
  answer: string
  /** True when the job must append its output and errors to BACKUP_LOG. */
  needsLog?: boolean
  /** Two text hints; the third hint is always the answer. */
  hints: [string, string]
}

const S = BACKUP_SCRIPT

export const CRON_CHALLENGES: CronChallenge[] = [
  {
    id: 'nightly',
    title: 'The nightly backup',
    story: 'The file server holds everyone’s class projects. Back it up every night at 2:00 AM, when nobody is working.',
    goal: 'files · every day at 2:00 AM',
    start: `* * * * * ${S} `,
    answer: `0 2 * * * ${S} files`,
    hints: [
      'The five fields are minute, hour, day of month, month and day of week. “Every day” means * in the last three.',
      'The minute is 0 and the hour is 2. The device name goes after the script: backup.sh files.',
    ],
  },
  {
    id: 'flood',
    title: 'Stop the flood',
    story:
      'Last night the database was backed up 60 times and the backup vault filled up! Someone wrote the line below. Run it to see what it does, then fix it so the database is backed up once, at 2:00 AM.',
    goal: 'db · once a day at 2:00 AM',
    start: `* 2 * * * ${S} db`,
    answer: `0 2 * * * ${S} db`,
    hints: ['Run it first and watch the clock. What does * mean in the minute field?', '* in the minute field means “every minute”. Put one exact minute there instead.'],
  },
  {
    id: 'lab',
    title: 'After-class lab backup',
    story: 'All three lab PCs must be backed up at 6:30 PM, Monday to Friday, after the last class. The lab is closed on weekends.',
    goal: 'lab (all 3 lab PCs) · weekdays at 6:30 PM',
    start: `* * * * * ${S} `,
    answer: `30 18 * * 1-5 ${S} lab`,
    hints: [
      'cron uses a 24-hour clock, so 6:30 PM is hour 18, minute 30. The group name lab means all three lab PCs.',
      'Monday to Friday is the range 1-5 in the day-of-week field (the fifth field).',
    ],
  },
  {
    id: 'often',
    title: 'Every 15 minutes',
    story: 'The web server takes new orders all day and all night. Losing an hour of orders is too much, so back it up every 15 minutes.',
    goal: 'web · every 15 minutes, day and night',
    start: `* * * * * ${S} `,
    answer: `*/15 * * * * ${S} web`,
    hints: ['“Every so many” uses a slash: */n.', 'Put */15 in the minute field and * in the other four.'],
  },
  {
    id: 'weekly',
    title: 'Sunday full backup',
    story: 'Once a week the mail server gets a full backup: every Sunday at 3:00 AM, when email is quiet.',
    goal: 'mail · every Sunday at 3:00 AM',
    start: `* * * * * ${S} `,
    answer: `0 3 * * 0 ${S} mail`,
    hints: ['Sunday is 0 (or 7) in the day-of-week field.', 'Minute 0, hour 3, any day of the month, any month, day of week 0.'],
  },
  {
    id: 'twice',
    title: 'Twice a day',
    story: 'The teacher’s laptop holds the grade book. Back it up twice a day: at midnight and at noon.',
    goal: 'teacher · at 12:00 AM and 12:00 PM',
    start: `* * * * * ${S} `,
    answer: `0 0,12 * * * ${S} teacher`,
    hints: ['A comma makes a list: 1,15 means “1 and 15”.', 'Midnight is hour 0 (not 24) and noon is hour 12. The minute is 0.'],
  },
  {
    id: 'monthly',
    title: 'Monthly archive, with proof',
    story: `On the 1st of every month at midnight, archive the file server. This time, keep a log so you can prove it worked: add the output to ${BACKUP_LOG}, errors included.`,
    goal: 'files · 1st of every month at 12:00 AM · log to backup.log',
    start: `* * * * * ${S} `,
    answer: `0 0 1 * * ${S} files >> ${BACKUP_LOG} 2>&1`,
    needsLog: true,
    hints: [
      'The day of the month is the third field. In the command, >> adds to the end of a file, and 2>&1 sends errors to the same place.',
      `The schedule is 0 0 1 * *. After the device name, add >> ${BACKUP_LOG} and then 2>&1.`,
    ],
  },
]
