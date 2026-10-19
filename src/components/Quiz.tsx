import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaArrowRight, FaBookOpen, FaCheck, FaHeart, FaRedo, FaRegHeart, FaTimes } from 'react-icons/fa'
import { QUIZZES } from '../data/quizzes'
import { LESSONS } from '../data/lessons'
import { bossFor } from '../data/bosses'
import { MAX_HEARTS, XP, starsFor } from '../lib/game'
import { useProgress } from '../lib/progress'
import { play } from '../lib/sfx'
import { shuffledOrder } from '../lib/shuffle'
import { requestTrack } from '../lib/music'
import { Sprite } from './pixel/Sprite'
import { Stars } from './pixel/Hud'

// The lesson quiz as a boss battle. Each right answer hits the boss; each wrong answer
// costs a heart and explains the idea, so the player learns from every move.
// Beat the boss (answer every question) to clear the stage. Stars = hearts left.
// Answer choices are shuffled on every fight, so a rematch tests the idea, not the position.

type Phase = 'intro' | 'fight' | 'won' | 'lost'

/** Smooth scrolling, unless the player asked for less motion. */
const scrollBehavior = (): ScrollBehavior => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

function Hearts({ left }: { left: number }) {
  return (
    <span className="inline-flex gap-1 text-hp" role="img" aria-label={`${left} of ${MAX_HEARTS} hearts left`}>
      {Array.from({ length: MAX_HEARTS }, (_, i) => (i < left ? <FaHeart key={i} aria-hidden /> : <FaRegHeart key={i} aria-hidden className="opacity-50" />))}
    </span>
  )
}

