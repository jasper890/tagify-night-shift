import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaLock, FaRedo, FaUser } from 'react-icons/fa'
import { LESSONS } from '../data/lessons'
import { MISSIONS } from '../data/missions'
import { BOSSES } from '../data/bosses'
import { ACHIEVEMENTS, TRACK_STEPS, XP, levelFor, missionsDone, terminalSteps, totalStars, xpFor } from '../lib/game'
import { useProgress } from '../lib/progress'
import { PageHeader } from '../components/ui'
import { Sprite } from '../components/pixel/Sprite'
import { Stars, XpBar } from '../components/pixel/Hud'

const TOTAL_STEPS = Object.values(TRACK_STEPS).reduce((a, b) => a + b, 0)

export default function Player() {
  const { progress, reset } = useProgress()
  const [confirming, setConfirming] = useState(false)
  const xp = xpFor(progress)
  const lvl = levelFor(xp)
  const unlocked = new Set(ACHIEVEMENTS.filter((a) => a.unlocked(progress)).map((a) => a.id))

  const stats = [
    { label: 'Stages cleared', value: `${progress.lessons.length}/${LESSONS.length}`, xp: `${XP.lesson} XP each` },
    { label: 'Stars', value: `${totalStars(progress)}/${LESSONS.length * 3}`, xp: `${XP.star} XP each` },
    { label: 'Practice missions', value: `${missionsDone(progress)}/${MISSIONS.length}`, xp: `${XP.mission} XP each` },
    { label: 'Terminal Lab steps', value: `${terminalSteps(progress)}/${TOTAL_STEPS}`, xp: `${XP.terminalStep} XP each` },
  ]

  return (
    <>
      <PageHeader kicker="Player profile" title="Your save file" icon={FaUser} intro="Your level, stars and badges. Everything is saved only in this browser." />

      <div className="on-dark hud-frame flex flex-wrap items-center gap-5 p-5 sm:p-6">
        <Sprite id="hero" size={96} label="Your sysadmin character" />
        <div className="min-w-0 flex-1">
          <p className="pixel-label text-amber">Level {lvl.level}</p>
          <p className="mt-1 text-3xl font-bold text-white">{lvl.title}</p>
          <XpBar into={lvl.into} span={lvl.span} className="mt-3 max-w-md" />
          <p className="mt-2 text-white/75">{lvl.max ? `${xp} XP. Top level reached!` : `${xp} XP · ${lvl.span - lvl.into} XP to level ${lvl.level + 1}`}</p>
        </div>
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label} className="card p-4">
            <p className="pixel-label !text-[0.6rem] text-teal">{s.label}</p>
            <p className="mt-2 text-3xl font-bold text-navy">{s.value}</p>
            <p className="text-sm text-ink/70">{s.xp}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-2xl">Bosses</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BOSSES.map((b) => {
          const done = progress.lessons.includes(b.lesson)
          return (
            <li key={b.lesson}>
              <Link to={`/lesson/${b.lesson}#boss`} className={`flex items-center gap-3 border-3 border-ink p-3 no-underline hover:-translate-y-0.5 ${done ? 'bg-teal-soft' : 'bg-white'}`}>
                <Sprite id={b.sprite} size={44} silhouette={!done} />
                <span className="min-w-0">
                  <span className="pixel-label block !text-[0.6rem] text-muted">Stage {b.lesson}</span>
                  <span className="block leading-tight font-bold text-navy">{done ? b.name : '???'}</span>
                  {done ? <Stars count={progress.stars[b.lesson] ?? 1} className="text-xs" /> : <span className="text-sm text-muted">Not defeated yet</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <h2 className="mt-12 text-2xl">
        Badges <span className="text-lg text-muted">({unlocked.size}/{ACHIEVEMENTS.length})</span>
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.has(a.id)
          return (
            <li key={a.id} className={`flex items-center gap-3 border-3 p-3 ${got ? 'border-ink bg-amber-soft' : 'border-dashed border-line-strong bg-card text-ink/70'}`}>
              <span
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center border-3 border-ink text-xl ${got ? 'bg-amber text-ink' : 'bg-line text-ink/50'}`}
                aria-hidden
              >
                {got ? <a.icon /> : <FaLock />}
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-navy">
                  {a.name}
                  {got ? null : <span className="sr-only"> (locked)</span>}
                </span>
                <span className="block text-sm">{a.desc}</span>
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-12 border-3 border-dashed border-danger bg-danger-soft p-4">
        <p className="font-bold text-danger-dark">New game</p>
        <p className="mt-1 text-[0.98rem]">Erase your stages, stars, missions and Terminal Lab steps to start again from Stage 1. Useful before a class demo.</p>
        {confirming ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn bg-danger text-white"
              onClick={() => {
                reset()
                setConfirming(false)
              }}
            >
              <FaRedo aria-hidden /> Yes, erase my progress
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
              Keep my progress
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost mt-3" onClick={() => setConfirming(true)}>
            <FaRedo aria-hidden /> Start a new game
          </button>
        )}
      </div>
    </>
  )
}
