import { Link } from 'react-router-dom'
import { FaRocket } from 'react-icons/fa'
import { LESSONS } from '../data/lessons'
import { TOOLS } from '../data/comparison'
import { Callout, LessonNav, PageHeader, Section } from '../components/ui'
import { ToolComparison } from '../demos/ToolComparison'
import { LabClock } from '../demos/LabClock'

const lesson = LESSONS[7]

export default function Lesson8() {
  const basics = TOOLS.filter((t) => t.group === 'basic')
  return (
    <>
      <PageHeader
        stage={lesson.id}
        kicker={lesson.kicker}
        title={lesson.title}
        slides={lesson.slides}
        icon={lesson.icon}
        intro="There is no single best tool. Pick the one that fits the platform and the job, and remember that schedulers and scripts work as a team."
      />

      <Section kicker="Slide 20" title="Which Tool Should I Use?">
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-navy text-white">
              <tr>
                <th scope="col" className="p-3">Tool</th>
                <th scope="col" className="p-3">Platform</th>
                <th scope="col" className="p-3">Best for</th>
                <th scope="col" className="p-3">Limitation</th>
              </tr>
            </thead>
            <tbody>
              {basics.map((t, i) => (
                <tr key={t.name} className={i % 2 ? 'bg-card' : 'bg-white'}>
                  <th scope="row" className="p-3 font-bold text-navy">
                    {t.name === 'Scripts (PowerShell, Bash)' ? 'Scripts' : t.name}
                  </th>
                  <td className="p-3">{t.platformText}</td>
                  <td className="p-3">{t.bestFor}</td>
                  <td className="p-3 text-danger-dark">{t.limitation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="tip" title="Remember">
          Schedulers decide <strong>WHEN</strong>, scripts decide <strong>HOW</strong>. They work as a team.
        </Callout>
        <ToolComparison initialGroup="basic" />
        <p className="mt-4">
          <Link to="/beyond" className="btn btn-amber no-underline">
            <FaRocket aria-hidden /> See how modern tools use the same ideas
          </Link>
        </p>
      </Section>

      <Section kicker="Slide 21 · Real-world example" title="Automating a School Computer Lab">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['10:00 PM nightly', 'Clear student files', 'Task Scheduler; only if idle'],
            ['1:30 AM daily', 'Back up the server', 'cron; service account'],
            ['Sunday 2:00 AM', 'Install updates', 'Random delay so 40 PCs do not overload'],
            ['Every 10 minutes', 'Check disk space', 'cron; alert at 85% full'],
          ].map(([w, t, h]) => (
            <div key={t} className="card p-4">
              <p className="text-sm font-bold text-teal uppercase">{w}</p>
              <p className="text-lg font-bold text-navy">{t}</p>
              <p className="text-[0.95rem]">{h}</p>
            </div>
          ))}
        </div>
        <LabClock />
      </Section>

      <LessonNav id={8} />
    </>
  )
}
