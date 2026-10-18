import { Link, useParams } from 'react-router-dom'
import { FaArrowLeft, FaArrowRight, FaExclamationTriangle, FaRocket } from 'react-icons/fa'
import { TOOL_PAGES } from '../data/tools'
import { C, Callout, DocLinks, PageHeader, Section, TryInTerminal } from '../components/ui'
import { CodeBlock } from '../components/CodeBlock'
import { TOOL_ICONS } from './Beyond'
import NotFound from './NotFound'

const CONCEPTS = [
  { key: 'trigger', label: 'Trigger' },
  { key: 'schedule', label: 'Schedule & interval' },
  { key: 'condition', label: 'Condition' },
  { key: 'dependency', label: 'Dependency' },
  { key: 'queue', label: 'Job queue' },
] as const

const REPO_URL = (import.meta.env.VITE_REPO_URL as string | undefined)?.replace(/\/$/, '')

export default function BeyondTool() {
  const { tool } = useParams()
  const index = TOOL_PAGES.findIndex((t) => t.slug === tool)
  if (index === -1) return <NotFound />
  const t = TOOL_PAGES[index]
  const prev = TOOL_PAGES[index - 1]
  const next = TOOL_PAGES[index + 1]

  return (
    <>
      <p className="no-print mb-4">
        <Link to="/beyond" className="inline-flex items-center gap-2 text-sm font-bold">
          <FaArrowLeft aria-hidden /> All modern tools
        </Link>
      </p>
      <PageHeader kicker={`Beyond the Basics · ${t.platform}`} title={t.name} icon={TOOL_ICONS[t.slug] ?? FaRocket} intro={t.tagline} />

      {t.slug === 'ansible' ? (
        <TryInTerminal track="ansible" title="Do it yourself: Ansible for network automation" text="Write an inventory and playbooks for 3 Cisco devices, preview with --check, and see idempotence." />
      ) : null}
      {t.slug === 'github-actions' ? (
        <TryInTerminal track="github-actions" title="Do it yourself: write and run a GitHub Actions workflow" text="Schedule your Ansible backup in UTC, push it, run it by hand and read the run log." />
      ) : null}

      <Section title="What it is">
        <p className="max-w-3xl text-lg">{t.what}</p>
        <h3 className="mt-5 text-lg">When to use it</h3>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          {t.whenToUse.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </Section>

      <Section kicker="Lesson 2 concepts" title="Same ideas, new tool">
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[520px] text-left">
            <thead className="bg-navy text-white">
              <tr>
                <th scope="col" className="w-48 p-3">Concept</th>
                <th scope="col" className="p-3">In {t.name}</th>
              </tr>
            </thead>
            <tbody>
              {CONCEPTS.map((c, i) => (
                <tr key={c.key} className={i % 2 ? 'bg-card' : 'bg-white'}>
                  <th scope="row" className="p-3 font-bold text-navy">
                    <Link to="/lesson/2">{c.label}</Link>
                  </th>
                  <td className="p-3">{t.concepts[c.key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section kicker="Complete example" title={t.scenario}>
        {t.examples.map((ex) => (
          <CodeBlock key={ex.title} lang={ex.lang} title={ex.title} code={ex.code} />
        ))}
        <h3 className="mt-6 text-xl">Line by line</h3>
        <dl className="mt-3 space-y-2">
          {t.explain.map((e) => (
            <div key={e.code} className="card grid gap-1 p-4 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-4">
              <dt>
                <C>{e.code}</C>
              </dt>
              <dd>{e.text}</dd>
            </div>
          ))}
        </dl>
        {t.slug === 'github-actions' ? (
          <Callout tone="info" title="This website uses it too">
            This project has a real scheduled workflow, <C>.github/workflows/nightly-check.yml</C>, with <C>cron: '0 18 * * *'</C>. That is 18:00 UTC, which is{' '}
            <strong>2:00 AM the next day in the Philippines</strong> (UTC+8). It runs the tests and a broken-link check every night.
            {REPO_URL ? (
              <>
                {' '}
                <a href={`${REPO_URL}/blob/main/.github/workflows/nightly-check.yml`} target="_blank" rel="noreferrer">
                  View the file on GitHub
                </a>{' '}
                ·{' '}
                <a href={`${REPO_URL}/actions/workflows/nightly-check.yml`} target="_blank" rel="noreferrer">
                  See its runs
                </a>
              </>
            ) : null}
          </Callout>
        ) : null}
      </Section>

      {t.extra?.map((x) => (
        <Section key={x.title} title={x.title}>
          <p className="max-w-3xl">{x.body}</p>
          {x.examples?.map((ex) => (
            <CodeBlock key={ex.title} lang={ex.lang} title={ex.title} code={ex.code} />
          ))}
        </Section>
      ))}

      <Section title="Common mistakes">
        <ul className="space-y-2">
          {t.mistakes.map((m) => (
            <li key={m} className="flex gap-3 rounded-xl border border-danger/40 bg-danger-soft p-3">
              <FaExclamationTriangle className="mt-1 shrink-0 text-danger" aria-hidden />
              <span>{m}</span>
            </li>
          ))}
        </ul>
      </Section>

      <DocLinks links={t.docs} />

      <nav className="no-print mt-10 grid gap-3 border-t border-line pt-6 sm:grid-cols-2" aria-label="Tool navigation">
        {prev ? (
          <Link to={`/beyond/${prev.slug}`} className="card flex items-center gap-3 p-4 no-underline hover:ring-2 hover:ring-amber">
            <FaArrowLeft className="text-teal" aria-hidden />
            <span className="font-bold text-navy">{prev.name}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/beyond/${next.slug}`} className="card flex items-center justify-end gap-3 p-4 text-right no-underline hover:ring-2 hover:ring-amber">
            <span className="font-bold text-navy">{next.name}</span>
            <FaArrowRight className="text-teal" aria-hidden />
          </Link>
        ) : null}
      </nav>
    </>
  )
}
