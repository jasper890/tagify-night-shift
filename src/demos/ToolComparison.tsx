import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaBalanceScale, FaCheck, FaMinus, FaTimes } from 'react-icons/fa'
import { DemoFrame } from '../components/ui'
import { FEATURES, TOOLS, type Cell, type FeatureKey, type Platform } from '../data/comparison'

const PLATFORMS: { value: Platform | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'windows', label: 'Windows' },
  { value: 'linux', label: 'Linux' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'cross', label: 'Cross-platform' },
]

function CellView({ cell }: { cell: Cell }) {
  const map = {
    yes: { icon: <FaCheck aria-hidden />, cls: 'bg-teal text-white', text: 'Yes' },
    partial: { icon: <FaMinus aria-hidden />, cls: 'bg-amber text-navy', text: 'Partly' },
    no: { icon: <FaTimes aria-hidden />, cls: 'bg-danger text-white', text: 'No' },
    na: { icon: <span aria-hidden>–</span>, cls: 'bg-card text-ink/70', text: 'Not applicable' },
  }[cell.v]
  return (
    <div className="flex items-start gap-2">
      <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${map.cls}`} title={map.text}>
        {map.icon}
      </span>
      <span className="sr-only">{map.text}.</span>
      {cell.note ? <span className="text-xs leading-snug text-ink/80">{cell.note}</span> : null}
    </div>
  )
}

export function ToolComparison({ initialGroup = 'all' }: { initialGroup?: 'all' | 'basic' }) {
  const [platform, setPlatform] = useState<Platform | 'all'>('all')
  const [group, setGroup] = useState<'all' | 'basic'>(initialGroup)
  const [needs, setNeeds] = useState<FeatureKey[]>([])

  const rows = useMemo(
    () =>
      TOOLS.filter((t) => (group === 'all' ? true : t.group === 'basic'))
        .filter((t) => platform === 'all' || t.platforms.includes(platform))
        .filter((t) => needs.every((k) => t[k].v === 'yes' || t[k].v === 'partial')),
    [platform, group, needs],
  )

  const toggleNeed = (k: FeatureKey) => setNeeds((n) => (n.includes(k) ? n.filter((x) => x !== k) : [...n, k]))

  return (
    <DemoFrame title="Tool Comparison Table" icon={FaBalanceScale} hint="Filter by platform and by what you need. Click a tool name to learn more.">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-navy">Show:</span>
          <button type="button" className="btn btn-ghost text-xs" aria-pressed={group === 'basic'} onClick={() => setGroup('basic')}>
            The 4 basic tools (slide 20)
          </button>
          <button type="button" className="btn btn-ghost text-xs" aria-pressed={group === 'all'} onClick={() => setGroup('all')}>
            All tools, including Beyond the Basics
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-navy">Platform:</span>
          {PLATFORMS.map((p) => (
            <button key={p.value} type="button" className="btn btn-ghost text-xs" aria-pressed={platform === p.value} onClick={() => setPlatform(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-navy">Must have:</span>
          {FEATURES.map((f) => (
            <label key={f.key} className="flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 text-sm">
              <input type="checkbox" checked={needs.includes(f.key)} onChange={() => toggleNeed(f.key)} /> {f.label}
            </label>
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm" aria-live="polite">
        Showing <strong>{rows.length}</strong> of {group === 'basic' ? TOOLS.filter((t) => t.group === 'basic').length : TOOLS.length} tools.
      </p>
      <div className="mt-2 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[960px] text-left text-sm">
          <caption className="sr-only">Comparison of scheduling and automation tools</caption>
          <thead className="bg-navy text-white">
            <tr>
              <th scope="col" className="p-2.5">Tool</th>
              <th scope="col" className="p-2.5">Platform</th>
              <th scope="col" className="p-2.5">Best for</th>
              <th scope="col" className="p-2.5">Limitation</th>
              {FEATURES.map((f) => (
                <th key={f.key} scope="col" className="p-2.5">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.name} className={i % 2 ? 'bg-card/60' : 'bg-white'}>
                <th scope="row" className="p-2.5 align-top font-bold text-navy">
                  {t.path ? <Link to={t.path}>{t.name}</Link> : t.name}
                  {t.group === 'beyond' ? <span className="mt-1 block text-[0.7rem] font-bold text-teal uppercase">Beyond</span> : null}
                </th>
                <td className="p-2.5 align-top">{t.platformText}</td>
                <td className="p-2.5 align-top">{t.bestFor}</td>
                <td className="p-2.5 align-top text-danger-dark">{t.limitation}</td>
                {FEATURES.map((f) => (
                  <td key={f.key} className="p-2.5 align-top">
                    <CellView cell={t[f.key]} />
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-4 text-center">
                  No tool matches all of those filters. Try removing one.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink/70">
        <span className="font-bold">Key:</span> ✔ yes · – partly (see note) · ✖ no · grey = does not apply
      </p>
    </DemoFrame>
  )
}
