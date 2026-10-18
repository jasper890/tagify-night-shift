import { lazy, Suspense, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FaArrowRight, FaBook, FaClipboardList, FaFlask, FaRocket, FaTerminal, FaUser } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import { useProgress } from '../lib/progress'
import { LESSONS } from '../data/lessons'
import { BOSSES } from '../data/bosses'
import { AUTOMATION_TOOLS } from '../data/automationTools'
import { MISSIONS } from '../data/missions'
import { currentStage, levelFor, missionsDone, totalStars, xpFor } from '../lib/game'
import { Sprite } from '../components/pixel/Sprite'
import { Stars, XpBar } from '../components/pixel/Hud'
import { MoonClock, ServerSkyline } from '../components/pixel/NightScene'
import { SlideBadge } from '../components/ui'

const IntroVideo = lazy(() => import('../components/IntroVideo'))

function SectionTitle({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <p className="pixel-label text-xp">{label}</p>
      <h2 className="mt-2 text-3xl !text-white px-shadow sm:text-4xl">{title}</h2>
      {children ? <p className="mt-2 text-lg text-white/80">{children}</p> : null}
    </div>
  )
}

/** The 8 lessons as stages on a path. On wide screens the path snakes: 1→4, then 5→8 back. */
function WorldMap() {
  const { progress } = useProgress()
  const here = currentStage(progress)
  // Grid position of each stage on md+ screens (snake), so the path reads in order.
  const order = [1, 2, 3, 4, 8, 7, 6, 5]
  return (
    <div className="relative mt-8">
      {/* Path for the snake layout */}
      <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
        <div className="absolute top-[25%] right-[12.5%] left-[12.5%] border-t-4 border-dashed border-amber/50" />
        <div className="absolute top-[25%] right-[12.5%] bottom-[25%] border-r-4 border-dashed border-amber/50" />
        <div className="absolute right-[12.5%] bottom-[25%] left-[12.5%] border-t-4 border-dashed border-amber/50" />
      </div>
      {/* Path for the single-column layout */}
      <div className="pointer-events-none absolute top-6 bottom-6 left-[2.15rem] border-l-4 border-dashed border-amber/50 md:hidden" aria-hidden />
      <ol className="relative grid gap-5 md:grid-cols-4 md:gap-x-6 md:gap-y-10">
        {LESSONS.map((l) => {
          const boss = BOSSES.find((b) => b.lesson === l.id)!
          const done = progress.lessons.includes(l.id)
          const current = here?.id === l.id
          const known = done || current
          return (
            <li key={l.id} className="relative md:[order:var(--snake)]" style={{ ['--snake' as string]: order.indexOf(l.id) }}>
              {current ? (
                <div className="pointer-events-none absolute -top-12 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center md:flex" aria-hidden>
                  <Sprite id="hero" size={40} className="animate-bob" />
                </div>
              ) : null}
              <Link
                to={l.path}
                className={`group relative flex h-full items-center gap-4 border-3 border-ink p-3 no-underline shadow-[5px_5px_0_0_rgb(0_0_0/0.4)] hover:-translate-y-1 md:flex-col md:items-start md:gap-2 md:p-4 ${
                  current ? 'bg-amber-soft pulse' : done ? 'bg-paper' : 'bg-card'
                }`}
                aria-label={`Stage ${l.id}: ${l.title}. ${done ? `Cleared with ${progress.stars[l.id] ?? 1} stars.` : current ? 'Your next stage.' : 'Not cleared yet.'}`}
              >
                <span
                  className={`pixel-label inline-flex h-10 w-10 shrink-0 items-center justify-center border-3 border-ink text-sm md:absolute md:-top-4 md:-left-4 ${
                    done ? 'bg-xp text-ink' : current ? 'bg-amber text-ink' : 'bg-sky text-white'
                  }`}
                  aria-hidden
                >
                  {l.id}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-3 md:w-full md:flex-col md:items-start md:gap-2">
                  <span className="hidden w-full items-start justify-between gap-2 md:flex">
                    <span className="pixel-label hidden !text-[0.6rem] text-muted md:block md:pt-3">{l.kicker.split(' · ')[1] ?? `Stage ${l.id}`}</span>
                    <Sprite id={boss.sprite} size={48} silhouette={!known} className="hidden md:block" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg leading-tight font-bold text-navy">{l.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      {done ? (
                        <Stars count={progress.stars[l.id] ?? 1} />
                      ) : current ? (
                        <span className="pixel-label !text-[0.6rem] text-amber-dark">▶ You are here</span>
                      ) : (
                        <span className="text-muted">Boss: {known ? boss.name : '???'}</span>
                      )}
                    </span>
                  </span>
                </span>
                <Sprite id={boss.sprite} size={40} silhouette={!known} className="md:hidden" />
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const SIDE_QUESTS: { to: string; icon: IconType; title: string; text: string }[] = [
  { to: '/practice', icon: FaFlask, title: 'Practice Lab', text: `${MISSIONS.length} missions that use the lesson simulators.` },
  { to: '/beyond', icon: FaRocket, title: 'Beyond the Basics', text: 'GitHub Actions, Ansible, systemd timers, Kubernetes, Jenkins and cloud schedulers.' },
  { to: '/cheatsheet', icon: FaClipboardList, title: 'Cheat Sheet', text: 'cron, at, schtasks, PowerShell and result codes on one printable page.' },
  { to: '/glossary', icon: FaBook, title: 'Glossary', text: 'Every key word, explained in one or two sentences.' },
  { to: '/player', icon: FaUser, title: 'Player & Badges', text: 'Your level, stars and the badges you can unlock.' },
]

export default function Home() {
  const { progress } = useProgress()
  const started = progress.lessons.length > 0 || xpFor(progress) > 0
  const next = currentStage(progress)
  const xp = xpFor(progress)
  const lvl = levelFor(xp)

  return (
    <>
      {/* Title screen (slide 1) */}
      <section className="on-dark scanlines relative overflow-hidden border-b-4 border-ink text-white" style={{ background: 'linear-gradient(180deg, #12142a 0 30%, #171a33 30% 55%, #1d2244 55% 75%, #232a52 75% 100%)' }}>
        <MoonClock size={112} className="absolute top-6 right-[6%] hidden opacity-95 sm:block lg:top-10 lg:right-[10%]" />
        <div className="relative mx-auto max-w-5xl px-4 pt-12 pb-6 text-center sm:px-8 md:pt-16">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <p className="pixel-label text-xp">A sysadmin quest by Tagify Group</p>
            <SlideBadge slides="Slide 1" />
          </div>
          <h1 className="mt-6 font-[family-name:var(--font-pixel)] !leading-[1.35] font-normal !text-amber px-shadow" style={{ fontSize: 'clamp(1.15rem, 4.6vw, 2.9rem)', textShadow: '4px 4px 0 #b13e53, 8px 8px 0 #1a1c2c' }}>
            Task Scheduling
            <br />
            &amp; Automation
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85 sm:text-xl">
            Every night at 2 AM, backups, updates and cleanups have to run. Learn to make the computer do them on time, every time, so the night shift runs
            itself.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to={(next ?? LESSONS[0]).path} className="btn btn-amber px-6 py-3 text-lg no-underline">
              <span className="animate-blink" aria-hidden>
                ▶
              </span>
              {next ? (started ? `Continue: Stage ${next.id}` : 'Press start') : 'Replay Stage 1'}
            </Link>
            <Link to="/terminal" className="btn bg-ink px-6 py-3 text-lg text-white no-underline">
              <FaTerminal aria-hidden /> Terminal Lab
            </Link>
          </div>

          {started ? (
            <Link to="/player" className="hud-frame mx-auto mt-8 flex max-w-md items-center gap-4 p-3 text-left text-white no-underline hover:brightness-125">
              <Sprite id="hero" size={48} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="pixel-label text-amber">LV{lvl.level}</span>
                  <span className="truncate font-bold">{lvl.title}</span>
                </span>
                <XpBar into={lvl.into} span={lvl.span} className="mt-2" />
                <span className="mt-1.5 block text-sm text-white/70">
                  {progress.lessons.length}/{LESSONS.length} stages · {totalStars(progress)} stars · {missionsDone(progress)} missions · {xp} XP
                </span>
              </span>
            </Link>
          ) : null}
        </div>
        <ServerSkyline className="relative mt-4 h-20 sm:h-28" />
        <div className="relative flex items-end justify-center gap-6 border-t-4 border-ink bg-[#333c57] px-4 pt-1 pb-2" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #3d4766 0 16px, #333c57 16px 32px)' }}>
          <Sprite id="hero" size={44} className="-mt-11 animate-bob" />
          <Sprite id="slime" size={36} className="-mt-9 hidden sm:block" />
          <Sprite id="bat" size={36} className="-mt-14 hidden sm:block" />
          <Sprite id="ghost" size={36} className="-mt-9 hidden sm:block" />
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-20 px-4 py-14 sm:px-8">
        {/* Intro cutscene */}
        <section>
          <SectionTitle label="Cutscene" title="Watch the 90-second intro">
            What scheduling and automation are, how a job runs, the tools, and how to use this site. Tap for sound to hear the narration.
          </SectionTitle>
          <div className="mt-6">
            <Suspense fallback={<div className="aspect-video w-full animate-pulse border-4 border-ink bg-white/5" />}>
              <IntroVideo />
            </Suspense>
          </div>
        </section>

        {/* World map (slide 2: what you will learn) */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle label="World map" title="8 stages, 8 bosses">
              Each stage is one lesson. Read it, train with its demos, then beat the boss quiz at the end to clear it and earn up to 3 stars.
            </SectionTitle>
            <SlideBadge slides="Slide 2" />
          </div>
          <WorldMap />
        </section>

        {/* How to play */}
        <section>
          <SectionTitle label="How to play" title="Four moves per stage" />
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Read', 'Each lesson is short, with everyday examples like a coffee maker with a timer.'],
              ['Train', 'Play with the training demos. They are pretend, so nothing can break.'],
              ['Beat the boss', 'Answer the boss’s questions. Every answer explains why, right or wrong.'],
              ['Side quests', 'Do the Practice Lab missions and Terminal Lab dungeons for extra XP.'],
            ].map(([t, d], i) => (
              <li key={t} className="card p-4">
                <span className="pixel-label inline-flex h-9 w-9 items-center justify-center border-3 border-ink bg-amber text-ink">{i + 1}</span>
                <p className="mt-3 text-lg font-bold text-navy">{t}</p>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Terminal Lab */}
        <Link
          to="/terminal"
          className="grid items-center gap-6 border-4 border-ink bg-night p-6 text-white no-underline shadow-[8px_8px_0_0_rgb(0_0_0/0.4)] hover:-translate-y-1 sm:p-8 md:grid-cols-[1fr_1.1fr]"
        >
          <div>
            <p className="pixel-label text-xp">Dungeon</p>
            <h2 className="mt-2 text-3xl !text-white">Terminal Lab</h2>
            <p className="mt-2 text-white/85">
              Learn by typing. A guide tells you what to code, you run it in a simulated terminal, and it checks your work: Bash and cron, PowerShell and Task
              Scheduler, Ansible for routers, and GitHub Actions.
            </p>
            <span className="btn btn-amber mt-4">
              <FaTerminal aria-hidden /> Enter the dungeon
            </span>
          </div>
          <pre className="overflow-hidden border-3 border-line-strong bg-black/50 p-4 font-mono text-[0.8rem] leading-relaxed" aria-hidden>
            {[
              ['p', 'student@lab-server:~/netauto$', ' ansible routers -i inventory.ini -m ping'],
              ['o', 'r1 | SUCCESS => { "ping": "pong" }'],
              ['o', 'r2 | SUCCESS => { "ping": "pong" }'],
              ['p', 'student@lab-server:~/netauto$', ' timewarp 6h'],
              ['a', '⏩ Time jumps from Sat 21:00 to Sun 03:00'],
              ['a', '   Sun 02:00  cron ran: ansible-playbook … ✓ exit 0'],
              ['g', '✔ Step 12 complete!  +10 XP'],
            ].map(([kind, a, b], i) => (
              <div key={i} className={{ p: 'text-xp', o: 'text-[#d6deeb]', a: 'text-amber', g: 'font-bold text-xp' }[kind]}>
                {a}
                {b ? <span className="text-white">{b}</span> : null}
              </div>
            ))}
          </pre>
        </Link>

        {/* Inventory: the tools of automation */}
        <section>
          <SectionTitle label="Inventory" title="The tools of automation">
            Every tool answers the same two questions: when should the job run, and how does it do the work. Start with the ones built into Windows and Linux, then
            see how teams run jobs on many machines at once.
          </SectionTitle>
          {(['built-in', 'scale'] as const).map((group) => (
            <div key={group} className="mt-8">
              <p className="pixel-label text-amber">{group === 'built-in' ? 'Built into the operating system' : 'Built for scale: DevOps and cloud'}</p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {AUTOMATION_TOOLS.filter((t) => t.group === group).map((t) => (
                  <li key={t.name}>
                    <Link to={t.path} className="panel flex h-full items-center gap-4 p-4 no-underline hover:-translate-y-0.5 hover:bg-amber-soft">
                      <span
                        className="inline-flex h-14 w-14 shrink-0 items-center justify-center border-3 border-ink text-2xl text-white shadow-[inset_-3px_-3px_0_0_rgb(0_0_0/0.3),inset_3px_3px_0_0_rgb(255_255_255/0.25)]"
                        style={{ background: t.color }}
                        aria-hidden
                      >
                        <t.icon />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-bold text-navy">{t.name}</span>
                          <span className="pixel-label !text-[0.6rem] text-teal">{t.platform}</span>
                        </span>
                        <span className="block text-[0.95rem] text-ink/80">{t.desc}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Side quests */}
        <section>
          <SectionTitle label="Side quests" title="More ways to practise" />
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SIDE_QUESTS.map((s) => (
              <li key={s.to}>
                <Link to={s.to} className="panel flex h-full items-start gap-4 p-5 no-underline hover:-translate-y-0.5 hover:bg-amber-soft">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center border-3 border-ink bg-teal text-xl text-white" aria-hidden>
                    <s.icon />
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-lg font-bold text-navy">
                      {s.title} <FaArrowRight className="text-sm text-teal" aria-hidden />
                    </span>
                    <span className="text-ink/80">{s.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
