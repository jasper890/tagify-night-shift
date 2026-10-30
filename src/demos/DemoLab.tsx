import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { FaArrowRight, FaCheckCircle, FaForward, FaLightbulb, FaPlay, FaRedo, FaStop } from 'react-icons/fa'
import { CopyButton } from '../components/CodeBlock'
import { Sprite } from '../components/pixel/Sprite'
import { EditorPane, RichText, TermLine, completeInput } from '../components/TerminalLab'
import { XP } from '../lib/game'
import { readProgress, useProgress } from '../lib/progress'
import { play } from '../lib/sfx'
import { followTick, heredocEnd, runBlock, splitBlock, type BlockResult } from '../terminal/block'
import { DEMO_TRACK, replayDemo } from '../terminal/demoTrack'
import { cronWarnings, prompt as linuxPrompt } from '../terminal/linux'
import { save } from '../terminal/tracks'
import type { EditorRequest, Line, ShellState } from '../terminal/types'

const steps = DEMO_TRACK.steps
/** While `tail -f` is running, a minute of lab time passes this often (real milliseconds). */
const FOLLOW_MS = 2200

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

function intro(resumeAt: number): Line[] {
  return [
    { kind: 'info', text: 'student@lab-server: this terminal is a SIMULATION. Nothing runs on your computer, so you cannot break anything.' },
    { kind: 'info', text: 'Type a command, paste a whole block, or press “Run it for me”. Tab completes, ↑ repeats, help lists the commands.' },
    ...(resumeAt > 0 && resumeAt < steps.length ? [{ kind: 'info' as const, text: `Welcome back! Resuming at step ${resumeAt + 1}.` }] : []),
    { kind: 'out', text: '' },
  ]
}

