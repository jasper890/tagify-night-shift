import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { FaBars, FaBook, FaClipboardList, FaFlagCheckered, FaFlask, FaHome, FaRocket, FaTerminal, FaTimes, FaUser } from 'react-icons/fa'
import { LESSONS } from '../data/lessons'
import { useProgress } from '../lib/progress'
import { currentStage } from '../lib/game'
import { Hud, Stars } from './pixel/Hud'
import { GameEvents } from './pixel/GameEvents'
import { Sprite } from './pixel/Sprite'

const EXTRA_LINKS = [
  { to: '/terminal', label: 'Terminal Lab', icon: FaTerminal },
  { to: '/practice', label: 'Practice Lab', icon: FaFlask },
  { to: '/beyond', label: 'Beyond the Basics', icon: FaRocket },
  { to: '/cheatsheet', label: 'Cheat Sheet', icon: FaClipboardList },
  { to: '/glossary', label: 'Glossary', icon: FaBook },
  { to: '/summary', label: 'Summary', icon: FaFlagCheckered },
  { to: '/player', label: 'Player & Badges', icon: FaUser },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { progress } = useProgress()
  const next = currentStage(progress)
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 border-2 px-2.5 py-1.5 text-[0.98rem] no-underline ${
      isActive ? 'border-amber bg-amber font-bold text-ink' : 'border-transparent text-white/90 hover:border-white/25 hover:bg-white/5'
    }`
  return (
    <nav aria-label="Lessons and pages" className="on-dark flex flex-col gap-1 p-3">
      <NavLink to="/" end className={linkClass} onClick={onNavigate}>
        <FaHome aria-hidden /> World map
      </NavLink>
      <p className="mt-4 flex items-center justify-between px-2.5 pb-1">
        <span className="pixel-label text-amber">Quest log</span>
        <span className="pixel-label !text-[0.6rem] text-white/60">
          {progress.lessons.length}/{LESSONS.length} clear
        </span>
      </p>
      {LESSONS.map((l) => {
        const done = progress.lessons.includes(l.id)
        const here = next?.id === l.id
        return (
          <NavLink key={l.id} to={l.path} className={linkClass} onClick={onNavigate}>
            {({ isActive }) => (
              <>
                <span
                  className={`pixel-label inline-flex h-7 w-7 shrink-0 items-center justify-center border-2 border-ink ${
                    done ? 'bg-xp text-ink' : isActive ? 'bg-ink text-amber' : 'bg-sky text-white'
                  }`}
                  aria-hidden
                >
                  {l.id}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  {l.short}
                  {done ? (
                    <Stars count={progress.stars[l.id] ?? 1} onLight={isActive} className="mt-0.5 flex text-[0.7rem]" />
                  ) : here ? (
                    <span className={`pixel-label mt-0.5 block !text-[0.6rem] ${isActive ? 'text-ink/70' : 'text-xp'}`}>▶ next stage</span>
                  ) : null}
                </span>
                {done ? <span className="sr-only">(cleared)</span> : null}
              </>
            )}
          </NavLink>
        )
      })}
      <p className="pixel-label mt-4 px-2.5 pb-1 text-amber">Side quests</p>
      {EXTRA_LINKS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={linkClass} onClick={onNavigate}>
          <Icon aria-hidden className="shrink-0" /> {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Scroll to top on page change, or to the #anchor if there is one.
  useEffect(() => {
    setMenuOpen(false)
    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)))
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [location.pathname, location.hash])

  const isHome = location.pathname === '/'
  const isLab = location.pathname.startsWith('/terminal/')

  return (
    <>
      <a href="#main" className="sr-only z-50 bg-amber px-4 py-2 font-bold text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <div className="flex min-h-screen flex-col">
        <header className="no-print on-dark scanlines sticky top-0 z-30 flex h-[3.5rem] items-center gap-3 border-b-4 border-ink bg-sky px-3 text-white sm:px-4">
          <button
            type="button"
            className="hud-frame p-2 hover:brightness-125 lg:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <FaTimes aria-hidden /> : <FaBars aria-hidden />}
          </button>
          <Link to="/" className="flex min-w-0 items-center gap-2 text-white no-underline">
            <Sprite id="hero" size={32} />
            <span className="min-w-0 leading-tight">
              <span className="pixel-label block truncate text-amber px-shadow sm:!text-[0.7rem]">Task Scheduling</span>
              <span className="pixel-label hidden !text-[0.6rem] text-white/75 sm:block">&amp; Automation · the night shift</span>
            </span>
          </Link>
          <Link to="/terminal" className="btn btn-amber ml-2 hidden py-1.5 text-sm no-underline xl:inline-flex">
            <FaTerminal aria-hidden /> Terminal Lab
          </Link>
          <Hud />
        </header>

        {menuOpen ? (
          <div id="mobile-menu" className="no-print fixed inset-x-0 top-[3.5rem] bottom-0 z-20 overflow-y-auto bg-night lg:hidden">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        ) : null}

        <div className="flex flex-1">
          <aside className="no-print on-dark sticky top-[3.5rem] hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r-4 border-ink bg-night lg:block">
            <Sidebar />
          </aside>
          <main id="main" className="min-w-0 flex-1" tabIndex={-1}>
            {isHome ? (
              children
            ) : (
              <div className={isLab ? 'px-2 py-4 sm:px-5 sm:py-6' : 'mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-10'}>
                <div key={location.pathname} className={`game-window anim-stage-in mx-1 mb-4 ${isLab ? 'p-3 sm:p-4' : 'px-4 py-6 sm:px-8 sm:py-9'}`}>
                  {children}
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="on-dark border-t-4 border-ink bg-night px-4 py-5 text-center text-white/80">
          <p className="pixel-label">
            <span className="text-amber">Tagify Group</span> · Task Scheduling and Automation
          </p>
          <p className="mt-2 text-sm text-white/55">Progress is saved only in this browser. No account, nothing sent anywhere.</p>
        </footer>
      </div>
      <GameEvents />
    </>
  )
}
