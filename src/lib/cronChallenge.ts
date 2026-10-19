// Checks a Cron Challenge answer. Pure: it never runs anything, it only works out what
// the crontab line would do on a pretend server clock.
import { BACKUP_LOG, BACKUP_SCRIPT, DEVICES, GROUPS, type CronChallenge } from '../data/cronChallenges'
import { analyzeCron, describeSchedule, FIELD_SPECS, nextRuns, type FieldSpec } from './cron'

/** The pretend server clock starts on Saturday 31 January 2026 at 11:50 PM (shown as UTC). */
export const SIM_START = new Date(Date.UTC(2026, 0, 31, 23, 50))

/** Runs shown in the animation. */
export const RUNS_SHOWN = 3

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
/** Stop counting runs here so "every minute" stays fast. */
const COUNT_CAP = 1000

export interface CannotRun {
  status: 'error'
  problems: string[]
}

export interface Ran {
  status: 'ran'
  correct: boolean
  /** The first few run times on the pretend clock. */
  runs: Date[]
  /** Device ids that were backed up. */
  targets: string[]
  /** Device ids the challenge wanted. */
  expected: string[]
  /** Runs in the first week (capped at COUNT_CAP). */
  perWeek: number
  expectedPerWeek: number
  /** Plain-English meaning of the schedule. */
  meaning: string | null
  /** True when output and errors are appended to the log. */
  logged: boolean
  /** What to fix; empty when correct. */
  feedback: string[]
}

export type CheckResult = CannotRun | Ran

/** Device ids for a name typed after backup.sh: a device, a group, or null if unknown. */
export function targetsFor(name: string): string[] | null {
  const key = name.toLowerCase()
  if (GROUPS[key]) return GROUPS[key]
  return DEVICES.some((d) => d.id === key) ? [key] : null
}

const deviceNames = () => [...DEVICES.map((d) => d.id), ...Object.keys(GROUPS)].join(', ')

/** Treat ~/ and $HOME/ as /home/student/, like the shell cron uses would. */
const expandHome = (path: string) => path.replace(/^(~|\$HOME|\$\{HOME\})(?=\/)/, '/home/student')

type LogCheck = { ok: true } | { ok: false; message: string } | { ok: 'none' }

/** Look at the part after the device name: an optional ">> file 2>&1". */
export function checkLog(rest: string): LogCheck {
  const text = rest.trim()
  if (!text) return { ok: 'none' }
  // Split ">>/path" into ">>" and "/path", but leave "2>&1" alone.
  const tokens = text.replace(/(^|\s)(>>?)(?=[^\s&>])/g, '$1$2 ').split(/\s+/).filter(Boolean)
  const [op, file, ...after] = tokens
  if (op === '2>&1') return { ok: false, message: 'Order matters: write >> and the log file first, then 2>&1. Otherwise errors still go to the old place.' }
  if (op === '>') return { ok: false, message: '> empties the log on every run, so last month’s lines are lost. Use >> to add to the end instead.' }
  if (op !== '>>') return { ok: false, message: 'backup.sh takes one device name. Anything after it should be a log redirect like >> file 2>&1.' }
  if (!file) return { ok: false, message: 'Write the log file after >>.' }
  if (expandHome(file) !== BACKUP_LOG) return { ok: false, message: `Save the log to ${BACKUP_LOG}, with the full path.` }
  if (after.join(' ') !== '2>&1') {
    return after.length === 0
      ? { ok: false, message: 'The output is saved, but errors still go nowhere. Add 2>&1 at the end so errors are saved too.' }
      : { ok: false, message: 'After the log file, write only 2>&1.' }
  }
  return { ok: true }
}

/**
 * The numbers one cron field matches, or null if it cannot be read.
 * Used only to say which field is off; the real check compares run times.
 */
export function expandField(value: string, spec: FieldSpec): Set<number> | null {
  const out = new Set<number>()
  const toNum = (v: string) => {
    if (/^\d+$/.test(v)) return Number(v)
    const i = spec.names?.indexOf(v.toUpperCase()) ?? -1
    if (i === -1) return null
    return spec.key === 'month' ? i + 1 : i
  }
  for (const item of value.split(',')) {
    const m = /^(\*|\?|[A-Za-z0-9]+)(?:-([A-Za-z0-9]+))?(?:\/(\d+))?$/.exec(item)
    if (!m) return null
    const [, a, b, stepText] = m
    const step = stepText ? Number(stepText) : 1
    if (step < 1) return null
    let from: number | null
    let to: number | null
    if (a === '*' || a === '?') {
      from = spec.min
      to = spec.key === 'dow' ? 6 : spec.max
    } else {
      from = toNum(a)
      to = b !== undefined ? toNum(b) : stepText ? spec.max : from
    }
    if (from === null || to === null || from > to) return null
    for (let n = from; n <= to; n += step) out.add(spec.key === 'dow' && n === 7 ? 0 : n)
  }
  return out
}

const sameSet = (a: Set<number> | null, b: Set<number> | null) => !!a && !!b && a.size === b.size && [...a].every((n) => b.has(n))

function countRuns(schedule: string): number {
  const runs = nextRuns(schedule, COUNT_CAP, 'utc', SIM_START)
  const end = SIM_START.getTime() + WEEK_MS
  return runs.filter((d) => d.getTime() <= end).length
}

