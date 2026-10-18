import { interpolate, useCurrentFrame } from 'remotion'
import { FaBolt, FaCheck, FaCheckCircle, FaClock, FaCode, FaFileAlt } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import { EASE_OUT, Headline, Kicker, Reveal, Scene, Sfx, glass, useLit, type SceneProps, type SfxName } from '../primitives'
import { C, GRAD_COOL, GRAD_WARM, MONO, PIXEL, pxShadow } from '../theme'
import { Sprite } from '../../components/pixel/Sprite'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const BLIPS: SfxName[] = ['blip1', 'blip2', 'blip3', 'blip4', 'blip5']

const STEPS: { icon: IconType; title: string; desc: string; word: string }[] = [
  { icon: FaBolt, title: 'Trigger', desc: '1:30 AM arrives', word: 'trigger' },
  { icon: FaClock, title: 'Scheduler', desc: 'cron wakes up', word: 'scheduler' },
  { icon: FaCode, title: 'Script', desc: 'backup.sh runs', word: 'script' },
  { icon: FaFileAlt, title: 'Log', desc: 'writes what happened', word: 'log' },
  { icon: FaCheckCircle, title: 'Verify', desc: 'the backup file exists', word: 'verifies' },
]
const CARD_W = 290
const GAP = 50

function StepCard({ step, at, activeAt }: { step: (typeof STEPS)[number]; at: number; activeAt: number }) {
  const a = useLit(activeAt, 10)
  const Icon = step.icon
  return (
    <Reveal at={at} y={30}>
      <div
        style={{
          ...glass,
          background: a > 0.5 ? '#29366f' : C.window,
          width: CARD_W,
          height: 330,
          padding: 36,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
          opacity: a > 0.5 ? 1 : 0.6,
          transform: `translateY(${a > 0.5 ? -12 : 0}px)`,
          borderColor: a > 0.5 ? C.amber : C.frame,
        }}
      >
        <div style={{ position: 'relative', width: 110, height: 110 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 0, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 0, background: GRAD_WARM, opacity: a > 0.5 ? 1 : 0, border: `5px solid ${C.bg}` }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={48} color={a > 0.5 ? '#1a1c2c' : C.ink} />
          </div>
        </div>
        <div style={{ fontFamily: PIXEL, fontSize: 26, lineHeight: 1.4, textShadow: pxShadow(26) }}>{step.title}</div>
        <div style={{ fontSize: 26, color: C.dim, lineHeight: 1.3 }}>{step.desc}</div>
      </div>
    </Reveal>
  )
}

/** The five steps light up one by one as the narrator names them; a glowing dot carries the job along. */
export function Pipeline({ duration, cue }: SceneProps) {
  const f = useCurrentFrame()
  const act = STEPS.map((s) => cue(s.word))
  const p = interpolate(f, [act[0] - 10, ...act], [0, 0, 0.25, 0.5, 0.75, 1], { ...clamp, easing: EASE_OUT })
  const trackW = (STEPS.length - 1) * (CARD_W + GAP)
  const done = act[4] + 16
  return (
    <Scene duration={duration}>
      {act.map((a, i) => (
        <Sfx key={i} name={BLIPS[i]} at={a} volume={0.4} />
      ))}
      <Sfx name="chime" at={done} volume={0.4} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
        <Kicker>How it works</Kicker>
        <Headline
          size={100}
          parts={[
            { t: 'Every job.', at: cue('every') },
            { t: 'Five steps.', at: cue('five'), grad: GRAD_WARM },
          ]}
        />
        <div style={{ position: 'relative', marginTop: 40 }}>
          <div style={{ position: 'absolute', left: CARD_W / 2, top: -6, width: trackW, height: 8, borderRadius: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.25) 0 16px, transparent 16px 28px)' }} />
          <div style={{ position: 'absolute', left: CARD_W / 2, top: -6, width: trackW * p, height: 8, borderRadius: 0, background: GRAD_WARM }} />
          <div
            style={{
              position: 'absolute',
              left: Math.round((CARD_W / 2 + trackW * p - 32) / 6) * 6,
              top: -66,
              opacity: interpolate(f, [act[0] - 12, act[0] - 4, done, done + 10], [0, 1, 1, 0], clamp) > 0.5 ? 1 : 0,
              transform: `translateY(${Math.floor(f / 5) % 2 ? -6 : 0}px)`,
              zIndex: 2,
            }}
          >
            <Sprite id="hero" size={64} />
          </div>
          <div style={{ display: 'flex', gap: GAP, position: 'relative' }}>
            {STEPS.map((s, i) => (
              <StepCard key={s.title} step={s} at={4 + i * 3} activeAt={act[i]} />
            ))}
          </div>
        </div>
        <Reveal at={done} y={16}>
          <div
            style={{
              marginTop: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '18px 36px',
              borderRadius: 0,
              background: C.night,
              border: `5px solid ${C.ok}`,
              boxShadow: `0 0 0 5px ${C.bg}`,
              color: C.ok,
              fontSize: 34,
              fontWeight: 600,
              fontFamily: MONO,
            }}
          >
            <FaCheck /> exit 0 · backup verified <span style={{ fontFamily: PIXEL, fontSize: 22, color: C.amber, marginLeft: 12 }}>+50 XP</span>
          </div>
        </Reveal>
      </div>
    </Scene>
  )
}

const FIELDS = [
  { v: '30', label: 'minute', means: 'at :30', name: ['minute', 0], value: ['thirty', 0] },
  { v: '1', label: 'hour', means: '1 AM', name: ['hour', 0], value: ['one', 0] },
  { v: '*', label: 'day', means: 'every day', name: ['day', 0], value: ['star', 0] },
  { v: '*', label: 'month', means: 'every month', name: ['month', 0], value: ['star', 1] },
  { v: '*', label: 'weekday', means: 'any weekday', name: ['weekday', 0], value: ['star', 2] },
] as const

function CronField({ fd, nameAt, valueAt }: { fd: (typeof FIELDS)[number]; nameAt: number; valueAt: number }) {
  const named = useLit(nameAt, 10)
  const valued = useLit(valueAt, 10)
  return (
    <div style={{ width: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div
        style={{
          fontFamily: PIXEL,
          fontSize: 104,
          lineHeight: '160px',
          color: named > 0.5 ? C.amber : C.ink,
          opacity: named > 0.5 ? 1 : 0.45,
          textShadow: pxShadow(104, valued > 0.5 ? C.pink : C.bg),
          transform: `translateY(${valued > 0 && valued < 1 ? -8 : 0}px)`,
        }}
      >
        {fd.v}
      </div>
      <div style={{ width: 130, height: 10, borderRadius: 0, background: GRAD_WARM, transform: `scaleX(${Math.floor(named * 4) / 4})` }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: C.ink, opacity: named, transform: `translateY(${(1 - named) * 12}px)` }}>{fd.label}</div>
        <div style={{ fontSize: 24, color: C.amber, opacity: valued, transform: `translateY(${(1 - valued) * 12}px)` }}>{fd.means}</div>
      </div>
    </div>
  )
}

/** Each cron field lights up as it is named, then gets its meaning as the narrator reads the line. */
export function Cron({ duration, cue }: SceneProps) {
  return (
    <Scene duration={duration}>
      {FIELDS.map((fd, i) => (
        <Sfx key={`n${i}`} name={BLIPS[i]} at={cue(fd.name[0], fd.name[1])} volume={0.35} />
      ))}
      {FIELDS.map((fd, i) => (
        <Sfx key={`v${i}`} name="tap" at={cue(fd.value[0], fd.value[1])} volume={0.35} />
      ))}
      <Sfx name="chime" at={cue('every')} volume={0.4} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
        <Kicker color={C.teal} at={0}>
          Speaking cron
        </Kicker>
        <Reveal at={2}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 26, fontFamily: MONO }}>
            {FIELDS.map((fd) => (
              <CronField key={fd.label} fd={fd} nameAt={cue(fd.name[0], fd.name[1])} valueAt={cue(fd.value[0], fd.value[1])} />
            ))}
            <div style={{ fontSize: 76, lineHeight: '160px', color: C.dim, marginLeft: 30 }}>backup.sh</div>
          </div>
        </Reveal>
        <Headline
          size={100}
          parts={[
            { t: 'Every day at', at: cue('every') },
            { t: '1:30 AM.', at: cue('one', 1), grad: GRAD_WARM },
          ]}
        />
      </div>
    </Scene>
  )
}

