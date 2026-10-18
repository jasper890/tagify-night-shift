export type LineKind = 'input' | 'out' | 'err' | 'ok' | 'info'

export interface Line {
  kind: LineKind
  text: string
}

export interface VFile {
  type: 'file' | 'dir'
  content: string
  /** Unix permission bits, e.g. 0o644. Ignored on Windows. */
  mode: number
  /** Last modified time (ms since epoch, simulated clock). */
  mtime: number
  /** Size in bytes. If missing, the content length is used. */
  size?: number
}

export interface AtJob {
  id: number
  time: number
  command: string
}

export interface WinTask {
  /** Full name, e.g. "\\IT-Lab\\Report" */
  name: string
  action: string
  schedule: 'daily' | 'weekly' | 'once' | 'onstart' | 'onlogon'
  time: string
  days: string[]
  runAs: string
  lastRun: number | null
  lastResult: number | null
}

export interface GitCommit {
  hash: string
  message: string
  /** Snapshot of every tracked file (path -> content). */
  files: Record<string, string>
}

export interface GitState {
  root: string
  remote: string
  commits: GitCommit[]
  staged: Record<string, string>
  pushed: number
}

export interface GhRun {
  id: number
  event: 'push' | 'workflow_dispatch' | 'schedule'
  time: number
  conclusion: 'success' | 'failure'
  title: string
  log: string[]
}

export interface ShellState {
  os: 'linux' | 'windows'
  cwd: string
  /** Simulated clock (ms since epoch, read as the server's local time). */
  now: number
  fs: Record<string, VFile>
  crontab: string
  atJobs: AtJob[]
  nextAtId: number
  tasks: WinTask[]
  history: string[]
  /** Simulated network devices: hostname -> running-config lines. */
  devices: Record<string, string[]>
  git: GitState | null
  /** Workflow file content as last pushed to GitHub (path -> content). */
  ghWorkflows: Record<string, string>
  ghRuns: GhRun[]
}

export interface EditorRequest {
  path: string
  kind: 'file' | 'crontab'
  content: string
}

export interface RunResult {
  lines: Line[]
  state: ShellState
  editor?: EditorRequest
  clear?: boolean
  exitCode: number
}

export const DAY = 24 * 60 * 60 * 1000
export const HOUR = 60 * 60 * 1000
export const MINUTE = 60 * 1000

/** The lab clock starts on Saturday 17 Oct 2026, 9:00 PM. */
export const START_TIME = Date.UTC(2026, 9, 17, 21, 0, 0)

export function clone(state: ShellState): ShellState {
  return JSON.parse(JSON.stringify(state)) as ShellState
}

export function fileSize(f: VFile): number {
  return f.size ?? f.content.length
}

/** Simple glob (* and ?) to RegExp. */
export function globToRegExp(glob: string, caseInsensitive = false): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`, caseInsensitive ? 'i' : '')
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Format with a tiny strftime subset: %F %T %H %M %S %Y %m %d %a %b %e %R. */
export function strftime(ms: number, fmt: string): string {
  const d = new Date(ms)
  return fmt.replace(/%([FTHMSYmdabeR%])/g, (_, c: string) => {
    switch (c) {
      case 'F': return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
      case 'T': return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
      case 'R': return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
      case 'H': return pad(d.getUTCHours())
      case 'M': return pad(d.getUTCMinutes())
      case 'S': return pad(d.getUTCSeconds())
      case 'Y': return String(d.getUTCFullYear())
      case 'm': return pad(d.getUTCMonth() + 1)
      case 'd': return pad(d.getUTCDate())
      case 'e': return String(d.getUTCDate()).padStart(2, ' ')
      case 'a': return DAYS[d.getUTCDay()]
      case 'b': return MONTHS[d.getUTCMonth()]
      default: return '%'
    }
  })
}

/** "Sat Oct 17 21:00:00 2026" */
export function unixDate(ms: number): string {
  return strftime(ms, '%a %b %e %T %Y')
}

/** "10/17/2026 9:00:00 PM" (Windows style) */
export function winDate(ms: number, withSeconds = true): string {
  const d = new Date(ms)
  const h = d.getUTCHours()
  const h12 = ((h + 11) % 12) + 1
  const sec = withSeconds ? `:${pad(d.getUTCSeconds())}` : ''
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()} ${h12}:${pad(d.getUTCMinutes())}${sec} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Parse "6h", "30m", "1d", "90m" into milliseconds. */
export function parseDuration(text: string): number | null {
  const m = /^(\d+)\s*(m|min|minutes?|h|hours?|d|days?)$/i.exec(text.trim())
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2][0].toLowerCase()
  return unit === 'm' ? n * MINUTE : unit === 'h' ? n * HOUR : n * DAY
}

/**
 * Split a command line into tokens, honouring '...' and "..." quotes.
 * Operators |, >, >>, 2>&1, &&, ; become their own tokens.
 * `expand` is called on unquoted and double-quoted text (not single-quoted).
 */
export function tokenize(input: string, expand: (s: string) => string = (s) => s, backslashEscapes = true): string[] {
  const tokens: string[] = []
  let cur = ''
  let has = false
  let i = 0
  const push = () => {
    if (has) tokens.push(cur)
    cur = ''
    has = false
  }
  while (i < input.length) {
    const c = input[i]
    if (c === "'") {
      const end = input.indexOf("'", i + 1)
      const stop = end === -1 ? input.length : end
      cur += input.slice(i + 1, stop)
      has = true
      i = stop + 1
      continue
    }
    if (c === '"') {
      let j = i + 1
      let text = ''
      while (j < input.length && input[j] !== '"') {
        if (backslashEscapes && input[j] === '\\' && (input[j + 1] === '"' || input[j + 1] === '\\' || input[j + 1] === '$')) {
          text += input[j + 1]
          j += 2
          continue
        }
        text += input[j]
        j++
      }
      cur += expand(text)
      has = true
      i = j + 1
      continue
    }
    if (/\s/.test(c)) {
      push()
      i++
      continue
    }
    if (input.startsWith('2>&1', i)) { push(); tokens.push('2>&1'); i += 4; continue }
    if (input.startsWith('&&', i)) { push(); tokens.push('&&'); i += 2; continue }
    if (input.startsWith('>>', i)) { push(); tokens.push('>>'); i += 2; continue }
    if (c === '>' || c === '|' || c === ';') { push(); tokens.push(c); i++; continue }
    if (backslashEscapes && c === '\\' && i + 1 < input.length) {
      cur += input[i + 1]
      has = true
      i += 2
      continue
    }
    // unquoted word: read until whitespace/quote/operator, then expand it
    let j = i
    let word = ''
    while (j < input.length && !/[\s'"|;>]/.test(input[j]) && !input.startsWith('&&', j) && !input.startsWith('2>&1', j)) {
      if (backslashEscapes && input[j] === '\\' && j + 1 < input.length) {
        word += input[j + 1]
        j += 2
        continue
      }
      if (input[j] === '$' && input[j + 1] === '(') {
        // keep $( ... ) together even if it contains spaces
        let depth = 0
        let k = j
        for (; k < input.length; k++) {
          if (input[k] === '(') depth++
          if (input[k] === ')') { depth--; if (depth === 0) break }
        }
        word += input.slice(j, k + 1)
        j = k + 1
        continue
      }
      word += input[j]
      j++
    }
    cur += expand(word)
    has = true
    i = j
  }
  push()
  return tokens
}
