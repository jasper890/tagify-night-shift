import { useMemo, useState } from 'react'
import { FaArrowRight, FaBookOpen, FaCheck, FaGamepad, FaLightbulb, FaRedo, FaTimes } from 'react-icons/fa'
import { CRON_QUIZ } from '../data/cronDemo'
import { XP, demoQuizDone } from '../lib/game'
import { buildChoices } from '../lib/cronDemo'
import { useProgress } from '../lib/progress'
import { play } from '../lib/sfx'
import { C, DemoFrame } from '../components/ui'

// A ten-question multiple-choice quiz about cron. One question at a time, the choices are
// shuffled, the hint is always on screen, and each question pays XP the first time it is
// answered right (so playing again is free practice, not an XP farm).

const FIELDS = [
  { l: 'minute', r: '0-59', cls: 'bg-amber text-ink' },
  { l: 'hour', r: '0-23', cls: 'bg-teal text-white' },
  { l: 'day of month', r: '1-31', cls: 'bg-slate text-white' },
  { l: 'month', r: '1-12', cls: 'bg-navy text-white' },
  { l: 'day of week', r: '0-7 (0 = Sunday)', cls: 'bg-[#5b4a8a] text-white' },
]

const SYMBOLS = [
  ['*', 'every'],
  [',', 'list'],
  ['-', 'range'],
  ['/', 'every so many'],
]