const EVENTS = [
  { h: 22, t: '22:00', name: 'Clear the lab PCs', tool: 'Task Scheduler', word: 'lab' },
  { h: 25.5, t: '01:30', name: 'Back up the database', tool: 'cron', word: 'database' },
  { h: 26, t: '02:00', name: 'Patch 50 servers', tool: 'Ansible', word: 'servers' },
  { h: 30, t: '06:00', name: 'Email the health report', tool: 'GitHub Actions', word: 'report' },
]

function polar(cx: number, h: number, R: number) {
  const a = ((h % 24) / 24) * Math.PI * 2
  return [cx + Math.sin(a) * R, cx - Math.cos(a) * R] as const
}

function arc(cx: number, R: number, h0: number, h1: number) {
  const [x0, y0] = polar(cx, h0, R)
  const [x1, y1] = polar(cx, h1, R)
  const large = (h1 - h0) / 24 > 0.5 ? 1 : 0
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`
}

function EventRow({ e, at, doneAt }: { e: (typeof EVENTS)[number]; at: number; doneAt: number }) {
  const done = useLit(doneAt, 10)
  return (
    <Reveal at={at} y={16}>
      <div
        style={{
          ...glass,
          borderRadius: 0,
          padding: '10px 26px',
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          opacity: done > 0.5 ? 1 : 0.6,
          borderColor: done > 0.5 ? C.ok : C.frame,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 32, color: C.amber, width: 110 }}>{e.t}</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 32, fontWeight: 600 }}>{e.name}</span>
          <span style={{ fontSize: 24, color: C.dim }}>{e.tool}</span>
        </span>
        <span
          style={{
            width: 50,
            height: 50,
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: done > 0.5 ? C.ok : 'rgba(255,255,255,0.08)',
            border: `4px solid ${C.bg}`,
          }}
        >
          <FaCheck size={24} color={done > 0.5 ? '#000' : 'rgba(255,255,255,0.25)'} />
        </span>
      </div>
    </Reveal>
  )
}

/** A 24-hour dial: the hand sweeps through the night and each job completes as it is mentioned. */
export function Orbit({ duration, cue }: SceneProps) {
  const f = useCurrentFrame()
  const act = EVENTS.map((e) => cue(e.word))
  const h = interpolate(f, [0, ...act, duration], [21, 22, 25.5, 26, 30, 30.6], { ...clamp, easing: EASE_OUT })
  const S = 700
  const cx = S / 2
  const R = 290
  const hh = Math.floor(h % 24)
  const mm = Math.floor((h % 1) * 60)
  return (
    <Scene duration={duration}>
      {act.map((a, i) => (
        <Sfx key={i} name={i === 3 ? 'chime' : BLIPS[i + 1]} at={a} volume={0.38} />
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 100 }}>
        <div style={{ width: 760 }}>
          <Kicker>24 hours</Kicker>
          <Headline
            size={96}
            align="left"
            style={{ marginTop: 8 }}
            parts={[
              { t: 'While you', at: cue('while') },
              { t: 'sleep.', at: cue('sleep'), grad: GRAD_COOL, br: true },
            ]}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 22 }}>
            {EVENTS.map((e, i) => (
              <EventRow key={e.t} e={e} at={4 + i * 3} doneAt={act[i]} />
            ))}
          </div>
        </div>
        <Reveal at={0}>
          <svg width={560} height={560} viewBox={`0 0 ${S} ${S}`}>
            <defs>
              <linearGradient id="trail" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={C.teal} />
                <stop offset="1" stopColor={C.blue} />
              </linearGradient>
            </defs>
            <circle cx={cx} cy={cx} r={R} fill={C.night} stroke={C.frame} strokeWidth={8} />
            <path d={arc(cx, R, 21, 31)} stroke="rgba(79,140,255,0.18)" strokeWidth={40} fill="none" strokeLinecap="round" />
            {h > 21.02 ? <path d={arc(cx, R, 21, h)} stroke="url(#trail)" strokeWidth={10} fill="none" strokeLinecap="round" /> : null}
            {Array.from({ length: 24 }, (_, i) => {
              const [x0, y0] = polar(cx, i, R - 26)
              const [x1, y1] = polar(cx, i, R - (i % 6 ? 40 : 56))
              return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={i % 6 ? 'rgba(255,255,255,0.25)' : C.ink} strokeWidth={i % 6 ? 2 : 4} strokeLinecap="round" />
            })}
            {[0, 6, 12, 18].map((n) => {
              const [x, y] = polar(cx, n, R + 40)
              return (
                <text key={n} x={x} y={y + 10} textAnchor="middle" fill={C.dim} fontSize={28} fontFamily={MONO}>
                  {String(n).padStart(2, '0')}
                </text>
              )
            })}
            {EVENTS.map((e, i) => {
              const pop = interpolate(f, [act[i], act[i] + 18], [0, 1], clamp)
              const [x, y] = polar(cx, e.h, R)
              return (
                <g key={e.t}>
                  <circle cx={x} cy={y} r={14 + 34 * pop} fill={C.ok} opacity={pop > 0 ? 0.35 * (1 - pop) : 0} />
                  <circle cx={x} cy={y} r={14} fill={pop > 0 ? C.ok : '#1c1c1e'} stroke={pop > 0 ? '#fff' : 'rgba(255,255,255,0.5)'} strokeWidth={4} />
                </g>
              )
            })}
            {(() => {
              const [x, y] = polar(cx, h, R - 70)
              return <line x1={cx} y1={cx} x2={x} y2={y} stroke="#fff" strokeWidth={8} strokeLinecap="round" />
            })()}
            <circle cx={cx} cy={cx} r={12} fill="#fff" />
            <text x={cx} y={cx + 110} textAnchor="middle" fill={C.amber} fontSize={44} fontFamily={PIXEL}>
              {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}
            </text>
          </svg>
        </Reveal>
      </div>
    </Scene>
  )
}
