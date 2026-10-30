import { describe, expect, it } from 'vitest'
import { DEMO_STEPS } from '../data/cronDemo'
import { followTick, heredocEnd, runBlock, splitBlock } from './block'
import { DEMO_TRACK, backupsOf, demoMachine } from './demoTrack'
import { HOME } from './linux'
import type { CheckCtx } from './tracks'
import type { ShellState } from './types'

const text = (r: { output: { text: string }[] }) => r.output.map((l) => l.text)

/** Run a pasted block on a machine and give back the new machine and what was printed. */
function sh(state: ShellState, block: string) {
  const r = runBlock(state, block)
  return { ...r, said: text(r) }
}

const ctxOf = (state: ShellState, r: ReturnType<typeof runBlock>, input: string): CheckCtx => ({
  state,
  input,
  lines: r.output,
  exitCode: r.exitCode,
  event: 'command',
})

describe('the Cron & at demo lab', () => {
  it('has one lab step for every demo page step, with the same id, title and commands', () => {
    expect(DEMO_TRACK.steps.map((s) => s.id)).toEqual(DEMO_STEPS.map((s) => s.id))
    expect(DEMO_TRACK.steps.map((s) => s.title)).toEqual(DEMO_STEPS.map((s) => s.title))
    DEMO_TRACK.steps.forEach((step, i) => {
      // the only difference: "wait 1 minute" becomes a timewarp, because the lab clock is pretend
      expect(step.command, step.title).toBe(step.id === 'check' ? `timewarp 5m\n${DEMO_STEPS[i].code}` : DEMO_STEPS[i].code)
    })
  })

  it('gives every step something for the Old Admin to say, a task and a success line', () => {
    for (const s of DEMO_TRACK.steps) {
      expect(s.explain.length, s.title).toBeGreaterThan(0)
      expect(s.task.trim().length, s.title).toBeGreaterThan(0)
      expect(s.success.trim().length, s.title).toBeGreaterThan(0)
    }
  })

  it('can be finished by running each step’s command, and no step is done before it is run', () => {
    let state = DEMO_TRACK.setup()
    for (const step of DEMO_TRACK.steps) {
      const before = step.check({ state, input: '', lines: [], exitCode: 0, event: 'command' })
      expect(before, `"${step.title}" must not pass before it is done`).toBe(false)
      const r = runBlock(state, step.command!)
      state = r.state
      if (step.id === 'watch') {
        expect(r.follow, 'tail -f should start following').toBe(`${HOME}/lab/backup.log`)
        const tick = followTick(state, r.follow!)
        state = tick.state
        expect(step.check({ state, input: '', lines: tick.lines, exitCode: 0, event: 'follow' })).toBe(true)
      } else {
        const ok = step.check(ctxOf(state, r, step.command!))
        expect(ok, `"${step.title}" failed. Output:\n${text(r).join('\n')}`).toBe(true)
      }
    }
  })

  it('shows the cleanup: many backups before, the newest 3 after, exit code 0', () => {
    let state = DEMO_TRACK.setup()
    for (const id of ['script', 'schedule', 'check', 'automate']) state = runBlock(state, DEMO_TRACK.steps.find((s) => s.id === id)!.command!).state
    expect(backupsOf(state).length).toBeGreaterThan(3)
    const r = sh(state, DEMO_TRACK.steps.find((s) => s.id === 'run-cleanup')!.command!)
    expect(r.said).toContain('Exit code: 0')
    expect(r.said.some((l) => l.includes('INFO   Old backups removed, 3 kept'))).toBe(true)
    expect(backupsOf(r.state)).toHaveLength(3)
  })

  it('fails loudly when the folder is missing: ERROR in the output and exit code 1', () => {
    let state = DEMO_TRACK.setup()
    for (const id of ['script', 'automate']) state = runBlock(state, DEMO_TRACK.steps.find((s) => s.id === id)!.command!).state
    const r = sh(state, DEMO_TRACK.steps.find((s) => s.id === 'fail')!.command!)
    expect(r.said.some((l) => l.includes('ERROR  Folder not found'))).toBe(true)
    expect(r.said).toContain('Exit code: 1')
    expect(r.state.fs[`${HOME}/lab/data`]).toBeDefined()
  })

  it('lets cron run the upgraded script by itself and writes the four log steps', () => {
    let state = DEMO_TRACK.setup()
    for (const id of ['script', 'schedule', 'automate']) state = runBlock(state, DEMO_TRACK.steps.find((s) => s.id === id)!.command!).state
    const tick = followTick(state, `${HOME}/lab/backup.log`)
    const lines = tick.lines.map((l) => l.text)
    expect(lines.some((l) => l.includes('INFO   Backup started'))).toBe(true)
    expect(lines.some((l) => /INFO {3}Created data-\d{6}\.tar\.gz/.test(l))).toBe(true)
    expect(lines.some((l) => l.includes('Old backups removed'))).toBe(true)
    expect(lines.some((l) => l.includes('INFO   Backup finished'))).toBe(true)
  })

  it('does not let crontab -r finish the last step', () => {
    let state = DEMO_TRACK.setup()
    for (const id of ['script', 'schedule']) state = runBlock(state, DEMO_TRACK.steps.find((s) => s.id === id)!.command!).state
    const remove = DEMO_TRACK.steps.find((s) => s.id === 'remove')!
    const r = runBlock(state, 'crontab -r')
    expect(remove.check(ctxOf(r.state, r, 'crontab -r'))).toBe(false)
  })
})

