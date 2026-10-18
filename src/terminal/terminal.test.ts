import { describe, expect, it } from 'vitest'
import { TRACKS, linuxMachine, replay, run, save, windowsMachine, type CheckCtx } from './tracks'
import { HOME, runLinux } from './linux'
import { runWindows } from './windows'
import { tokenize } from './types'

describe('every guided track can be completed step by step', () => {
  for (const track of TRACKS) {
    it(`track "${track.title}"`, () => {
      let state = track.setup()
      track.steps.forEach((step, i) => {
        let ctx: CheckCtx
        if (step.file) {
          const opened = run(state, step.command!)
          expect(opened.editor, `step ${i + 1} should open the editor`).toBeDefined()
          const saved = save(opened.state, opened.editor!, step.file.content)
          state = saved.state
          ctx = { state, input: '', lines: saved.lines, exitCode: 0, event: 'save', savedPath: opened.editor!.path }
        } else {
          const r = run(state, step.command!)
          state = r.state
          ctx = { state, input: step.command!, lines: r.lines, exitCode: r.exitCode, event: 'command' }
        }
        expect(step.check(ctx), `step ${i + 1} "${step.title}" failed. Output:\n${ctx.lines.map((l) => l.text).join('\n')}`).toBe(true)
      })
    })

    it(`track "${track.title}" can be resumed with replay`, () => {
      expect(() => replay(track, track.steps.length)).not.toThrow()
    })
  }
})

describe('linux shell basics', () => {
  const sh = (cmds: string[]) => {
    let s = linuxMachine()
    let last = runLinux('', s)
    for (const c of cmds) {
      last = runLinux(c, s)
      s = last.state
    }
    return last
  }

  it('tokenizes quotes and operators', () => {
    expect(tokenize(`echo "a b" 'c d' >> log 2>&1 && ls`)).toEqual(['echo', 'a b', 'c d', '>>', 'log', '2>&1', '&&', 'ls'])
  })

  it('cd and pwd', () => {
    expect(sh(['cd lab/logs', 'pwd']).lines[0].text).toBe(`${HOME}/lab/logs`)
    expect(sh(['cd nope']).lines[0].text).toContain('No such file')
  })

  it('redirects output and expands $(date)', () => {
    const r = sh(['echo "today is $(date +%F)" > /home/student/x.txt', 'cat ~/x.txt'])
    expect(r.lines[0].text).toBe('today is 2026-10-17')
  })

  it('timewarp with nothing scheduled says so', () => {
    const r = sh(['timewarp 1h'])
    expect(r.lines[1].text).toContain('Nothing was scheduled')
  })

  it('cron cannot find a relative command, and mails the error', () => {
    let s = linuxMachine()
    s.crontab = '0 22 * * * report.sh\n'
    s = runLinux('timewarp 2h', s).state
    expect(s.fs['/var/mail/student'].content).toContain('report.sh: not found')
  })

  it('cron cuts a command at an unescaped %', () => {
    let s = linuxMachine()
    s.crontab = '0 22 * * * /bin/echo $(date +%F) >> /home/student/out.txt\n'
    const r = runLinux('timewarp 2h', s)
    expect(r.lines.some((l) => l.text.includes('cron cut it short'))).toBe(true)
  })

  it('crontab -r removes everything', () => {
    const r = sh(['crontab -r', 'crontab -l'])
    expect(r.lines.some((l) => l.text.includes('no crontab'))).toBe(true)
  })

  it('unknown commands give a friendly error', () => {
    expect(sh(['foo']).lines[0].text).toBe('foo: command not found')
    expect(sh(['cd lab', 'report.sh']).lines[1].text).toContain('./report.sh')
  })
})

describe('windows shell basics', () => {
  it('scheduled task with a relative log path is denied in System32', () => {
    let s = windowsMachine()
    s = runWindows('cd C:\\Lab', s).state
    s.fs['C:\\Lab\\rel.ps1'] = { type: 'file', content: 'Add-Content -Path report.log -Value "x"\n', mode: 0o644, mtime: s.now }
    s = runWindows('schtasks /create /tn "IT-Lab\\Rel" /tr "powershell.exe -File C:\\Lab\\rel.ps1" /sc daily /st 18:00', s).state
    s = runWindows('schtasks /run /tn "IT-Lab\\Rel"', s).state
    expect(s.tasks[0].lastResult).toBe(1)
  })

  it('suggests .\\ for scripts in the current folder', () => {
    let s = windowsMachine()
    s.fs['C:\\Users\\student\\a.ps1'] = { type: 'file', content: 'exit 0\n', mode: 0o644, mtime: s.now }
    const r = runWindows('a.ps1', s)
    expect(r.lines.some((l) => l.text.includes('.\\a.ps1'))).toBe(true)
  })
})
