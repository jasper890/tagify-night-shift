import { Link } from 'react-router-dom'
import { FaArrowLeft, FaCheckCircle, FaFileAlt, FaUserShield } from 'react-icons/fa'
import { IconCircle, PageHeader } from '../components/ui'
import { Sprite } from '../components/pixel/Sprite'

export default function Summary() {
  return (
    <>
      <PageHeader
        kicker="Ending · Summary"
        title="Three Habits for Trustworthy Automation"
        slides="Slides 22–23"
        intro="Every boss in this game was a bad habit. These three good habits beat all of them."
      />
      <ol className="grid gap-4 md:grid-cols-3">
        {[
          { icon: FaFileAlt, t: 'Log everything', d: 'Record the time, what happened, and whether it worked.', link: '/lesson/6' },
          { icon: FaCheckCircle, t: 'Verify the result', d: 'Check the output really exists, not just that the job ran.', link: '/lesson/7' },
          { icon: FaUserShield, t: 'Least privilege', d: 'Give every job only the access it needs, nothing more.', link: '/lesson/7' },
        ].map((x, i) => (
          <li key={x.t} className="card flex flex-col p-6">
            <div className="flex items-center justify-between">
              <span className="pixel-label inline-flex h-12 w-12 items-center justify-center border-3 border-ink bg-amber text-base text-ink">{i + 1}</span>
              <IconCircle icon={x.icon} tone="teal" />
            </div>
            <h2 className="mt-4 text-2xl">{x.t}</h2>
            <p className="mt-1 text-lg">{x.d}</p>
            <Link to={x.link} className="mt-auto pt-4 text-sm font-bold">
              Review this →
            </Link>
          </li>
        ))}
      </ol>

      <section className="on-dark hud-frame scanlines mt-14 p-8 text-center sm:p-12">
        <div className="flex items-end justify-center gap-4" aria-hidden>
          <Sprite id="sage" size={56} />
          <Sprite id="hero" size={72} className="animate-bob" />
          <Sprite id="dragon" size={56} className="opacity-40 grayscale" />
        </div>
        <p className="pixel-label mt-5 text-xp">The end · thanks for playing</p>
        <h2 className="mt-3 text-4xl !text-white px-shadow sm:text-5xl">You made it!</h2>
        <p className="mt-3 text-lg">
          Try the <Link to="/practice" className="font-bold text-amber">Practice Lab</Link> to test yourself.{' '}
          <span className="mx-2 text-white/50">|</span> Made by <span className="font-bold text-amber">Tagify Group</span>
        </p>
        <blockquote className="mx-auto mt-6 max-w-2xl text-xl text-white/90 italic">
          “The best administrators are not the ones working at 2 AM. Their systems take care of themselves at 2 AM.”
        </blockquote>
      </section>

      <p className="no-print mt-8">
        <Link to="/lesson/8" className="inline-flex items-center gap-2 font-bold">
          <FaArrowLeft aria-hidden /> Back to Lesson 8
        </Link>
      </p>
    </>
  )
}
