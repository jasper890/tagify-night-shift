import cronstrue from 'cronstrue'
import { CronExpressionParser } from 'cron-parser'

export type FieldKey = 'minute' | 'hour' | 'dom' | 'month' | 'dow'

export interface FieldSpec {
  key: FieldKey
  label: string
  min: number
  max: number
  rangeText: string
  names?: string[]
}

export const FIELD_SPECS: FieldSpec[] = [
  { key: 'minute', label: 'minute', min: 0, max: 59, rangeText: '0-59' },
  { key: 'hour', label: 'hour', min: 0, max: 23, rangeText: '0-23' },
  { key: 'dom', label: 'day of month', min: 1, max: 31, rangeText: '1-31' },
  {
    key: 'month',
    label: 'month',
    min: 1,
    max: 12,
    rangeText: '1-12',
    names: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  },
  {
    key: 'dow',
    label: 'day of week',
    min: 0,
    max: 7,
    rangeText: '0-7 (0 = Sun)',
    names: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  },
]

export interface CronParts {
  minute: string
  hour: string
  dom: string
  month: string
  dow: string
  command: string
}

export type Severity = 'error' | 'warning'

export type IssueId =
  | 'field-count'
  | 'invalid-syntax'
  | 'out-of-range'
  | 'minute-star'
  | 'dom-dow-or'
  | 'percent'
  | 'relative-path'

export interface CronIssue {
  id: IssueId
  severity: Severity
  message: string
  /** A corrected value the user can apply with one click. */
  suggestion?: string
}

export interface CronAnalysis {
  parts: CronParts | null
  /** Only the five time fields, e.g. "0 2 * * *". */
  schedule: string | null
  issues: CronIssue[]
  /** True when the five time fields are valid and run times can be computed. */
  valid: boolean
}

/** Split a crontab line into five time fields and the command. */
export function splitCronLine(line: string): CronParts | null {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 5) return null
  const [minute, hour, dom, month, dow, ...rest] = tokens
  return { minute, hour, dom, month, dow, command: rest.join(' ') }
}

function nameToNumber(value: string, spec: FieldSpec): number | null {
  if (/^\d+$/.test(value)) return Number(value)
  if (!spec.names) return null
  const index = spec.names.indexOf(value.toUpperCase())
  if (index === -1) return null
  return spec.key === 'month' ? index + 1 : index
}

/**
 * Check one field. Returns null when it is fine, or an issue.
 * Supports: *, n, a-b, lists (a,b,c), steps (*\/n, a-b/n) and month/day names.
 */
