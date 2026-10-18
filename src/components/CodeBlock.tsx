import { useMemo, useState } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-powershell'
import 'prismjs/components/prism-ini'
import 'prismjs/components/prism-groovy'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-batch'
import { FaCheck, FaCopy } from 'react-icons/fa'

export type CodeLang = 'bash' | 'yaml' | 'powershell' | 'ini' | 'groovy' | 'json' | 'batch' | 'text' | 'crontab'

const LABELS: Record<CodeLang, string> = {
  bash: 'Bash',
  yaml: 'YAML',
  powershell: 'PowerShell',
  ini: 'INI (systemd unit)',
  groovy: 'Groovy (Jenkinsfile)',
  json: 'JSON',
  batch: 'Command Prompt',
  text: 'Output',
  crontab: 'crontab',
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="no-print inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/20"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        }
      }}
      aria-label={copied ? 'Copied to clipboard' : `${label} code`}
    >
      {copied ? <FaCheck aria-hidden /> : <FaCopy aria-hidden />}
      {copied ? 'Copied' : label}
    </button>
  )
}

interface CodeBlockProps {
  code: string
  lang: CodeLang
  title?: string
  /** Highlight these 1-based line numbers. */
  highlight?: number[]
}

export function CodeBlock({ code, lang, title, highlight = [] }: CodeBlockProps) {
  const trimmed = code.replace(/^\n+|\s+$/g, '')
  const html = useMemo(() => {
    const prismLang = lang === 'crontab' ? 'bash' : lang
    const grammar = prismLang === 'text' ? undefined : Prism.languages[prismLang]
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const highlighted = grammar ? Prism.highlight(trimmed, grammar, prismLang) : escape(trimmed)
    return highlighted
      .split('\n')
      .map((line, i) =>
        highlight.includes(i + 1)
          ? `<span style="display:block;background:rgba(252,163,17,.18);box-shadow:inset 3px 0 0 #FCA311;margin:0 -1rem;padding:0 1rem">${line || ' '}</span>`
          : line,
      )
      .join('\n')
  }, [trimmed, lang, highlight])

  return (
    <figure className="code-block print-break my-4 overflow-hidden rounded-xl shadow-md">
      <figcaption className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-2">
        <span className="min-w-0 truncate text-xs font-bold tracking-wide text-amber uppercase">
          {LABELS[lang]}
          {title ? <span className="ml-2 font-normal tracking-normal text-[#c5cee0] normal-case">{title}</span> : null}
        </span>
        <CopyButton text={trimmed} />
      </figcaption>
      <pre className="overflow-x-auto px-4 py-3 text-[0.86rem] leading-relaxed" tabIndex={0}>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </figure>
  )
}
