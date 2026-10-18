import { useState } from 'react'
import { FaSearch } from 'react-icons/fa'
import { DemoFrame } from '../components/ui'
import { decodeResultCode, RESULT_CODES } from '../lib/resultCodes'

export function ResultDecoder({ initial = '0x2' }: { initial?: string }) {
  const [input, setInput] = useState(initial)
  const result = decodeResultCode(input)
  const toneStyle = result
    ? result.tone === 'success'
      ? 'border-ok bg-teal-soft'
      : result.tone === 'error'
        ? 'border-danger bg-danger-soft'
        : 'border-slate bg-card'
    : 'border-line bg-white'

  return (
    <DemoFrame title="Last Run Result Decoder" icon={FaSearch} hint="Type the code from the Last Run Result column, or pick one.">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="rc-input" className="block text-sm font-bold text-navy">
            Last Run Result
          </label>
          <input
            id="rc-input"
            className="field-input mt-1 w-48 font-mono text-lg"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder="0x0"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {RESULT_CODES.slice(0, 5).map((c) => (
            <button key={c.code} type="button" className="btn btn-ghost font-mono text-xs" aria-pressed={result?.code === c.code} onClick={() => setInput(c.code)}>
              {c.code}
            </button>
          ))}
          <label className="sr-only" htmlFor="rc-more">
            More codes
          </label>
          <select id="rc-more" className="field-input text-sm" value="" onChange={(e) => e.target.value && setInput(e.target.value)}>
            <option value="">More codes…</option>
            {RESULT_CODES.slice(5).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={`mt-4 rounded-xl border-2 p-4 ${toneStyle}`} aria-live="polite">
        {result ? (
          <>
            <p className="font-mono text-sm font-bold text-ink/70">{result.code}</p>
            <p className="text-2xl font-bold text-navy">{result.name}</p>
            <p className="mt-1">{result.meaning}</p>
            <p className="mt-2">
              <strong>What to check:</strong> {result.check}
            </p>
          </>
        ) : (
          <p>
            {input.trim() ? (
              <>
                Not in our list. Any code other than <span className="font-mono">0x0</span> means something went wrong: look in the History tab and the script’s log, and search the
                code in the Microsoft docs.
              </>
            ) : (
              'Type a code to decode it.'
            )}
          </p>
        )}
      </div>
    </DemoFrame>
  )
}
