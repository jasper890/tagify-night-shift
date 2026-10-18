import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { FaArrowRight, FaCheckCircle, FaChevronLeft, FaKeyboard, FaLightbulb, FaRedo, FaSave, FaTimes, FaForward, FaPaste } from 'react-icons/fa'
import { CodeBlock } from './CodeBlock'
import { useProgress } from '../lib/progress'
import { cronWarnings, prompt as linuxPrompt } from '../terminal/linux'
import { yamlProblem } from '../terminal/devops'
import { winPrompt } from '../terminal/windows'
import { replay, run, save, type Track } from '../terminal/tracks'
import type { EditorRequest, Line, ShellState } from '../terminal/types'

/** Render `code` spans inside guide text. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') ? (
          <code key={i} className="inline-code">
            {p.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}

const COMMANDS_LINUX = ['pwd', 'ls', 'cd', 'cat', 'nano', 'chmod', 'mkdir', 'crontab', 'timewarp', 'grep', 'tail', 'find', 'echo', 'atq', 'atrm', 'ansible', 'ansible-playbook', 'git', 'gh', 'clear', 'help']
const COMMANDS_WIN = ['Get-ChildItem', 'Set-Location', 'Get-Content', 'Remove-Item', 'Where-Object', 'notepad', 'schtasks', 'Get-ScheduledTask', 'Get-ScheduledTaskInfo', 'Add-Content', 'timewarp', 'cls', 'help']

function welcome(track: Track): Line[] {
  return [
    { kind: 'info', text: `Welcome to the "${track.title}" lab.` },
    { kind: 'info', text: 'This terminal is a SIMULATION: nothing runs on your computer, so you cannot break anything.' },
    { kind: 'info', text: 'Follow the guide on the left. Type help any time to see the commands.' },
    { kind: 'out', text: '' },
  ]
}

export function TerminalLab({ track, onExit }: { track: Track; onExit: () => void }) {
  const { progress, setTerminalStep, resetTerminal } = useProgress()
  const saved = Math.min(progress.terminal[track.id] ?? 0, track.steps.length)
  const [stepIndex, setStepIndex] = useState(saved)
  const [done, setDone] = useState(false)
  const [state, setState] = useState<ShellState>(() => replay(track, saved))
  const [lines, setLines] = useState<Line[]>(() => [
    ...welcome(track),
    ...(saved > 0 && saved < track.steps.length ? [{ kind: 'info' as const, text: `Welcome back! Resuming at step ${saved + 1}.` }, { kind: 'out' as const, text: '' }] : []),
  ])
  const [input, setInput] = useState('')
  const [histPos, setHistPos] = useState<number | null>(null)
  const [editor, setEditor] = useState<(EditorRequest & { text: string }) | null>(null)
  const [showHint, setShowHint] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const finished = stepIndex >= track.steps.length
  const step = finished ? null : track.steps[stepIndex]
  const promptText = state.os === 'linux' ? linuxPrompt(state) : winPrompt(state)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines, editor])

  useEffect(() => {
    if (!editor) inputRef.current?.focus({ preventScroll: true })
  }, [editor, stepIndex])

  const passStep = (ok: boolean) => {
    if (!ok || !step || done) return
    setDone(true)
    setTerminalStep(track.id, stepIndex + 1)
    setLines((l) => [...l, { kind: 'ok', text: `✔ Step ${stepIndex + 1} complete: ${step.success}` }])
  }

  const nextStep = () => {
    setDone(false)
    setShowHint(false)
    setStepIndex((i) => i + 1)
  }

  const submit = () => {
    const cmd = input
    setInput('')
    setHistPos(null)
    const r = run(state, cmd)
    const echo: Line = { kind: 'input', text: `${promptText} ${cmd}` }
    setLines((l) => (r.clear ? [] : [...l, echo, ...r.lines]))
    setState(r.state)
    if (r.editor) {
      setEditor({ ...r.editor, text: r.editor.content })
      return
    }
    if (cmd.trim() === 'help') return
    if (step && !done) passStep(step.check({ state: r.state, input: cmd, lines: r.lines, exitCode: r.exitCode, event: 'command' }))
  }

  const saveEditor = () => {
    if (!editor) return
    const r = save(state, editor, editor.text)
    setState(r.state)
    setLines((l) => [...l, ...r.lines])
    const path = editor.path
    setEditor(null)
    if (step && !done) passStep(step.check({ state: r.state, input: '', lines: r.lines, exitCode: 0, event: 'save', savedPath: path }))
  }

  const complete = (value: string): string => {
    const parts = value.split(/(\s+)/)
    const last = parts[parts.length - 1] ?? ''
    if (parts.length === 1) {
      const list = state.os === 'linux' ? COMMANDS_LINUX : COMMANDS_WIN
      const hit = list.filter((c) => c.toLowerCase().startsWith(last.toLowerCase()))
      return hit.length === 1 ? hit[0] + ' ' : value
    }
    const sep = state.os === 'linux' ? '/' : '\\'
    const slash = last.lastIndexOf(sep)
    const dirPart = slash >= 0 ? last.slice(0, slash + 1) : ''
    const namePart = last.slice(slash + 1)
    let root: string
    if (state.os === 'linux') {
      const d = dirPart.startsWith('~/') ? `/home/student/${dirPart.slice(2)}` : dirPart
      root = d.startsWith('/') ? d : `${state.cwd}/${d}`
    } else {
      root = /^[a-z]:/i.test(dirPart) ? dirPart : `${state.cwd}\\${dirPart}`
    }
    root = root.replace(/[\\/]+$/, '')
    const names = Object.keys(state.fs)
      .filter((k) => k.toLowerCase().startsWith((root + sep).toLowerCase()) && !k.slice(root.length + 1).includes(sep))
      .map((k) => k.slice(root.length + 1) + (state.fs[k].type === 'dir' ? sep : ''))
      .filter((n) => n.toLowerCase().startsWith(namePart.toLowerCase()) && !n.startsWith('.git'))
    if (names.length === 1) return parts.slice(0, -1).join('') + dirPart + names[0]
    if (names.length > 1) setLines((l) => [...l, { kind: 'out', text: names.join('  ') }])
    return value
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const hist = state.history
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!hist.length) return
      const pos = histPos === null ? hist.length - 1 : Math.max(0, histPos - 1)
      setHistPos(pos)
      setInput(hist[pos])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histPos === null) return
      const pos = histPos + 1
      if (pos >= hist.length) {
        setHistPos(null)
        setInput('')
      } else {
        setHistPos(pos)
        setInput(hist[pos])
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      setInput((v) => complete(v))
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLines([])
    }
  }

  const skipStep = () => {
    if (!step) return
    const next = replay(track, stepIndex + 1)
    setState(next)
    setEditor(null)
    setLines((l) => [...l, { kind: 'info', text: `(Skipped step ${stepIndex + 1}: the simulator did it for you.)` }])
    setTerminalStep(track.id, stepIndex + 1)
    setDone(false)
    setShowHint(false)
    setStepIndex((i) => i + 1)
  }

  const restart = () => {
    resetTerminal(track.id)
    setStepIndex(0)
    setDone(false)
    setEditor(null)
    setShowHint(false)
    setState(track.setup())
    setLines(welcome(track))
  }

  const editorProblems = useMemo(() => {
    if (!editor) return [] as Line[]
    if (editor.kind === 'crontab') return cronWarnings(editor.text)
    if (/\.ya?ml$/.test(editor.path)) {
      const p = yamlProblem(editor.text)
      return p ? [{ kind: 'err' as const, text: p }] : editor.text.trim() ? [{ kind: 'ok' as const, text: 'YAML looks valid' }] : []
    }
    return []
  }, [editor])

  const exampleFits = !!(editor && step?.file && (step.file.path === editor.path || (step.file.path === 'crontab' && editor.kind === 'crontab')))

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* Guide */}
      <aside className="panel flex min-h-0 flex-col overflow-hidden xl:max-h-[calc(100vh-7rem)]">
        <div className="flex items-center gap-2 border-b border-line bg-card px-4 py-2">
          <button type="button" onClick={onExit} className="btn btn-ghost shrink-0 px-2 py-1 text-xs whitespace-nowrap">
            <FaChevronLeft aria-hidden /> All labs
          </button>
          <span className="min-w-0 truncate text-sm font-bold text-navy">{track.title}</span>
          <button type="button" onClick={restart} className="btn btn-ghost ml-auto shrink-0 px-2 py-1 text-xs whitespace-nowrap" title="Start this lab again">
            <FaRedo aria-hidden /> Restart
          </button>
        </div>
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between text-xs font-bold text-teal">
            <span>
              {finished ? 'All steps done' : `Step ${stepIndex + 1} of ${track.steps.length}`}
            </span>
            <span>{Math.round((Math.min(stepIndex + (done ? 1 : 0), track.steps.length) / track.steps.length) * 100)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-card" aria-hidden>
            <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${(Math.min(stepIndex + (done ? 1 : 0), track.steps.length) / track.steps.length) * 100}%` }} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">
          {step ? (
            <>
              <h2 className="text-xl">{step.title}</h2>
              <div className="mt-2 space-y-2 text-[0.97rem]">
                {step.explain.map((e) => (
                  <p key={e}>
                    <RichText text={e} />
                  </p>
                ))}
              </div>
              <div className="mt-4 rounded-xl border-2 border-amber bg-amber-soft p-3">
                <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-amber-dark uppercase">
                  <FaKeyboard aria-hidden /> Your turn
                </p>
                <p className="mt-1 font-bold text-navy">{step.task}</p>
                {step.command ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 rounded bg-navy px-2 py-1 font-mono text-sm break-all text-amber">{step.command}</code>
                    <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => { setInput(step.command!); inputRef.current?.focus() }}>
                      Type it for me
                    </button>
                  </div>
                ) : null}
              </div>
              {step.file ? (
                <div className="mt-3">
                  <p className="text-sm font-bold text-navy">Code to write in the editor:</p>
                  <CodeBlock lang={step.file.lang} title={step.file.path === 'crontab' ? 'crontab -e' : step.file.path.split(/[\\/]/).pop()} code={step.file.content} />
                </div>
              ) : null}
              {step.hint ? (
                <div className="mt-2">
                  {showHint ? (
                    <p className="flex gap-2 rounded-lg bg-card p-3 text-sm">
                      <FaLightbulb className="mt-0.5 shrink-0 text-amber-dark" aria-hidden /> {step.hint}
                    </p>
                  ) : (
                    <button type="button" className="text-sm font-bold text-slate underline" onClick={() => setShowHint(true)}>
                      Stuck? Show a hint
                    </button>
                  )}
                </div>
              ) : null}
              {done ? (
                <div className="mt-4 rounded-xl bg-teal-soft p-3">
                  <p className="flex items-start gap-2 font-bold text-teal">
                    <FaCheckCircle className="mt-1 shrink-0" aria-hidden /> {step.success}
                  </p>
                  <button type="button" className="btn btn-primary mt-3" onClick={nextStep}>
                    {stepIndex + 1 < track.steps.length ? 'Next step' : 'Finish'} <FaArrowRight aria-hidden />
                  </button>
                </div>
              ) : (
                <button type="button" className="mt-4 inline-flex items-center gap-1 text-xs text-ink/60 underline" onClick={skipStep}>
                  <FaForward aria-hidden /> Skip this step
                </button>
              )}
            </>
          ) : (
            <div className="text-center">
              <FaCheckCircle className="mx-auto text-5xl text-teal" aria-hidden />
              <h2 className="mt-3 text-2xl">Lab complete!</h2>
              <p className="mt-2">You finished every step of “{track.title}”. Keep experimenting in the terminal: it is still yours to play with.</p>
              <p className="mt-3 text-sm font-bold text-navy">You practised:</p>
              <ul className="mt-1 list-inside list-disc text-left text-sm">
                {track.youWillLearn.map((y) => (
                  <li key={y}>{y}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" className="btn btn-primary" onClick={onExit}>
                  Choose another lab
                </button>
                <button type="button" className="btn btn-ghost" onClick={restart}>
                  <FaRedo aria-hidden /> Do it again
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Terminal */}
      <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl bg-night shadow-xl xl:h-[calc(100vh-7rem)]" aria-label="Simulated terminal">
        <div className="flex items-center gap-2 border-b border-white/10 bg-night-2 px-4 py-2">
          <span className="h-3 w-3 rounded-full bg-danger" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-amber" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#3fb27f]" aria-hidden />
          <span className="ml-2 truncate font-mono text-xs text-white/70">
            {state.os === 'linux' ? 'student@lab-server: bash (simulated)' : 'Windows PowerShell (simulated)'}
          </span>
          <span className="ml-auto font-mono text-xs text-amber" title="Simulated clock">
            🕒 {new Date(state.now).toISOString().slice(11, 16)} lab time
          </span>
        </div>

        {editor ? (
          <EditorPane
            editor={editor}
            problems={editorProblems}
            onChange={(text) => setEditor({ ...editor, text })}
            onSave={saveEditor}
            onCancel={() => {
              setEditor(null)
              setLines((l) => [...l, { kind: 'info', text: 'Closed the editor without saving.' }])
            }}
            onPaste={exampleFits ? () => setEditor({ ...editor, text: step!.file!.content }) : undefined}
          />
        ) : (
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 cursor-text overflow-y-auto px-4 py-3 font-mono text-[0.86rem] leading-relaxed"
            onClick={() => {
              if (!window.getSelection()?.toString()) inputRef.current?.focus()
            }}
          >
            {lines.map((l, i) => (
              <TermLine key={i} line={l} />
            ))}
            <div className="flex items-start gap-2">
              <label htmlFor="term-input" className="shrink-0 whitespace-pre text-[#7ee0a1]">
                {promptText}
              </label>
              <input
                id="term-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                className="min-w-0 flex-1 bg-transparent text-white caret-amber outline-none"
                aria-label="Type a command and press Enter"
              />
            </div>
          </div>
        )}
        <div className="border-t border-white/10 bg-night-2 px-4 py-1.5 text-[0.72rem] text-white/60">
          Enter = run · ↑ ↓ = previous commands · Tab = complete names · type <span className="text-amber">help</span> for commands
        </div>
      </section>
    </div>
  )
}

function TermLine({ line }: { line: Line }) {
  const cls = {
    input: 'text-white',
    out: 'text-[#d6deeb]',
    err: 'text-[#ff8a98]',
    ok: 'text-[#7ee0a1] font-bold',
    info: 'text-amber',
  }[line.kind]
  if (line.kind === 'input') {
    const idx = line.text.search(/[$>] /)
    return (
      <div className="break-all whitespace-pre-wrap">
        <span className="text-[#7ee0a1]">{line.text.slice(0, idx + 1)}</span>
        <span className="text-white">{line.text.slice(idx + 1)}</span>
      </div>
    )
  }
  return <div className={`break-words whitespace-pre-wrap ${cls}`}>{line.text || ' '}</div>
}

function EditorPane({
  editor,
  problems,
  onChange,
  onSave,
  onCancel,
  onPaste,
}: {
  editor: EditorRequest & { text: string }
  problems: Line[]
  onChange: (t: string) => void
  onSave: () => void
  onCancel: () => void
  onPaste?: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  const title = editor.kind === 'crontab' ? 'crontab -e  (your cron jobs)' : editor.path
  const lineCount = editor.text.split('\n').length
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      onSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.currentTarget
      const { selectionStart: a, selectionEnd: b } = el
      const next = editor.text.slice(0, a) + '  ' + editor.text.slice(b)
      onChange(next)
      requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 bg-[#1b2742] px-3 py-2">
        <span className="min-w-0 truncate font-mono text-xs text-white">✎ {title}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {onPaste ? (
            <button type="button" className="btn border border-white/30 px-2 py-1 text-xs text-white hover:bg-white/10" onClick={onPaste}>
              <FaPaste aria-hidden /> Paste example
            </button>
          ) : null}
          <button type="button" className="btn border border-white/30 px-2 py-1 text-xs text-white hover:bg-white/10" onClick={onCancel}>
            <FaTimes aria-hidden /> Cancel
          </button>
          <button type="button" className="btn btn-amber px-3 py-1 text-xs" onClick={onSave}>
            <FaSave aria-hidden /> Save (Ctrl+S)
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-auto">
        <pre className="select-none border-r border-white/10 px-2 py-3 text-right font-mono text-[0.86rem] leading-[1.5rem] text-white/30" aria-hidden>
          {Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')}
        </pre>
        <textarea
          ref={ref}
          value={editor.text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          wrap="off"
          className="min-h-[16rem] flex-1 resize-none bg-transparent px-3 py-3 font-mono text-[0.86rem] leading-[1.5rem] whitespace-pre text-white caret-amber outline-none"
          aria-label={`Editing ${title}`}
          placeholder={editor.kind === 'crontab' ? '30 1 * * * /home/student/lab/backup.sh' : 'Type your code here…'}
        />
      </div>
      {problems.length ? (
        <ul className="max-h-28 overflow-y-auto border-t border-white/10 bg-night-2 px-3 py-2 font-mono text-xs" aria-live="polite">
          {problems.map((p, i) => (
            <li key={i} className={p.kind === 'err' ? 'text-[#ff8a98]' : p.kind === 'ok' ? 'text-[#7ee0a1]' : 'text-amber'}>
              {p.kind === 'ok' ? '✔ ' : p.kind === 'err' ? '✖ ' : '⚠ '}
              {p.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
