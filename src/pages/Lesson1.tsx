import { FaCheckDouble, FaClock, FaCogs, FaFileAlt, FaHandPaper, FaMoon, FaProjectDiagram, FaRedo, FaServer } from 'react-icons/fa'
import { LESSONS } from '../data/lessons'
import { Analogy, Callout, IconCircle, LessonNav, PageHeader, Section, Term } from '../components/ui'

const lesson = LESSONS[0]

export default function Lesson1() {
  return (
    <>
      <PageHeader
        stage={lesson.id}
        kicker={lesson.kicker}
        title={lesson.title}
        slides={lesson.slides}
        icon={lesson.icon}
        intro="System administrators look after many computers. Most of their daily jobs repeat. This lesson explains how computers can do that repetitive work for us."
      />

      <Section kicker="Slide 3" title="Scheduling = When, Automation = How">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <IconCircle icon={FaClock} />
            <h3 className="mt-3 text-xl">
              <Term id="scheduling">Task Scheduling</Term> = WHEN
            </h3>
            <p className="mt-1">Tells the computer when to run a task: at a set time, at regular intervals, or when an event happens, even if nobody is logged in.</p>
          </div>
          <div className="card p-5">
            <IconCircle icon={FaCogs} tone="teal" />
            <h3 className="mt-3 text-xl">
              <Term id="automation">Automation</Term> = HOW
            </h3>
            <p className="mt-1">
              A <Term id="script">script</Term> lists the steps so the computer can do the whole job by itself, the same way every time, with no person needed.
            </p>
          </div>
        </div>
        <Analogy>
          Like a <strong className="text-amber">coffee maker with a timer</strong>: the timer is the scheduler, and the coffee and water are the script.
        </Analogy>
      </Section>

      <Section kicker="Slide 4" title="Why It Matters to System Administrators">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-2xl bg-navy p-6 text-white">
            <IconCircle icon={FaServer} />
            <p className="mt-3 text-5xl font-bold text-amber">8+ hours</p>
            <p className="mt-1 text-lg">of manual checks every day for 50 servers at 10 minutes each</p>
            <p className="mt-2 text-sm text-white/80">50 × 10 minutes = 500 minutes = 8 hours and 20 minutes.</p>
            <p className="mt-4 rounded-lg bg-white/10 p-3 font-bold">A scheduled script: a few seconds</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: FaRedo, t: 'Consistent', d: 'Same steps, same order, every time' },
              { icon: FaMoon, t: 'Runs off-hours', d: 'Backups and updates run at 2 AM without anyone awake' },
              { icon: FaCheckDouble, t: 'Fewer errors', d: 'Scripts do not skip steps when tired or busy' },
              { icon: FaFileAlt, t: 'Proof in logs', d: 'Records show the work was really done' },
            ].map((x) => (
              <div key={x.t} className="card flex gap-3 p-4">
                <IconCircle icon={x.icon} tone="teal" size="sm" />
                <div>
                  <p className="font-bold text-navy">{x.t}</p>
                  <p className="text-[0.95rem]">{x.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section kicker="Slide 5" title="Three Levels: Manual, Scheduled, Automated">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: FaHandPaper, tone: 'danger' as const, t: 'Manual task', s: 'A person does every step', ex: 'Admin copies a folder to a USB drive when they remember' },
            { icon: FaClock, tone: 'amber' as const, t: 'Scheduled task', s: 'A script runs on a timer', ex: 'A script creates a backup every night at 1:00 AM' },
            {
              icon: FaProjectDiagram,
              tone: 'teal' as const,
              t: 'Automated workflow',
              s: 'Many steps with checks and alerts',
              ex: 'Back up, verify, copy off-site, clean old copies, report; retry and alert on failure',
            },
          ].map((x, i) => (
            <div key={x.t} className="card flex flex-col p-5">
              <div className="flex items-center gap-3">
                <IconCircle icon={x.icon} tone={x.tone} />
                <span className="text-sm font-bold text-teal">LEVEL {i + 1}</span>
              </div>
              <h3 className="mt-3 text-xl">{x.t}</h3>
              <p>{x.s}</p>
              <p className="mt-3 rounded-lg bg-white p-3 text-[0.95rem]">
                <strong>Backup example:</strong> {x.ex}
              </p>
            </div>
          ))}
        </div>
        <Callout tone="tip" title="Rule of thumb">
          Automate tasks that are <strong>repetitive</strong>, <strong>well understood</strong>, and follow <strong>clear rules</strong>. If you still have to make a judgment call each
          time, keep a person in the loop.
        </Callout>
      </Section>

      <LessonNav id={1} />
    </>
  )
}