const times = (n: number) => (n >= COUNT_CAP ? `over ${COUNT_CAP.toLocaleString('en-US')} times` : n === 1 ? 'once' : `${n.toLocaleString('en-US')} times`)

const listNames = (ids: string[]) => ids.join(', ')

/** Check a crontab line against a challenge. */
export function checkChallenge(line: string, challenge: CronChallenge): CheckResult {
  const problems: string[] = []
  const analysis = analyzeCron(line)
  for (const issue of analysis.issues) if (issue.severity === 'error') problems.push(issue.message)

  const parts = analysis.parts
  const tokens = (parts?.command ?? '').split(/\s+/).filter(Boolean)
  const [script, device, ...rest] = tokens
  let targets: string[] | null = null

  if (parts) {
    if (!script) {
      problems.push(`Add the command after the five time fields: ${BACKUP_SCRIPT}, then a device name.`)
    } else if (expandHome(script) !== BACKUP_SCRIPT) {
      if (/(^|\/)backup\.sh$/.test(script) && !script.startsWith('/')) {
        problems.push(`"${script}" is not a full path. cron starts in your home folder with a short PATH, so it cannot find the script. Use ${BACKUP_SCRIPT}.`)
      } else {
        problems.push(`There is no script at "${script}". The backup script is ${BACKUP_SCRIPT}.`)
      }
    } else if (!device) {
      problems.push(`Tell backup.sh which device to back up: add a device name after the script. Names on the map: ${deviceNames()}.`)
    } else {
      targets = targetsFor(device)
      if (!targets) problems.push(`There is no device called "${device}". Use a name from the network map: ${deviceNames()}.`)
    }
  }

  const log = checkLog(rest.join(' '))
  // Junk after the device name means the command cannot run as written.
  if (targets && log.ok === false && !/^\d?>/.test(rest[0] ?? '')) problems.push(log.message)

  if (problems.length || !analysis.schedule || !targets) return { status: 'error', problems }

  const runs = nextRuns(analysis.schedule, RUNS_SHOWN, 'utc', SIM_START)
  if (!runs.length) return { status: 'error', problems: ['This schedule never runs. Check the day and month fields.'] }

  const expectedParts = analyzeCron(challenge.answer).parts!
  const expectedSchedule = [expectedParts.minute, expectedParts.hour, expectedParts.dom, expectedParts.month, expectedParts.dow].join(' ')
  const expected = targetsFor(expectedParts.command.split(/\s+/)[1])!

  // Same schedule = same run times. Comparing 60 runs covers years for daily and monthly jobs.
  const mine = nextRuns(analysis.schedule, 60, 'utc', SIM_START).map((d) => d.getTime())
  const want = nextRuns(expectedSchedule, 60, 'utc', SIM_START).map((d) => d.getTime())
  const scheduleOk = mine.length === want.length && mine.every((t, i) => t === want[i])
  const devicesOk = targets.length === expected.length && targets.every((t) => expected.includes(t))
  const logged = log.ok === true
  const logOk = !challenge.needsLog || logged

  const perWeek = countRuns(analysis.schedule)
  const expectedPerWeek = countRuns(expectedSchedule)
  const feedback: string[] = []

  if (!devicesOk) feedback.push(`You backed up ${listNames(targets)}, but this job is for ${listNames(expected)}.`)
  if (!scheduleOk) {
    if (perWeek !== expectedPerWeek) feedback.push(`Your line runs ${times(perWeek)} in a week. This job should run ${times(expectedPerWeek)}.`)
    const minuteStar = analysis.issues.find((i) => i.id === 'minute-star')
    if (minuteStar) feedback.push(minuteStar.message.replace(/ Did you mean.*$/, ''))
    const off = FIELD_SPECS.filter((spec) => !sameSet(expandField(parts![spec.key], spec), expandField(expectedParts[spec.key], spec))).map((s) => s.label)
    if (off.length) feedback.push(`Check the ${off.join(', ')} field${off.length > 1 ? 's' : ''}.`)
    const both = analysis.issues.find((i) => i.id === 'dom-dow-or')
    if (both) feedback.push(both.message)
  }
  if (!logOk) {
    feedback.push(log.ok === false ? log.message : `This job must keep a log: add its output to ${BACKUP_LOG} with >>, and send errors there too with 2>&1.`)
  }

  return {
    status: 'ran',
    correct: scheduleOk && devicesOk && logOk,
    runs,
    targets,
    expected,
    perWeek,
    expectedPerWeek,
    meaning: describeSchedule(analysis.schedule),
    logged,
    feedback,
  }
}

/** Stars for a solved challenge: 3 with no hints, 2 with text hints, 1 if the answer was shown. */
export const challengeStars = (hintsShown: number) => (hintsShown === 0 ? 3 : hintsShown < 3 ? 2 : 1)

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const pad = (n: number) => String(n).padStart(2, '0')

/** "SUN 01 FEB" and "02:00" for the pretend server clock. */
export function clockParts(d: Date) {
  return {
    day: `${DAYS[d.getUTCDay()]} ${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  }
}

/** A syslog-style cron line, like the ones in Lesson 6. */
export function cronLogLine(d: Date, command: string, pid: number) {
  const m = MONTHS[d.getUTCMonth()]
  return `${m[0]}${m.slice(1).toLowerCase()} ${pad(d.getUTCDate())} ${clockParts(d).time}:00 lab CRON[${pid}]: (student) CMD (${command})`
}
