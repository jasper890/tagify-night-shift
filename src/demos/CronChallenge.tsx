import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import { FaCheckCircle, FaCopy, FaForward, FaLightbulb, FaPaste, FaPlay, FaRedo, FaArrowRight, FaTimesCircle, FaHdd, FaCheck } from 'react-icons/fa'
import { DemoFrame } from '../components/ui'
import { copyText } from '../components/CodeBlock'
import { Sprite } from '../components/pixel/Sprite'
import { Stars } from '../components/pixel/Hud'
import { CRON_CHALLENGES, DEVICES, GROUPS, type Device } from '../data/cronChallenges'
import { challengeStars, checkChallenge, clockParts, cronLogLine, SIM_START, type CheckResult, type Ran } from '../lib/cronChallenge'
import { splitCronLine } from '../lib/cron'
import { useProgress } from '../lib/progress'
import { XP } from '../lib/game'
import { play } from '../lib/sfx'

// Cron Challenge: type a crontab line, then watch it run on a pretend network.
// The server clock jumps to each run time and data packets fly from the device you
// named to the backup vault. Nothing real runs; it is all worked out in lib/cronChallenge.

/* ---------- Network map ---------- */

const BUS_Y = 118
const TOP_Y = 20 // servers: 30 x 42
const BOTTOM_Y = 150 // PCs and laptop: about 38 x 30

/** Two layouts: a roomy one, and a tighter one with bigger labels for phones. */
interface Layout {
  w: number
  cols: number[]
  vaultX: number
  switchX: number
  clockX: number
  label: number
  small: number
}

const WIDE: Layout = { w: 400, cols: [38, 102, 166, 230], vaultX: 322, switchX: 262, clockX: 290, label: 10, small: 9 }
const COMPACT: Layout = { w: 330, cols: [28, 84, 140, 196], vaultX: 262, switchX: 216, clockX: 226, label: 12, small: 11 }

interface Spot {
  device: Device
  cx: number
  top: boolean
}

const spotsFor = (g: Layout): Spot[] => DEVICES.map((device, i) => ({ device, cx: g.cols[i % 4], top: i < 4 }))
const SPOTS = { wide: spotsFor(WIDE), compact: spotsFor(COMPACT) }

type DeviceState = 'idle' | 'active' | 'done' | 'missed'

/** Where a device's cable meets its body. */
const plugY = (s: Spot) => (s.top ? TOP_Y + 42 : BOTTOM_Y)

