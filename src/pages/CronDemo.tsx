import { Link } from 'react-router-dom'
import { FaArrowLeft, FaCheck, FaClock, FaLock } from 'react-icons/fa'
import { DEMO_STEPS, TROUBLESHOOTING } from '../data/cronDemo'
import { ACHIEVEMENTS, XP, demoStepsDone } from '../lib/game'
import { useProgress } from '../lib/progress'
import { C, Callout, PageHeader, Section } from '../components/ui'
import { CodeBlock } from '../components/CodeBlock'
import { CronFieldGuide, CronMiniGame } from '../demos/CronMiniGame'
import { DemoLab } from '../demos/DemoLab'

const MAX_STEP_XP = DEMO_STEPS.length * XP.demoStep

export default function CronDemo() {
  const { progress } = useProgress()
  const stepsDone = demoStepsDone(progress)
  const stepXp = stepsDone * XP.demoStep
  const badge = ACHIEVEMENTS.find((a) => a.id === 'cron-master')!
  const unlocked = badge.unlocked(progress)

  return (
    <>
      <PageHeader
        kicker="Task Scheduling and Automation · Tagify Group"
        title="Linux cron & at Demo"
        icon={FaClock}
        intro="Ten steps in a Linux terminal right here in your browser, with the Old Admin explaining each one. Finish a step to earn XP, then play the cron mini-game. This terminal is a simulation: nothing on this page runs a command on your computer."
      />

      <Callout title="Before you start">
        Everything works in the terminal below, no install needed. Want to try it on a real Linux machine (Ubuntu/WSL) instead? The same commands are in <a href="#real-terminal">Part 4</a>.
      </Callout>

      <Section kicker="Part 1" title="Demo lab" id="steps">
        <DemoLab />
      </Section>

      <Section kicker="Part 2" title="Checklist with XP" id="checklist">
        <div className="on-dark hud-frame p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="pixel-label text-amber">Demo XP</p>
            <p className="text-white/85">
              {stepsDone} of {DEMO_STEPS.length} steps done · <strong className="text-white">{stepXp}/{MAX_STEP_XP} XP</strong>
            </p>
          </div>
          <div className="px-bar mt-3 text-xp" role="progressbar" aria-label="XP from the demo steps" aria-valuenow={stepXp} aria-valuemin={0} aria-valuemax={MAX_STEP_XP}>
            <span style={{ width: `${(stepXp / MAX_STEP_XP) * 100}%` }} />
          </div>
        </div>

        <ul className="mt-4 grid gap-2">
          {DEMO_STEPS.map((s, i) => {
            const isDone = progress.cronDemo.steps.includes(s.id)
            return (
              <li key={s.id}>
                <a
                  href={`#step-${s.id}`}
                  className={`flex items-center gap-3 border-3 px-3 py-2 no-underline ${isDone ? 'border-teal bg-teal-soft' : 'border-ink bg-white hover:bg-amber-soft'}`}
                >
                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center border-2 border-ink ${isDone ? 'bg-xp text-ink' : 'bg-white'}`} aria-hidden>
                    {isDone ? <FaCheck /> : null}
                  </span>
                  <span className="min-w-0 flex-1 font-bold text-navy">
                    {i + 1}. {s.title}
                    <span className="sr-only">{isDone ? ' (done)' : ' (not done yet)'}</span>
                  </span>
                  <span className="pixel-label shrink-0 !text-[0.6rem] text-teal">+{XP.demoStep} XP</span>
                </a>
              </li>
            )
          })}
        </ul>

        <div className={`mt-4 flex flex-wrap items-center gap-3 border-3 p-3 ${unlocked ? 'border-ink bg-amber-soft' : 'border-dashed border-line-strong bg-card text-ink/70'}`}>
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center border-3 border-ink text-xl ${unlocked ? 'bg-amber text-ink' : 'bg-line text-ink/50'}`}
            aria-hidden
          >
            {unlocked ? <badge.icon /> : <FaLock />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-navy">
              {badge.name}
              {unlocked ? null : <span className="sr-only"> (locked)</span>}
            </span>
            <span className="block text-sm">
              {unlocked ? `Badge unlocked! All ${DEMO_STEPS.length} steps done, ${MAX_STEP_XP} XP earned.` : `Finish all ${DEMO_STEPS.length} steps in the lab (${MAX_STEP_XP} XP) to unlock this badge.`}
            </span>
          </span>
          {unlocked ? (
            <Link to="/player" className="text-sm font-bold">
              See your badges →
            </Link>
          ) : null}
        </div>
      </Section>

      <Section kicker="Part 3" title="Cron mini-game" id="mini-game">
        <p className="mb-4">Check the guide, read the hint under each question, and pick the right answer.</p>
        <CronFieldGuide />
        <CronMiniGame />
      </Section>

      <Section kicker="Part 4" title="Real terminal commands" id="real-terminal">
        <p className="mb-4">The same ten steps for a real Linux terminal (Ubuntu/WSL). The lab above checks your work and gives the XP; here you just copy and run.</p>
        <ol className="space-y-9">
          {DEMO_STEPS.map((s, i) => {
            const isDone = progress.cronDemo.steps.includes(s.id)
            return (
              <li key={s.id} id={`step-${s.id}`} className="scroll-mt-20">
                <div className="flex items-center gap-3">
                  <span className="pixel-label inline-flex h-11 w-11 shrink-0 items-center justify-center border-3 border-ink bg-amber text-base text-ink" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="pixel-label !text-[0.6rem] text-teal">
                      Step {i + 1} of {DEMO_STEPS.length}
                      <span className="ml-2 text-ink/60">{isDone ? '· ✔ done in the lab' : '· not done in the lab yet'}</span>
                    </p>
                    <h3 className="text-xl leading-snug">{s.title}</h3>
                  </div>
                </div>

                <CodeBlock lang="bash" title="Terminal" code={s.code} copiedLabel="Copied!" />

                {s.note ? <Callout tone={s.noteTone === 'warn' ? 'warn' : 'info'}>{s.note}</Callout> : null}
              </li>
            )
          })}
        </ol>

        <Callout tone="tip" title="Troubleshooting">
          {TROUBLESHOOTING.problem} Run: <C>{TROUBLESHOOTING.command}</C>
        </Callout>
      </Section>

      <p className="no-print mt-10">
        <Link to="/lesson/4" className="inline-flex items-center gap-2 font-bold">
          <FaArrowLeft aria-hidden /> Review Lesson 4: Linux cron and at
        </Link>
      </p>
    </>
  )
}
