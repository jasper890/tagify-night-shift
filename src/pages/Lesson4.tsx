import { LESSONS } from '../data/lessons'
import { C, Callout, DocLinks, LessonNav, PageHeader, Section, Term, TryInTerminal } from '../components/ui'
import { CodeBlock } from '../components/CodeBlock'
import { CronBuilder } from '../demos/CronBuilder'
import { CronChallenge } from '../demos/CronChallenge'

const lesson = LESSONS[3]

const FIELDS = [
  { v: '30', l: 'minute', r: '0-59', cls: 'bg-amber text-navy' },
  { v: '18', l: 'hour', r: '0-23', cls: 'bg-teal text-white' },
  { v: '*', l: 'day of month', r: '1-31', cls: 'bg-slate text-white' },
  { v: '*', l: 'month', r: '1-12', cls: 'bg-navy text-white' },
  { v: '1-5', l: 'day of week', r: '0-7 (0 = Sun)', cls: 'bg-[#5b4a8a] text-white' },
  { v: 'backup.sh', l: 'command', r: 'use the full path', cls: 'bg-card text-navy border border-line-strong' },
]

const COMMON = [
  ['*/15 * * * *', 'Every 15 minutes'],
  ['0 * * * *', 'Every hour'],
  ['0 2 * * *', 'Every day at 2:00 AM'],
  ['30 18 * * 1-5', 'Weekdays at 6:30 PM'],
  ['0 3 * * 0', 'Sundays at 3:00 AM'],
  ['0 0 1 * *', 'First day of every month'],
]

export default function Lesson4() {
  return (
    <>
      <PageHeader
        stage={lesson.id}
        kicker={lesson.kicker}
        title={lesson.title}
        slides={lesson.slides}
        icon={lesson.icon}
        intro={
          <>
            On Linux, <Term id="cron">cron</Term> runs repeating jobs and <Term id="at">at</Term> runs one-time jobs. A whole schedule fits in one short line.
          </>
        }
      />

      <Section kicker="Slide 11" title="Reading a cron Line: Five Fields + a Command">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {FIELDS.map((f) => (
            <div key={f.l} className={`rounded-xl p-4 text-center ${f.cls}`}>
              <p className={`font-mono font-bold break-all ${f.l === 'command' ? 'text-xl leading-9' : 'text-3xl'}`}>{f.v}</p>
              <p className="mt-1 font-bold">{f.l}</p>
              <p className="text-sm opacity-90">{f.r}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-xl bg-navy p-4 text-lg text-white">
          <span className="font-bold text-amber">Meaning:</span> at 6:30 PM, Monday to Friday
        </p>
        <p className="mt-3">
          <C>*</C> means “every” · <C>,</C> makes a list · <C>-</C> makes a range · <C>/</C> means “every so many”
        </p>
        <CronBuilder />
      </Section>

      <Section kicker="Slide 12" title="Common cron Schedules (and One Big Mistake)">
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left">
              <thead className="bg-navy text-white">
                <tr>
                  <th scope="col" className="p-3">Cron expression</th>
                  <th scope="col" className="p-3">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {COMMON.map(([e, m], i) => (
                  <tr key={e} className={i % 2 ? 'bg-card' : 'bg-white'}>
                    <td className="p-3 font-mono font-bold text-navy">{e}</td>
                    <td className="p-3">{m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border-2 border-danger p-5">
            <p className="kicker !text-danger-dark">Common mistake</p>
            <p className="mt-3 text-sm font-bold text-danger-dark uppercase">Wrong</p>
            <p className="font-mono text-3xl font-bold text-danger-dark">* 2 * * *</p>
            <p>Runs every minute from 2:00 to 2:59 (60 times!)</p>
            <p className="mt-4 text-sm font-bold text-teal uppercase">Right</p>
            <p className="font-mono text-3xl font-bold text-teal">0 2 * * *</p>
            <p>Runs once, at exactly 2:00 AM.</p>
          </div>
        </div>
      </Section>

      <Section id="cron-challenge" kicker="Challenge" title="Cron Challenge: Back Up the Network">
        <p>
          Now you are the night-shift admin. Each ticket asks for one backup job. Write the crontab line, run it, and watch the server clock jump to each run time while the data flies to the
          backup vault. A wrong line runs too, so you can see what it would really do.
        </p>
        <CronChallenge />
      </Section>

      <Section kicker="Slide 13" title="cron for Repeating Jobs, at for One-Time Jobs">
        <div className="grid gap-x-5 lg:grid-cols-2">
          <div>
            <h3 className="text-xl">cron: repeating jobs</h3>
            <CodeBlock
              lang="bash"
              title="Terminal"
              code={`crontab -e    # edit your jobs
crontab -l    # list your jobs

# Every night at 1:30 AM
30 1 * * * /home/student/backup.sh >> /home/student/backup.log 2>&1`}
            />
            <p className="text-[0.95rem]">
              <C>&gt;&gt;</C> adds the output to the end of the log, and <C>2&gt;&amp;1</C> sends errors there too (see <Term id="redirect">redirect</Term>). Without it, you never see why a job failed.
            </p>
          </div>
          <div>
            <h3 className="text-xl">at: one-time jobs</h3>
            <CodeBlock
              lang="bash"
              title="Terminal"
              code={`at 23:00          # then type the command
                  # and press Ctrl+D
echo "/home/student/report.sh" | at now + 2 hours
atq               # list waiting jobs
atrm 3            # remove job 3`}
            />
          </div>
        </div>
        <Callout tone="warn" title="Careful">
          <C>crontab -r</C> deletes <strong>ALL</strong> your cron jobs without asking. The <C>r</C> key is right next to <C>e</C>! Edit with <C>crontab -e</C> instead, and keep a
          copy: <C>crontab -l &gt; /home/student/lab/crontab.bak</C>.
        </Callout>
      </Section>

      <TryInTerminal track="cron" title="Do it yourself: schedule a job with cron" text="Use crontab -e, fast-forward time with timewarp, read the cron log, and fix a broken job." />

      <DocLinks
        links={[
          { label: 'crontab(5) manual page: the file format', href: 'https://man7.org/linux/man-pages/man5/crontab.5.html' },
          { label: 'crontab(1) manual page: the command', href: 'https://man7.org/linux/man-pages/man1/crontab.1p.html' },
          { label: 'at(1) manual page', href: 'https://manpages.debian.org/bookworm/at/at.1.en.html' },
        ]}
      />
      <LessonNav id={4} />
    </>
  )
}