function useNarrow() {
  const query = '(max-width: 640px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

function ServerBody({ cx, state }: { cx: number; state: DeviceState }) {
  const x = cx - 15
  return (
    <g>
      <rect x={x} y={TOP_Y} width={30} height={42} fill="#20233f" stroke={ring(state)} strokeWidth={state === 'idle' ? 1 : 2} />
      {[6, 18, 30].map((dy, i) => (
        <g key={dy}>
          <rect x={x + 3} y={TOP_Y + dy} width={24} height={8} fill="#181a30" />
          <rect x={x + 5} y={TOP_Y + dy + 3} width={12} height={1} fill="#333c57" />
          <rect
            x={x + 22}
            y={TOP_Y + dy + 3}
            width={2}
            height={2}
            fill={state === 'active' ? '#ffcd75' : '#a7f070'}
            className="anim-twinkle"
            style={{ animationDelay: `${(i * 0.7 + cx / 90) % 2.4}s`, animationDuration: state === 'active' ? '0.3s' : undefined }}
          />
        </g>
      ))}
    </g>
  )
}

function ScreenBody({ cx, state, laptop }: { cx: number; state: DeviceState; laptop: boolean }) {
  const screen = state === 'active' ? '#73eff7' : state === 'done' ? '#38b764' : '#29366f'
  if (laptop) {
    return (
      <g>
        <rect x={cx - 15} y={BOTTOM_Y + 2} width={30} height={20} fill="#333c57" stroke={ring(state)} strokeWidth={state === 'idle' ? 1 : 2} />
        <rect x={cx - 12} y={BOTTOM_Y + 5} width={24} height={14} fill={screen} />
        <rect x={cx - 19} y={BOTTOM_Y + 22} width={38} height={5} fill="#94b0c2" stroke="#1a1c2c" strokeWidth={1} />
      </g>
    )
  }
  return (
    <g>
      <rect x={cx - 16} y={BOTTOM_Y} width={32} height={22} fill="#333c57" stroke={ring(state)} strokeWidth={state === 'idle' ? 1 : 2} />
      <rect x={cx - 13} y={BOTTOM_Y + 3} width={26} height={16} fill={screen} />
      <rect x={cx - 3} y={BOTTOM_Y + 22} width={6} height={4} fill="#333c57" />
      <rect x={cx - 9} y={BOTTOM_Y + 26} width={18} height={3} fill="#94b0c2" />
    </g>
  )
}

const ring = (state: DeviceState) => (state === 'active' ? '#ffcd75' : state === 'done' ? '#a7f070' : state === 'missed' ? '#ef5d6b' : '#1a1c2c')

const NetworkScene = memo(function NetworkScene({
  states,
  clock,
  sending,
  sendKey,
  stored,
  full,
  label,
  compact,
}: {
  states: Record<string, DeviceState>
  clock: Date
  /** Device ids sending packets right now. */
  sending: string[]
  /** Changes on every run so the packets replay. */
  sendKey: number
  /** Backups saved in the vault so far. */
  stored: number
  /** Set when the vault overflowed: the label to show under it, like "60 a night". */
  full: string | null
  label: string
  compact: boolean
}) {
  const g = compact ? COMPACT : WIDE
  const spots = compact ? SPOTS.compact : SPOTS.wide
  const vx = g.vaultX
  const { day, time } = clockParts(clock)
  const fill = full ? 1 : Math.min(0.85, stored * 0.15)
  return (
    <svg viewBox={`0 0 ${g.w} 214`} className="sprite block h-auto w-full" shapeRendering="crispEdges" role="img" aria-label={label}>
      <rect x={0} y={0} width={g.w} height={214} fill="#12142a" />
      {/* Cables: each device drops to the bus, the bus runs to the vault. */}
      <rect x={g.cols[0]} y={BUS_Y - 1} width={vx - g.cols[0]} height={3} fill="#333c57" />
      {spots.map((s) => {
        const y1 = Math.min(plugY(s), BUS_Y)
        const h = Math.abs(BUS_Y - plugY(s))
        return <rect key={s.device.id} x={s.cx - 1} y={y1} width={3} height={h} fill={sending.includes(s.device.id) ? '#ffcd75' : '#333c57'} />
      })}
      {/* Network switch on the bus */}
      <rect x={g.switchX} y={BUS_Y - 7} width={36} height={14} fill="#20233f" stroke="#94b0c2" strokeWidth={1} />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={g.switchX + 5 + i * 7}
          y={BUS_Y - 1}
          width={3}
          height={2}
          fill="#a7f070"
          className="anim-twinkle"
          style={{ animationDelay: `${i * 0.4}s`, animationDuration: sending.length ? '0.3s' : undefined }}
        />
      ))}

      {spots.map((s) => {
        const state = states[s.device.id] ?? 'idle'
        const labelY = s.top ? TOP_Y - 6 : BOTTOM_Y + 30 + g.label
        const badgeY = s.top ? TOP_Y - 2 : BOTTOM_Y - 4
        return (
          <g key={s.device.id}>
            {s.device.kind === 'server' ? <ServerBody cx={s.cx} state={state} /> : <ScreenBody cx={s.cx} state={state} laptop={s.device.kind === 'laptop'} />}
            <text x={s.cx} y={labelY} textAnchor="middle" fontSize={g.label} fontFamily="var(--font-body)" fill={state === 'active' ? '#ffcd75' : state === 'missed' ? '#ef5d6b' : '#c5cee0'}>
              {s.device.id}
            </text>
            {state === 'done' || state === 'missed' ? (
              <g>
                <rect x={s.cx + 12} y={badgeY} width={10} height={10} fill={state === 'done' ? '#38b764' : '#b13e53'} stroke="#1a1c2c" strokeWidth={1} />
                <text x={s.cx + 17} y={badgeY + 8.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff" fontFamily="var(--font-body)">
                  {state === 'done' ? '✓' : '!'}
                </text>
              </g>
            ) : null}
          </g>
        )
      })}

      {/* Packets: down the device's cable, then along the bus into the vault. */}
      <g key={sendKey}>
        {spots
          .filter((s) => sending.includes(s.device.id))
          .flatMap((s, si) =>
            [0, 1, 2].map((k) => (
              <rect
                key={`${s.device.id}-${k}`}
                x={s.cx - 2.5}
                y={plugY(s) - 2.5}
                width={6}
                height={6}
                fill={k === 1 ? '#73eff7' : '#ffcd75'}
                stroke="#1a1c2c"
                strokeWidth={1}
                className="cc-packet"
                style={{ '--dx': `${vx - s.cx}px`, '--dy': `${BUS_Y - plugY(s)}px`, animationDelay: `${k * 0.22 + si * 0.08}s` } as CSSProperties}
              />
            )),
          )}
      </g>

      {/* Backup vault (a NAS) with a fill meter */}
      <rect x={vx} y={70} width={62} height={96} fill="#20233f" stroke={full ? '#ef5d6b' : sending.length ? '#ffcd75' : '#94b0c2'} strokeWidth={2} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={vx + 6} y={78 + i * 20} width={26} height={14} fill="#181a30" />
          <rect x={vx + 9} y={84 + i * 20} width={14} height={2} fill="#333c57" />
        </g>
      ))}
      <rect x={vx + 39} y={78} width={16} height={80} fill="#181a30" stroke="#333c57" strokeWidth={1} />
      <rect x={vx + 40} y={78 + 79 * (1 - fill)} width={14} height={79 * fill} fill={full ? '#ef5d6b' : '#38b764'} />
      <text x={vx + 31} y={180} textAnchor="middle" fontSize={g.label} fontFamily="var(--font-body)" fill={full ? '#ef5d6b' : '#ffcd75'}>
        {full ? 'vault FULL!' : 'vault'}
      </text>
      <text x={vx + 31} y={182 + g.small + 4} textAnchor="middle" fontSize={g.small} fontFamily="var(--font-body)" fill="#c5cee0">
        {full ?? `${stored} saved`}
      </text>

      {/* Server clock */}
      <rect x={g.clockX} y={6} width={g.w - g.clockX - 6} height={46} fill="#1a1c2c" stroke="#ffcd75" strokeWidth={2} />
      <text x={(g.clockX + g.w - 6) / 2} y={21} textAnchor="middle" fontSize={g.small} fontFamily="var(--font-body)" fill="#ffcd75">
        {day}
      </text>
      <text key={time + day} x={(g.clockX + g.w - 6) / 2} y={44} textAnchor="middle" fontSize={17} fontFamily="var(--font-pixel)" fill="#fff" className="anim-pop">
        {time}
      </text>
    </svg>
  )
})