export function checkField(value: string, spec: FieldSpec): CronIssue | null {
  for (const item of value.split(',')) {
    const match = /^(\*|[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?)(?:\/(\d+))?$/.exec(item)
    if (!match) {
      return {
        id: 'invalid-syntax',
        severity: 'error',
        message: `The ${spec.label} field "${value}" is not valid cron syntax. Use a number, *, a list (1,15), a range (1-5) or a step (*/10).`,
      }
    }
    const [, base, step] = match
    if (step !== undefined && Number(step) === 0) {
      return {
        id: 'invalid-syntax',
        severity: 'error',
        message: `A step of 0 in the ${spec.label} field makes no sense. Use */5, */10 and so on.`,
      }
    }
    if (base === '*') continue
    const numbers = base.split('-').map((end) => nameToNumber(end, spec))
    if (numbers.some((n) => n === null)) {
      return {
        id: 'invalid-syntax',
        severity: 'error',
        message: `"${item}" is not a valid value for the ${spec.label} field (${spec.rangeText}).`,
      }
    }
    for (const n of numbers as number[]) {
      if (n < spec.min || n > spec.max) {
        let hint = ''
        if (spec.key === 'hour' && n === 24) hint = ' Midnight is hour 0, not 24.'
        if (spec.key === 'minute' && n === 60) hint = ' The last minute is 59.'
        return {
          id: 'out-of-range',
          severity: 'error',
          message: `${n} is out of range for the ${spec.label} field. Allowed: ${spec.rangeText}.${hint}`,
        }
      }
    }
    if (numbers.length === 2 && (numbers[0] as number) > (numbers[1] as number)) {
      return {
        id: 'invalid-syntax',
        severity: 'error',
        message: `The range "${item}" goes backwards. Write the smaller number first.`,
      }
    }
  }
  return null
}

const isRestricted = (value: string) => value !== '*' && value !== '?'
const isFixedHour = (value: string) => /^\d+(,\d+)*$/.test(value) || /^\d+-\d+$/.test(value)

/** Returns the first program or script given without a full path, or null. */
export function findRelativePath(command: string): string | null {
  const tokens = command.split(/\s+/).filter(Boolean)
  const first = tokens[0]
  if (!first) return null
  const isFull = (t: string) => t.startsWith('/') || t.startsWith('~') || t.startsWith('$')
  const looksLikeScript = (t: string) => /\.(sh|py|pl|rb|php|js)$/.test(t)
  if (!isFull(first)) return first
  for (const token of tokens.slice(1)) {
    if (looksLikeScript(token) && !isFull(token)) return token
  }
  return null
}

/** Find mistakes in a crontab line and return friendly warnings. Pure: no side effects. */
export function analyzeCron(line: string): CronAnalysis {
  const parts = splitCronLine(line)
  if (!parts) {
    return {
      parts: null,
      schedule: null,
      valid: false,
      issues: [
        {
          id: 'field-count',
          severity: 'error',
          message:
            'A cron line needs five time fields (minute, hour, day of month, month, day of week), then the command.',
        },
      ],
    }
  }

  const issues: CronIssue[] = []
  for (const spec of FIELD_SPECS) {
    const issue = checkField(parts[spec.key], spec)
    if (issue) issues.push(issue)
  }
  const valid = issues.length === 0
  const schedule = [parts.minute, parts.hour, parts.dom, parts.month, parts.dow].join(' ')

  if (parts.minute === '*' && isFixedHour(parts.hour)) {
    const fixed = ['0', parts.hour, parts.dom, parts.month, parts.dow].join(' ')
    const single = /^\d+$/.test(parts.hour)
    issues.push({
      id: 'minute-star',
      severity: 'warning',
      message: single
        ? `* in the minute field means "every minute", so this runs 60 times (every minute from ${parts.hour}:00 to ${parts.hour}:59). Did you mean \`${fixed}\`?`
        : `* in the minute field means "every minute", so this runs 60 times in each of those hours. Did you mean \`${fixed}\`?`,
      suggestion: fixed,
    })
  }

  if (isRestricted(parts.dom) && isRestricted(parts.dow)) {
    issues.push({
      id: 'dom-dow-or',
      severity: 'warning',
      message:
        'Both "day of month" and "day of week" are set. cron uses OR here: the job runs on those dates OR on those weekdays, not only when both match.',
    })
  }

  if (/(^|[^\\])%/.test(parts.command)) {
    issues.push({
      id: 'percent',
      severity: 'warning',
      message:
        'cron treats % in the command as a new line, so the rest of the command is cut off. Escape it as \\%, for example date +\\%F.',
    })
  }

  const relative = parts.command ? findRelativePath(parts.command) : null
  if (relative) {
    issues.push({
      id: 'relative-path',
      severity: 'warning',
      message: `"${relative}" is not a full path. cron starts in your home folder with a short PATH, so it may not find it. Use a full path, like /home/student/lab/${relative.replace(/^\.\//, '')}.`,
    })
  }

  return { parts, schedule, issues, valid }
}

/** Plain-English meaning of the five time fields. */
export function describeSchedule(schedule: string): string | null {
  try {
    return cronstrue.toString(schedule, { use24HourTimeFormat: false })
  } catch {
    return null
  }
}

export type TimeMode = 'local' | 'utc'

/** Next `count` run times after `from`. Returns [] if the schedule cannot be parsed. */
export function nextRuns(schedule: string, count: number, mode: TimeMode, from: Date = new Date()): Date[] {
  try {
    const tz = mode === 'utc' ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone
    const interval = CronExpressionParser.parse(schedule, { currentDate: from, tz })
    return interval.take(count).map((d) => d.toDate())
  } catch {
    return []
  }
}

export function formatRun(date: Date, mode: TimeMode): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: mode === 'utc' ? 'UTC' : undefined,
    timeZoneName: 'short',
  }).format(date)
}
