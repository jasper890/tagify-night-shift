import { Link } from 'react-router-dom'
import { FaStar, FaVolumeMute, FaVolumeUp } from 'react-icons/fa'
import { LESSONS } from '../../data/lessons'
import { levelFor, totalStars, xpFor } from '../../lib/game'
import { useProgress } from '../../lib/progress'
import { play, useSound } from '../../lib/sfx'

export function XpBar({ into, span, className = '' }: { into: number; span: number; className?: string }) {
  const pct = Math.round((into / span) * 100)
  return (
    <div className={`px-bar text-xp ${className}`} role="progressbar" aria-label="XP to next level" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Stars({ count, max = 3, className = '', onLight = false }: { count: number; max?: number; className?: string; /** On a gold background: draw stars dark. */ onLight?: boolean }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} role="img" aria-label={`${count} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <FaStar key={i} aria-hidden className={onLight ? (i < count ? 'text-ink' : 'text-ink/25') : i < count ? 'text-amber drop-shadow-[1px_1px_0_#1a1c2c]' : 'text-white/25'} />
      ))}
    </span>
  )
}

/** Player stats in the header: level, XP bar, stars, sound. */
export function Hud() {
  const { progress } = useProgress()
  const xp = xpFor(progress)
  const lvl = levelFor(xp)
  const { muted, toggle } = useSound()
  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      <Link
        to="/player"
        className="hud-frame flex items-center gap-2 px-2 py-1 text-white no-underline hover:brightness-125 sm:gap-3 sm:px-3"
        title={`Level ${lvl.level} ${lvl.title}: ${xp} XP. Open your player profile.`}
      >
        <span className="pixel-label text-amber">LV{lvl.level}</span>
        <span className="hidden min-w-0 flex-col gap-1 md:flex">
          <span className="max-w-[11rem] truncate text-sm leading-none text-white/85">{lvl.title}</span>
          <XpBar into={lvl.into} span={lvl.span} className="w-28" />
        </span>
        <span className="pixel-label flex items-center gap-1 text-amber" aria-label={`${totalStars(progress)} of ${LESSONS.length * 3} stars`}>
          <FaStar aria-hidden /> {totalStars(progress)}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => {
          toggle()
          if (muted) setTimeout(() => play('select'), 0)
        }}
        className="hud-frame p-2 text-white hover:brightness-125"
        aria-pressed={!muted}
        aria-label={muted ? 'Turn sound effects on' : 'Turn sound effects off'}
        title={muted ? 'Sound off' : 'Sound on'}
      >
        {muted ? <FaVolumeMute aria-hidden /> : <FaVolumeUp aria-hidden />}
      </button>
    </div>
  )
}