describe('pasting commands', () => {
  it('splits a block into commands and gathers a heredoc', () => {
    const parts = splitBlock(`mkdir x\ncat > f.sh << 'EOF'\n#!/bin/bash\necho hi\nEOF\nls\n`)
    expect(parts.map((p) => p.text)).toEqual(['mkdir x', 'cat > f.sh', 'ls'])
    expect(parts[1].stdin).toBe('#!/bin/bash\necho hi\n')
    expect(parts[1].shown).toEqual([`cat > f.sh << 'EOF'`, '#!/bin/bash', 'echo hi', 'EOF'])
  })

  it('knows which word ends a heredoc', () => {
    expect(heredocEnd(`cat > a << 'EOF'`)).toBe('EOF')
    expect(heredocEnd('cat > a << END')).toBe('END')
    expect(heredocEnd('cat a')).toBeNull()
  })

  it('writes the heredoc into the file, exactly as pasted', () => {
    const r = sh(demoMachine(), `mkdir -p ~/lab\ncat > ~/lab/a.txt << 'EOF'\nline $HOME one\nline two\nEOF\ncat ~/lab/a.txt`)
    expect(r.said).toEqual(['line $HOME one', 'line two'])
  })
})

describe('shell features the demo needs', () => {
  const run1 = (cmd: string, state = demoMachine()) => sh(state, cmd)

  it('$? is the exit code of the last command', () => {
    expect(run1('true; echo "code $?"').said).toEqual(['code 0'])
    expect(run1('false; echo "code $?"').said).toEqual(['code 1'])
    expect(run1('cat nope; echo $?').said).toContain('1')
  })

  it('( a; b ) | cmd groups commands, and 2>/dev/null hides errors', () => {
    const r = run1('(crontab -l 2>/dev/null; echo "0 3 * * * /bin/true") | crontab -\ncrontab -l')
    expect(r.said).toEqual(['0 3 * * * /bin/true'])
    expect(run1('crontab -l 2>/dev/null').said).toEqual([])
    expect(run1('crontab -l').said.join(' ')).toContain('no crontab')
  })

  it('crontab - and crontab FILE install a crontab', () => {
    const r = run1('echo "30 1 * * * /bin/true" > c.txt\ncrontab c.txt\ncrontab -l')
    expect(r.said).toEqual(['30 1 * * * /bin/true'])
  })

  it('expands * in file names and sorts ls -t newest first', () => {
    let s = demoMachine()
    s = sh(s, 'mkdir -p ~/b').state
    for (const n of ['a', 'b', 'c']) {
      s = sh(s, `touch ~/b/${n}.tar.gz`).state
      s.now += 1000
    }
    // like bash, the names come back the way they were typed
    expect(sh(s, 'ls -t ~/b/*.tar.gz').said).toEqual(['~/b/c.tar.gz', '~/b/b.tar.gz', '~/b/a.tar.gz'])
    // keep the 1 newest: delete the rest
    const r = sh(s, 'ls -t ~/b/*.tar.gz | tail -n +2 | xargs -r rm\nls ~/b')
    expect(r.said).toEqual(['c.tar.gz'])
  })

  it('ls writes one name per line into a pipe, and wc -l counts them', () => {
    const s = sh(demoMachine(), 'mkdir ~/d\ntouch ~/d/x ~/d/y ~/d/z').state
    expect(sh(s, 'ls ~/d').said).toEqual(['x  y  z'])
    expect(sh(s, 'ls ~/d | wc -l').said).toEqual(['3'])
  })

  it('xargs -r does nothing when there is no input', () => {
    const s = sh(demoMachine(), 'mkdir ~/d\ntouch ~/d/x').state
    const r = sh(s, 'ls ~/d/nothing* 2>/dev/null | xargs -r rm\nls ~/d')
    expect(r.said).toEqual(['x'])
  })

  it('tar -C packs a folder relative to another one', () => {
    const s = sh(demoMachine(), 'mkdir -p ~/lab/data\necho hi > ~/lab/data/a.txt').state
    const ok = sh(s, 'tar -czf ~/out.tar.gz -C ~/lab data')
    expect(ok.exitCode).toBe(0)
    expect(ok.state.fs[`${HOME}/out.tar.gz`]).toBeDefined()
    const bad = sh(s, 'tar -czf ~/out.tar.gz -C ~/lab nope')
    expect(bad.exitCode).toBe(2)
  })

  it('mv moves a whole folder, with what is inside', () => {
    const s = sh(demoMachine(), 'mkdir -p ~/lab/data\necho hi > ~/lab/data/a.txt').state
    const r = sh(s, 'mv ~/lab/data ~/lab/hidden\ncat ~/lab/hidden/a.txt\nls ~/lab')
    expect(r.said).toEqual(['hi', 'hidden/'])
  })

  it('grep -v keeps the lines that do not match', () => {
    expect(run1('echo a > f\necho b >> f\ngrep -v a f').said).toEqual(['b'])
  })

  it('basename drops the folder', () => {
    expect(run1('basename /a/b/c.tar.gz').said).toEqual(['c.tar.gz'])
  })

  it('[ ] tests folders and files that are not empty', () => {
    const s = sh(demoMachine(), 'mkdir ~/d\necho x > ~/f\ntouch ~/empty').state
    const t = (c: string) => sh(s, c).exitCode
    expect(t('[ -d ~/d ]')).toBe(0)
    expect(t('[ ! -d ~/d ]')).toBe(1)
    expect(t('[ -s ~/f ]')).toBe(0)
    expect(t('[ -s ~/empty ]')).toBe(1)
    expect(t('[ -d ~/nope ]')).toBe(1)
  })

  it('scripts can use if / else / fi and exit inside it', () => {
    const body = ['#!/bin/bash', 'if [ -d /home/student/lab ]; then', '  echo has-lab', 'else', '  echo no-lab', 'fi', 'if [ ! -d /nope ]; then', '  echo missing', '  exit 3', 'fi', 'echo not-reached'].join('\n')
    let s = demoMachine()
    s.fs[`${HOME}/t.sh`] = { type: 'file', content: body + '\n', mode: 0o755, mtime: s.now }
    const r = sh(s, './t.sh; echo "exit $?"')
    expect(r.said).toEqual(['no-lab', 'missing', 'exit 3'])
    s = sh(s, 'mkdir ~/lab').state
    expect(sh(s, './t.sh').said).toEqual(['has-lab', 'missing'])
  })

  it('two script runs never share a second, so backup names stay different', () => {
    const s = sh(demoMachine(), 'mkdir -p ~/lab/data ~/lab/backups\necho hi > ~/lab/data/a').state
    s.fs[`${HOME}/b.sh`] = { type: 'file', content: 'tar -czf /home/student/lab/backups/x-$(date +%H%M%S).tar.gz -C /home/student/lab data\n', mode: 0o755, mtime: s.now }
    const r = sh(s, './b.sh\n./b.sh\n./b.sh')
    expect(backupsOf(r.state)).toHaveLength(3)
  })

  it('tail -f asks the terminal to keep watching, but only when you run it yourself', () => {
    const s = sh(demoMachine(), 'echo one > ~/log.txt').state
    expect(runBlock(s, 'tail -f ~/log.txt').follow).toBe(`${HOME}/log.txt`)
    expect(runBlock(s, 'echo $(tail -f ~/log.txt)').follow).toBeUndefined()
  })
})