/* ---------- The challenge ---------- */

interface Show {
  run: number
  sending: boolean
  stored: number
  finished: boolean
}

const PER_RUN = { clock: 450, send: 1300, gap: 200 }

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function CronChallenge() {
  const { progress, winChallenge } = useProgress()
  const [index, setIndex] = useState(0)
  const challenge = CRON_CHALLENGES[index]
  const [line, setLine] = useState(challenge.start)
  const [hints, setHints] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [show, setShow] = useState<Show | null>(null)
  const [copied, setCopied] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [firstSolve, setFirstSolve] = useState(false)
  const timers = useRef<number[]>([])
  const input = useRef<HTMLInputElement>(null)
  // Read by timers at the end of a run, so hints opened mid-animation still count.
  const hintsRef = useRef(0)
  hintsRef.current = hints

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const pick = (i: number) => {
    clearTimers()
    setIndex(i)
    setLine(CRON_CHALLENGES[i].start)
    setHints(0)
    setResult(null)
    setShow(null)
    setCopied(false)
  }

  const animating = !!show && !show.finished

  const finish = (r: Ran) => {
    clearTimers()
    setShow({ run: r.runs.length - 1, sending: false, stored: r.runs.length, finished: true })
    if (r.correct) {
      play('victory')
      setFirstSolve(!(progress.challenges[challenge.id] > 0))
      winChallenge(challenge.id, challengeStars(hintsRef.current))
    } else {
      play('hurt')
    }
  }

  const run = () => {
    if (animating) return
    clearTimers()
    const r = checkChallenge(line, challenge)
    setResult(r)
    if (r.status === 'error') {
      setShow(null)
      setShaking(false)
      window.requestAnimationFrame(() => setShaking(true))
      timers.current.push(window.setTimeout(() => setShaking(false), 450))
      play('hurt')
      return
    }
    play('start')
    if (reducedMotion()) {
      finish(r)
      return
    }
    const step = PER_RUN.clock + PER_RUN.send + PER_RUN.gap
    setShow({ run: -1, sending: false, stored: 0, finished: false })
    r.runs.forEach((_, i) => {
      const t = i * step
      timers.current.push(window.setTimeout(() => setShow({ run: i, sending: false, stored: i, finished: false }), t))
      timers.current.push(
        window.setTimeout(() => {
          play('select')
          setShow({ run: i, sending: true, stored: i, finished: false })
        }, t + PER_RUN.clock),
      )
      timers.current.push(window.setTimeout(() => setShow({ run: i, sending: false, stored: i + 1, finished: false }), t + PER_RUN.clock + PER_RUN.send))
    })
    timers.current.push(window.setTimeout(() => finish(r), r.runs.length * step))
  }

  const ran = result?.status === 'ran' ? result : null
  const finished = !!show?.finished && !!ran

  // Device colors on the map.
  const states: Record<string, DeviceState> = {}
  if (ran && show) {
    for (const id of ran.targets) states[id] = show.sending ? 'active' : show.stored > 0 ? 'done' : 'idle'
    if (finished && !ran.correct) for (const id of ran.expected) if (!ran.targets.includes(id)) states[id] = 'missed'
  }
  const clock = ran && show && show.run >= 0 ? ran.runs[show.run] : SIM_START
  const flooded = finished && !!ran && !ran.correct && ran.perWeek > ran.expectedPerWeek * 4
  const full = flooded && ran ? (ran.perWeek >= 1000 ? 'too many!' : `${Math.round(ran.perWeek / 7)} a night`) : null
  const narrow = useNarrow()

  const command = splitCronLine(line)?.command ?? ''
  const logLines =
    ran && show
      ? ran.runs.slice(0, show.stored).flatMap((d, i) => {
          const sizes = ran.targets.map((id) => `${id} ${DEVICES.find((x) => x.id === id)?.size}`).join(', ')
          return [cronLogLine(d, command, 2101 + i * 7), `backup.sh: copied ${sizes} to vault: OK${ran.logged ? ' (output saved in backup.log)' : ''}`]
        })
      : []

  const sceneLabel = ran && show
    ? `Network map. Server clock ${clockParts(clock).day} ${clockParts(clock).time}. ${show.sending ? `Backing up ${ran.targets.join(', ')}.` : ''} ${show.stored} backups saved in the vault.`
    : `Network map with 8 devices (${DEVICES.map((d) => d.id).join(', ')}), a network switch, and the backup vault. Server clock ${clockParts(SIM_START).day} ${clockParts(SIM_START).time}.`

  const best = progress.challenges[challenge.id] ?? 0
  const earned = challengeStars(hints)

  const copyAnswer = async () => {
    if (await copyText(challenge.answer)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <DemoFrame
      title="Cron Challenge: Back Up the Network"
      icon={FaHdd}
      hint={
        <>
          Write one crontab line that backs up the right device at the right time, then press <strong>Run it</strong> and watch the night shift happen. Stuck? Open a hint; the last one
          gives you the answer to copy and paste.
        </>
      }
    >
      {/* Challenge picker */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a challenge">
        {CRON_CHALLENGES.map((c, i) => {
          const stars = progress.challenges[c.id] ?? 0
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={i === index}
              aria-label={`Challenge ${i + 1}: ${c.title}${stars ? `, solved with ${stars} of 3 stars` : ''}`}
              className={`btn flex-col !gap-0.5 !px-3 !py-1.5 text-xs ${i === index ? 'bg-amber text-navy' : stars ? 'bg-teal-soft text-navy' : 'bg-white text-navy'}`}
            >
              <span className="pixel-label">{i + 1}</span>
              {stars ? <Stars count={stars} onLight className="text-[0.6rem]" /> : <span className="text-[0.65rem] text-ink/60">new</span>}
            </button>
          )
        })}
      </div>

      {/* The ticket */}
      <div className="mt-4 flex items-start gap-3 rounded-xl border-3 border-ink bg-navy p-4 text-white">
        <Sprite id="sage" size={48} className="shrink-0" />
        <div className="min-w-0">
          <p className="pixel-label text-amber">
            Ticket {index + 1}/{CRON_CHALLENGES.length} · {challenge.title}
          </p>
          <p className="mt-1">{challenge.story}</p>
          <p className="mt-2 inline-block rounded-md bg-white/10 px-2 py-0.5 font-mono text-sm text-xp">{challenge.goal}</p>
        </div>
      </div>

      {/* The line */}
      <label htmlFor="cc-line" className="mt-4 block text-sm font-bold text-navy">
        Your crontab line <span className="font-normal text-ink/70">(minute hour day month weekday, then the command and a device name)</span>
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input
          ref={input}
          id="cc-line"
          className={`field-input w-full min-w-0 font-mono text-base sm:w-auto sm:flex-1 sm:text-lg ${shaking ? 'anim-shake' : ''}`}
          value={line}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run()
          }}
        />
        <button type="button" className="btn btn-primary" onClick={run} disabled={animating}>
          <FaPlay aria-hidden /> Run it
        </button>
      </div>
      <p className="mt-1 text-sm text-ink/70">
        Device names: {DEVICES.map((d) => d.id).join(', ')} · group <span className="font-mono">lab</span> = {GROUPS.lab.join(' + ')}
      </p>

      {/* The night shift, animated */}
      <div className="mt-4 overflow-hidden rounded-xl border-3 border-ink">
        <NetworkScene
          states={states}
          clock={clock}
          sending={show?.sending && ran ? ran.targets : []}
          sendKey={show?.run ?? -1}
          stored={show?.stored ?? 0}
          full={full}
          label={sceneLabel}
          compact={narrow}
        />
        <div className="code-block min-h-[4.5rem] border-t-3 border-ink bg-night-2 p-3 font-mono text-xs leading-relaxed text-[#c5cee0]" aria-label="Server log">
          <p className="text-white/50"># /var/log/syslog (pretend)</p>
          {logLines.length ? (
            logLines.map((l, i) => (
              <p key={i} className={`break-all ${i % 2 ? 'text-xp' : ''}`}>
                {l}
              </p>
            ))
          ) : (
            <p className="text-white/50">{result?.status === 'error' ? 'crontab: errors in crontab file, can’t install.' : 'Waiting for the first run…'}</p>
          )}
        </div>
      </div>
      {animating ? (
        <button type="button" className="btn btn-ghost mt-2 text-xs" onClick={() => ran && finish(ran)}>
          <FaForward aria-hidden /> Skip to the result
        </button>
      ) : null}

      {/* Verdict */}
      <div aria-live="polite" className="mt-4">
        {result?.status === 'error' ? (
          <div className="rounded-xl border-2 border-danger/60 bg-danger-soft p-4">
            <p className="flex items-center gap-2 font-bold text-danger-dark">
              <FaTimesCircle aria-hidden /> cron can’t run this line yet
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {finished && ran && ran.correct ? (
          <div className="anim-pop rounded-xl border-2 border-ok/60 bg-teal-soft p-4">
            <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-ok">
              <FaCheckCircle aria-hidden /> Backup complete! <Stars count={earned} onLight />
            </p>
            <p className="mt-1">
              <strong>{ran.meaning}</strong>, backing up {ran.targets.join(', ')}. That is {ran.perWeek >= 1000 ? 'over 1,000' : ran.perWeek} run{ran.perWeek === 1 ? '' : 's'} a week, exactly what the
              ticket asked for.
            </p>
            <p className="mt-1 text-sm text-ink/75">
              {firstSolve ? `+${XP.challenge} XP. ` : ''}
              {earned < 3 ? 'Solve it again without hints for 3 stars.' : 'No hints needed. Great work!'}
              {best > earned ? ` Your best is still ${best} stars.` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {index + 1 < CRON_CHALLENGES.length ? (
                <button type="button" className="btn btn-primary" onClick={() => pick(index + 1)}>
                  Next ticket <FaArrowRight aria-hidden />
                </button>
              ) : (
                <p className="font-bold text-navy">That was the last ticket. The whole network is backed up!</p>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => pick(index)}>
                <FaRedo aria-hidden /> Try again
              </button>
            </div>
          </div>
        ) : null}

        {finished && ran && !ran.correct ? (
          <div className="anim-pop rounded-xl border-2 border-amber/70 bg-amber-soft p-4">
            <p className="flex items-center gap-2 font-bold text-amber-dark">
              <FaTimesCircle aria-hidden /> It ran, but it’s not the job on the ticket
            </p>
            {ran.meaning ? (
              <p className="mt-1">
                Your line means: <strong>{ran.meaning}</strong>.
              </p>
            ) : null}
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {ran.feedback.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Hints */}
      <div className="mt-4 rounded-xl border-2 border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-navy">
            <FaLightbulb className="mr-1 inline text-amber-dark" aria-hidden /> Hints ({hints}/3)
          </p>
          {hints < 3 ? (
            <button type="button" className="btn btn-ghost text-xs" onClick={() => setHints((h) => h + 1)}>
              {hints === 2 ? 'Show the answer' : `Show hint ${hints + 1}`}
            </button>
          ) : null}
          <span className="text-sm text-ink/70">{hints === 0 ? 'No hints: 3 stars.' : hints < 3 ? 'With hints: 2 stars.' : 'Answer shown: 1 star.'}</span>
        </div>
        {hints > 0 ? (
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {challenge.hints.slice(0, Math.min(hints, 2)).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
        ) : null}
        {hints >= 3 ? (
          <div className="mt-3 rounded-lg bg-navy p-3 text-white">
            <p className="pixel-label text-amber">Answer</p>
            <p className="mt-1 font-mono text-sm break-all sm:text-base">{challenge.answer}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn bg-white text-xs text-navy" onClick={copyAnswer} aria-label={copied ? 'Copied to clipboard' : 'Copy the answer'}>
                {copied ? <FaCheck aria-hidden /> : <FaCopy aria-hidden />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                className="btn btn-primary text-xs"
                onClick={() => {
                  setLine(challenge.answer)
                  input.current?.focus()
                }}
              >
                <FaPaste aria-hidden /> Paste into the box
              </button>
            </div>
            <p className="mt-2 text-sm text-white/80">Read it field by field before you run it: can you say what each part does?</p>
          </div>
        ) : null}
      </div>
    </DemoFrame>
  )
}
