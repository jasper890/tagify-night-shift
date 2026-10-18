import { useEffect, useState } from 'react'
import { FaMusic } from 'react-icons/fa'
import { isMusicOn, unlockMusic, useMusic } from '../../lib/music'

const HINT_KEY = 'tsa-music-hint-v1'

/** Music on/off button for the HUD. */
export function MusicButton() {
  const { on, toggle } = useMusic()
  return (
    <button
      type="button"
      onClick={toggle}
      className="hud-frame relative p-2 text-white hover:brightness-125"
      aria-pressed={on}
      aria-label={on ? 'Turn background music off' : 'Turn background music on'}
      title={on ? 'Music on' : 'Music off'}
    >
      <FaMusic aria-hidden className={on ? 'text-xp' : 'opacity-50'} />
      {on ? null : <span className="absolute top-1/2 left-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-hp" aria-hidden />}
    </button>
  )
}

/**
 * Starts the background music on the visitor's first click or key press (browsers block sound before that),
 * and the first time it plays, says where the off switch is.
 */
export function MusicPlayer() {
  const [hint, setHint] = useState(false)

  useEffect(() => {
    const start = () => {
      unlockMusic()
      let seen = true
      try {
        seen = window.localStorage.getItem(HINT_KEY) === '1'
        window.localStorage.setItem(HINT_KEY, '1')
      } catch {
        /* storage blocked */
      }
      if (!seen && isMusicOn()) setHint(true)
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
    }
    window.addEventListener('pointerdown', start)
    window.addEventListener('keydown', start)
    return () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
    }
  }, [])

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(false), 6000)
    return () => clearTimeout(t)
  }, [hint])

  if (!hint) return null
  return (
    <div className="no-print hud-frame anim-toast fixed bottom-3 left-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 p-3" role="status">
      <FaMusic className="shrink-0 text-xl text-xp" aria-hidden />
      <span className="text-sm">
        Music on. Use the <FaMusic className="inline text-xs text-xp" aria-label="music" /> button at the top to turn it off.
      </span>
    </div>
  )
}
