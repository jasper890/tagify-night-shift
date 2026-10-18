import { FaBolt, FaClipboardCheck, FaCog, FaFilter, FaHistory, FaPlay, FaUser } from 'react-icons/fa'
import { LESSONS } from '../data/lessons'
import { C, Callout, DocLinks, IconCircle, LessonNav, PageHeader, Section, Term, TryInTerminal } from '../components/ui'
import { CodeBlock } from '../components/CodeBlock'
import { TaskSchedulerExplorer } from '../demos/TaskSchedulerExplorer'
import { ResultDecoder } from '../demos/ResultDecoder'

const lesson = LESSONS[2]

const SIX = [
  { icon: FaUser, tab: 'General', q: 'WHO runs it?' },
  { icon: FaBolt, tab: 'Triggers', q: 'WHEN does it run?' },
  { icon: FaPlay, tab: 'Actions', q: 'WHAT does it run?' },
  { icon: FaFilter, tab: 'Conditions', q: 'Only IF…?' },
  { icon: FaCog, tab: 'Settings', q: 'What if it FAILS?' },
  { icon: FaHistory, tab: 'History', q: 'Did it RUN?' },
]

const STEPS = [
  'Open Task Scheduler and select your IT-Lab folder',
  'Click Create Task and give it a name',
  'Triggers: choose Daily and a time',
  'Actions: choose the program or script, and fill in Start in',
  'Settings: allow run on demand; run after a missed start',
  'Right-click the task and choose Run to test it',
]

export default function Lesson3() {
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
            <Term id="task-scheduler">Task Scheduler</Term> is built into every Windows PC and server. Each of its six tabs answers one simple question.
          </>
        }
      />

      <Section kicker="Slide 8" title="Task Scheduler: Six Tabs, Six Questions">
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <div className="rounded-2xl bg-navy p-5 text-white">
            <p className="font-bold text-amber">How to open it</p>
            <p className="mt-1">
              Press <kbd className="rounded bg-white/15 px-1.5 font-mono">Win</kbd> + <kbd className="rounded bg-white/15 px-1.5 font-mono">R</kbd>, then type:
            </p>
            <p className="mt-2 rounded-lg bg-white/10 p-3 font-mono text-xl text-amber">taskschd.msc</p>
            <p className="mt-3 text-sm text-white/85">Tip: make your own folder (e.g., IT-Lab) for your tasks.</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SIX.map((s, i) => (
              <li key={s.tab} className="card p-4">
                <IconCircle icon={s.icon} tone={i % 2 ? 'teal' : 'amber'} size="sm" />
                <p className="mt-2 font-bold text-navy">{s.tab}</p>
                <p className="text-[0.95rem]">{s.q}</p>
              </li>
            ))}
          </ul>
        </div>
        <TaskSchedulerExplorer />
      </Section>

      <Section kicker="Slide 9" title="Creating a Scheduled Task">
        <div className="grid gap-6 lg:grid-cols-2">
          <ol className="space-y-2">
            {STEPS.map((s, i) => (
              <li key={s} className="card flex items-center gap-3 p-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber font-bold text-navy">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <div>
            <p>
              Or use the command line (<Term id="schtasks">schtasks</Term>):
            </p>
            <CodeBlock
              lang="batch"
              title="Command Prompt (as administrator)"
              code={`:: Run every day at 6:00 PM
schtasks /create /tn "IT-Lab\\Report" ^
  /tr "C:\\Lab\\report.bat" ^
  /sc daily /st 18:00

:: Run now, view, delete
schtasks /run /tn "IT-Lab\\Report"
schtasks /query /tn "IT-Lab\\Report"
schtasks /delete /tn "IT-Lab\\Report" /f`}
            />
            <p className="text-sm text-ink/80">
              The <C>^</C> at the end of a line continues the command on the next line in Command Prompt. <C>/f</C> deletes without asking “are you sure?”.
            </p>
          </div>
        </div>
      </Section>

      <Section kicker="Slide 10" title="Did It Work? Read the Last Run Result">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { c: '0x0', n: 'Success', d: 'The task completed with no errors', cls: 'bg-teal text-white' },
            { c: '0x1', n: 'Script error', d: 'Run the exact command by hand to see the error', cls: 'bg-danger text-white' },
            { c: '0x2', n: 'File not found', d: 'Check the path and spelling in the action', cls: 'bg-danger text-white' },
            { c: '0x41301', n: 'Still running', d: 'Wait, or check for a script that never ends', cls: 'bg-amber text-navy' },
          ].map((x) => (
            <div key={x.c} className="card overflow-hidden">
              <p className={`px-4 py-3 font-mono text-2xl font-bold ${x.cls}`}>{x.c}</p>
              <div className="p-4">
                <p className="font-bold text-navy">{x.n}</p>
                <p className="text-[0.95rem]">{x.d}</p>
              </div>
            </div>
          ))}
        </div>
        <Callout title="More detail">
          Open the <strong>History</strong> tab. If it is empty, click <strong>“Enable All Tasks History”</strong> in the Actions pane on the right. The{' '}
          <Term id="last-run-result">Last Run Result</Term> is the script’s <Term id="exit-code">exit code</Term>, so <C>exit 0</C> in your script shows as 0x0.
        </Callout>
        <ResultDecoder />
      </Section>

      <Callout tone="tip" title="Lesson 3 in one line">
        <FaClipboardCheck className="mr-1 inline" aria-hidden /> Six tabs, six questions: WHO, WHEN, WHAT, ONLY IF, WHAT IF IT FAILS, DID IT RUN. And always fill in Start in.
      </Callout>

      <TryInTerminal track="windows" title="Do it yourself: PowerShell & Task Scheduler" text="Write a .ps1 script, schedule it with schtasks, and read a real Last Result (0 vs 0x2)." />

      <DocLinks
        links={[
          { label: 'schtasks commands (Microsoft Learn)', href: 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks' },
          { label: 'ScheduledTasks PowerShell module', href: 'https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/' },
          { label: 'Task Scheduler error and success constants', href: 'https://learn.microsoft.com/en-us/windows/win32/taskschd/task-scheduler-error-and-success-constants' },
        ]}
      />
      <LessonNav id={3} />
    </>
  )
}
