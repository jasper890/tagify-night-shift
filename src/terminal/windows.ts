// A small, safe, simulated Windows PowerShell. Nothing here touches the real computer.
import {
  clone, DAY, fileSize, globToRegExp, parseDuration, tokenize, winDate,
  type EditorRequest, type Line, type RunResult, type ShellState, type VFile, type WinTask,
} from './types'

const SYSTEM32 = 'C:\\Windows\\System32'

interface Ctx {
  state: ShellState
  cwd: string
  interactive: boolean
  editor?: EditorRequest
  clear?: boolean
  depth: number
}

interface Res {
  out: string[]
  err: string[]
  code: number
  /** File paths passed down a pipeline (objects, not text). */
  items?: string[]
}

// ---------------------------------------------------------------------------
// Paths (case-insensitive, backslashes)
// ---------------------------------------------------------------------------

export function winResolve(cwd: string, p: string): string {
  let path = p.replace(/\//g, '\\').replace(/^["']|["']$/g, '')
  if (!/^[a-z]:/i.test(path)) path = `${cwd}\\${path}`
  const [drive, ...segs] = path.split('\\')
  const parts: string[] = []
  for (const s of segs) {
    if (!s || s === '.') continue
    if (s === '..') parts.pop()
    else parts.push(s)
  }
  return `${drive.toUpperCase()}\\${parts.join('\\')}`.replace(/\\$/, '') || 'C:\\'
}

function findKey(state: ShellState, path: string): string | null {
  const low = path.toLowerCase()
  return Object.keys(state.fs).find((k) => k.toLowerCase() === low) ?? null
}

function get(state: ShellState, path: string): [string, VFile] | null {
  const k = findKey(state, path)
  return k ? [k, state.fs[k]] : null
}

const parentOf = (p: string) => p.slice(0, p.lastIndexOf('\\')) || p
const baseName = (p: string) => p.slice(p.lastIndexOf('\\') + 1)

function writeWin(state: ShellState, path: string, content: string, append = false) {
  const hit = get(state, path)
  if (hit && hit[1].type === 'file') {
    hit[1].content = append ? hit[1].content + content : content
    hit[1].size = undefined
    hit[1].mtime = state.now
  } else {
    state.fs[path] = { type: 'file', content, mode: 0o644, mtime: state.now }
  }
}

function listDir(state: ShellState, dir: string): string[] {
  const low = dir.toLowerCase() + '\\'
  return Object.keys(state.fs)
    .filter((k) => k.toLowerCase().startsWith(low) && !k.slice(low.length).includes('\\'))
    .sort((a, b) => a.localeCompare(b))
}

function table(state: ShellState, dir: string, items: string[]): string[] {
  const out = ['', `    Directory: ${dir}`, '', 'Mode                 LastWriteTime         Length Name', '----                 -------------         ------ ----']
  for (const k of items) {
    const f = state.fs[k]
    const when = winDate(f.mtime, false).replace(/^(\S+) /, (d) => d.padStart(11, ' ') + ' ')
    out.push(`${f.type === 'dir' ? 'd-----' : '-a----'}       ${when.padEnd(20)} ${f.type === 'dir' ? ''.padStart(14) : String(fileSize(f)).padStart(14)} ${baseName(k)}`)
  }
  out.push('')
  return out
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function splitPipes(line: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let cur = ''
  for (const c of line) {
    if (quote) {
      if (c === quote) quote = null
    } else if (c === '"' || c === "'") quote = c
    else if (c === '{' || c === '(') depth++
    else if (c === '}' || c === ')') depth--
    else if (c === '|' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  parts.push(cur.trim())
  return parts.filter(Boolean)
}

function param(args: string[], name: string): string | undefined {
  const i = args.findIndex((a) => a.toLowerCase() === name.toLowerCase())
  return i >= 0 ? args[i + 1] : undefined
}

function positional(args: string[], skipWithValue: string[] = []): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('-')) {
      if (skipWithValue.includes(a.toLowerCase())) i++
      continue
    }
    out.push(a)
  }
  return out
}

function runLine(line: string, ctx: Ctx): Res {
  const stages = splitPipes(line)
  let prev: Res = { out: [], err: [], code: 0 }
  const errors: string[] = []
  for (const stage of stages) {
    prev = runStage(stage, ctx, prev)
    errors.push(...prev.err)
    if (prev.code && prev.err.length && stages.length > 1) break
  }
  return { ...prev, err: errors }
}

function runStage(stage: string, ctx: Ctx, input: Res): Res {
  const state = ctx.state
  const R = (out: string[] = [], err: string[] = [], code = err.length ? 1 : 0, items?: string[]): Res => ({ out, err, code, items })
  const where = /^(where-object|where|\?)\s*\{\s*\$_\.LastWriteTime\s+-lt\s+\(Get-Date\)\.AddDays\(\s*-?(\d+)\s*\)\s*\}$/i.exec(stage)
  if (where) {
    const days = Number(where[2])
    const items = (input.items ?? []).filter((k) => state.fs[k] && state.now - state.fs[k].mtime > days * DAY)
    return R(items.length ? table(state, parentOf(items[0]), items) : [], [], 0, items)
  }
  if (/^(where-object|where|\?)\b/i.test(stage)) {
    return R([], ['(Simulator) This lab understands: Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) }'])
  }

  const args = tokenize(stage, (s) => s.replace(/\$\(Get-Date\)/gi, winDate(state.now)), false)
  const [rawCmd, ...rest] = args
  const cmd = (rawCmd ?? '').toLowerCase()
  const p = (x: string) => winResolve(ctx.cwd, x)

  // Run a script: .\x.ps1, C:\Lab\x.ps1, & 'C:\Lab\x.ps1', powershell -File x
  if (cmd === '&' && rest[0]) return runScript(p(rest[0]), ctx)
  if (/\.(ps1|bat|cmd)$/i.test(rawCmd ?? '') && (rawCmd.includes('\\') || rawCmd.includes('/'))) return runScript(p(rawCmd), ctx)
  if (cmd === 'powershell' || cmd === 'powershell.exe' || cmd === 'pwsh') {
    const file = param(rest, '-File')
    if (!file) return R([], ['(Simulator) Use: powershell -NoProfile -File C:\\Lab\\script.ps1'])
    return runScript(p(file), ctx)
  }
  if (/\.(ps1|bat|cmd)$/i.test(rawCmd ?? '')) {
    return R([], [
      `${rawCmd} : The term '${rawCmd}' is not recognized as the name of a cmdlet, function, script file, or operable program.`,
      `Suggestion: PowerShell does not run scripts from the current folder by default. Type: .\\${rawCmd}`,
    ])
  }

  switch (cmd) {
    case 'help':
      return R(WIN_HELP)
    case 'clear':
    case 'cls':
    case 'clear-host':
      ctx.clear = true
      return R()
    case 'pwd':
    case 'get-location':
      return R(['', 'Path', '----', ctx.cwd, ''])
    case 'whoami':
      return R(['lab\\student'])
    case 'cd':
    case 'set-location':
    case 'sl': {
      const target = p(rest[0] ?? 'C:\\Lab')
      const hit = get(state, target)
      if (!hit || hit[1].type !== 'dir') return R([], [`Set-Location : Cannot find path '${target}' because it does not exist.`])
      ctx.cwd = hit[0]
      return R()
    }
    case 'ls':
    case 'dir':
    case 'gci':
    case 'get-childitem': {
      const filter = param(rest, '-Filter')
      const pos = positional(rest, ['-filter', '-path'])
      const target = p(param(rest, '-Path') ?? pos[0] ?? '.')
      const hit = get(state, target)
      if (!hit) return R([], [`Get-ChildItem : Cannot find path '${target}' because it does not exist.`])
      let items = hit[1].type === 'dir' ? listDir(state, hit[0]) : [hit[0]]
      if (filter) {
        const re = globToRegExp(filter, true)
        items = items.filter((k) => re.test(baseName(k)))
      }
      return R(items.length ? table(state, hit[0], items) : [], [], 0, items)
    }
    case 'measure-object':
    case 'measure':
      return R(['', `Count    : ${(input.items ?? input.out).length}`, ''])
    case 'remove-item':
    case 'del':
    case 'rm': {
      const whatIf = rest.some((a) => a.toLowerCase() === '-whatif')
      const targets = input.items ?? positional(rest).map((x) => get(state, p(x))?.[0]).filter((x): x is string => !!x)
      if (!input.items && !targets.length) return R([], [`Remove-Item : Cannot find path '${p(positional(rest)[0] ?? '')}' because it does not exist.`])
      if (whatIf) return R(targets.map((k) => `What if: Performing the operation "Remove File" on target "${k}".`))
      for (const k of targets) delete state.fs[k]
      return R()
    }
    case 'get-content':
    case 'gc':
    case 'cat':
    case 'type': {
      const f = rest[0] ? get(state, p(rest[0])) : null
      if (!f || f[1].type !== 'file') return R([], [`Get-Content : Cannot find path '${p(rest[0] ?? '')}' because it does not exist.`])
      return R(f[1].content.replace(/\r?\n$/, '').split(/\r?\n/))
    }
    case 'get-date': {
      const fmt = param(rest, '-Format')
      const d = new Date(state.now)
      if (fmt) {
        const pad = (n: number) => String(n).padStart(2, '0')
        return R([fmt.replace('yyyy', String(d.getUTCFullYear())).replace('MM', pad(d.getUTCMonth() + 1)).replace('dd', pad(d.getUTCDate())).replace('HH', pad(d.getUTCHours())).replace('mm', pad(d.getUTCMinutes())).replace('ss', pad(d.getUTCSeconds()))])
      }
      return R([winDate(state.now)])
    }
    case 'write-output':
    case 'echo':
    case 'write-host':
      return R([rest.join(' ')])
    case 'add-content': {
      const path = param(rest, '-Path') ?? positional(rest, ['-path', '-value'])[0]
      const value = param(rest, '-Value') ?? positional(rest, ['-path', '-value'])[1] ?? ''
      if (!path) return R([], ['Add-Content -Path C:\\Lab\\Logs\\report.log -Value "text"'])
      const full = p(path)
      if (full.toLowerCase().startsWith('c:\\windows')) return R([], [`Add-Content : Access to the path '${full}' is denied.`])
      if (!get(state, parentOf(full))) return R([], [`Add-Content : Could not find a part of the path '${full}'.`])
      writeWin(state, get(state, full)?.[0] ?? full, value + '\n', true)
      return R()
    }
    case 'out-file': {
      const path = param(rest, '-FilePath') ?? positional(rest, ['-filepath', '-encoding'])[0]
      if (!path) return R([], ['Out-File -FilePath C:\\Lab\\Logs\\report.log -Append'])
      const full = p(path)
      if (full.toLowerCase().startsWith('c:\\windows')) return R([], [`Out-File : Access to the path '${full}' is denied.`])
      if (!get(state, parentOf(full))) return R([], [`Out-File : Could not find a part of the path '${full}'.`])
      const append = rest.some((a) => a.toLowerCase() === '-append')
      writeWin(state, get(state, full)?.[0] ?? full, input.out.join('\n') + '\n', append)
      return R()
    }
    case 'new-item':
    case 'mkdir':
    case 'md': {
      const path = p(param(rest, '-Path') ?? positional(rest, ['-path', '-itemtype'])[0] ?? '')
      if (get(state, path)) return R([], [`New-Item : An item with the specified name ${path} already exists.`])
      const isDir = cmd !== 'new-item' || (param(rest, '-ItemType') ?? '').toLowerCase() === 'directory'
      state.fs[path] = { type: isDir ? 'dir' : 'file', content: '', mode: 0o755, mtime: state.now }
      return R(table(state, parentOf(path), [path]))
    }
    case 'notepad':
    case 'notepad.exe':
    case 'edit':
    case 'code': {
      if (!ctx.interactive) return R([], ['(Simulator) An editor cannot open inside a script.'])
      if (!rest[0]) return R([], [`usage: ${cmd} C:\\Lab\\report.ps1`])
      const full = p(rest[0])
      const hit = get(state, full)
      if (!get(state, parentOf(full))) return R([], [`The folder ${parentOf(full)} does not exist.`])
      ctx.editor = { path: hit?.[0] ?? full, kind: 'file', content: hit?.[1].content ?? '' }
      return R()
    }
    case 'schtasks':
    case 'schtasks.exe':
      return schtasks(rest, ctx)
    case 'get-scheduledtask': {
      const rows = state.tasks.map((t) => {
        const i = t.name.lastIndexOf('\\')
        return `${t.name.slice(0, i + 1).padEnd(14)} ${t.name.slice(i + 1).padEnd(22)} Ready`
      })
      return R(['', 'TaskPath       TaskName               State', '--------       --------               -----', ...rows, ''])
    }
    case 'get-scheduledtaskinfo':
    case 'start-scheduledtask': {
      const tp = (param(rest, '-TaskPath') ?? '\\').replace(/^["']|["']$/g, '')
      const tn = param(rest, '-TaskName') ?? positional(rest, ['-taskpath', '-taskname'])[0]
      const full = `${tp.endsWith('\\') ? tp : tp + '\\'}${tn ?? ''}`.replace(/^([^\\])/, '\\$1')
      const task = state.tasks.find((t) => t.name.toLowerCase() === full.toLowerCase())
      if (!task) return R([], [`${rawCmd} : No MSFT_ScheduledTask objects found with property 'TaskName' equal to '${tn ?? ''}'.`])
      if (cmd === 'start-scheduledtask') {
        runTask(task, ctx)
        return R()
      }
      return R([
        '',
        `LastRunTime        : ${task.lastRun ? winDate(task.lastRun) : '11/30/1999 12:00:00 AM'}`,
        `LastTaskResult     : ${task.lastResult ?? 267011}`,
        `NextRunTime        : ${nextRun(task, state.now)}`,
        'NumberOfMissedRuns : 0',
        `TaskName           : ${task.name.slice(task.name.lastIndexOf('\\') + 1)}`,
        `TaskPath           : ${task.name.slice(0, task.name.lastIndexOf('\\') + 1)}`,
        '',
        task.lastResult === null ? '(267011 = 0x41303: the task has not run yet)' : `(${task.lastResult} = 0x${task.lastResult.toString(16).toUpperCase()}${task.lastResult === 0 ? ': success' : task.lastResult === 2 ? ': file not found' : ''})`,
      ])
    }
    case 'timewarp':
      return winTimewarp(rest, ctx)
    case 'history':
    case 'h':
      return R(state.history.map((h, i) => `${String(i + 1).padStart(4)} ${h}`))
    default:
      return R([], [
        `${rawCmd} : The term '${rawCmd}' is not recognized as the name of a cmdlet, function, script file, or operable program.`,
        'Check the spelling of the name, or type help to see what this lab supports.',
      ])
  }
}

function runScript(path: string, ctx: Ctx): Res {
  const hit = get(ctx.state, path)
  if (!hit || hit[1].type !== 'file') {
    return {
      out: [],
      err: [`The term '${path}' is not recognized as the name of a cmdlet, function, script file, or operable program.`],
      code: 2,
    }
  }
  if (ctx.depth > 3) return { out: [], err: ['(Simulator) too many nested scripts'], code: 1 }
  const sub: Ctx = { ...ctx, depth: ctx.depth + 1, interactive: false }
  const out: string[] = []
  const err: string[] = []
  for (const raw of hit[1].content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const exit = /^exit(?:\s+(\d+))?$/i.exec(line)
    if (exit) return { out, err, code: Number(exit[1] ?? 0) }
    const r = runLine(line, sub)
    out.push(...r.out)
    err.push(...r.err)
  }
  ctx.cwd = ctx.cwd // scripts do not change the caller's folder
  return { out, err, code: err.length ? 1 : 0 }
}

// ---------------------------------------------------------------------------
// Scheduled tasks (schtasks)
// ---------------------------------------------------------------------------

function normTask(name: string): string {
  const n = name.replace(/^["']|["']$/g, '').replace(/\//g, '\\')
  return n.startsWith('\\') ? n : `\\${n}`
}

function nextRun(t: WinTask, now: number): string {
  if (t.schedule === 'onstart' || t.schedule === 'onlogon') return 'N/A (runs at startup/logon)'
  const [h, m] = t.time.split(':').map(Number)
  const d = new Date(now)
  let next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m)
  if (next <= now) next += DAY
  return winDate(next)
}

function runTask(task: WinTask, ctx: Ctx) {
  const state = ctx.state
  task.lastRun = state.now
  const action = task.action.trim()
  const fileMatch = /-File\s+("[^"]+"|\S+)/i.exec(action)
  const target = (fileMatch ? fileMatch[1] : /^("[^"]+"|\S+)/.exec(action)?.[1] ?? '').replace(/"/g, '')
  const isPowerShell = /^powershell(\.exe)?\b/i.test(action) && !fileMatch
  if (isPowerShell) {
    task.lastResult = 0
    return
  }
  const sub: Ctx = { state, cwd: SYSTEM32, interactive: false, depth: 0 } // tasks start in System32!
  const full = winResolve(SYSTEM32, target)
  if (!get(state, full)) {
    task.lastResult = 2
    return
  }
  const r = runScript(full, sub)
  task.lastResult = r.code
}

function schtasks(args: string[], ctx: Ctx): Res {
  const state = ctx.state
  const lower = args.map((a) => a.toLowerCase())
  const val = (flag: string) => {
    const i = lower.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const R = (out: string[] = [], err: string[] = [], code = err.length ? 1 : 0): Res => ({ out, err, code })

  if (lower.includes('/create')) {
    const tn = val('/tn')
    const tr = val('/tr')
    const sc = (val('/sc') ?? '').toLowerCase()
    const st = val('/st') ?? ''
    if (!tn || !tr || !sc) return R([], ['ERROR: Invalid syntax. Mandatory option(s) missing: /tn, /tr and /sc are needed.', 'Example: schtasks /create /tn "IT-Lab\\Report" /tr "powershell.exe -File C:\\Lab\\report.ps1" /sc daily /st 18:00'])
    if (!['daily', 'weekly', 'once', 'onstart', 'onlogon'].includes(sc)) return R([], [`ERROR: Invalid value for /sc: "${sc}". Use daily, weekly, once, onstart or onlogon.`])
    if (['daily', 'weekly', 'once'].includes(sc) && !/^\d{2}:\d{2}$/.test(st)) return R([], ['ERROR: Invalid start time. Use /st HH:mm in 24-hour time, e.g. /st 18:00'])
    const name = normTask(tn)
    const existing = state.tasks.findIndex((t) => t.name.toLowerCase() === name.toLowerCase())
    if (existing >= 0 && !lower.includes('/f')) return R([], [`WARNING: The task name "${name.slice(1)}" already exists. (Simulator: add /f to replace it.)`])
    const task: WinTask = { name, action: tr, schedule: sc as WinTask['schedule'], time: st, days: (val('/d') ?? '').split(',').filter(Boolean), runAs: val('/ru') ?? 'lab\\student', lastRun: null, lastResult: null }
    if (existing >= 0) state.tasks[existing] = task
    else state.tasks.push(task)
    return R([`SUCCESS: The scheduled task "${name.slice(1)}" has successfully been created.`])
  }
  if (lower.includes('/query')) {
    const tn = val('/tn')
    const list = tn ? state.tasks.filter((t) => t.name.toLowerCase() === normTask(tn).toLowerCase()) : state.tasks
    if (tn && !list.length) return R([], ['ERROR: The system cannot find the file specified.'])
    if (!list.length) return R(['INFO: There are no scheduled tasks in the IT-Lab folder yet.'])
    if (lower.includes('/v')) {
      const out: string[] = []
      for (const t of list) {
        out.push(
          '',
          `TaskName:        ${t.name}`,
          `Next Run Time:   ${nextRun(t, state.now)}`,
          'Status:          Ready',
          `Last Run Time:   ${t.lastRun ? winDate(t.lastRun) : 'N/A'}`,
          `Last Result:     ${t.lastResult ?? 267011}`,
          `Task To Run:     ${t.action}`,
          'Start In:        N/A',
          `Run As User:     ${t.runAs}`,
          `Schedule Type:   ${t.schedule}${t.time ? ` at ${t.time}` : ''}`,
        )
      }
      return R(out)
    }
    const out = ['', 'Folder: \\IT-Lab', 'TaskName                                 Next Run Time          Status', '======================================== ====================== ===============']
    for (const t of list) out.push(`${t.name.slice(t.name.lastIndexOf('\\') + 1).padEnd(40)} ${nextRun(t, state.now).padEnd(22)} Ready`)
    return R(out)
  }
  if (lower.includes('/run')) {
    const tn = val('/tn')
    const task = tn ? state.tasks.find((t) => t.name.toLowerCase() === normTask(tn).toLowerCase()) : undefined
    if (!task) return R([], ['ERROR: The system cannot find the file specified.'])
    runTask(task, ctx)
    return R([`SUCCESS: Attempted to run the scheduled task "${task.name.slice(1)}".`, '(Check the result with: schtasks /query /tn "' + task.name.slice(1) + '" /v /fo list)'])
  }
  if (lower.includes('/delete')) {
    const tn = val('/tn')
    const idx = tn ? state.tasks.findIndex((t) => t.name.toLowerCase() === normTask(tn).toLowerCase()) : -1
    if (idx < 0) return R([], ['ERROR: The system cannot find the file specified.'])
    if (!lower.includes('/f')) return R([], [`WARNING: Are you sure you want to remove the task "${state.tasks[idx].name.slice(1)}" (Y/N)?`, '(Simulator: add /f to confirm.)'])
    const [removed] = state.tasks.splice(idx, 1)
    return R([`SUCCESS: The scheduled task "${removed.name.slice(1)}" was successfully deleted.`])
  }
  return R([], ['ERROR: Invalid syntax. Try /create, /query, /run or /delete.'])
}

function winTimewarp(args: string[], ctx: Ctx): Res {
  const state = ctx.state
  const dur = parseDuration(args.join(''))
  if (!dur) return { out: [], err: ['usage: timewarp 24h  (Simulator only: jumps the clock forward and runs due tasks)'], code: 1 }
  const from = state.now
  const to = from + Math.min(dur, 8 * DAY)
  const events: { time: number; task: WinTask }[] = []
  for (const t of state.tasks) {
    if (t.schedule !== 'daily' && t.schedule !== 'weekly' && t.schedule !== 'once') continue
    const [h, m] = t.time.split(':').map(Number)
    const d = new Date(from)
    for (let day = 0; day <= 8; day++) {
      const at = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + day, h, m)
      if (at <= from || at > to) continue
      const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(at).getUTCDay()]
      if (t.schedule === 'weekly' && t.days.length && !t.days.map((x) => x.toUpperCase()).includes(dow)) continue
      events.push({ time: at, task: t })
      if (t.schedule === 'once') break
    }
  }
  events.sort((a, b) => a.time - b.time)
  const out = [`⏩ Time jumps from ${winDate(from, false)} to ${winDate(to, false)}.`]
  if (!events.length) out.push('   No tasks were due in that time.')
  for (const ev of events) {
    state.now = ev.time
    runTask(ev.task, ctx)
    out.push(`   ${winDate(ev.time, false)}  ${ev.task.name} ran. Last Result: ${ev.task.lastResult}${ev.task.lastResult === 0 ? ' (success)' : ev.task.lastResult === 2 ? ' (0x2 file not found)' : ''}`)
  }
  state.now = to
  return { out, err: [], code: 0 }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const WIN_HELP = [
  'Commands in this simulated Windows PowerShell:',
  '  Files:     Get-Location (pwd)  Set-Location (cd)  Get-ChildItem (dir, ls) [-Filter *.log]  Get-Content (cat)',
  '             New-Item -ItemType Directory  Add-Content  Out-File  Remove-Item [-WhatIf]',
  '  Pipeline:  Get-ChildItem C:\\Lab\\Logs -Filter *.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -WhatIf',
  '  Editing:   notepad C:\\Lab\\report.ps1   (opens the editor)',
  '  Scripts:   .\\report.ps1    powershell -File C:\\Lab\\report.ps1',
  '  Tasks:     schtasks /create /query /run /delete    Get-ScheduledTask   Get-ScheduledTaskInfo',
  '  Simulator: timewarp 24h  (jump the clock forward and run tasks that are due)',
  '  Other:     cls  history  Get-Date   ·   Tab completes names, ↑ ↓ repeat commands',
]

export function winPrompt(state: ShellState): string {
  return `PS ${state.cwd}>`
}

export function runWindows(input: string, state0: ShellState): RunResult {
  const state = clone(state0)
  const line = input.trim()
  if (line) state.history.push(line)
  const ctx: Ctx = { state, cwd: state.cwd, interactive: true, depth: 0 }
  const r = line ? runLine(line, ctx) : { out: [], err: [], code: 0 }
  state.cwd = ctx.cwd
  const lines: Line[] = [...r.out.map((t) => ({ kind: 'out' as const, text: t })), ...r.err.map((t) => ({ kind: 'err' as const, text: t }))]
  return { lines, state, editor: ctx.editor, clear: ctx.clear, exitCode: r.code }
}

export function saveWindowsEditor(state0: ShellState, req: EditorRequest, content: string): { state: ShellState; lines: Line[] } {
  const state = clone(state0)
  writeWin(state, req.path, content.endsWith('\n') || !content ? content : content + '\n')
  return { state, lines: [{ kind: 'info', text: `Saved ${req.path}` }] }
}
