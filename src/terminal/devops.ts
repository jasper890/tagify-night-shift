// Simulated Ansible, git, GitHub and GitHub Actions. Nothing here talks to a network.
import { parse as parseYaml, YAMLParseError } from 'yaml'
import { analyzeCron } from '../lib/cron'
import type { GhRun, ShellState } from './types'
import { strftime } from './types'

/** File access the simulators need (provided by the shell). */
export interface Host {
  state: ShellState
  read(path: string): string | null
  write(path: string, content: string): void
  resolve(path: string): string
  cwd: string
  env: Record<string, string>
}

export interface CmdResult {
  out: string[]
  err: string[]
  code: number
}

const ok = (out: string[] = []): CmdResult => ({ out, err: [], code: 0 })
const fail = (err: string[], code = 1, out: string[] = []): CmdResult => ({ out, err, code })

// ---------------------------------------------------------------------------
// YAML helpers
// ---------------------------------------------------------------------------

export function yamlProblem(text: string): string | null {
  try {
    parseYaml(text)
    return null
  } catch (e) {
    if (e instanceof YAMLParseError) {
      const line = e.linePos?.[0]?.line
      const first = e.message.split('\n')[0]
      return line ? `Line ${line}: ${first}` : first
    }
    return String(e)
  }
}

function loadYaml(text: string): { data: unknown; error: string | null } {
  const error = yamlProblem(text)
  return { data: error ? null : parseYaml(text), error }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export interface Inventory {
  groups: Record<string, string[]>
  hostVars: Record<string, Record<string, string>>
}

export function parseInventory(text: string): Inventory {
  const groups: Record<string, string[]> = { all: [] }
  const groupVars: Record<string, Record<string, string>> = {}
  const hostVars: Record<string, Record<string, string>> = {}
  let section = 'ungrouped'
  let isVars = false
  for (const raw of text.split('\n')) {
    const line = raw.replace(/[;#].*$/, '').trim()
    if (!line) continue
    const sec = /^\[([^\]]+)\]$/.exec(line)
    if (sec) {
      isVars = sec[1].endsWith(':vars')
      section = sec[1].replace(/:vars$/, '')
      if (!isVars) groups[section] ??= []
      continue
    }
    if (isVars) {
      const eq = line.indexOf('=')
      if (eq > 0) (groupVars[section] ??= {})[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
      continue
    }
    const [host, ...pairs] = line.split(/\s+/)
    groups[section] ??= []
    if (!groups[section].includes(host)) groups[section].push(host)
    if (!groups.all.includes(host)) groups.all.push(host)
    hostVars[host] ??= {}
    for (const p of pairs) {
      const eq = p.indexOf('=')
      if (eq > 0) hostVars[host][p.slice(0, eq)] = p.slice(eq + 1)
    }
  }
  // apply group vars (host vars win)
  for (const [g, vars] of Object.entries(groupVars)) {
    for (const h of g === 'all' ? groups.all : groups[g] ?? []) hostVars[h] = { ...vars, ...hostVars[h] }
  }
  return { groups, hostVars }
}

function matchHosts(inv: Inventory, pattern: string): string[] {
  const out: string[] = []
  for (const part of pattern.split(/[:,]/)) {
    const p = part.trim()
    if (!p) continue
    const hosts = inv.groups[p] ?? (inv.hostVars[p] ? [p] : [])
    for (const h of hosts) if (!out.includes(h)) out.push(h)
  }
  return out
}

/** Why a host cannot be reached, or null if it is fine. */
function connectionProblem(vars: Record<string, string>, onCloudRunner: boolean): string | null {
  const conn = vars.ansible_connection ?? 'ssh'
  if (!/network_cli$/.test(conn)) {
    return 'Failed to connect: this is a network device. Set ansible_connection=ansible.netcommon.network_cli for it.'
  }
  if (!vars.ansible_network_os) {
    return 'Unable to automatically determine host network os. Please manually configure ansible_network_os value for this host'
  }
  if (!/ios$/.test(vars.ansible_network_os)) {
    return `network os ${vars.ansible_network_os} is not supported in this lab (use cisco.ios.ios)`
  }
  if (onCloudRunner) {
    return `ssh connection failed: Failed to connect to ${vars.ansible_host ?? 'host'} port 22: Connection timed out`
  }
  return null
}

const stars = (title: string) => `${title} ${'*'.repeat(Math.max(3, 78 - title.length))}`

export function deviceConfig(state: ShellState, host: string): string {
  const lines = state.devices[host] ?? []
  return ['!', ...lines, '!', 'end'].join('\n')
}

function template(value: string, host: string, vars: Record<string, string>): string {
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => (name === 'inventory_hostname' ? host : vars[name] ?? ''))
}

// ---------------------------------------------------------------------------
// ansible (ad-hoc)
// ---------------------------------------------------------------------------

function parseAnsibleArgs(args: string[]) {
  let inventory = ''
  let module = 'command'
  let pattern = ''
  let check = false
  let diff = false
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-i' || a === '--inventory') inventory = args[++i] ?? ''
    else if (a === '-m' || a === '--module-name') module = args[++i] ?? ''
    else if (a === '-C' || a === '--check') check = true
    else if (a === '-D' || a === '--diff') diff = true
    else if (a === '-k' || a === '--ask-pass' || a === '--ask-vault-pass') continue
    else if (!pattern && !a.startsWith('-')) pattern = a
    else rest.push(a)
  }
  return { inventory, module, pattern, check, diff, rest }
}

function loadInventory(host: Host, file: string): { inv: Inventory | null; err: string[] } {
  if (!file) {
    return { inv: null, err: ['[WARNING]: No inventory was parsed, only implicit localhost is available', '(Tip: add -i inventory.ini)'] }
  }
  const text = host.read(host.resolve(file))
  if (text === null) {
    return {
      inv: null,
      err: [`[WARNING]: Unable to parse ${host.resolve(file)} as an inventory source`, '[WARNING]: No inventory was parsed, only implicit localhost is available'],
    }
  }
  return { inv: parseInventory(text), err: [] }
}

export function ansibleAdhoc(host: Host, args: string[]): CmdResult {
  const a = parseAnsibleArgs(args)
  if (!a.pattern) return fail(['usage: ansible <host-pattern> -i inventory.ini -m ping'])
  const { inv, err } = loadInventory(host, a.inventory)
  if (!inv) return fail([...err, `[WARNING]: Could not match supplied host pattern, ignoring: ${a.pattern}`])
  const hosts = matchHosts(inv, a.pattern)
  if (!hosts.length) return fail([`[WARNING]: Could not match supplied host pattern, ignoring: ${a.pattern}`])
  if (!/^(ansible\.builtin\.)?ping$|^ansible\.netcommon\.net_ping$/.test(a.module)) {
    return fail([`(Simulator) Only the ping module is available for ad-hoc commands here. Try: ansible ${a.pattern} -i ${a.inventory} -m ping`])
  }
  const out: string[] = []
  let code = 0
  for (const h of hosts) {
    const problem = connectionProblem(inv.hostVars[h] ?? {}, false)
    if (problem) {
      code = 4
      out.push(`${h} | FAILED! => {`, `    "msg": "${problem}"`, '}')
    } else {
      out.push(`${h} | SUCCESS => {`, '    "changed": false,', '    "ping": "pong"', '}')
    }
  }
  return { out, err: [], code }
}

// ---------------------------------------------------------------------------
// ansible-playbook
// ---------------------------------------------------------------------------

interface HostStats {
  ok: number
  changed: number
  unreachable: number
  failed: number
}

const MODULE_ALIASES: Record<string, string> = {
  'cisco.ios.ios_config': 'ios_config',
  ios_config: 'ios_config',
  'cisco.ios.ios_command': 'ios_command',
  ios_command: 'ios_command',
  'ansible.builtin.debug': 'debug',
  debug: 'debug',
  'ansible.builtin.ping': 'ping',
  ping: 'ping',
}

const TASK_KEYWORDS = new Set(['name', 'register', 'when', 'become', 'tags', 'ignore_errors', 'no_log', 'vars', 'notify', 'delegate_to', 'changed_when', 'failed_when', 'loop'])

export function ansiblePlaybook(host: Host, args: string[], onCloudRunner = false): CmdResult {
  const a = parseAnsibleArgs(args)
  const playbook = a.pattern
  if (!playbook) return fail(['usage: ansible-playbook -i inventory.ini playbook.yml [--check] [--diff]'])
  const path = host.resolve(playbook)
  const text = host.read(path)
  if (text === null) return fail([`ERROR! the playbook: ${playbook} could not be found`])
  const { data, error } = loadYaml(text)
  if (error) {
    return fail([
      'ERROR! We were unable to read either as JSON nor YAML, these are the errors we got from each:',
      `Syntax Error while loading YAML.`,
      `  ${error}`,
      '(Tip: YAML is picky about spaces. Use 2 spaces per level and never tabs.)',
    ])
  }
  if (!Array.isArray(data)) return fail(['ERROR! A playbook must be a list of plays, such as: - name: ... (start the first line with "- ")'])

  const { inv, err } = loadInventory(host, a.inventory)
  const out: string[] = []
  if (err.length) out.push(...err)
  const stats: Record<string, HostStats> = {}
  const dir = path.slice(0, path.lastIndexOf('/')) || '/'

  for (const play of data) {
    if (!isObj(play)) return fail(['ERROR! Each play must be a dictionary with hosts: and tasks:'])
    if (typeof play.hosts !== 'string') return fail([`ERROR! the field 'hosts' is required but was not set (play "${String(play.name ?? '')}")`])
    const hosts = inv ? matchHosts(inv, play.hosts) : []
    out.push('', stars(`PLAY [${String(play.name ?? play.hosts)}]`))
    if (!hosts.length) {
      out.push(`skipping: no hosts matched (check the group name "${play.hosts}" in your inventory)`)
      continue
    }
    const live = hosts.filter((h) => {
      stats[h] ??= { ok: 0, changed: 0, unreachable: 0, failed: 0 }
      return true
    })
    const tasks = Array.isArray(play.tasks) ? play.tasks : []
    if (!tasks.length) out.push('(this play has no tasks:)')
    const alive = new Set(live)

    for (const task of tasks) {
      if (!isObj(task)) return fail(['ERROR! Each task must be a dictionary, starting with "- name:"'])
      const moduleKey = Object.keys(task).find((k) => !TASK_KEYWORDS.has(k))
      if (!moduleKey) return fail([`ERROR! no module/action detected in task "${String(task.name ?? '')}"`])
      const mod = MODULE_ALIASES[moduleKey]
      if (!mod) {
        return fail([
          `ERROR! couldn't resolve module/action '${moduleKey}'. This often indicates a misspelling, missing collection, or incorrect module path.`,
          '(Modules in this lab: cisco.ios.ios_config, cisco.ios.ios_command, ansible.builtin.debug, ansible.builtin.ping)',
        ])
      }
      const params = isObj(task[moduleKey]) ? (task[moduleKey] as Record<string, unknown>) : {}
      out.push('', stars(`TASK [${String(task.name ?? moduleKey)}]`))

      for (const h of [...alive]) {
        const vars = inv!.hostVars[h] ?? {}
        const problem = connectionProblem(vars, onCloudRunner)
        if (problem) {
          stats[h].unreachable++
          alive.delete(h)
          out.push(`fatal: [${h}]: UNREACHABLE! => {"changed": false, "msg": "${problem}"}`)
          continue
        }
        if (mod === 'ping') {
          stats[h].ok++
          out.push(`ok: [${h}]`)
        } else if (mod === 'debug') {
          stats[h].ok++
          const msg = template(String(params.msg ?? 'Hello world!'), h, vars)
          out.push(`ok: [${h}] => {`, `    "msg": "${msg}"`, '}')
        } else if (mod === 'ios_command') {
          stats[h].ok++
          out.push(`ok: [${h}]`)
        } else {
          // ios_config
          const lines = Array.isArray(params.lines) ? params.lines.map(String) : []
          const wantsBackup = params.backup === true || params.backup === 'yes'
          const current = host.state.devices[h] ?? []
          const missing = lines.filter((l) => !current.includes(l.trim()))
          let changed = missing.length > 0
          if (wantsBackup) {
            const opts = isObj(params.backup_options) ? params.backup_options : {}
            const folder = template(String(opts.dir_path ?? 'backup'), h, vars)
            const file = template(String(opts.filename ?? `${h}_config.${strftime(host.state.now, '%F@%T')}`), h, vars)
            const target = folder.startsWith('/') ? `${folder}/${file}` : `${dir}/${folder.replace(/^\.\//, '')}/${file}`
            if (!a.check) host.write(target.replace(/\/+/g, '/'), deviceConfig(host.state, h))
            changed = true
          }
          if (missing.length && !a.check) host.state.devices[h] = [...current, ...missing.map((l) => l.trim())]
          if (changed) {
            stats[h].changed++
            stats[h].ok++
            out.push(`changed: [${h}]`)
            if (a.diff && missing.length) out.push(...missing.map((l) => `+ ${l.trim()}`))
          } else {
            stats[h].ok++
            out.push(`ok: [${h}]`)
          }
        }
      }
    }
  }

  out.push('', stars('PLAY RECAP'))
  let code = 0
  for (const [h, s] of Object.entries(stats)) {
    if (s.unreachable) code = 4
    if (s.failed && !code) code = 2
    out.push(
      `${h.padEnd(10)} : ok=${String(s.ok).padEnd(4)} changed=${String(s.changed).padEnd(4)} unreachable=${String(s.unreachable).padEnd(4)} failed=${String(s.failed).padEnd(4)} skipped=0    rescued=0    ignored=0`,
    )
  }
  if (a.check) out.push('', '(check mode: this was a preview. Nothing on the devices was changed and no files were written.)')
  return { out, err: [], code }
}

// ---------------------------------------------------------------------------
// GitHub Actions workflow checks
// ---------------------------------------------------------------------------

export interface WorkflowInfo {
  name: string
  crons: string[]
  dispatch: boolean
  problems: string[]
  warnings: string[]
  jobs: { id: string; runsOn: string; steps: { name: string; uses?: string; run?: string; env: Record<string, string>; with: Record<string, string> }[] }[]
}

export function inspectWorkflow(text: string): WorkflowInfo {
  const info: WorkflowInfo = { name: '', crons: [], dispatch: false, problems: [], warnings: [], jobs: [] }
  const { data, error } = loadYaml(text)
  if (error) {
    info.problems.push(`YAML error. ${error}`)
    return info
  }
  if (!isObj(data)) {
    info.problems.push('The workflow must be a YAML mapping with name:, on: and jobs:')
    return info
  }
  info.name = typeof data.name === 'string' ? data.name : '(no name)'
  const on = data.on ?? (data as Record<string, unknown>)['true']
  if (on === undefined) info.problems.push('Missing "on:" (what triggers the workflow).')
  if (isObj(on)) {
    if ('workflow_dispatch' in on) info.dispatch = true
    if ('schedule' in on) {
      if (!Array.isArray(on.schedule)) info.problems.push('"schedule:" must be a list, like:  - cron: \'0 18 * * *\'')
      else
        for (const item of on.schedule) {
          if (!isObj(item) || typeof item.cron !== 'string') {
            info.problems.push('Each schedule item needs a cron line, like:  - cron: \'0 18 * * *\'')
            continue
          }
          const analysis = analyzeCron(item.cron)
          const errs = analysis.issues.filter((i) => i.severity === 'error')
          if (errs.length) info.problems.push(`Bad cron "${item.cron}": ${errs[0].message}`)
          else {
            info.crons.push(item.cron)
            for (const w of analysis.issues) info.warnings.push(`cron "${item.cron}": ${w.message}`)
            if (/^\*\s/.test(item.cron) || /^\*\/[1-4]\s/.test(item.cron)) info.warnings.push('GitHub runs schedules at most once every 5 minutes.')
          }
        }
    }
  } else if (typeof on === 'string' || Array.isArray(on)) {
    const list = Array.isArray(on) ? on.map(String) : [on]
    if (list.includes('workflow_dispatch')) info.dispatch = true
    if (list.includes('schedule')) info.problems.push('"schedule" needs cron lines: use the mapping form  on: schedule: - cron: ...')
  }
  if (!isObj(data.jobs) || !Object.keys(data.jobs).length) {
    info.problems.push('Missing "jobs:" with at least one job.')
    return info
  }
  for (const [id, job] of Object.entries(data.jobs)) {
    if (!isObj(job)) {
      info.problems.push(`Job "${id}" must be a mapping with runs-on: and steps:`)
      continue
    }
    const runsOn = Array.isArray(job['runs-on']) ? job['runs-on'].map(String).join(', ') : String(job['runs-on'] ?? '')
    if (!runsOn) info.problems.push(`Job "${id}" needs "runs-on:" (for example ubuntu-latest or self-hosted).`)
    const steps = Array.isArray(job.steps) ? job.steps : []
    if (!steps.length) info.problems.push(`Job "${id}" needs "steps:".`)
    const parsed = steps.filter(isObj).map((s, i) => ({
      name: String(s.name ?? (s.uses ? `Run ${String(s.uses)}` : `Run step ${i + 1}`)),
      uses: s.uses ? String(s.uses) : undefined,
      run: s.run ? String(s.run) : undefined,
      env: isObj(s.env) ? Object.fromEntries(Object.entries(s.env).map(([k, v]) => [k, String(v)])) : {},
      with: isObj(s.with) ? Object.fromEntries(Object.entries(s.with).map(([k, v]) => [k, String(v)])) : {},
    }))
    for (const s of parsed) {
      if (!s.uses && !s.run) info.problems.push(`Step "${s.name}" needs either uses: or run:.`)
      for (const [k, v] of Object.entries(s.env)) {
        if (/pass|secret|token|key/i.test(k) && !/\$\{\{\s*secrets\./.test(v)) {
          info.warnings.push(`env ${k} looks like a secret typed in plain text. Use \${{ secrets.NAME }} instead.`)
        }
      }
    }
    info.jobs.push({ id, runsOn, steps: parsed })
  }
  return info
}

// ---------------------------------------------------------------------------
// git (just enough for add / commit / push)
// ---------------------------------------------------------------------------

function hashOf(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7)
}

function repoFiles(host: Host): Record<string, string> {
  const git = host.state.git!
  const files: Record<string, string> = {}
  for (const [p, f] of Object.entries(host.state.fs)) {
    if (f.type !== 'file' || !p.startsWith(git.root + '/')) continue
    const rel = p.slice(git.root.length + 1)
    if (rel.startsWith('.git/') || rel.startsWith('backups/') || rel.startsWith('logs/')) continue
    files[rel] = f.content
  }
  return files
}

export function git(host: Host, args: string[]): CmdResult {
  const g = host.state.git
  const sub = args[0]
  if (!g || !(host.cwd === g.root || host.cwd.startsWith(g.root + '/'))) {
    if (sub === 'init') return ok(['(Simulator) This lab already has a repository in ~/netauto. Run: cd ~/netauto'])
    return fail(['fatal: not a git repository (or any of the parent directories): .git', '(Tip: cd ~/netauto first)'], 128)
  }
  const last = g.commits[g.commits.length - 1]?.files ?? {}
  const files = repoFiles(host)
  const changed = Object.keys(files).filter((p) => files[p] !== last[p] && files[p] !== g.staged[p])
  const stagedList = Object.keys(g.staged)

  switch (sub) {
    case 'status': {
      const out = ['On branch main']
      if (g.pushed < g.commits.length) out.push(`Your branch is ahead of 'origin/main' by ${g.commits.length - g.pushed} commit(s).`, '  (use "git push" to publish your local commits)')
      if (stagedList.length) out.push('', 'Changes to be committed:', ...stagedList.map((p) => `\tnew file / modified:   ${p}`))
      if (changed.length) out.push('', 'Untracked or modified files:', '  (use "git add <file>..." to include in what will be committed)', ...changed.map((p) => `\t${p}`))
      if (!stagedList.length && !changed.length) out.push('nothing to commit, working tree clean')
      return ok(out)
    }
    case 'add': {
      const targets = args.slice(1)
      if (!targets.length) return fail(['Nothing specified, nothing added.', 'Maybe you wanted to say \'git add .\'?'])
      let n = 0
      for (const [rel, content] of Object.entries(files)) {
        const abs = `${g.root}/${rel}`
        const hit = targets.some((t) => {
          const r = host.resolve(t)
          return t === '.' || t === '-A' || abs === r || abs.startsWith(r + '/')
        })
        if (hit && content !== last[rel]) {
          g.staged[rel] = content
          n++
        }
      }
      return ok(n ? [] : ['(nothing new to add: files are unchanged)'])
    }
    case 'commit': {
      const mi = args.indexOf('-m')
      const message = mi >= 0 ? args[mi + 1] : ''
      if (!message) return fail(['error: write a message with -m, for example: git commit -m "Add nightly backup workflow"'])
      if (!stagedList.length) return fail(['nothing to commit (use "git add" first)'])
      const snapshot = { ...last, ...g.staged }
      const hash = hashOf(message + JSON.stringify(snapshot) + g.commits.length)
      g.commits.push({ hash, message, files: snapshot })
      g.staged = {}
      return ok([`[main ${hash}] ${message}`, ` ${stagedList.length} file${stagedList.length > 1 ? 's' : ''} changed`])
    }
    case 'log': {
      return ok([...g.commits].reverse().map((c) => `${c.hash} ${c.message}`))
    }
    case 'push': {
      if (g.pushed >= g.commits.length) return ok(['Everything up-to-date'])
      const before = g.commits[g.pushed - 1]?.hash ?? '0000000'
      const head = g.commits[g.commits.length - 1]
      g.pushed = g.commits.length
      const out = [
        'Enumerating objects: 7, done.',
        'Writing objects: 100% (5/5), done.',
        `To ${g.remote}`,
        `   ${before}..${head.hash}  main -> main`,
      ]
      // GitHub reads workflows from the pushed default branch
      host.state.ghWorkflows = {}
      for (const [rel, content] of Object.entries(head.files)) {
        if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(rel)) host.state.ghWorkflows[rel] = content
      }
      for (const [rel, content] of Object.entries(host.state.ghWorkflows)) {
        const info = inspectWorkflow(content)
        if (info.problems.length) {
          out.push('', `GitHub: ✗ ${rel} has a problem and will not run:`, ...info.problems.map((p) => `  - ${p}`))
        } else {
          const triggers = [...info.crons.map((c) => `schedule '${c}' (UTC)`), info.dispatch ? 'workflow_dispatch (manual)' : ''].filter(Boolean).join(', ')
          out.push('', `GitHub: ✓ found workflow "${info.name}" (${rel})`, `        triggers: ${triggers || 'none'}`)
          for (const c of info.crons) out.push(`        ${utcNote(c)}`)
          for (const w of info.warnings) out.push(`        warning: ${w}`)
        }
      }
      return ok(out)
    }
    default:
      return fail([`(Simulator) git ${sub ?? ''} is not available. Try: git status, git add, git commit -m "...", git push, git log`])
  }
}

/** "0 18 * * *" -> "18:00 UTC = 02:00 the next day in Manila (UTC+8)" for simple daily schedules. */
export function utcNote(cron: string): string {
  const m = /^(\d+)\s+(\d+)\s/.exec(cron)
  if (!m) return 'remember: GitHub reads this schedule in UTC (Manila is UTC+8)'
  const min = Number(m[1])
  const h = Number(m[2])
  const local = (h + 8) % 24
  const next = h + 8 >= 24 ? ' the next day' : ''
  const f = (x: number) => String(x).padStart(2, '0')
  return `${f(h)}:${f(min)} UTC = ${f(local)}:${f(min)}${next} in Manila (UTC+8)`
}

// ---------------------------------------------------------------------------
// gh CLI and simulated workflow runs
// ---------------------------------------------------------------------------

function findWorkflow(state: ShellState, ref: string | undefined): [string, string] | null {
  const entries = Object.entries(state.ghWorkflows)
  if (!ref) return entries[0] ?? null
  return entries.find(([p, c]) => p.endsWith('/' + ref) || inspectWorkflow(c).name === ref) ?? null
}

/** Run a pushed workflow on the simulated runner and record it. */
export function simulateRun(host: Host, path: string, content: string, event: GhRun['event'], time: number): GhRun {
  const info = inspectWorkflow(content)
  const log: string[] = []
  let failed = info.problems.length > 0
  if (failed) log.push(...info.problems.map((p) => `Error: ${p}`))
  const commitFiles = host.state.git?.commits[host.state.git.pushed - 1]?.files ?? {}
  const workspace: Record<string, string> = {}
  for (const job of info.jobs) {
    if (failed) break
    const cloud = !/self-hosted/.test(job.runsOn)
    log.push(`=== Job: ${job.id} (runs-on: ${job.runsOn}) ===`)
    log.push(cloud ? 'Runner: GitHub-hosted virtual machine (in the cloud)' : 'Runner: self-hosted runner "lab-runner" (inside the school network)')
    for (const step of job.steps) {
      if (failed) {
        log.push(`- ${step.name}: skipped`)
        continue
      }
      log.push(`▶ ${step.name}`)
      if (step.uses) {
        if (step.uses.startsWith('actions/checkout')) {
          Object.assign(workspace, commitFiles)
          log.push(`  Syncing repository: tagify-student/netauto (${Object.keys(commitFiles).length} files)`)
        } else if (step.uses.startsWith('actions/upload-artifact')) {
          const target = step.with.path ?? ''
          const count = Object.keys(workspace).filter((p) => p.startsWith(target.replace(/^\.\//, '').replace(/\/$/, ''))).length
          log.push(count ? `  Uploaded artifact "${step.with.name ?? 'artifact'}" (${count} file${count > 1 ? 's' : ''})` : `  Warning: No files were found with the provided path: ${target}. No artifacts will be uploaded.`)
        } else if (step.uses.startsWith('actions/setup-python')) {
          log.push(`  Python ${step.with['python-version'] ?? '3.x'} is ready`)
        } else {
          log.push(`  Download action repository '${step.uses}'`)
        }
        continue
      }
      const secretsUsed = Object.values(step.env).some((v) => /\$\{\{\s*secrets\./.test(v))
      for (const raw of (step.run ?? '').split('\n').map((l) => l.trim()).filter(Boolean)) {
        log.push(`  $ ${raw}`)
        if (/^pip3? install/.test(raw)) log.push('  Successfully installed ansible-core and ansible (simulated)')
        else if (/^ansible-galaxy collection install/.test(raw)) log.push(`  ${raw.split(/\s+/).pop()} was installed successfully`)
        else if (/^ansible-playbook\b/.test(raw)) {
          const runner: Host = {
            state: host.state,
            cwd: '/runner/work',
            env: {},
            resolve: (p) => (p.startsWith('/') ? p : `/runner/work/${p.replace(/^\.\//, '')}`),
            read: (p) => workspace[p.replace('/runner/work/', '')] ?? null,
            write: (p, c) => {
              workspace[p.replace('/runner/work/', '')] = c
            },
          }
          const inv = workspace['inventory.ini'] ?? ''
          if (/ROUTER_PASSWORD/.test(inv) && !secretsUsed) {
            log.push('  fatal: Authentication failed: the ROUTER_PASSWORD environment variable is empty.', '  (Add env: ROUTER_PASSWORD: ${{ secrets.ROUTER_PASSWORD }} to this step)')
            failed = true
            break
          }
          const res = ansiblePlaybook(runner, raw.split(/\s+/).slice(1), cloud)
          log.push(...res.out.map((l) => `  ${l}`), ...res.err.map((l) => `  ${l}`))
          if (res.code) {
            failed = true
            if (cloud) log.push('  Hint: a GitHub-hosted runner is on the internet and cannot reach routers at 10.0.0.x. Use runs-on: self-hosted.')
            break
          }
        } else if (/^echo\b/.test(raw)) log.push(`  ${raw.replace(/^echo\s+/, '').replace(/^["']|["']$/g, '')}`)
        else log.push('  (done)')
      }
      if (secretsUsed) log.push('  env: ROUTER_PASSWORD=***   (GitHub hides secrets in logs)')
      if (failed) log.push(`  Error: Process completed with exit code ${4}.`)
    }
  }
  const run: GhRun = {
    id: 1000 + host.state.ghRuns.length + 1,
    event,
    time,
    conclusion: failed ? 'failure' : 'success',
    title: info.name || path,
    log,
  }
  host.state.ghRuns.push(run)
  return run
}

export function gh(host: Host, args: string[]): CmdResult {
  const [area, action, ...rest] = args
  const state = host.state
  if (area === 'workflow' && action === 'list') {
    const rows = Object.entries(state.ghWorkflows).map(([p, c]) => `${inspectWorkflow(c).name.padEnd(28)} active  ${p}`)
    return ok(rows.length ? rows : ['no workflows found (push a .github/workflows/*.yml file first)'])
  }
  if (area === 'workflow' && action === 'run') {
    const wf = findWorkflow(state, rest[0])
    if (!wf) return fail([`could not find any workflows named ${rest[0] ?? ''}`, '(Did you git push the workflow file?)'])
    const info = inspectWorkflow(wf[1])
    if (!info.dispatch) return fail([`could not create workflow dispatch event: HTTP 422: Workflow does not have 'workflow_dispatch' trigger`])
    const run = simulateRun(host, wf[0], wf[1], 'workflow_dispatch', state.now)
    return ok([`✓ Created workflow_dispatch event for ${wf[0].split('/').pop()} at main`, '', `To see runs for this workflow, try: gh run list`, `(simulated run #${run.id} finished: ${run.conclusion})`])
  }
  if (area === 'run' && action === 'list') {
    if (!state.ghRuns.length) return ok(['no runs found'])
    const rows = [...state.ghRuns]
      .reverse()
      .map((r) => `${r.conclusion === 'success' ? '✓' : 'X'}  ${r.title.padEnd(24)} ${r.event.padEnd(18)} ${r.id}  ${strftime(r.time, '%F %R')} (lab time)`)
    return ok(['STATUS  TITLE                    EVENT              ID    STARTED', ...rows])
  }
  if (area === 'run' && action === 'view') {
    const id = rest.find((x) => /^\d+$/.test(x))
    const run = id ? state.ghRuns.find((r) => String(r.id) === id) : state.ghRuns[state.ghRuns.length - 1]
    if (!run) return fail(['no runs found'])
    const head = [`${run.conclusion === 'success' ? '✓' : 'X'} ${run.title} · ${run.id} (${run.event})`, '']
    return ok(rest.includes('--log') ? [...head, ...run.log] : [...head, ...run.log.filter((l) => l.startsWith('▶') || l.startsWith('===') || l.startsWith('- ')), '', 'For the full log, try: gh run view --log'])
  }
  return fail(['(Simulator) Try: gh workflow list | gh workflow run <file> | gh run list | gh run view --log'])
}
