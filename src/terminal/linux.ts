// A small, safe, simulated Linux shell. Nothing here touches the real computer.
import { CronExpressionParser } from 'cron-parser'
import { analyzeCron, splitCronLine } from '../lib/cron'
import { ansibleAdhoc, ansiblePlaybook, gh, git, inspectWorkflow, simulateRun, yamlProblem, type CmdResult, type Host } from './devops'
import {
  clone, DAY, fileSize, globToRegExp, HOUR, MINUTE, parseDuration, strftime, tokenize, unixDate,
  type EditorRequest, type Line, type RunResult, type ShellState, type VFile,
} from './types'

export const HOME = '/home/student'
const USER = 'student'
const HOSTNAME = 'lab-server'

/** Programs cron can find with its short PATH (/usr/bin:/bin). */
const SYSTEM_BINS = new Set([
  'echo', 'tar', 'find', 'date', 'ls', 'cat', 'grep', 'mkdir', 'rm', 'cp', 'mv', 'touch', 'chmod', 'tail', 'head', 'bash', 'sh',
  'cd', 'pwd', 'whoami', 'hostname', 'sleep', 'true', 'false', 'flock', 'ansible', 'ansible-playbook', 'git', 'wc', 'df', 'du', 'test', '[',
  'basename', 'xargs',
])

interface Ctx {
  state: ShellState
  cwd: string
  env: Record<string, string>
  cron: boolean
  interactive: boolean
  editor?: EditorRequest
  clear?: boolean
  /** Set by `tail -f`: the file the terminal should keep watching. */
  follow?: string
  depth: number
}

// ---------------------------------------------------------------------------
// Paths and files
// ---------------------------------------------------------------------------

export function resolvePath(cwd: string, p: string): string {
  if (!p) return cwd
  let path = p.replace(/^~(?=\/|$)/, HOME)
  if (!path.startsWith('/')) path = `${cwd}/${path}`
  const parts: string[] = []
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return '/' + parts.join('/')
}

const parentOf = (p: string) => p.slice(0, p.lastIndexOf('/')) || '/'
const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1)
const display = (p: string) => (p === HOME ? '~' : p.startsWith(HOME + '/') ? '~' + p.slice(HOME.length) : p)

function ensureParents(state: ShellState, path: string) {
  let p = parentOf(path)
  const missing: string[] = []
  while (p !== '/' && !state.fs[p]) {
    missing.push(p)
    p = parentOf(p)
  }
  for (const dir of missing.reverse()) state.fs[dir] = { type: 'dir', content: '', mode: 0o755, mtime: state.now }
}

export function writeFile(state: ShellState, path: string, content: string, append = false) {
  ensureParents(state, path)
  const existing = state.fs[path]
  if (existing && existing.type === 'file') {
    existing.content = append ? existing.content + content : content
    existing.size = undefined
    existing.mtime = state.now
  } else {
    state.fs[path] = { type: 'file', content, mode: 0o644, mtime: state.now }
  }
}

function children(state: ShellState, dir: string): [string, VFile][] {
  const prefix = dir === '/' ? '/' : dir + '/'
  return Object.entries(state.fs)
    .filter(([p]) => p.startsWith(prefix) && p !== dir && !p.slice(prefix.length).includes('/'))
    .sort(([a], [b]) => a.localeCompare(b))
}

function modeString(f: VFile): string {
  const bits = ['r', 'w', 'x']
  let s = f.type === 'dir' ? 'd' : '-'
  for (let i = 8; i >= 0; i--) s += f.mode & (1 << i) ? bits[(8 - i) % 3] : '-'
  return s
}

function longLine(name: string, f: VFile, now: number): string {
  const size = f.type === 'dir' ? 4096 : fileSize(f)
  const recent = now - f.mtime < 180 * DAY
  const when = recent ? strftime(f.mtime, '%b %e %R') : strftime(f.mtime, '%b %e  %Y')
  return `${modeString(f)} 1 ${USER} ${USER} ${String(size).padStart(7)} ${when} ${name}${f.type === 'dir' ? '/' : ''}`
}

// ---------------------------------------------------------------------------
// Expansion: $VAR, ${VAR}, $(command)
// ---------------------------------------------------------------------------

function expander(ctx: Ctx) {
  return (text: string): string =>
    text
      .replace(/\$\(([^()]*)\)/g, (_, inner: string) => {
        // a $( ) runs in its own little shell, so it must not change $? for the outer line
        const keep = ctx.env['?']
        const out = runSequence(inner, { ...ctx, interactive: false }, '').out.join(' ').trim()
        if (keep === undefined) delete ctx.env['?']
        else ctx.env['?'] = keep
        return out
      })
      .replace(/\$\{(\w+)\}|\$(\w+)|\$\?/g, (m, a?: string, b?: string) => (m === '$?' ? ctx.env['?'] ?? '0' : ctx.env[(a ?? b)!] ?? ''))
}

// ---------------------------------------------------------------------------
// Running command lines
// ---------------------------------------------------------------------------

/** Split a line at top-level operators: not inside quotes, $( ) or ( ). */
function splitTop(text: string, ops: readonly string[]): string[] {
  const parts: string[] = []
  let cur = ''
  let quote: string | null = null
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      cur += c
      if (c === '\\' && quote === '"' && i + 1 < text.length) cur += text[++i]
      else if (c === quote) quote = null
      continue
    }
    if (c === '\\' && i + 1 < text.length) {
      cur += c + text[++i]
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      cur += c
      continue
    }
    if (c === '(') depth++
    else if (c === ')') depth = Math.max(0, depth - 1)
    if (depth === 0) {
      const op = ops.find((o) => text.startsWith(o, i) && !(o === '|' && text[i + 1] === '|'))
      if (op) {
        parts.push(cur)
        cur = ''
        i += op.length - 1
        continue
      }
    }
    cur += c
  }
  parts.push(cur)
  return parts
}

