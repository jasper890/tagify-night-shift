import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'
import { Link } from 'react-router-dom'
import { FaArrowLeft, FaArrowRight, FaBookOpen, FaTerminal, FaExclamationTriangle, FaExternalLinkAlt, FaInfoCircle, FaRegClone } from 'react-icons/fa'
import { LESSONS } from '../data/lessons'
import { GLOSSARY } from '../data/glossary'
import { bossFor } from '../data/bosses'
import { useProgress } from '../lib/progress'
import { Quiz } from './Quiz'
import { Sprite } from './pixel/Sprite'
import { Stars } from './pixel/Hud'

export function IconCircle({
  icon: Icon,
  tone = 'amber',
  size = 'md',
}: {
  icon: IconType
  tone?: 'amber' | 'teal' | 'navy' | 'danger' | 'slate'
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const tones = {
    amber: 'bg-amber text-ink',
    teal: 'bg-teal text-white',
    navy: 'bg-navy text-amber',
    danger: 'bg-danger text-white',
    slate: 'bg-slate text-white',
  }
  const sizes = {
    sm: 'h-9 w-9 text-base',
    md: 'h-12 w-12 text-xl',
    lg: 'h-16 w-16 text-2xl',
    xl: 'h-28 w-28 text-5xl',
  }
  // A beveled pixel tile: dark lower-right edge, light upper-left edge.
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border-3 border-ink shadow-[inset_-3px_-3px_0_0_rgb(0_0_0/0.25),inset_3px_3px_0_0_rgb(255_255_255/0.3)] ${tones[tone]} ${sizes[size]}`}
      aria-hidden
    >
      <Icon />
    </span>
  )
}

export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`kicker ${className}`}>{children}</p>
}

export function SlideBadge({ slides }: { slides: string }) {
  return (
    <span className="pixel-label inline-flex items-center gap-1.5 border-2 border-ink bg-navy px-2 py-1 !text-[0.6rem] text-amber" title="Matching slides in the PowerPoint">
      <FaRegClone aria-hidden /> {slides}
    </span>
  )
}

/** Banner at the top of a lesson: which stage it is and which boss waits at the end. */
function StageBanner({ stage }: { stage: number }) {
  const { progress } = useProgress()
  const boss = bossFor(stage)
  const cleared = progress.lessons.includes(stage)
  return (
    <div className="on-dark scanlines -mx-4 -mt-6 mb-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-b-4 border-ink bg-sky px-4 py-4 text-white sm:-mx-8 sm:-mt-9 sm:px-8">
      <div className="min-w-0">
        <p className="pixel-label text-xp">
          Stage {stage} of {LESSONS.length}
        </p>
        <p className="mt-1 text-white/85">Read the lesson, train with the demos, then beat the boss to clear the stage.</p>
      </div>
      <a href="#boss" className="hud-frame ml-auto flex items-center gap-3 px-3 py-2 text-white no-underline hover:brightness-125">
        <Sprite id={boss.sprite} size={40} />
        <span className="leading-tight">
          <span className="pixel-label block !text-[0.6rem] text-white/65">{cleared ? 'Boss defeated' : 'Boss at the end'}</span>
          <span className="block font-bold text-amber">{boss.name}</span>
          {cleared ? <Stars count={progress.stars[stage] ?? 1} className="text-xs" /> : null}
        </span>
      </a>
    </div>
  )
}

export function PageHeader({
  kicker,
  title,
  intro,
  slides,
  icon,
  stage,
}: {
  kicker: string
  title: string
  intro?: ReactNode
  slides?: string
  icon?: IconType
  /** Lesson number: shows the stage banner with its boss. */
  stage?: number
}) {
  return (
    <header className="mb-8">
      {stage ? <StageBanner stage={stage} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Kicker>{kicker}</Kicker>
        {slides ? <SlideBadge slides={slides} /> : null}
      </div>
      <div className="mt-3 flex items-start gap-4">
        {icon ? (
          <span className="hidden sm:block">
            <IconCircle icon={icon} size="lg" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-[2.6rem]">{title}</h1>
          {intro ? <div className="mt-3 max-w-3xl text-lg text-ink/85">{intro}</div> : null}
        </div>
      </div>
    </header>
  )
}

export function Section({
  kicker,
  title,
  slide,
  children,
  id,
}: {
  kicker?: string
  title: string
  slide?: string
  children: ReactNode
  id?: string
}) {
  return (
    <section className="mt-12 scroll-mt-20" id={id}>
      <div className="flex flex-wrap items-center gap-3">
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        {slide ? <span className="pixel-label !text-[0.6rem] text-muted">{slide}</span> : null}
      </div>
      <h2 className="mt-1.5 flex items-baseline gap-2.5 text-2xl sm:text-[1.8rem]">
        <span className="inline-block h-3 w-3 shrink-0 -translate-y-0.5 bg-amber shadow-[2px_2px_0_0_#1a1c2c]" aria-hidden />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Frame around every interactive simulator: the lesson's training ground. */
export function DemoFrame({ title, icon, children, hint }: { title: string; icon: IconType; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="panel print-break mt-6 overflow-hidden">
      <div className="on-dark scanlines flex flex-wrap items-center gap-3 border-b-3 border-ink bg-navy px-4 py-3 text-white sm:px-5">
        <IconCircle icon={icon} size="sm" />
        <div className="min-w-0">
          <p className="pixel-label !text-[0.64rem] text-xp">Training · try it yourself</p>
          <h3 className="text-lg text-white">{title}</h3>
        </div>
      </div>
      {hint ? (
        <p className="flex gap-3 border-b-3 border-ink bg-amber-soft px-4 py-2.5 text-[0.98rem] sm:px-5">
          <span className="pixel-label shrink-0 pt-1.5 !text-[0.6rem] text-amber-dark">Goal</span>
          <span className="min-w-0">{hint}</span>
        </p>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'tip'
  title?: string
  children: ReactNode
}) {
  const styles = {
    info: { box: 'border-slate bg-card', icon: FaInfoCircle, color: 'text-slate', tile: 'bg-slate text-white' },
    warn: { box: 'border-danger bg-danger-soft', icon: FaExclamationTriangle, color: 'text-danger-dark', tile: 'bg-danger text-white' },
    tip: { box: 'border-amber-dark bg-amber-soft', icon: FaBookOpen, color: 'text-amber-dark', tile: 'bg-amber text-ink' },
  }[tone]
  const Icon = styles.icon
  return (
    <div className={`print-break my-4 flex gap-3 border-3 p-4 shadow-[4px_4px_0_0_rgb(26_28_44/0.18)] ${styles.box}`} role={tone === 'warn' ? 'note' : undefined}>
      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink ${styles.tile}`} aria-hidden>
        <Icon />
      </span>
      <div className="min-w-0">
        {title ? <p className={`font-bold ${styles.color}`}>{title}</p> : null}
        <div className="text-[0.98rem]">{children}</div>
      </div>
    </div>
  )
}