/** The five cron fields and the four special characters, always visible above the quiz. */
export function CronFieldGuide() {
  return (
    <div className="card p-4 sm:p-5">
      <p className="kicker">Cron field guide</p>
      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="The five cron fields, left to right">
        {FIELDS.map((f, i) => (
          <li key={f.l} className={`rounded-xl p-3 text-center ${f.cls} ${i === FIELDS.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <p className="font-bold">{f.l}</p>
            <p className="font-mono text-sm opacity-90">{f.r}</p>
          </li>
        ))}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
        {SYMBOLS.map(([s, m]) => (
          <li key={s}>
            <C>{s}</C> = {m}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface Result {
  right: boolean
  /** This answer earned XP (first time this question was answered right). */
  paid: boolean
}

export function CronMiniGame() {
  const { progress, answerDemoQuiz } = useProgress()
  const total = CRON_QUIZ.length
  const [round, setRound] = useState(0) // changes on "Play again", which reshuffles the choices
  const choicesByQuestion = useMemo(() => CRON_QUIZ.map((q) => buildChoices(q)), [round])
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [results, setResults] = useState<Result[]>([])

  const done = qi >= total
  const mastered = demoQuizDone(progress)
  const score = results.filter((r) => r.right).length
  const gained = results.filter((r) => r.paid).length * XP.demoQuiz

  const choose = (oi: number) => {
    if (picked !== null || done) return
    const q = CRON_QUIZ[qi]
    const right = oi === choicesByQuestion[qi].answer
    const paid = right && !progress.cronDemo.quiz.includes(q.id)
    setPicked(oi)
    setResults((r) => [...r, { right, paid }])
    play(right ? 'hit' : 'hurt')
    if (paid) answerDemoQuiz(q.id)
  }

  const next = () => {
    if (qi + 1 >= total) play(score >= 7 ? 'victory' : 'select')
    else play('select')
    setQi(qi + 1)
    setPicked(null)
  }

  const restart = () => {
    play('start')
    setRound((n) => n + 1)
    setQi(0)
    setPicked(null)
    setResults([])
  }

  const q = done ? null : CRON_QUIZ[qi]
  const choices = done ? null : choicesByQuestion[qi]
  const res = picked !== null ? results[qi] : null

  return (
    <DemoFrame
      title="Cron Mini-Game"
      icon={FaGamepad}
      hint={
        <>
          Answer {total} questions, one at a time. Each right answer earns <strong>+{XP.demoQuiz} XP</strong> the first time. You can play again to practise.
        </>
      }
    >
      <div className="flex items-center gap-3">
        <ol className="flex flex-1 gap-1" aria-label="Quiz progress">
          {CRON_QUIZ.map((x, i) => {
            const r = results[i]
            const cls = r ? (r.right ? 'bg-xp' : 'bg-hp') : i === qi && !done ? 'bg-amber' : 'bg-line'
            return <li key={x.id} className={`h-3 flex-1 border-2 border-ink ${cls}`} aria-label={r ? (r.right ? `Question ${i + 1}: right` : `Question ${i + 1}: wrong`) : `Question ${i + 1}`} />
          })}
        </ol>
        <p className="pixel-label shrink-0 !text-[0.6rem] text-teal" title="XP from right answers, counted once per question">
          {mastered * XP.demoQuiz}/{total * XP.demoQuiz} XP
        </p>
      </div>

      {q && choices ? (
        <fieldset key={qi} className="anim-pop mt-4">
          <legend className="text-xl leading-snug font-bold text-navy">
            <span className="pixel-label mb-2 block !text-[0.64rem] text-teal">
              Question {qi + 1} of {total}
            </span>
            {q.q}
          </legend>

          {q.code ? <p className="mt-3 overflow-x-auto border-3 border-ink bg-night px-4 py-3 font-mono text-2xl font-bold text-amber">{q.code}</p> : null}

          {/* The hint is always visible: no button, no penalty. */}
          <p className="mt-3 flex gap-3 border-3 border-amber-dark bg-amber-soft p-3 text-[0.98rem]">
            <FaLightbulb className="mt-1 shrink-0 text-amber-dark" aria-hidden />
            <span className="min-w-0">
              <strong className="text-amber-dark">Hint:</strong> {q.hint}
            </span>
          </p>

          <div className="mt-3 grid gap-2">
            {choices.options.map((o, oi) => {
              const state = picked === null ? 'idle' : oi === choices.answer ? 'right' : oi === picked ? 'wrong' : 'off'
              const cls = {
                idle: 'border-ink bg-white hover:bg-amber-soft',
                right: 'border-teal bg-teal-soft text-teal',
                wrong: 'border-danger bg-danger-soft text-danger-dark',
                off: 'border-line bg-white text-ink/45',
              }[state]
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => choose(oi)}
                  disabled={picked !== null}
                  aria-pressed={state === 'right' || state === 'wrong'}
                  className={`flex items-center gap-3 border-3 px-3 py-2.5 text-left text-[1.05rem] font-semibold ${cls}`}
                >
                  <span className={`pixel-label inline-flex h-7 w-7 shrink-0 items-center justify-center border-2 border-current !text-[0.6rem] ${state === 'idle' ? 'bg-navy text-amber' : ''}`} aria-hidden>
                    {state === 'right' ? <FaCheck /> : state === 'wrong' ? <FaTimes /> : oi + 1}
                  </span>
                  <span className={`min-w-0 flex-1 break-words ${q.codeOptions ? 'font-mono font-bold' : ''}`}>{o}</span>
                </button>
              )
            })}
          </div>

          <div aria-live="polite">
            {res ? (
              <div className={`anim-pop mt-4 border-3 p-4 ${res.right ? 'border-teal bg-teal-soft' : 'border-danger bg-danger-soft'}`}>
                <p className={`font-bold ${res.right ? 'text-teal' : 'text-danger-dark'}`}>
                  {res.right
                    ? `Correct! ${res.paid ? `+${XP.demoQuiz} XP` : 'You already earned the XP for this question.'}`
                    : `Not quite. The answer is “${choices.options[choices.answer]}”.`}
                </p>
                <p className="mt-1 flex gap-2">
                  <FaBookOpen className={`mt-1 shrink-0 ${res.right ? 'text-teal' : 'text-danger-dark'}`} aria-hidden />
                  <span>{q.why}</span>
                </p>
                <button type="button" className="btn btn-primary mt-3" onClick={next} autoFocus>
                  {qi + 1 < total ? 'Next question' : 'See my score'} <FaArrowRight aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </fieldset>
      ) : (
        <div className="anim-pop mt-4" aria-live="polite">
          <div className="on-dark hud-frame p-4 text-center sm:p-6">
            <p className="pixel-label text-xp">{score === total ? 'Perfect score!' : 'Round complete'}</p>
            <p className="mt-2 text-4xl font-bold text-white">
              {score} / {total}
            </p>
            <p className="pixel-label mt-3 text-amber">{gained > 0 ? `+${gained} XP` : 'No new XP this round'}</p>
          </div>
          <p className="mt-3">
            Questions mastered: <strong>{mastered}</strong> of {total}. Each question pays XP only the first time you answer it right.
          </p>
          {score < total ? (
            <>
              <h3 className="mt-4 text-xl">Review these</h3>
              <ul className="mt-2 space-y-2">
                {CRON_QUIZ.map((x, i) =>
                  results[i]?.right ? null : (
                    <li key={x.id} className="card p-3">
                      <p className="font-bold text-navy">
                        {x.q} {x.code ? <C>{x.code}</C> : null}
                      </p>
                      <p className="mt-0.5">
                        <span className="font-bold text-teal">{x.answer}.</span> {x.why}
                      </p>
                    </li>
                  ),
                )}
              </ul>
            </>
          ) : null}
          <button type="button" className="btn btn-amber mt-4" onClick={restart} autoFocus>
            <FaRedo aria-hidden /> Play again
          </button>
        </div>
      )}
    </DemoFrame>
  )
}