// Each command is split, expanded and run on its own, so $? and $( ) see what the commands before them did.
function runSequence(line: string, ctx: Ctx, stdin: string): CmdResult {
  const out: string[] = []
  const err: string[] = []
  let code = 0
  // split on ; then &&
  for (const group of splitTop(line, [';'])) {
    for (const piece of splitTop(group, ['&&'])) {
      if (!piece.trim()) continue
      const r = runPipeline(piece, ctx, stdin)
      out.push(...r.out)
      err.push(...r.err)
      code = r.code
      ctx.env['?'] = String(code)
      if (code !== 0) break
    }
  }
  return { out, err, code }
}

function runPipeline(text: string, ctx: Ctx, stdin: string): CmdResult {
  const stages = splitTop(text, ['|'])
  let input = stdin
  let result: CmdResult = { out: [], err: [], code: 0 }
  const errors: string[] = []
  stages.forEach((stage, i) => {
    const trimmed = stage.trim()
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      // ( a; b ) runs in a copy of the environment, like a real subshell
      result = runSequence(trimmed.slice(1, -1), { ...ctx, env: { ...ctx.env } }, input)
    } else {
      result = runStage(tokenize(trimmed, expander(ctx)), ctx, input, i < stages.length - 1)
    }
    errors.push(...result.err)
    input = result.out.join('\n')
  })
  return { out: result.out, err: errors, code: result.code }
}

/** One command with its redirections. `piped` means its output feeds another command. */
function runStage(stage: string[], ctx: Ctx, stdin: string, piped: boolean): CmdResult {
  const args: string[] = []
  let target: string | null = null
  let append = false
  let mergeErr = false
  let errTarget: string | null = null
  for (let i = 0; i < stage.length; i++) {
    const t = stage[i]
    if (t === '>' || t === '>>') {
      target = stage[++i] ?? null
      append = t === '>>'
    } else if (t === '2>') errTarget = stage[++i] ?? null
    else if (t === '2>&1') mergeErr = true
    else args.push(t)
  }
  let result = runCommand(expandGlobs(args, ctx), ctx, stdin, piped || target !== null)
  if (errTarget) {
    if (errTarget !== '/dev/null') writeFile(ctx.state, resolvePath(ctx.cwd, errTarget), result.err.length ? result.err.join('\n') + '\n' : '')
    result = { out: result.out, err: [], code: result.code }
  }
  if (target === '/dev/null') {
    result = { out: [], err: mergeErr ? [] : result.err, code: result.code }
  } else if (target) {
    const path = resolvePath(ctx.cwd, target)
    const dir = ctx.state.fs[parentOf(path)]
    if (!dir) {
      result = { out: [], err: [`bash: ${target}: No such file or directory`], code: 1 }
    } else {
      const text = [...result.out, ...(mergeErr ? result.err : [])]
      writeFile(ctx.state, path, text.length ? text.join('\n') + '\n' : '', append)
      result = { out: [], err: mergeErr ? [] : result.err, code: result.code }
    }
  }
  return result
}

/** Commands whose file arguments the shell expands from * and ? patterns. */
const GLOB_CMDS = new Set(['ls', 'rm', 'cat', 'wc', 'head', 'tail', 'mv', 'cp', 'chmod', 'du'])

function expandGlobs(args: string[], ctx: Ctx): string[] {
  const start = args[0] === 'sudo' ? 1 : 0
  if (!GLOB_CMDS.has(args[start] ?? '')) return args
  const out = args.slice(0, start + 1)
  for (const a of args.slice(start + 1)) {
    const slash = a.lastIndexOf('/')
    const dirPart = slash >= 0 ? a.slice(0, slash + 1) : ''
    const pattern = a.slice(slash + 1)
    if (a.startsWith('-') || !/[*?]/.test(pattern) || /[*?]/.test(dirPart)) {
      out.push(a)
      continue
    }
    const re = globToRegExp(pattern)
    const hits = children(ctx.state, resolvePath(ctx.cwd, dirPart))
      .map(([cp]) => baseName(cp))
      .filter((n) => re.test(n) && (!n.startsWith('.') || pattern.startsWith('.')))
    // like bash: a pattern that matches nothing stays as typed
    out.push(...(hits.length ? hits.map((n) => dirPart + n) : [a]))
  }
  return out
}

function isExecutable(f: VFile) {
  return (f.mode & 0o100) !== 0
}

function runScript(path: string, ctx: Ctx, viaShell: boolean, display: string): CmdResult {
  const result = runScriptBody(path, ctx, viaShell, display)
  // A script takes a moment to run. This keeps two runs from getting the same data-HHMMSS name.
  if (ctx.state.fs[path]?.type === 'file') ctx.state.now += 1000
  return result
}