/** The Old Admin explains the idea with an everyday example, RPG dialog style. */
export function Analogy({ children }: { children: ReactNode }) {
  return (
    <div className="print-break my-6 flex items-end gap-3 sm:gap-4">
      <div className="hidden shrink-0 flex-col items-center sm:flex">
        <Sprite id="sage" size={64} />
        <span className="pixel-label mt-1 !text-[0.6rem] text-muted">Old Admin</span>
      </div>
      <div className="on-dark hud-frame relative min-w-0 flex-1 p-4 sm:p-5">
        <p className="pixel-label !text-[0.64rem] text-xp">
          <span className="sm:hidden">Old Admin · </span>Everyday analogy
        </p>
        <p className="mt-1.5 text-lg leading-snug">{children}</p>
        <span className="pixel-label anim-twinkle absolute right-3 bottom-2 !text-[0.64rem] text-amber" aria-hidden>
          ▼
        </span>
      </div>
    </div>
  )
}

/** A key term: links to the glossary and shows a short definition on hover. */
export function Term({ id, children }: { id: string; children: ReactNode }) {
  const entry = GLOSSARY.find((g) => g.id === id)
  return (
    <Link to={`/glossary#${id}`} className="term" title={entry ? `${entry.term}: ${entry.definition}` : undefined}>
      {children}
    </Link>
  )
}

