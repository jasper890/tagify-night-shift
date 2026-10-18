import { useEffect, useState } from 'react'
import { FaArrowUp } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import { ACHIEVEMENTS, levelFor, unlockedAchievements, xpFor } from '../../lib/game'
import { useProgress, type Progress } from '../../lib/progress'
import { play } from '../../lib/sfx'

// Pops up "Level up!" and "Achievement unlocked" banners when progress changes.
// What the player has already been shown is remembered in this browser, so a reload
// never repeats a popup.

const KEY = 'tsa-game-seen-v1'

interface Seen {
  level: number
  achievements: string[]
}

function snapshot(p: Progress): Seen {
  return { level: levelFor(xpFor(p)).level, achievements: unlockedAchievements(p) }
}

function readSeen(): Seen | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Seen) : null
  } catch {
    return null
  }
}

function writeSeen(s: Seen) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage blocked */
  }
}

interface Toast {
  id: number
  icon: IconType
  kind: string
  title: string
  text: string
}

let nextId = 1

export function GameEvents() {
  const { progress } = useProgress()
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const now = snapshot(progress)
    const seen = readSeen()
    // First visit, or a save from before the game layer: remember quietly.
    if (!seen) {
      writeSeen(now)
      return
    }
    const fresh: Toast[] = []
    if (now.level > seen.level) {
      const lvl = levelFor(xpFor(progress))
      fresh.push({ id: nextId++, icon: FaArrowUp, kind: 'Level up!', title: `Level ${lvl.level}`, text: `You are now a ${lvl.title}.` })
    }
    for (const id of now.achievements) {
      if (seen.achievements.includes(id)) continue
      const a = ACHIEVEMENTS.find((x) => x.id === id)
      if (a) fresh.push({ id: nextId++, icon: a.icon, kind: 'Achievement unlocked', title: a.name, text: a.desc })
    }
    // Remember the highest level and every badge ever shown, even after an undo.
    writeSeen({ level: Math.max(now.level, seen.level), achievements: [...new Set([...seen.achievements, ...now.achievements])] })
    if (!fresh.length) return
    setToasts((list) => [...list, ...fresh])
    // Let a battle fanfare finish before the popup jingle (the popup waits too, in CSS).
    setTimeout(() => play(fresh[0].kind === 'Level up!' ? 'levelup' : 'unlock'), 700)
  }, [progress])

  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => setToasts((list) => list.slice(1)), 5200)
    return () => clearTimeout(t)
  }, [toasts])

  return (
    <div className="no-print pointer-events-none fixed right-3 bottom-3 z-50 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-3" aria-live="polite">
      {toasts.slice(0, 3).map((t) => (
        <div key={t.id} style={{ animationDelay: '0.7s' }} className="hud-frame anim-toast pointer-events-auto flex items-center gap-3 p-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-3 border-ink bg-amber text-xl text-ink" aria-hidden>
            <t.icon />
          </span>
          <span className="min-w-0">
            <span className="pixel-label block text-xp">{t.kind}</span>
            <span className="block text-lg leading-tight font-bold text-amber">{t.title}</span>
            <span className="block text-sm text-white/85">{t.text}</span>
          </span>
          <button
            type="button"
            className="ml-auto self-start px-1 text-white/60 hover:text-white"
            onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