/** `a code span` that is still being typed gets its closing backtick, so it shows as code right away. */
const closeTicks = (t: string) => ((t.match(/`/g) ?? []).length % 2 ? t + '`' : t)

/** The Old Admin talking: comment lines that type themselves out, like a shell script explaining itself. */
function Speech({ paragraphs }: { paragraphs: string[] }) {
  const full = paragraphs.join('\n\n')
  const [shown, setShown] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? full.length : 0,
  )
  useEffect(() => {
    if (shown >= full.length) return
    const id = window.setTimeout(() => setShown((n) => Math.min(full.length, n + 2)), 16)
    return () => window.clearTimeout(id)
  }, [shown, full])

  return (
    <div
      className="cursor-pointer"
      onClick={() => setShown(full.length)}
      title={shown < full.length ? 'Click to show it all' : undefined}
    >
      <p className="sr-only">{full}</p>
      <div aria-hidden className="space-y-2">
        {full
          .slice(0, shown)
          .split('\n\n')
          .map((p, i) => (
            <p key={i}>
              <span className="select-none text-amber/70"># </span>
              <RichText text={closeTicks(p)} />
            </p>
          ))}
        {shown < full.length ? <span className="animate-blink text-amber">▌</span> : null}
      </div>
    </div>
  )
}

export function DemoLab() {
  const { toggleDemoStep } = useProgress()

  // Come back to the first step that is not done yet.
  const [startAt] = useState(() => {
    const open = steps.findIndex((s) => !readProgress().cronDemo.steps.includes(s.id!))
    return open === -1 ? steps.length : open
  })
  const [stepIndex, setStepIndex] = useState(startAt)
  const [done, setDone] = useState(false)
  const [state, setState] = useState<ShellState>(() => replayDemo(startAt))
  const [lines, setLines] = useState<Line[]>(() => intro(startAt))
  const [input, setInput] = useState('')
  const [histPos, setHistPos] = useState<number | null>(null)
  const [pending, setPending] = useState<{ first: string; end: string; body: string[] } | null>(null)
  const [editor, setEditor] = useState<(EditorRequest & { text: string }) | null>(null)
  const [following, setFollowing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showHint, setShowHint] = useState(false)

  // The auto-typing and the tail -f timer run between renders, so they read the latest values from refs.
  const stateRef = useRef(state)
  const stepRef = useRef(stepIndex)
  const doneRef = useRef(false)
  const busyRef = useRef(false)
  const aliveRef = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const finished = stepIndex >= steps.length
  const step = finished ? null : steps[stepIndex]
  const promptText = linuxPrompt(state)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines, editor, following])

  useEffect(() => {
    if (!editor && !following && !busy) inputRef.current?.focus({ preventScroll: true })
  }, [editor, following, busy, stepIndex])

  // tail -f has no prompt, so the terminal itself takes the focus and hears Ctrl+C
  useEffect(() => {
    if (following) scrollRef.current?.focus({ preventScroll: true })
  }, [following])

  const commit = (next: ShellState) => {
    stateRef.current = next
    setState(next)
  }

  const passStep = (ok: boolean) => {
    const current = steps[stepRef.current]
    if (!ok || !current || doneRef.current) return
    doneRef.current = true
    setDone(true)
    // the lab pays the same XP as the page's checklist: each step once
    if (!readProgress().cronDemo.steps.includes(current.id!)) toggleDemoStep(current.id!)
    play('select')
    setLines((l) => [...l, { kind: 'ok', text: `✔ Step ${stepRef.current + 1} complete: ${current.success}` }])
  }

  /** Run text as if typed (or pasted). Several lines run one after another; a heredoc keeps its body. */
  const runText = (text: string, opts: { echo?: boolean; check?: boolean } = {}): BlockResult => {
    const { echo = true, check = true } = opts
    const r = runBlock(stateRef.current, text)
    commit(r.state)
    const added = echo ? r.transcript : r.output
    setLines((l) => (r.clear ? r.transcript : [...l, ...added]))
    if (r.editor) setEditor({ ...r.editor, text: r.editor.content })
    if (r.follow) setFollowing(r.follow)
    const current = steps[stepRef.current]
    if (check && current && !r.editor && !r.follow && !/^\s*help\s*$/.test(text)) {
      passStep(current.check({ state: r.state, input: text, lines: r.output, exitCode: r.exitCode, event: 'command' }))
    }
    return r
  }

  // tail -f: every couple of seconds a minute of lab time passes, cron runs what is due, and new log lines appear.
  useEffect(() => {
    if (!following) return
    const id = window.setInterval(() => {
      const tick = followTick(stateRef.current, following)
      commit(tick.state)
      if (!tick.lines.length) return
      setLines((l) => [...l, ...tick.lines])
      const current = steps[stepRef.current]
      if (current && !doneRef.current) passStep(current.check({ state: tick.state, input: '', lines: tick.lines, exitCode: 0, event: 'follow' }))
    }, FOLLOW_MS)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [following])

  const stopFollow = () => {
    setFollowing(null)
    setLines((l) => [...l, { kind: 'input', text: '^C' }])
  }

  const cancelLine = () => {
    setLines((l) => [...l, { kind: 'input', text: `${pending ? '>' : promptText} ${input}^C` }])
    setInput('')
    setPending(null)
    setHistPos(null)
  }

  const submit = () => {
    const raw = input
    setInput('')
    setHistPos(null)
    if (pending) {
      setLines((l) => [...l, { kind: 'input', text: `> ${raw}` }])
      if (raw === pending.end) {
        const full = [pending.first, ...pending.body, pending.end].join('\n')
        setPending(null)
        runText(full, { echo: false })
      } else setPending({ ...pending, body: [...pending.body, raw] })
      return
    }
    const end = heredocEnd(raw)
    if (end && splitBlock(raw).length === 1) {
      // typing a heredoc by hand: the shell waits for the lines, then for the end word
      setLines((l) => [...l, { kind: 'input', text: `${promptText} ${raw}` }])
      setPending({ first: raw, end, body: [] })
      return
    }
    runText(raw)
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (!/\n[\s\S]*\S/.test(text) || pending) return
    e.preventDefault()
    runText(text.replace(/\s+$/, ''))
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const hist = state.history
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'c' && e.ctrlKey && !window.getSelection()?.toString()) {
      e.preventDefault()
      cancelLine()
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
      const r = completeInput(input, stateRef.current)
      if (r.listing) setLines((l) => [...l, { kind: 'out', text: r.listing! }])
      setInput(r.value)
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLines([])
    }
  }

  // While tail -f runs there is no prompt, so Ctrl+C is caught on the terminal itself.
  const onTerminalKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (following && e.key === 'c' && e.ctrlKey) {
      e.preventDefault()
      stopFollow()
    }
  }

  /** "Run it for me": types each command of the step, presses Enter, and checks the step at the end. */
  const autoRun = async () => {
    const current = steps[stepRef.current]
    if (!current?.command || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setShowHint(false)
    const output: Line[] = []
    let exitCode = 0
    let stopped = false
    for (const cmd of splitBlock(current.command)) {
      if (!aliveRef.current) return
      const first = cmd.shown[0]
      const pace = first.length > 70 ? 3 : 16
      for (let i = 1; i <= first.length; i++) {
        setInput(first.slice(0, i))
        await sleep(pace)
      }
      await sleep(260)
      setInput('')
      const r = runText(cmd.shown.join('\n'), { check: false })
      output.push(...r.output)
      exitCode = r.exitCode
      if (r.follow || r.editor) {
        stopped = true
        break
      }
      await sleep(380)
    }
    busyRef.current = false
    setBusy(false)
    if (!aliveRef.current || stopped) return
    passStep(current.check({ state: stateRef.current, input: current.command, lines: output, exitCode, event: 'command' }))
  }

  const saveEditor = () => {
    if (!editor) return
    const r = save(stateRef.current, editor, editor.text)
    commit(r.state)
    setLines((l) => [...l, ...r.lines])
    const path = editor.path
    setEditor(null)
    if (step && !doneRef.current) passStep(step.check({ state: r.state, input: '', lines: r.lines, exitCode: 0, event: 'save', savedPath: path }))
  }

  const goTo = (index: number, machine: ShellState, note?: string) => {
    stepRef.current = index
    doneRef.current = false
    setStepIndex(index)
    setDone(false)
    setShowHint(false)
    setEditor(null)
    setFollowing(null)
    setPending(null)
    setInput('')
    commit(machine)
    if (note) setLines((l) => [...l, { kind: 'info', text: note }])
  }

  const nextStep = () => goTo(stepIndex + 1, stateRef.current)
  const skipStep = () => goTo(stepIndex + 1, replayDemo(stepIndex + 1), `(Skipped step ${stepIndex + 1}: the simulator did it for you. Skipping earns no XP.)`)
  const restart = () => {
    goTo(0, replayDemo(0))
    setLines(intro(0))
  }

  const editorProblems = useMemo(() => (editor?.kind === 'crontab' ? cronWarnings(editor.text) : ([] as Line[])), [editor])

  const commandLines = step?.command?.split('\n') ?? []
  const percent = Math.round((Math.min(stepIndex + (done ? 1 : 0), steps.length) / steps.length) * 100)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* The Old Admin explains the step */}
      <aside className="flex min-h-0 flex-col gap-3">
        <div className="border-3 border-ink bg-navy p-4 text-white shadow-[5px_5px_0_0_rgb(26_28_44/0.3)]">
          <div className="flex items-center justify-between gap-2">
            <p className="pixel-label !text-[0.6rem] text-amber">{finished ? 'All steps done' : `Step ${stepIndex + 1} of ${steps.length}`}</p>
            <p className="pixel-label !text-[0.6rem] text-xp">{percent}%</p>
          </div>
          <div className="px-bar mt-2 text-xp" role="progressbar" aria-label="Lab progress" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${percent}%` }} />
          </div>

          <h3 className="mt-3 text-xl leading-snug text-white">{step ? step.title : 'Lab complete!'}</h3>

          <div className="mt-3 flex items-start gap-3" aria-live="polite">
            <div className="shrink-0 text-center">
              <Sprite id="sage" size={64} className="animate-bob" label="The Old Admin" />
              <p className="pixel-label mt-1 !text-[0.5rem] text-amber">Old Admin</p>
            </div>
            <div className="relative min-w-0 flex-1 rounded-md border-2 border-amber/60 bg-night p-3 font-mono text-[0.84rem] leading-relaxed text-[#d6deeb] [&_.inline-code]:border-white/25 [&_.inline-code]:bg-white/10 [&_.inline-code]:text-xp">
              <span className="absolute top-5 -left-[7px] h-3 w-3 rotate-45 border-b-2 border-l-2 border-amber/60 bg-night" aria-hidden />
              {step ? (
                <Speech key={`${step.id}-${done ? 'ok' : 'say'}`} paragraphs={done ? [`Well done! ${step.success}`] : step.explain} />
              ) : (
                <Speech
                  key="end"
                  paragraphs={[
                    'You did it! cron decides WHEN. The script decides HOW. Together they make a job that runs while nobody is looking.',
                    'Poke around: this terminal is still yours. Try timewarp 1h, then cat ~/lab/backup.log.',
                  ]}
                />
              )}
            </div>
          </div>
        </div>

        {step ? (
          <div className="border-3 border-amber bg-amber-soft p-3">
            <p className="pixel-label !text-[0.58rem] text-amber-dark">Your turn · +{XP.demoStep} XP</p>
            <p className="mt-1 font-bold text-navy">{step.task}</p>
            {commandLines.length <= 3 ? (
              <pre className="mt-2 overflow-x-auto rounded bg-night px-2 py-1.5 font-mono text-[0.8rem] text-amber">{step.command}</pre>
            ) : (
              <details className="mt-2 rounded bg-night px-2 py-1.5 font-mono text-[0.8rem] text-amber">
                <summary className="cursor-pointer">Show the {commandLines.length} lines</summary>
                <pre className="mt-1 max-h-56 overflow-auto">{step.command}</pre>
              </details>
            )}
            {step.hint ? (
              <div className="mt-2">
                {showHint ? (
                  <p className="flex gap-2 rounded-lg bg-white/70 p-2 text-sm">
                    <FaLightbulb className="mt-0.5 shrink-0 text-amber-dark" aria-hidden /> {step.hint}
                  </p>
                ) : (
                  <button type="button" className="text-sm font-bold text-slate underline" onClick={() => setShowHint(true)}>
                    Stuck? Show a hint
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {done && step ? (
          <div className="rounded-xl bg-teal-soft p-3">
            <p className="flex items-start gap-2 font-bold text-teal">
              <FaCheckCircle className="mt-1 shrink-0" aria-hidden /> Step {stepIndex + 1} done · +{XP.demoStep} XP
            </p>
            <button type="button" className="btn btn-primary mt-3" onClick={nextStep}>
              {stepIndex + 1 < steps.length ? 'Next step' : 'Finish'} <FaArrowRight aria-hidden />
            </button>
          </div>
        ) : null}

        {finished ? (
          <div className="rounded-xl bg-teal-soft p-3">
            <p className="font-bold text-teal">You practised:</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {DEMO_TRACK.youWillLearn.map((y) => (
                <li key={y}>{y}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-ghost" onClick={restart}>
                <FaRedo aria-hidden /> Do it again
              </button>
              <Link to="/player" className="text-sm font-bold">
                See your badges →
              </Link>
            </div>
          </div>
        ) : !done ? (
          <div className="flex flex-wrap items-center gap-4 text-xs text-ink/60">
            <button type="button" className="inline-flex items-center gap-1 underline" onClick={skipStep} disabled={busy || !!following}>
              <FaForward aria-hidden /> Skip this step (no XP)
            </button>
            <button type="button" className="inline-flex items-center gap-1 underline" onClick={restart} disabled={busy}>
              <FaRedo aria-hidden /> Restart the lab
            </button>
          </div>
        ) : null}
      </aside>

      {/* The terminal */}
      <section className="flex h-[32rem] min-h-[26rem] flex-col overflow-hidden rounded-2xl bg-night shadow-xl xl:h-[40rem]" aria-label="Simulated terminal">
        <div className="flex items-center gap-2 border-b border-white/10 bg-night-2 px-4 py-2">
          <span className="h-3 w-3 rounded-full bg-danger" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-amber" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#3fb27f]" aria-hidden />
          <span className="ml-2 truncate font-mono text-xs text-white/70">student@lab-server: bash (simulated)</span>
          <span className="ml-auto shrink-0 font-mono text-xs text-amber" title="Simulated clock">
            🕒 {new Date(state.now).toISOString().slice(11, 19)} lab time
          </span>
        </div>

        {/* The step's controls sit on the dark terminal itself, so they are on the first screen and easy to read. */}
        {step ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-night-2 px-3 py-2">
            <button type="button" className="btn btn-amber px-3 py-1 text-sm" onClick={autoRun} disabled={busy || !!following || done || !!editor}>
              <FaPlay aria-hidden /> Run it for me
            </button>
            <CopyButton text={step.command ?? ''} label="Copy" copiedLabel="Copied! Now paste it" />
            <span className="ml-auto min-w-0 truncate font-mono text-xs text-white/60">
              Step {stepIndex + 1}: {step.title}
            </span>
          </div>
        ) : null}

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
          />
        ) : (
          <div
            ref={scrollRef}
            tabIndex={following ? 0 : -1}
            onKeyDown={onTerminalKey}
            className="min-h-0 flex-1 cursor-text overflow-y-auto px-4 py-3 font-mono text-[0.86rem] leading-relaxed outline-none"
            onClick={() => {
              if (!window.getSelection()?.toString()) inputRef.current?.focus()
            }}
          >
            {lines.map((l, i) => (
              <TermLine key={i} line={l} />
            ))}
            {following ? (
              <div className="mt-1 flex flex-wrap items-center gap-3 text-amber">
                <span className="animate-blink">▌</span>
                <span>following {following.replace(/^\/home\/student/, '~')} · press Ctrl+C to stop</span>
                <button type="button" className="btn border border-white/30 px-2 py-0.5 text-xs text-white hover:bg-white/10" onClick={stopFollow}>
                  <FaStop aria-hidden /> Stop (Ctrl+C)
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <label htmlFor="demo-term-input" className="shrink-0 whitespace-pre text-[#7ee0a1]">
                  {pending ? '>' : promptText}
                </label>
                <input
                  id="demo-term-input"
                  ref={inputRef}
                  value={input}
                  disabled={busy}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  onPaste={onPaste}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  className="min-w-0 flex-1 bg-transparent text-white caret-amber outline-none"
                  aria-label="Type a command and press Enter"
                />
              </div>
            )}
          </div>
        )}
        <div className="border-t border-white/10 bg-night-2 px-4 py-1.5 text-[0.72rem] text-white/60">
          Enter = run · paste a whole block · ↑ ↓ = history · Tab = complete · Ctrl+C = stop · type <span className="text-amber">help</span>
        </div>
      </section>
    </div>
  )
}