export function C({ children }: { children: ReactNode }) {
  return <code className="inline-code">{children}</code>
}

export function DocLinks({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div className="print-break mt-10 border-3 border-dashed border-line-strong bg-white p-4">
      <p className="kicker">Official documentation</p>
      <ul className="mt-2 space-y-1">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold underline-offset-2 hover:underline">
              {l.label} <FaExternalLinkAlt className="text-xs" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NavCard({ to, dir, label, title }: { to: string; dir: 'prev' | 'next'; label: string; title: string }) {
  const next = dir === 'next'
  return (
    <Link
      to={to}
      className={`card flex items-center gap-3 p-4 no-underline hover:-translate-y-0.5 hover:bg-amber-soft ${next ? 'justify-end text-right' : ''}`}
    >
      {next ? null : <FaArrowLeft className="shrink-0 text-teal" aria-hidden />}
      <span>
        <span className="pixel-label block !text-[0.6rem] text-teal">{label}</span>
        <span className="font-bold text-navy">{title}</span>
      </span>
      {next ? <FaArrowRight className="shrink-0 text-teal" aria-hidden /> : null}
    </Link>
  )
}

export function LessonNav({ id }: { id: number }) {
  const prev = LESSONS.find((l) => l.id === id - 1)
  const next = LESSONS.find((l) => l.id === id + 1)
  return (
    <>
      <Quiz lesson={id} />
      <nav className="no-print mt-10 grid gap-4 border-t-3 border-dashed border-line pt-6 sm:grid-cols-2" aria-label="Lesson navigation">
        {prev ? <NavCard to={prev.path} dir="prev" label={`Stage ${prev.id}`} title={prev.short} /> : <NavCard to="/" dir="prev" label="Back" title="World map" />}
        {next ? (
          <NavCard to={next.path} dir="next" label={`Stage ${next.id}`} title={next.short} />
        ) : (
          <NavCard to="/summary" dir="next" label="Ending" title="Summary: three habits" />
        )}
      </nav>
    </>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 border-3 border-ink bg-white px-3 py-2 text-left hover:bg-amber-soft"
    >
      <span className={`relative inline-block h-6 w-11 shrink-0 border-2 border-ink ${checked ? 'bg-xp' : 'bg-line'}`} aria-hidden>
        <span className={`absolute top-0.5 h-4 w-4 border-2 border-ink bg-white transition-transform duration-100 ${checked ? 'translate-x-[1.3rem]' : 'translate-x-0.5'}`} />
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-navy">{label}</span>
        {description ? <span className="block text-sm text-ink/75">{description}</span> : null}
      </span>
      <span className={`pixel-label ml-auto !text-[0.64rem] ${checked ? 'text-teal' : 'text-ink/70'}`}>{checked ? 'ON' : 'OFF'}</span>
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 border-3 border-ink bg-card p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-sm font-bold ${value === o.value ? 'bg-navy text-amber shadow-[inset_-2px_-2px_0_0_rgb(0_0_0/0.35)]' : 'text-navy hover:bg-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A call-to-action that sends the student to a Terminal Lab track. */
export function TryInTerminal({ track, title, text }: { track: string; title: string; text: string }) {
  return (
    <Link
      to={`/terminal/${track}`}
      className="on-dark scanlines no-print my-7 flex items-center gap-4 border-3 border-ink bg-night p-4 text-white no-underline shadow-[5px_5px_0_0_rgb(26_28_44/0.35)] hover:-translate-y-0.5 sm:p-5"
    >
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center border-3 border-ink bg-amber text-xl text-ink" aria-hidden>
        <FaTerminal />
      </span>
      <span className="min-w-0">
        <span className="pixel-label block !text-[0.64rem] text-xp">Dungeon · Terminal Lab</span>
        <span className="block text-lg font-bold">{title}</span>
        <span className="block text-sm text-white/80">{text}</span>
      </span>
      <FaArrowRight className="ml-auto shrink-0 text-amber" aria-hidden />
    </Link>
  )
}