function runScriptBody(path: string, ctx: Ctx, viaShell: boolean, display: string): CmdResult {
  const f = ctx.state.fs[path]
  if (!f) return { out: [], err: [`bash: ${display}: No such file or directory`], code: 127 }
  if (f.type === 'dir') return { out: [], err: [`bash: ${display}: Is a directory`], code: 126 }
  if (!viaShell && !isExecutable(f)) {
    return { out: [], err: [`bash: ${display}: Permission denied`], code: 126 }
  }
  if (ctx.depth > 3) return { out: [], err: ['(Simulator) scripts calling scripts too deeply'], code: 1 }
  if (/\r/.test(f.content)) return { out: [], err: [`${display}: /bin/bash^M: bad interpreter: No such file or directory`], code: 126 }

  const sub: Ctx = { ...ctx, env: { ...ctx.env }, depth: ctx.depth + 1, interactive: false }
  const out: string[] = []
  const err: string[] = []
  // join lines that end with a backslash
  const lines = f.content.replace(/\\\n\s*/g, ' ').split('\n')
  // one frame per open `if`: `on` = this branch runs, `taken` = a branch already ran
  const frames: { on: boolean; taken: boolean }[] = []
  const active = () => frames.every((fr) => fr.on)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const cond = /^if\s+(.+?)\s*(?:;\s*then)?$/.exec(line)
    if (cond) {
      if (active()) {
        const c = runSequence(cond[1], sub, '')
        out.push(...c.out)
        err.push(...c.err)
        frames.push({ on: c.code === 0, taken: c.code === 0 })
      } else frames.push({ on: false, taken: true })
      continue
    }
    if (line === 'then') continue
    if (line === 'else') {
      const fr = frames[frames.length - 1]
      if (fr) {
        fr.on = frames.slice(0, -1).every((x) => x.on) && !fr.taken
        fr.taken = true
      }
      continue
    }
    if (line === 'fi') {
      frames.pop()
      continue
    }
    if (!active()) continue
    const exit = /^exit(?:\s+(\d+))?$/.exec(line)
    if (exit) return { out, err, code: Number(exit[1] ?? 0) }
    if (/^set\s+-/.test(line)) continue
    const assign = /^([A-Za-z_]\w*)=(.*)$/.exec(line)
    if (assign) {
      const value = tokenize(assign[2], expander(sub)).join(' ')
      sub.env[assign[1]] = value
      continue
    }
    if (/^(for|while|case|function|elif)\b/.test(line)) {
      err.push(`(Simulator) "${line.split(/\s/)[0]}" blocks are not supported here. Keep lab scripts to simple commands.`)
      return { out, err, code: 2 }
    }
    const r = runSequence(line, sub, '')
    out.push(...r.out)
    err.push(...r.err.map((e) => e.replace(/^bash:/, `${display}: line ${lines.indexOf(raw) + 1}:`)))
  }
  return { out, err, code: 0 }
}

