import { Link, useNavigate, useParams } from 'react-router-dom'
import { FaCheckCircle, FaCode, FaGithub, FaLinux, FaPlay, FaServer, FaTerminal, FaWindows, FaClock, FaBroom } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import { TRACKS } from '../terminal/tracks'
import { TerminalLab } from '../components/TerminalLab'
import { IconCircle, PageHeader } from '../components/ui'
import { useProgress } from '../lib/progress'
import NotFound from './NotFound'

const ICONS: Record<string, IconType> = {
  bash: FaCode,
  cron: FaClock,
  cleanup: FaBroom,
  windows: FaWindows,
  ansible: FaServer,
  'github-actions': FaGithub,
}

export default function Terminal() {
  const { track: trackId } = useParams()
  const navigate = useNavigate()
  const { progress } = useProgress()

  if (trackId) {
    const track = TRACKS.find((t) => t.id === trackId)
    if (!track) return <NotFound />
    return (
      <>
        <h1 className="sr-only">Terminal Lab: {track.title}</h1>
        <TerminalLab key={track.id} track={track} onExit={() => navigate('/terminal')} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        kicker="Hands-on · learn by typing"
        title="Terminal Lab"
        icon={FaTerminal}
        intro="Practise like a real system administrator and network automation engineer. A guide tells you what to type or code, you do it in a simulated terminal, and it checks your work. Nothing runs on your computer, so you cannot break anything."
      />

      <ol className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Read the guide', 'Each step explains one idea in plain words.'],
          ['Type or code it', 'Run the command, or write the script, playbook or workflow in the editor.'],
          ['See what happens', 'Real-looking output, errors and logs. Use timewarp to watch scheduled jobs run.'],
          ['Get checked', 'The step turns green when you got it right. Stuck? Use the hint.'],
        ].map(([t, d], i) => (
          <li key={t} className="card p-4">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber font-bold text-navy">{i + 1}</span>
            <p className="mt-2 font-bold text-navy">{t}</p>
            <p className="text-[0.95rem]">{d}</p>
          </li>
        ))}
      </ol>

      <h2 className="text-2xl">Choose a lab</h2>
      <p className="mt-1 text-ink/80">Start at the top if you are new. Each lab takes about 10–15 minutes, and your progress is saved in this browser.</p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {TRACKS.map((t, i) => {
          const doneSteps = Math.min(progress.terminal[t.id] ?? 0, t.steps.length)
          const complete = doneSteps === t.steps.length
          return (
            <li key={t.id}>
              <Link
                to={`/terminal/${t.id}`}
                className={`flex h-full flex-col gap-3 rounded-2xl border-2 p-5 no-underline transition-shadow hover:shadow-lg ${complete ? 'border-teal/60 bg-teal-soft' : 'border-line bg-white hover:border-amber'}`}
              >
                <div className="flex items-center gap-3">
                  <IconCircle icon={ICONS[t.id] ?? FaTerminal} tone={i % 2 ? 'teal' : 'amber'} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-teal uppercase">
                      Lab {i + 1} · {t.level} · ~{t.minutes} min
                    </p>
                    <p className="text-lg font-bold text-navy">{t.title}</p>
                  </div>
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-navy px-2 py-1 text-xs font-bold text-white">
                    {t.os === 'linux' ? <FaLinux aria-hidden /> : <FaWindows aria-hidden />} {t.os === 'linux' ? 'Linux' : 'Windows'}
                  </span>
                </div>
                <p className="text-ink/85">{t.summary}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {t.youWillLearn.map((y) => (
                    <li key={y} className="rounded-full bg-card px-2 py-0.5 text-xs text-navy">
                      {y}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center gap-3 pt-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-card" aria-hidden>
                    <div className="h-full rounded-full bg-teal" style={{ width: `${(doneSteps / t.steps.length) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-ink/70">
                    {doneSteps}/{t.steps.length} steps
                  </span>
                  <span className="btn btn-primary px-3 py-1 text-xs">
                    {complete ? <FaCheckCircle aria-hidden /> : <FaPlay aria-hidden />} {complete ? 'Review' : doneSteps ? 'Continue' : 'Start'}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