export function Quiz({ lesson }: { lesson: number }) {
  const questions = QUIZZES[lesson] ?? []
  const boss = bossFor(lesson)
  const { progress, winBattle } = useProgress()
  const cleared = progress.lessons.includes(lesson)
  const best = progress.stars[lesson] ?? (cleared ? 1 : 0)
  const next = LESSONS.find((l) => l.id === lesson + 1)

  const [phase, setPhase] = useState<Phase>('intro')
  const [qi, setQi] = useState(0)
  const [hearts, setHearts] = useState(MAX_HEARTS)
  const [wrong, setWrong] = useState<number[]>([]) // wrong options picked on this question
  const [solved, setSolved] = useState(false) // this question answered right
  const [fx, setFx] = useState<{ kind: 'hit' | 'hurt'; n: number } | null>(null)
  const [reward, setReward] = useState({ stars: 0, xp: 0 })
  const arenaRef = useRef<HTMLDivElement>(null)
  // Display order of each question's options for this fight, and where each answer sat last fight.
  const [orders, setOrders] = useState<number[][]>([])
  const lastSlots = useRef<number[]>([])

  const q = questions[qi]
  const order = orders[qi] ?? q?.options.map((_, i) => i) ?? []
  const bossHp = questions.length - qi - (solved ? 1 : 0)

  const start = () => {
    play('start')
    const fresh = questions.map((x, i) => shuffledOrder(x.options.length, x.answer, lastSlots.current[i]))
    lastSlots.current = fresh.map((o, i) => o.indexOf(questions[i].answer))
    setOrders(fresh)
    setPhase('fight')
    setQi(0)
    setHearts(MAX_HEARTS)
    setWrong([])
    setSolved(false)
    setFx(null)
    arenaRef.current?.scrollIntoView({ block: 'start', behavior: scrollBehavior() })
  }

  const choose = (oi: number) => {
    if (phase !== 'fight' || solved || hearts <= 0 || wrong.includes(oi)) return
    if (oi === q.answer) {
      play('hit')
      setSolved(true)
      setFx({ kind: 'hit', n: Date.now() })
    } else {
      play('hurt')
      const left = hearts - 1
      setHearts(left)
      setWrong((w) => [...w, oi])
      setFx({ kind: 'hurt', n: Date.now() })
      if (left <= 0) {
        setTimeout(() => {
          play('gameover')
          setPhase('lost')
        }, 1400)
      }
    }
  }

  const advance = () => {
    if (qi + 1 < questions.length) {
      play('select')
      setQi(qi + 1)
      setWrong([])
      setSolved(false)
      return
    }
    const stars = starsFor(hearts)
    const xp = (cleared ? 0 : XP.lesson) + Math.max(0, stars - best) * XP.star
    setReward({ stars, xp })
    play('victory')
    setPhase('won')
    winBattle(lesson, stars)
  }

  // Boss music while the fight is on; the overworld theme comes back after.
  useEffect(() => {
    requestTrack(`boss-${lesson}`, phase === 'fight' ? 'battle' : null)
    return () => requestTrack(`boss-${lesson}`, null)
  }, [phase, lesson])

  // Keys 1–4 pick an answer and Enter moves on: handy when demoing on a projector.
  useEffect(() => {
    if (phase !== 'fight') return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return
      const n = Number(e.key)
      if (n >= 1 && n <= order.length) choose(order[n - 1])
      else if (e.key === 'Enter' && solved && !t.closest('button, a')) advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!questions.length) return null

  const lastWrong = wrong.length ? wrong[wrong.length - 1] : null
  const fighting = phase === 'fight'

  return (
    <section id="boss" className="no-print mt-14 scroll-mt-20 border-3 border-ink bg-white shadow-[6px_6px_0_0_rgb(26_28_44/0.3)]" aria-labelledby={`boss-${lesson}`}>
      <div className="flex flex-wrap items-center gap-3 border-b-3 border-ink bg-danger px-4 py-2.5 text-white sm:px-5">
        <span className="pixel-label">Boss battle</span>
        <h2 id={`boss-${lesson}`} className="text-lg !text-white">
          Stage {lesson}: {boss.name}
        </h2>
        {cleared ? (
          <span className="ml-auto inline-flex items-center gap-2 border-2 border-ink bg-ink px-2 py-0.5 text-sm">
            <span className="pixel-label !text-[0.6rem] text-xp">Cleared</span> <Stars count={best} />
          </span>
        ) : null}
      </div>

      {/* Arena */}
      <div ref={arenaRef} className={`on-dark scanlines relative scroll-mt-20 overflow-hidden bg-night ${fx?.kind === 'hurt' ? 'anim-hurt' : ''}`} key={fx?.kind === 'hurt' ? fx.n : 'arena'}>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 border-t-4 border-ink bg-[#333c57]"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, #3d4766 0 16px, #333c57 16px 32px)' }}
          aria-hidden
        />
        <div className="relative grid grid-cols-2 items-end gap-4 px-4 pt-5 pb-6 sm:px-8">
          {/* Player */}
          <div className="flex flex-col items-start gap-2">
            <div className="hud-frame px-2.5 py-1.5">
              <p className="pixel-label !text-[0.6rem] text-white/70">You</p>
              <Hearts left={phase === 'intro' ? MAX_HEARTS : hearts} />
            </div>
            <Sprite id="hero" size={72} className={`ml-2 ${phase === 'lost' ? 'rotate-90 opacity-60' : fighting ? 'animate-bob' : ''}`} />
          </div>
          {/* Boss */}
          <div className="flex flex-col items-end gap-2">
            <div className="hud-frame min-w-0 px-2.5 py-1.5 text-right">
              <p className="pixel-label truncate !text-[0.6rem] text-white/70">{boss.name}</p>
              <div className="mt-1 flex items-center justify-end gap-2">
                <span className="pixel-label !text-[0.6rem] text-hp">HP</span>
                <div className="px-bar w-20 text-hp sm:w-28" role="img" aria-label={`Boss health ${phase === 'won' ? 0 : bossHp} of ${questions.length}`}>
                  <span style={{ width: `${((phase === 'won' ? 0 : phase === 'intro' ? questions.length : bossHp) / questions.length) * 100}%` }} />
                </div>
              </div>
            </div>
            <div className="relative mr-2">
              {fx?.kind === 'hit' ? (
                <span key={fx.n} className="float-dmg pixel-label text-base text-amber px-shadow" aria-hidden>
                  -1
                </span>
              ) : null}
              <Sprite
                key={fx?.kind === 'hit' ? fx.n : 'boss'}
                id={boss.sprite}
                size={96}
                className={`${phase === 'won' ? 'translate-y-4 opacity-0 transition-all duration-700' : ''} ${fx?.kind === 'hit' ? 'anim-shake anim-flash' : phase !== 'won' ? 'animate-bob' : ''}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dialog + menu */}
      <div className="border-t-3 border-ink p-4 sm:p-5">
        {phase === 'intro' ? (
          <div className="anim-pop">
            <div className="hud-frame p-4">
              <p className="pixel-label !text-[0.64rem] text-xp">{boss.name} appears!</p>
              <p className="mt-1.5 text-lg text-white">“{boss.taunt}”</p>
            </div>
            <p className="mt-4">
              Answer {questions.length} questions about this lesson. A right answer hits the boss. A wrong answer costs a heart, and you will see why so you can try
              again. Keep all {MAX_HEARTS} hearts for 3 stars.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-amber px-5 py-2.5 text-base" onClick={start}>
                {cleared ? 'Rematch' : 'Fight!'} <FaArrowRight aria-hidden />
              </button>
              {cleared && best < 3 ? <span className="text-sm text-ink/75">Win with more hearts left to earn more stars.</span> : null}
            </div>
          </div>
        ) : null}

        {fighting ? (
          <div key={qi} className="anim-pop">
            <p className="pixel-label !text-[0.64rem] text-teal">
              Question {qi + 1} of {questions.length}
            </p>
            <fieldset className="mt-2">
              <legend className="text-xl leading-snug font-bold text-navy">{q.q}</legend>
              <div className="mt-3 grid gap-2">
                {order.map((oi, slot) => {
                  const o = q.options[oi]
                  const state = solved && oi === q.answer ? 'right' : wrong.includes(oi) ? 'wrong' : solved ? 'off' : 'idle'
                  const cls = {
                    idle: 'border-ink bg-white hover:bg-amber-soft',
                    right: 'border-teal bg-teal-soft text-teal',
                    wrong: 'border-danger bg-danger-soft text-danger-dark line-through decoration-2',
                    off: 'border-line bg-white text-ink/45',
                  }[state]
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => choose(oi)}
                      disabled={state !== 'idle'}
                      aria-pressed={state === 'right' || state === 'wrong'}
                      className={`group flex items-center gap-3 border-3 px-3 py-2.5 text-left text-[1.05rem] font-semibold ${cls}`}
                    >
                      <span className={`pixel-label inline-flex h-7 w-7 shrink-0 items-center justify-center border-2 border-current !text-[0.6rem] ${state === 'idle' ? 'bg-navy text-amber' : ''}`} aria-hidden>
                        {state === 'right' ? <FaCheck /> : state === 'wrong' ? <FaTimes /> : slot + 1}
                      </span>
                      <span className="min-w-0 flex-1">{o}</span>
                      {state === 'idle' ? (
                        <span className="pixel-label text-amber-dark opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
                          ◀
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div aria-live="polite">
              {solved ? (
                <div className="anim-pop mt-4 border-3 border-teal bg-teal-soft p-4">
                  <p className="font-bold text-teal">Critical hit! That’s right.</p>
                  <p className="mt-1 flex gap-2">
                    <FaBookOpen className="mt-1 shrink-0 text-teal" aria-hidden />
                    <span>{q.why}</span>
                  </p>
                  <button type="button" className="btn btn-primary mt-3" onClick={advance} autoFocus>
                    {qi + 1 < questions.length ? 'Next question' : 'Finish the boss'} <FaArrowRight aria-hidden />
                  </button>
                </div>
              ) : lastWrong !== null ? (
                <div key={wrong.length} className="anim-pop mt-4 border-3 border-danger bg-danger-soft p-4">
                  <p className="font-bold text-danger-dark">
                    Ouch! “{q.options[lastWrong]}” is not it. You lost a heart.
                  </p>
                  <p className="mt-1 flex gap-2">
                    <FaBookOpen className="mt-1 shrink-0 text-danger-dark" aria-hidden />
                    <span>
                      <strong>Learn from it:</strong> {q.why}
                    </span>
                  </p>
                  {hearts > 0 ? <p className="mt-2 text-sm text-ink/80">Now pick the right answer to hit the boss.</p> : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink/65">Tip: press 1–{q.options.length} on the keyboard to answer.</p>
              )}
            </div>
          </div>
        ) : null}

        {phase === 'won' ? (
          <div className="anim-pop" aria-live="polite">
            <div className="hud-frame p-4 text-center sm:p-6">
              <p className="pixel-label text-xp">Stage clear!</p>
              <p className="mt-2 text-white/85">{boss.name}: “{boss.defeat}”</p>
              <Stars count={reward.stars} className="mt-3 justify-center text-4xl" />
              <p className="pixel-label mt-3 text-amber">{reward.xp > 0 ? `+${reward.xp} XP` : 'No new XP: beat your best stars to earn more'}</p>
            </div>
            <h3 className="mt-5 text-xl">What you learned</h3>
            <ol className="mt-2 space-y-2">
              {questions.map((x, i) => (
                <li key={x.q} className="card p-3">
                  <p className="font-bold text-navy">
                    {i + 1}. {x.q}
                  </p>
                  <p className="mt-0.5">
                    <span className="font-bold text-teal">{x.options[x.answer]}.</span> {x.why}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-3">
              {next ? (
                <Link to={next.path} className="btn btn-amber no-underline">
                  Next stage: {next.short} <FaArrowRight aria-hidden />
                </Link>
              ) : (
                <Link to="/summary" className="btn btn-amber no-underline">
                  See the ending <FaArrowRight aria-hidden />
                </Link>
              )}
              <button type="button" className="btn btn-ghost" onClick={start}>
                <FaRedo aria-hidden /> Rematch
              </button>
            </div>
          </div>
        ) : null}

        {phase === 'lost' ? (
          <div className="anim-pop" aria-live="polite">
            <div className="hud-frame p-4 text-center sm:p-6">
              <p className="pixel-label text-hp">Game over</p>
              <p className="mt-2 text-white/85">{boss.name} wins this round. Read the explanations, scroll up to review the lesson, then try again.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className="btn btn-amber" onClick={start} autoFocus>
                <FaRedo aria-hidden /> Continue? Try again
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}>
                Review the lesson
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