/** `piped` means the output goes to another command or a file, not to the screen. */
function runCommand(args: string[], ctx: Ctx, stdin: string, piped = false): CmdResult {
  if (!args.length) return { out: [], err: [], code: 0 }
  let [cmd, ...rest] = args
  const state = ctx.state
  const R = (out: string[] = [], err: string[] = [], code = err.length ? 1 : 0): CmdResult => ({ out, err, code })
  const p = (x: string) => resolvePath(ctx.cwd, x)

  if (cmd === 'sudo') {
    if (!rest.length) return R([], ['usage: sudo <command>'])
    ;[cmd, ...rest] = rest
  }

  // Scripts and programs given by path
  if (cmd.includes('/')) {
    const full = p(cmd)
    if (/\/usr\/bin\/|\/bin\//.test(full) && !state.fs[full]) {
      const name = baseName(full)
      if (SYSTEM_BINS.has(name)) return runCommand([name, ...rest], ctx, stdin)
    }
    return runScript(full, ctx, false, cmd)
  }

  // cron has a short PATH: only system programs are found
  const host: Host = {
    state,
    cwd: ctx.cwd,
    env: ctx.env,
    resolve: p,
    read: (path) => (state.fs[path]?.type === 'file' ? state.fs[path].content : null),
    write: (path, content) => writeFile(state, path, content),
  }

  switch (cmd) {
    case 'help':
      return R(HELP)
    case 'clear':
      ctx.clear = true
      return R()
    case 'pwd':
      return R([ctx.cwd])
    case 'whoami':
      return R([USER])
    case 'hostname':
      return R([HOSTNAME])
    case 'true':
      return R()
    case 'false':
      return R([], [], 1)
    case 'history':
      return R(state.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`))
    case 'exit':
      return R(['(Simulator) This terminal is pretend, so there is nothing to exit. Keep practising!'])
    case 'man':
      return R(['(Simulator) No manual pages here. Type help, or open the Cheat Sheet page.'])
    case 'sleep':
      return R()
    case 'cd': {
      const target = p(rest[0] ?? HOME)
      const f = state.fs[target]
      if (!f) return R([], [`bash: cd: ${rest[0]}: No such file or directory`])
      if (f.type !== 'dir') return R([], [`bash: cd: ${rest[0]}: Not a directory`])
      ctx.cwd = target
      return R()
    }
    case 'ls': {
      const flags = rest.filter((a) => a.startsWith('-')).join('')
      const long = flags.includes('l')
      const all = flags.includes('a')
      const newestFirst = flags.includes('t')
      // on a screen ls packs names into a row; into a pipe or file it writes one name per line
      const onePerLine = piped || flags.includes('1')
      const targets = rest.filter((a) => !a.startsWith('-'))
      const fileTargets: [string, VFile][] = []
      const dirTargets: [string, string][] = []
      for (const t of targets.length ? targets : ['.']) {
        const path = p(t)
        const f = state.fs[path]
        if (!f) return R([], [`ls: cannot access '${t}': No such file or directory`], 2)
        if (f.type === 'file') fileTargets.push([t, f])
        else dirTargets.push([t, path])
      }
      const out: string[] = []
      if (newestFirst) fileTargets.sort(([an, af], [bn, bf]) => bf.mtime - af.mtime || an.localeCompare(bn))
      for (const [t, f] of fileTargets) out.push(long ? longLine(t, f, state.now) : t)
      for (const [t, path] of dirTargets) {
        if (targets.length > 1) out.push(`${t}:`)
        let items = children(state, path).filter(([cp]) => all || !baseName(cp).startsWith('.'))
        if (newestFirst) items = [...items].sort(([ap, af], [bp, bf]) => bf.mtime - af.mtime || baseName(ap).localeCompare(baseName(bp)))
        const names = items.map(([cp, cf]) => baseName(cp) + (cf.type === 'dir' ? '/' : ''))
        if (long) {
          out.push(`total ${items.length * 4}`)
          for (const [cp, cf] of items) out.push(longLine(baseName(cp), cf, state.now))
        } else if (onePerLine) out.push(...names)
        else if (items.length) out.push(names.join('  '))
      }
      return R(out)
    }
    case 'cat': {
      if (!rest.length) return R(stdin ? stdin.replace(/\n$/, '').split('\n') : [])
      const out: string[] = []
      for (const t of rest) {
        const f = state.fs[p(t)]
        if (!f) return R(out, [`cat: ${t}: No such file or directory`])
        if (f.type === 'dir') return R(out, [`cat: ${t}: Is a directory`])
        out.push(...f.content.replace(/\n$/, '').split('\n'))
      }
      return R(out)
    }
    case 'head':
    case 'tail': {
      let n = 10
      let fromLine: number | null = null
      let follow = false
      const files: string[] = []
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '-n') {
          const v = rest[++i] ?? ''
          // tail -n +4 means "from line 4 on"
          if (v.startsWith('+')) fromLine = Number(v.slice(1))
          else n = Number(v)
        } else if (rest[i] === '-f' || rest[i] === '-F') follow = true
        else if (/^-\d+$/.test(rest[i])) n = Number(rest[i].slice(1))
        else files.push(rest[i])
      }
      let text = stdin
      if (files[0]) {
        const f = state.fs[p(files[0])]
        if (!f || f.type !== 'file') return R([], [`${cmd}: cannot open '${files[0]}' for reading: No such file or directory`])
        text = f.content
      }
      const lines = text.replace(/\n$/, '').split('\n').filter((l, i, a) => l !== '' || i < a.length - 1)
      if (follow && cmd === 'tail' && files[0] && ctx.interactive && !piped) ctx.follow = p(files[0])
      if (cmd === 'head') return R(lines.slice(0, n))
      return R(fromLine !== null ? lines.slice(Math.max(0, fromLine - 1)) : lines.slice(-n))
    }
    case 'grep': {
      const flags = rest.filter((a) => /^-[a-z]+$/.test(a)).join('')
      const [pattern, file] = rest.filter((a) => !/^-[a-z]+$/.test(a))
      if (!pattern) return R([], ['usage: grep PATTERN [FILE]'])
      let text = stdin
      if (file) {
        const f = state.fs[p(file)]
        if (!f || f.type !== 'file') return R([], [`grep: ${file}: No such file or directory`], 2)
        text = f.content
      }
      let re: RegExp
      try {
        re = new RegExp(pattern, flags.includes('i') ? 'i' : '')
      } catch {
        re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      }
      const invert = flags.includes('v')
      const lines = text.split('\n').filter((l) => l && re.test(l) !== invert)
      return R(lines, [], lines.length ? 0 : 1)
    }
    case 'wc': {
      const text = rest[1] ? state.fs[p(rest[1])]?.content ?? '' : stdin
      return R([String(text.replace(/\n$/, '').split('\n').filter(Boolean).length)])
    }
    case 'echo': {
      const words = rest.filter((a, i) => !(i === 0 && (a === '-e' || a === '-n')))
      return R([words.join(' ')])
    }
    case 'date': {
      const fmt = rest.find((a) => a.startsWith('+'))
      return R([fmt ? strftime(state.now, fmt.slice(1)) : `${strftime(state.now, '%a %b %e %T')} PST ${strftime(state.now, '%Y')}`])
    }
    case 'mkdir': {
      const parents = rest.includes('-p')
      for (const t of rest.filter((a) => !a.startsWith('-'))) {
        const path = p(t)
        if (state.fs[path]) {
          if (!parents) return R([], [`mkdir: cannot create directory '${t}': File exists`])
          continue
        }
        if (!parents && !state.fs[parentOf(path)]) return R([], [`mkdir: cannot create directory '${t}': No such file or directory`])
        ensureParents(state, path + '/x')
      }
      return R()
    }
    case 'touch': {
      for (const t of rest) {
        const path = p(t)
        if (state.fs[path]) state.fs[path].mtime = state.now
        else if (!state.fs[parentOf(path)]) return R([], [`touch: cannot touch '${t}': No such file or directory`])
        else writeFile(state, path, '')
      }
      return R()
    }
    case 'rm': {
      const recursive = rest.some((a) => /^-[a-z]*r/i.test(a))
      const force = rest.some((a) => /^-[a-z]*f/.test(a))
      for (const t of rest.filter((a) => !a.startsWith('-'))) {
        const path = p(t)
        if (path === '/' || path === HOME) return R([], ['(Simulator) Refusing to delete that. Real rm would happily wipe it. Always double-check rm paths!'])
        const f = state.fs[path]
        if (!f) {
          if (force) continue
          return R([], [`rm: cannot remove '${t}': No such file or directory`])
        }
        if (f.type === 'dir' && !recursive) return R([], [`rm: cannot remove '${t}': Is a directory`])
        for (const k of Object.keys(state.fs)) if (k === path || k.startsWith(path + '/')) delete state.fs[k]
      }
      return R()
    }
    case 'cp':
    case 'mv': {
      const files = rest.filter((a) => !a.startsWith('-'))
      if (files.length !== 2) return R([], [`usage: ${cmd} SOURCE DEST`])
      const src = p(files[0])
      let dest = p(files[1])
      const f = state.fs[src]
      if (!f) return R([], [`${cmd}: cannot stat '${files[0]}': No such file or directory`])
      if (f.type === 'dir') {
        // moving a folder moves everything inside it
        if (cmd === 'cp') return R([], [`cp: -r not specified; omitting directory '${files[0]}'`])
        if (state.fs[dest]?.type === 'dir') dest = `${dest}/${baseName(src)}`
        if (dest === src || dest.startsWith(src + '/')) return R([], [`mv: cannot move '${files[0]}' to a subdirectory of itself`])
        if (!state.fs[parentOf(dest)]) return R([], [`mv: cannot move '${files[0]}' to '${files[1]}': No such file or directory`])
        for (const k of Object.keys(state.fs)) {
          if (k === src || k.startsWith(src + '/')) {
            state.fs[dest + k.slice(src.length)] = state.fs[k]
            delete state.fs[k]
          }
        }
        return R()
      }
      if (state.fs[dest]?.type === 'dir') dest = `${dest}/${baseName(src)}`
      state.fs[dest] = { ...f, mtime: cmd === 'cp' ? state.now : f.mtime }
      if (cmd === 'mv') delete state.fs[src]
      return R()
    }
    case 'chmod': {
      const [modeArg, ...files] = rest
      if (!modeArg || !files.length) return R([], ['usage: chmod +x FILE   or   chmod 700 FILE'])
      for (const t of files) {
        const f = state.fs[p(t)]
        if (!f) return R([], [`chmod: cannot access '${t}': No such file or directory`])
        if (/^[0-7]{3}$/.test(modeArg)) f.mode = parseInt(modeArg, 8)
        else {
          const m = /^([ugoa]*)([+-])([rwx]+)$/.exec(modeArg)
          if (!m) return R([], [`chmod: invalid mode: '${modeArg}'`])
          const who = m[1] || 'a'
          let mask = 0
          for (const ch of m[3]) {
            const bit = ch === 'r' ? 4 : ch === 'w' ? 2 : 1
            if (who.includes('u') || who.includes('a')) mask |= bit << 6
            if (who.includes('g') || who.includes('a')) mask |= bit << 3
            if (who.includes('o') || who.includes('a')) mask |= bit
          }
          f.mode = m[2] === '+' ? f.mode | mask : f.mode & ~mask
        }
      }
      return R()
    }
    case 'nano':
    case 'vim':
    case 'vi':
    case 'edit':
    case 'code': {
      if (!ctx.interactive) return R([], [`(Simulator) ${cmd} needs a person at the keyboard; it cannot run inside a script or cron job.`])
      if (!rest[0]) return R([], [`usage: ${cmd} FILE`])
      const path = p(rest[0])
      const f = state.fs[path]
      if (f?.type === 'dir') return R([], [`${rest[0]} is a directory`])
      if (!state.fs[parentOf(path)]) return R([], [`(Simulator) The folder ${display(parentOf(path))} does not exist. Create it first with mkdir -p`])
      ctx.editor = { path, kind: 'file', content: f?.content ?? '' }
      return R()
    }
    case 'bash':
    case 'sh': {
      if (!rest[0]) return R([], ['(Simulator) Interactive shells are not available. Run a script: bash backup.sh'])
      if (rest[0] === '-c') return runSequence(rest.slice(1).join(' '), ctx, stdin)
      return runScript(p(rest[0]), ctx, true, rest[0])
    }
    case 'tar': {
      const flags = rest[0] ?? ''
      if (!/^-?[czvf]*c[czvf]*f$/.test(flags)) return R([], ['(Simulator) Use tar to create an archive: tar -czf DEST.tar.gz FOLDER'])
      // tar -czf DEST [-C DIR] SOURCE...: -C makes the sources relative to DIR
      let dest: string | undefined
      let base = ctx.cwd
      const sources: string[] = []
      for (let i = 1; i < rest.length; i++) {
        if (rest[i] === '-C') base = p(rest[++i] ?? '.')
        else if (dest === undefined) dest = rest[i]
        else sources.push(rest[i])
      }
      if (!dest || !sources.length) return R([], ['tar: Cowardly refusing to create an empty archive'], 2)
      let total = 0
      for (const s of sources) {
        const sp = resolvePath(base, s)
        const f = state.fs[sp]
        if (!f) return R([], [`tar: ${s}: Cannot stat: No such file or directory`, 'tar: Exiting with failure status due to previous errors'], 2)
        for (const [k, v] of Object.entries(state.fs)) if ((k === sp || k.startsWith(sp + '/')) && v.type === 'file') total += fileSize(v)
      }
      const destPath = p(dest)
      if (!state.fs[parentOf(destPath)]) return R([], [`tar (child): ${dest}: Cannot open: No such file or directory`], 2)
      writeFile(state, destPath, '(compressed archive)')
      state.fs[destPath].size = Math.max(64, Math.round(total * 0.31))
      return R(flags.includes('v') ? sources.map((s) => `${s.replace(/^\//, '')}/`) : [])
    }
    case 'find': {
      const start = rest[0] && !rest[0].startsWith('-') ? rest[0] : '.'
      const opts = rest[0] && !rest[0].startsWith('-') ? rest.slice(1) : rest
      let nameRe: RegExp | null = null
      let type: string | null = null
      let mtime: string | null = null
      let doDelete = false
      let doPrint = false
      for (let i = 0; i < opts.length; i++) {
        const o = opts[i]
        if (o === '-name') nameRe = globToRegExp(opts[++i] ?? '*')
        else if (o === '-type') type = opts[++i] ?? null
        else if (o === '-mtime') mtime = opts[++i] ?? null
        else if (o === '-delete') doDelete = true
        else if (o === '-print') doPrint = true
        else return R([], [`find: unknown predicate '${o}' (this lab supports -name, -type, -mtime, -print, -delete)`])
      }
      const root = p(start)
      if (!state.fs[root]) return R([], [`find: '${start}': No such file or directory`])
      const out: string[] = []
      const matches = Object.entries(state.fs)
        .filter(([k]) => k === root || k.startsWith(root + '/'))
        .filter(([k, f]) => {
          if (type === 'f' && f.type !== 'file') return false
          if (type === 'd' && f.type !== 'dir') return false
          if (nameRe && !nameRe.test(baseName(k))) return false
          if (mtime) {
            const age = Math.floor((state.now - f.mtime) / DAY)
            const n = Number(mtime.replace(/^[+-]/, ''))
            if (mtime.startsWith('+') ? !(age > n) : mtime.startsWith('-') ? !(age < n) : age !== n) return false
          }
          return true
        })
        .sort(([a], [b]) => a.localeCompare(b))
      for (const [k] of matches) {
        const shown = start.startsWith('/') || start.startsWith('~') ? k : (start === '.' ? '.' : start) + k.slice(root.length)
        if (doPrint || !doDelete) out.push(shown)
        if (doDelete) delete state.fs[k]
      }
      return R(out)
    }
    case 'basename': {
      const name = baseName(rest[0] ?? '')
      return R([rest[1] && name.endsWith(rest[1]) ? name.slice(0, -rest[1].length) : name])
    }
    case 'xargs': {
      // xargs [-r] COMMAND: runs COMMAND with the input lines added as arguments
      const skipEmpty = rest[0] === '-r'
      const cmdArgs = skipEmpty ? rest.slice(1) : rest
      const items = stdin.split('\n').map((s) => s.trim()).filter(Boolean)
      if (!items.length && skipEmpty) return R()
      return runCommand([...(cmdArgs.length ? cmdArgs : ['echo']), ...items], ctx, '')
    }
    case '[':
    case 'test': {
      let a = rest
      if (cmd === '[') {
        if (a[a.length - 1] !== ']') return R([], ["bash: [: missing `]'"], 2)
        a = a.slice(0, -1)
      }
      const negate = a[0] === '!'
      if (negate) a = a.slice(1)
      let ok = false
      if (a.length === 1) ok = a[0] !== ''
      else if (a.length === 2) {
        const [op, v] = a
        const f = state.fs[p(v)]
        if (op === '-d') ok = f?.type === 'dir'
        else if (op === '-f') ok = f?.type === 'file'
        else if (op === '-e') ok = !!f
        else if (op === '-s') ok = !!f && (f.type === 'dir' || fileSize(f) > 0)
        else if (op === '-z') ok = v === ''
        else if (op === '-n') ok = v !== ''
        else return R([], [`bash: [: ${op}: unary operator expected`], 2)
      } else if (a.length === 3) {
        const [x, op, y] = a
        if (op === '=' || op === '==') ok = x === y
        else if (op === '!=') ok = x !== y
        else if (op === '-eq') ok = Number(x) === Number(y)
        else if (op === '-ne') ok = Number(x) !== Number(y)
        else if (op === '-lt') ok = Number(x) < Number(y)
        else if (op === '-gt') ok = Number(x) > Number(y)
        else return R([], [`bash: [: ${op}: binary operator expected`], 2)
      }
      return R([], [], ok !== negate ? 0 : 1)
    }
    case 'df':
      return R(['Filesystem     Size  Used Avail Use% Mounted on', '/dev/sda1       50G   31G   19G  62% /'])
    case 'flock': {
      const args2 = rest.filter((a) => a !== '-n')
      return runCommand(args2.slice(1), ctx, stdin)
    }
    case 'crontab':
      return crontabCmd(rest, ctx, stdin)
    case 'at':
      return atCmd(rest, ctx, stdin)
    case 'atq':
      return R(state.atJobs.map((j) => `${j.id}\t${unixDate(j.time)} a ${USER}`))
    case 'atrm': {
      const id = Number(rest[0])
      const before = state.atJobs.length
      state.atJobs = state.atJobs.filter((j) => j.id !== id)
      return before === state.atJobs.length ? R([], [`Cannot find jobid ${rest[0] ?? ''}`]) : R()
    }
    case 'timewarp':
      return timewarp(rest, ctx)
    case 'ansible':
      return ansibleAdhoc(host, rest)
    case 'ansible-playbook':
      return ansiblePlaybook(host, rest)
    case 'git':
      return git(host, rest)
    case 'gh':
      return gh(host, rest)
    default: {
      const f = state.fs[p(cmd)]
      if (f && f.type === 'file') {
        return R([], [`${cmd}: command not found`, `(Tip: to run a script in this folder, type ./${cmd})`], 127)
      }
      return R([], [ctx.cron ? `/bin/sh: 1: ${cmd}: not found` : `${cmd}: command not found`], 127)
    }
  }
}

// ---------------------------------------------------------------------------
// crontab, at, timewarp
// ---------------------------------------------------------------------------

function crontabCmd(args: string[], ctx: Ctx, stdin: string): CmdResult {
  const state = ctx.state
  // crontab -  (read the new crontab from a pipe)  or  crontab FILE
  if (args[0] === '-' || (args.length === 1 && !args[0].startsWith('-'))) {
    const text = args[0] === '-' ? stdin : state.fs[resolvePath(ctx.cwd, args[0])]?.content
    if (text === undefined) return { out: [], err: [`${args[0]}: No such file or directory`], code: 1 }
    state.crontab = text && !text.endsWith('\n') ? text + '\n' : text
    return { out: cronWarnings(state.crontab).map((l) => l.text), err: [], code: 0 }
  }
  if (args.includes('-l')) {
    if (!state.crontab.trim()) return { out: [], err: [`no crontab for ${USER}`], code: 1 }
    return { out: state.crontab.replace(/\n$/, '').split('\n'), err: [], code: 0 }
  }
  if (args.includes('-e')) {
    if (!ctx.interactive) return { out: [], err: ['crontab -e needs a person at the keyboard'], code: 1 }
    ctx.editor = {
      path: 'crontab',
      kind: 'crontab',
      content: state.crontab || '# m h  dom mon dow   command\n',
    }
    return { out: [], err: [], code: 0 }
  }
  if (args.includes('-r')) {
    state.crontab = ''
    return { out: ['(Simulator) All your cron jobs were deleted. Real crontab -r does this WITHOUT asking.', 'That is why we always edit with crontab -e.'], err: [], code: 0 }
  }
  return { out: [], err: ['usage: crontab -l (list) | crontab -e (edit) | crontab -r (remove all)'], code: 1 }
}

export function parseAtTime(spec: string, now: number): number | null {
  const s = spec.trim().toLowerCase()
  const rel = /^now\s*\+\s*(\d+)\s*(minutes?|hours?|days?)$/.exec(s)
  if (rel) {
    const n = Number(rel[1])
    return now + n * (rel[2].startsWith('minute') ? MINUTE : rel[2].startsWith('hour') ? HOUR : DAY)
  }
  const abs = /^(\d{1,2}):(\d{2})(\s+tomorrow)?$/.exec(s)
  if (abs) {
    const d = new Date(now)
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(abs[1]), Number(abs[2]))
    if (abs[3] || t <= now) t += DAY
    return t
  }
  return null
}

function atCmd(args: string[], ctx: Ctx, stdin: string): CmdResult {
  const spec = args.join(' ')
  if (!spec) return { out: [], err: ['usage: echo "COMMAND" | at now + 2 hours'], code: 1 }
  const time = parseAtTime(spec, ctx.state.now)
  if (time === null) return { out: [], err: ['syntax error. Last token seen: ' + (args[args.length - 1] ?? ''), 'Garbled time', '(This lab understands: now + N minutes/hours/days, HH:MM, HH:MM tomorrow)'], code: 1 }
  if (!stdin.trim()) {
    return { out: [], err: ['(Simulator) Real at now waits for you to type commands and press Ctrl+D.', `Here, pipe the command in instead:  echo "/home/student/lab/report.sh" | at ${spec}`], code: 1 }
  }
  const id = ctx.state.nextAtId++
  ctx.state.atJobs.push({ id, time, command: stdin.trim() })
  return { out: [], err: ['warning: commands will be executed using /bin/sh', `job ${id} at ${unixDate(time)}`], code: 0 }
}

interface TimedEvent {
  time: number
  kind: 'cron' | 'at' | 'gh'
  command: string
  ref?: string
}

function cronCommand(command: string): { cmd: string; truncated: boolean } {
  // cron turns an unescaped % into a newline: everything after it is lost
  const m = /(^|[^\\])%/.exec(command)
  const cut = m ? command.slice(0, m.index + m[1].length) : command
  return { cmd: cut.replace(/\\%/g, '%'), truncated: !!m }
}

function timewarp(args: string[], ctx: Ctx): CmdResult {
  const state = ctx.state
  const dur = parseDuration(args.join(''))
  if (!dur) return { out: [], err: ['usage: timewarp 6h   (also 30m, 1d). Simulator only: jumps the clock forward and runs due jobs.'], code: 1 }
  if (dur > 8 * DAY) return { out: [], err: ['(Simulator) Jump at most 8 days at a time.'], code: 1 }
  const from = state.now
  const to = from + dur
  const events: TimedEvent[] = []

  for (const raw of state.crontab.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || /^[A-Z_]+=/.test(line)) continue
    const a = analyzeCron(line)
    if (!a.valid || !a.parts?.command) continue
    try {
      const it = CronExpressionParser.parse(a.schedule!, { currentDate: new Date(from), endDate: new Date(to), tz: 'UTC' })
      let n = 0
      while (it.hasNext() && n < 200) {
        events.push({ time: it.next().getTime(), kind: 'cron', command: a.parts.command })
        n++
      }
    } catch {
      /* no runs in range */
    }
  }
  for (const j of state.atJobs) if (j.time > from && j.time <= to) events.push({ time: j.time, kind: 'at', command: j.command, ref: String(j.id) })
  // GitHub Actions schedules are UTC; the lab clock is Manila time (UTC+8)
  for (const [path, content] of Object.entries(state.ghWorkflows)) {
    for (const cron of inspectWorkflow(content).crons) {
      try {
        const it = CronExpressionParser.parse(cron, { currentDate: new Date(from - 8 * HOUR), endDate: new Date(to - 8 * HOUR), tz: 'UTC' })
        let n = 0
        while (it.hasNext() && n < 20) {
          events.push({ time: it.next().getTime() + 8 * HOUR + 4 * MINUTE, kind: 'gh', command: path })
          n++
        }
      } catch {
        /* none */
      }
    }
  }
  events.sort((a, b) => a.time - b.time)

  const out = [`⏩ Time jumps from ${strftime(from, '%a %R')} to ${strftime(to, '%a %R')} (${args.join('')}).`]
  if (!events.length) out.push('   Nothing was scheduled in that time. (Check crontab -l, atq, or gh workflow list.)')
  let shown = 0
  const total = events.length
  let pid = 2300
  for (const ev of events) {
    state.now = ev.time
    pid += 7
    if (ev.kind === 'gh') {
      const host: Host = {
        state, cwd: HOME, env: {}, resolve: (x) => resolvePath(HOME, x),
        read: (x) => state.fs[x]?.content ?? null, write: (x, c) => writeFile(state, x, c),
      }
      const run = simulateRun(host, ev.command, state.ghWorkflows[ev.command], 'schedule', ev.time)
      out.push(`   ${strftime(ev.time, '%a %R')}  GitHub Actions scheduled run #${run.id}: ${run.conclusion === 'success' ? '✓ success' : '✗ failure'} (started a few minutes late, which is normal)`)
      continue
    }
    const cronCtx: Ctx = { state, cwd: HOME, env: { HOME, USER, LOGNAME: USER, PATH: '/usr/bin:/bin', SHELL: '/bin/sh' }, cron: true, interactive: false, depth: 0 }
    const { cmd, truncated } = ev.kind === 'cron' ? cronCommand(ev.command) : { cmd: ev.command, truncated: false }
    const tag = ev.kind === 'cron' ? 'CRON' : 'atd'
    writeFile(state, '/var/log/syslog', `${strftime(ev.time, '%b %e %T')} ${HOSTNAME} ${tag}[${pid}]: (${USER}) CMD (${ev.command})\n`, true)
    const r = runSequence(cmd, cronCtx, '')
    const leftover = [...r.out, ...r.err]
    if (leftover.length) {
      // cron mails any output that was not redirected
      writeFile(state, `/var/mail/${USER}`, `From: Cron Daemon\nSubject: Cron <${USER}@${HOSTNAME}> ${ev.command}\nDate: ${unixDate(ev.time)}\n\n${leftover.join('\n')}\n\n`, true)
    }
    if (ev.kind === 'at') state.atJobs = state.atJobs.filter((j) => String(j.id) !== ev.ref)
    if (shown < 8) {
      const status = r.code === 0 ? '✓ exit 0' : `✗ exit ${r.code}`
      out.push(`   ${strftime(ev.time, '%a %R')}  ${ev.kind === 'cron' ? 'cron' : `at job ${ev.ref}`} ran: ${ev.command}  ${status}`)
      if (truncated) out.push('      ⚠ The command had a % so cron cut it short. Escape it as \\%.')
      if (leftover.length) out.push(`      ↳ output was not saved to a log, so cron mailed it: cat /var/mail/${USER}`)
    }
    shown++
  }
  if (total > 8) out.push(`   …and ${total - 8} more runs (see grep CRON /var/log/syslog).`)
  state.now = to
  return { out, err: [], code: 0 }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const HELP = [
  'Commands in this simulated Linux terminal:',
  '  Files:     pwd  ls [-l]  cd DIR  cat FILE  mkdir -p DIR  touch  cp  mv  rm  chmod +x|700 FILE',
  '  Editing:   nano FILE   (opens the editor; also edit, vim, code)',
  '  Scripts:   ./script.sh   bash script.sh   echo   date [+%F]   tar -czf   find ... -mtime +7 -print',
  '  Logs:      grep [-v] TEXT FILE   tail [-n 5] [-f] FILE   head FILE   (tail -f: watch a log, Ctrl+C stops)',
  '  Schedule:  crontab -l | -e     echo "CMD" | at now + 2 hours    atq    atrm N',
  '  DevOps:    ansible  ansible-playbook  git  gh',
  '  Simulator: timewarp 6h  (jump the clock forward and run any jobs that are due)',
  '  Other:     clear  history  whoami  hostname   ·   Tab completes names, ↑ ↓ repeat commands',
]

export function prompt(state: ShellState): string {
  return `${USER}@${HOSTNAME}:${display(state.cwd)}$`
}

/** `stdin` is the body of a heredoc (cat > file << 'EOF'), when the command has one. */
export function runLinux(input: string, state0: ShellState, stdin = ''): RunResult {
  const state = clone(state0)
  const line = input.trim()
  if (line) state.history.push(line)
  const ctx: Ctx = { state, cwd: state.cwd, env: { HOME, USER, PATH: '/usr/local/bin:/usr/bin:/bin', SHELL: '/bin/bash' }, cron: false, interactive: true, depth: 0 }
  const r = line ? runSequence(line, ctx, stdin) : { out: [], err: [], code: 0 }
  state.cwd = ctx.cwd
  const lines: Line[] = [...r.out.map((t) => ({ kind: 'out' as const, text: t })), ...r.err.map((t) => ({ kind: 'err' as const, text: t }))]
  return { lines, state, editor: ctx.editor, clear: ctx.clear, follow: ctx.follow, exitCode: r.code }
}

/** Save from the editor. Returns new state and any messages. */
export function saveLinuxEditor(state0: ShellState, req: EditorRequest, content: string): { state: ShellState; lines: Line[] } {
  const state = clone(state0)
  const text = content.endsWith('\n') || !content ? content : content + '\n'
  if (req.kind === 'crontab') {
    state.crontab = text
    const lines: Line[] = [{ kind: 'out', text: 'crontab: installing new crontab' }]
    for (const l of cronWarnings(text)) lines.push(l)
    return { state, lines }
  }
  const existed = !!state.fs[req.path]
  writeFile(state, req.path, text)
  const lines: Line[] = [{ kind: 'info', text: `Saved ${display(req.path)} (${text.split('\n').length - 1} lines)${existed ? '' : ' - new file'}` }]
  if (/\.ya?ml$/.test(req.path)) {
    const problem = yamlProblem(text)
    lines.push(problem ? { kind: 'err', text: `YAML problem: ${problem}` } : { kind: 'ok', text: 'YAML looks valid.' })
  }
  return { state, lines }
}

export function cronWarnings(text: string): Line[] {
  const lines: Line[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || /^[A-Z_]+=/.test(line)) continue
    const parts = splitCronLine(line)
    const a = analyzeCron(line)
    for (const issue of a.issues) lines.push({ kind: issue.severity === 'error' ? 'err' : 'info', text: `${issue.severity === 'error' ? 'error' : 'warning'} in "${line}": ${issue.message}` })
    if (parts && !parts.command) lines.push({ kind: 'err', text: `error in "${line}": no command after the five time fields` })
  }
  return lines
}
