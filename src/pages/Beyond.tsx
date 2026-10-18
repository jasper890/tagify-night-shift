import { Link } from 'react-router-dom'
import { FaAws, FaCloud, FaGithub, FaJenkins, FaLinux, FaRocket, FaServer, FaWindows } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import { TOOL_PAGES } from '../data/tools'
import { Callout, IconCircle, PageHeader, Section } from '../components/ui'
import { ToolComparison } from '../demos/ToolComparison'

export const TOOL_ICONS: Record<string, IconType> = {
  'github-actions': FaGithub,
  ansible: FaServer,
  'systemd-timers': FaLinux,
  'kubernetes-cronjob': FaCloud,
  jenkins: FaJenkins,
  'powershell-scheduledtasks': FaWindows,
  'cloud-schedulers': FaAws,
}

export default function Beyond() {
  return (
    <>
      <PageHeader
        kicker="Beyond the Basics · new"
        title="Modern Automation Tools"
        icon={FaRocket}
        intro="Real companies also use cloud and DevOps tools. The good news: they all use the same five ideas from Lesson 2: trigger, schedule, condition, dependency and job queue."
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOL_PAGES.map((t, i) => (
          <li key={t.slug}>
            <Link to={`/beyond/${t.slug}`} className="card flex h-full flex-col gap-3 p-5 no-underline hover:shadow-lg hover:ring-2 hover:ring-amber">
              <IconCircle icon={TOOL_ICONS[t.slug] ?? FaRocket} tone={i % 2 ? 'teal' : 'amber'} />
              <span className="text-xl font-bold text-navy">{t.name}</span>
              <span className="text-ink/85">{t.tagline}</span>
              <span className="mt-auto text-xs font-bold text-teal uppercase">{t.platform}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Callout tone="tip" title="Same ideas, new tool">
        Every tool page has a table that maps the tool to the five concepts, a complete working example for a real sysadmin job, common mistakes, and links to the official
        documentation.
      </Callout>
      <Section title="Compare all the tools">
        <ToolComparison />
      </Section>
    </>
  )
}
