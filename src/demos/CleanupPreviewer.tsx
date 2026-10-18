import { useMemo, useState } from 'react'
import { FaBroom, FaFileAlt, FaTrashAlt } from 'react-icons/fa'
import { DemoFrame, Segmented, Toggle } from '../components/ui'
import { CodeBlock } from '../components/CodeBlock'
import { filesToDelete, SAMPLE_LOGS } from '../lib/cleanup'

type Shell = 'powershell' | 'bash'

export function CleanupPreviewer() {
  const [keepDays, setKeepDays] = useState(7)
  const [preview, setPreview] = useState(true)
  const [shell, setShell] = useState<Shell>('powershell')
  const [ran, setRan] = useState(false)

  const doomed = useMemo(() => filesToDelete(SAMPLE_LOGS, keepDays), [keepDays])
  const doomedNames = new Set(doomed.map((f) => f.name))
  const removed = ran && !preview

  const psCommand = `# Delete .log files older than ${keepDays} days
Get-ChildItem C:\\Lab\\Logs -Filter *.log |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-${keepDays}) } |
  Remove-Item${preview ? ' -WhatIf   # preview first' : '            # really deletes!'}`

  const bashCommand = `# Delete .log files older than ${keepDays} days
find /home/student/lab/logs -type f -name '*.log' -mtime +${keepDays} ${preview ? '-print            # preview first' : '-print -delete    # really deletes!'}`

  const psOutput = doomed.length
    ? doomed.map((f) => `What if: Performing the operation "Remove File" on target "C:\\Lab\\Logs\\${f.name}".`).join('\n')
    : '(no output: no files are old enough)'
  const bashOutput = doomed.length ? doomed.map((f) => `/home/student/lab/logs/${f.name}`).join('\n') : '(no output: no files are old enough)'
  const realOutputPs = doomed.length ? '(no output: Remove-Item is silent when it succeeds)' : '(no output: no files are old enough)'

  return (
    <DemoFrame
      title="Safe Cleanup Previewer"
      icon={FaBroom}
      hint="Nothing here touches your computer. The files are pretend. Move the slider and watch which files would be deleted."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <label htmlFor="keep-days" className="flex justify-between font-bold text-navy">
            <span>Days to keep</span>
            <span className="text-teal">{keepDays} days</span>
          </label>
          <input
            id="keep-days"
            type="range"
            min={1}
            max={21}
            value={keepDays}
            onChange={(e) => {
              setKeepDays(Number(e.target.value))
              setRan(false)
            }}
            className="w-full"
          />
          <div className="mt-3">
            <Toggle
              checked={preview}
              onChange={(v) => {
                setPreview(v)
                setRan(false)
              }}
              label="Preview mode"
              description={preview ? 'Shows what WOULD be deleted. Nothing is removed.' : 'Danger: the command really deletes (here: pretend).'}
            />
          </div>

          <ul className="mt-4 divide-y divide-[#dbe2ec] rounded-xl border border-line" aria-label="Log files in the folder">
            {SAMPLE_LOGS.map((f) => {
              const willGo = doomedNames.has(f.name)
              if (removed && willGo) {
                return (
                  <li key={f.name} className="flex items-center gap-3 bg-danger-soft px-3 py-1.5 text-sm text-danger-dark line-through">
                    <FaTrashAlt aria-hidden /> <span className="font-mono">{f.name}</span>
                    <span className="ml-auto">removed</span>
                  </li>
                )
              }
              return (
                <li key={f.name} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${willGo ? 'bg-danger-soft' : ''}`}>
                  <FaFileAlt className={willGo ? 'text-danger' : 'text-teal'} aria-hidden />
                  <span className="min-w-0 truncate font-mono">{f.name}</span>
                  <span className="ml-auto shrink-0 text-ink/70">{f.ageDays} days old</span>
                  <span className={`w-24 shrink-0 text-right text-xs font-bold ${willGo ? 'text-danger-dark' : 'text-teal'}`}>
                    {willGo ? (preview ? 'would delete' : 'will delete') : 'keep'}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-sm" aria-live="polite">
            <strong>{doomed.length}</strong> of {SAMPLE_LOGS.length} files {preview ? 'would be' : removed ? 'were' : 'will be'} deleted;{' '}
            {SAMPLE_LOGS.length - doomed.length} kept.
          </p>
        </div>

        <div>
          <Segmented
            label="Shell"
            value={shell}
            onChange={setShell}
            options={[
              { value: 'powershell', label: 'PowerShell (Windows)' },
              { value: 'bash', label: 'Bash (Linux)' },
            ]}
          />
          {shell === 'powershell' ? (
            <CodeBlock lang="powershell" title="C:\Lab\cleanup.ps1" code={psCommand} />
          ) : (
            <CodeBlock lang="bash" title="/home/student/lab/cleanup.sh" code={bashCommand} />
          )}
          <button type="button" className={`btn ${preview ? 'btn-primary' : 'bg-danger text-white hover:bg-danger-dark'}`} onClick={() => setRan(true)}>
            ▶ Run (simulated)
          </button>
          {ran ? (
            <CodeBlock
              lang="text"
              title="Simulated output"
              code={shell === 'powershell' ? (preview ? psOutput : realOutputPs) : bashOutput}
            />
          ) : (
            <p className="mt-3 rounded-xl bg-card p-3 text-sm">Press Run to see the simulated output.</p>
          )}
          <p className="mt-2 text-sm text-ink/80">
            <strong>Why preview first?</strong> A delete cannot be undone. One wrong folder or a missing filter can wipe the wrong files. Read the list, then
            remove <span className="font-mono">-WhatIf</span> (or change <span className="font-mono">-print</span> to <span className="font-mono">-print -delete</span>).
          </p>
        </div>
      </div>
    </DemoFrame>
  )
}
