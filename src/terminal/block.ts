// Running pasted text: several commands at once, and heredocs (cat > file << 'EOF').
import { prompt as linuxPrompt } from './linux'
import { run } from './tracks'
import type { EditorRequest, Line, ShellState } from './types'
import { winPrompt } from './windows'

export interface BlockCommand {
  /** The command line, without the heredoc marker. */
  text: string
  /** What a heredoc collected: the text that goes into the command's standard input. */
  stdin?: string
  /** The lines to show after the prompt: the command, then any heredoc lines. */
  shown: string[]
}

const HEREDOC = /^(.*?)<<-?\s*(['"]?)([A-Za-z_]\w*)\2\s*$/

/** Split pasted text into commands. A `<< 'EOF'` line swallows the lines up to EOF as its input. */
export function splitBlock(text: string): BlockCommand[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: BlockCommand[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const m = HEREDOC.exec(line)
    if (!m) {
      out.push({ text: line, shown: [line] })
      continue
    }
    const body: string[] = []
    let j = i + 1
    while (j < lines.length && lines[j] !== m[3]) body.push(lines[j++])
    out.push({ text: m[1].trim(), stdin: body.length ? body.join('\n') + '\n' : '', shown: [line, ...body, ...(j < lines.length ? [m[3]] : [])] })
    i = j
  }
  return out
}

/** Does this line start a heredoc? Returns the word that ends it (EOF). */
export function heredocEnd(line: string): string | null {
  return HEREDOC.exec(line)?.[3] ?? null
}

export interface BlockResult {
  state: ShellState
  /** What the screen shows: each command after its prompt, then its output. */
  transcript: Line[]
  /** Only the output of the commands. */
  output: Line[]
  exitCode: number
  editor?: EditorRequest
  follow?: string
  clear?: boolean
}

const promptFor = (s: ShellState) => (s.os === 'linux' ? linuxPrompt(s) : winPrompt(s))

/** Run pasted text one command at a time, as if it had been typed. Stops if an editor opens or `tail -f` starts. */
export function runBlock(state0: ShellState, text: string): BlockResult {
  let state = state0
  const transcript: Line[] = []
  const output: Line[] = []
  let exitCode = 0
  let editor: EditorRequest | undefined
  let follow: string | undefined
  let clear = false
  for (const cmd of splitBlock(text)) {
    const prompt = promptFor(state)
    const r = run(state, cmd.text, cmd.stdin ?? '')
    state = r.state
    exitCode = r.exitCode
    if (r.clear) {
      clear = true
      transcript.length = 0
      continue
    }
    const [first, ...more] = cmd.shown
    transcript.push({ kind: 'input', text: `${prompt} ${first}` }, ...more.map((m) => ({ kind: 'input' as const, text: `> ${m}` })), ...r.lines)
    output.push(...r.lines)
    if (r.editor) {
      editor = r.editor
      break
    }
    if (r.follow) {
      follow = r.follow
      break
    }
  }
  return { state, transcript, output, exitCode, editor, follow, clear }
}

/** One beat of `tail -f`: a minute of lab time passes (cron runs whatever is due) and the new lines of the file come back. */
export function followTick(state: ShellState, path: string): { state: ShellState; lines: Line[] } {
  const before = state.fs[path]?.content ?? ''
  const warp = run(state, 'timewarp 1m')
  const after = warp.state.fs[path]?.content ?? ''
  const added = after.startsWith(before) ? after.slice(before.length) : after
  const lines = added
    .split('\n')
    .filter(Boolean)
    .map((text) => ({ kind: 'out' as const, text }))
  return { state: warp.state, lines }
}
