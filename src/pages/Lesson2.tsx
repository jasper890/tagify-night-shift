import { FaBolt, FaCalendarAlt, FaFilter, FaLink, FaListOl } from 'react-icons/fa'
import { LESSONS } from '../data/lessons'
import { Analogy, IconCircle, LessonNav, PageHeader, Section, Term } from '../components/ui'
import { PhoneUpdateSim } from '../demos/PhoneUpdateSim'
import { QueueSim } from '../demos/QueueSim'

const lesson = LESSONS[1]

const IDEAS = [
  { icon: FaBolt, id: 'trigger', t: 'Trigger', d: 'What starts the task: a time, startup, or logon' },
  { icon: FaCalendarAlt, id: 'interval', t: 'Schedule & Interval', d: 'When it runs, and how often it repeats' },
  { icon: FaFilter, id: 'condition', t: 'Condition', d: 'An “only if” rule, e.g., only if plugged in' },
  { icon: FaLink, id: 'dependency', t: 'Dependency', d: 'Job B waits until job A finishes' },
  { icon: FaListOl, id: 'job-queue', t: 'Job Queue', d: 'Jobs take turns so copies do not clash' },
]

export default function Lesson2() {
  return (
    <>
      <PageHeader
        stage={lesson.id}
        kicker={lesson.kicker}
        title={lesson.title}
        slides={lesson.slides}
        icon={lesson.icon}
        intro="Every scheduler, from Windows Task Scheduler to Kubernetes, is built from the same five ideas. Learn them once and you can use any tool."
      />

      <Section kicker="Slide 6" title="Five Ideas Every Scheduler Uses">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {IDEAS.map((x, i) => (
            <li key={x.t} className="card p-4">
              <div className="flex items-center justify-between">
                <IconCircle icon={x.icon} tone={i % 2 ? 'teal' : 'amber'} />
                <span className="text-2xl font-bold text-muted">{i + 1}</span>
              </div>
              <h3 className="mt-3 text-lg">
                <Term id={x.id}>{x.t}</Term>
              </h3>
              <p className="text-[0.95rem]">{x.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Analogy>
            <strong className="text-amber">Dependency</strong> is like <strong>cooking rice before serving</strong>: you cannot serve until the rice is done.
          </Analogy>
          <Analogy>
            A <strong className="text-amber">job queue</strong> is like <strong>one ATM line</strong>: people take turns, so two people never use the machine at once.
          </Analogy>
        </div>
      </Section>

      <Section kicker="Slide 7" title="Example: Your Phone’s Night Update">
        <p>
          Your phone does not just install updates at 2:00 AM. It checks things first, in order. If any check fails, the update simply waits for the next night.{' '}
          <strong>Servers use the same logic.</strong>
        </p>
        <PhoneUpdateSim />
      </Section>

      <Section title="What if a job is still running when the next run is due?">
        <p>
          A job set to run every 5 minutes that sometimes takes 8 minutes will <Term id="overlap">overlap</Term> with itself. Two copies can write the same file at the same time and
          damage it. Every scheduler lets you choose what happens: run in parallel, wait in a <Term id="job-queue">queue</Term>, or skip.
        </p>
        <QueueSim />
      </Section>

      <LessonNav id={2} />
    </>
  )
}
