import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FaSearch } from 'react-icons/fa'
import { GLOSSARY } from '../data/glossary'
import { PageHeader } from '../components/ui'

export default function Glossary() {
  const [q, setQ] = useState('')
  const location = useLocation()
  const target = location.hash.slice(1)

  const items = useMemo(() => {
    const s = q.trim().toLowerCase()
    return [...GLOSSARY]
      .sort((a, b) => a.term.localeCompare(b.term))
      .filter((g) => !s || g.term.toLowerCase().includes(s) || g.definition.toLowerCase().includes(s))
  }, [q])

  // The page loads lazily, so scroll to the #term after it renders.
  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView({ block: 'center' })
  }, [target])

  return (
    <>
      <PageHeader kicker="Reference" title="Glossary" intro="Every key term from the lessons, in plain English. Dotted underlined words in the lessons link here." />
      <div className="relative max-w-md">
        <FaSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="glossary-search" className="sr-only">
          Search the glossary
        </label>
        <input id="glossary-search" type="search" className="field-input w-full !pl-9" placeholder="Search terms, e.g. cron" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="mt-2 text-sm" aria-live="polite">
        {items.length} term{items.length === 1 ? '' : 's'}
      </p>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((g) => (
          <div key={g.id} id={g.id} className={`card scroll-mt-24 p-4 ${g.id === target ? 'ring-4 ring-amber' : ''}`}>
            <dt className="font-[family-name:var(--font-heading)] text-lg font-bold text-navy">{g.term}</dt>
            <dd className="mt-1">{g.definition}</dd>
            {g.lesson ? (
              <dd className="mt-2 text-sm">
                <Link to={g.lesson}>Learn more →</Link>
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </>
  )
}
