import { FaEye, FaFolderOpen, FaUserSecret } from 'react-icons/fa'
import { LESSONS } from '../data/lessons'
import { Analogy, C, Callout, IconCircle, LessonNav, PageHeader, Section, Term, TryInTerminal } from '../components/ui'
import { CodeBlock } from '../components/CodeBlock'
import { Troubleshooter } from '../demos/Troubleshooter'

const lesson = LESSONS[5]

export default function Lesson6() {
  return (
    <>
      <PageHeader
        stage={lesson.id}
        kicker={lesson.kicker}
        title={lesson.title}
        slides={lesson.slides}
        icon={lesson.icon}
        intro="The most common complaint: “It works when I run it, but not when it is scheduled.” Here is why, and how to find the problem fast."
      />

      <Section kicker="Slide 16" title="Works by Hand, Fails When Scheduled?">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: FaUserSecret, q: 'WHO runs it?', a: <>A <Term id="service-account">service account</Term>, not you. It may lack permission to your folders.</> },
            { icon: FaFolderOpen, q: 'WHERE does it run?', a: <>cron starts in your home folder; Windows starts in <Term id="system32">System32</Term>.</> },
            { icon: FaEye, q: 'WHAT does it see?', a: <>A shorter <Term id="path-variable">PATH</Term> and none of your personal settings.</> },
          ].map((x, i) => (
            <div key={x.q} className="card p-5">
              <IconCircle icon={x.icon} tone={i === 1 ? 'teal' : 'amber'} />
              <h3 className="mt-3 text-xl">{x.q}</h3>
              <p className="mt-1">{x.a}</p>
            </div>
          ))}
        </div>
        <Analogy>
          A scheduled job is like a cook in a <strong className="text-amber">stranger’s kitchen at 2 AM</strong>. “Get the rice from the cupboard” is useless: which cupboard? You have to
          say exactly where everything is. That is why we use <Term id="full-path">full paths</Term>.
        </Analogy>
        <Callout tone="tip" title="The fix">
          Use full paths (<C>/home/student/backup.sh</C>), fill in “Start in” on Windows, and test as the job’s own user.
        </Callout>
        <CodeBlock
          lang="bash"
          title="Test like cron does: same user, tiny environment"
          code={`sudo -u svc-backup env -i HOME=/home/svc-backup PATH=/usr/bin:/bin \\
  /bin/sh -c '/home/student/lab/backup.sh'`}
        />
      </Section>

      <Section kicker="Slide 17" title="The Log Is the Job’s Screen">
        <p>
          Nobody watches a job at 1:30 AM. The <Term id="log">log</Term> is the only way to see what happened, so every script should write the time, what it did, and whether it worked.
        </p>
        <div className="grid gap-x-5 lg:grid-cols-2">
          <div>
            <CodeBlock
              lang="text"
              title="Example log"
              highlight={[4]}
              code={`01:30:01  INFO   Backup started
01:30:04  INFO   Created data.tar.gz
01:30:04  INFO   Backup finished
01:30:01  ERROR  Folder not found`}
            />
            <div className="grid grid-cols-2 gap-3">
              <p className="rounded-xl bg-teal p-3 text-white">
                <span className="font-mono text-lg font-bold">exit 0</span>
                <br />= success
              </p>
              <p className="rounded-xl bg-danger p-3 text-white">
                <span className="font-mono text-lg font-bold">exit 1</span>
                <br />= failure (the scheduler knows it failed)
              </p>
            </div>
          </div>
          <div>
            <CodeBlock
              lang="bash"
              title="A tiny logging pattern for Bash"
              code={`#!/bin/bash
log=/home/student/lab/logs/backup.log
say() { echo "$(date '+%F %T')  $1  $2" >> "$log"; }

say INFO "Backup started"
if ! tar -czf /home/student/lab/backups/data.tar.gz /home/student/lab/data; then
  say ERROR "Folder not found or tar failed"
  exit 1
fi
say INFO "Backup finished"
exit 0`}
            />
          </div>
        </div>
        <h3 className="mt-6 text-xl">When a job fails, check in order:</h3>
        <ol className="mt-3 grid gap-3 md:grid-cols-2">
          {['Did the scheduler start it?', 'Did the script start and finish? Read its log.', 'Run the exact command by hand, as the same user.', 'Fix one thing at a time, then test again.'].map((s, i) => (
            <li key={s} className="card flex items-center gap-3 p-4">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber font-bold text-navy">{i + 1}</span>
              <span className="font-bold text-navy">{s}</span>
            </li>
          ))}
        </ol>
        <Troubleshooter />
        <TryInTerminal track="cron" title="Do it yourself: break a cron job, then fix it" text="The cron lab ends with a real “works by hand, fails in cron” bug for you to solve." />
      </Section>

      <LessonNav id={6} />
    </>
  )
}
