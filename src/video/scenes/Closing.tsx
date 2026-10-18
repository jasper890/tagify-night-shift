import { interpolate, useCurrentFrame } from 'remotion'
import { FaArrowRight, FaBookOpen, FaCheckDouble, FaClipboardCheck, FaFileAlt, FaFlask, FaTerminal, FaUserShield } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import { Headline, Kicker, Reveal, Scene, Sfx, glass, typed, useLit, type SceneProps } from '../primitives'
import { C, GRAD_COOL, GRAD_WARM, MONO, PIXEL, pxShadow } from '../theme'
import { BrandMark } from './Opening'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

const HABITS: { icon: IconType; title: string; sub: string; grad: string; word: string }[] = [
  { icon: FaFileAlt, title: 'Log everything', sub: 'The time, what happened, and whether it worked.', grad: GRAD_WARM, word: 'log' },
  { icon: FaCheckDouble, title: 'Verify the result', sub: 'Check the output exists, not just that the job ran.', grad: GRAD_COOL, word: 'verify' },
  { icon: FaUserShield, title: 'Least privilege', sub: 'Every job gets only the access it needs.', grad: GRAD_WARM, word: 'least' },
]

function HabitCard({ h, i, at }: { h: (typeof HABITS)[number]; i: number; at: number }) {
  const lit = useLit(at, 12)
  return (
    <Reveal at={4 + i * 3} y={30}>
      <div
        style={{
          ...glass,
          width: 520,
          height: 440,
          padding: 44,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          opacity: lit > 0.5 ? 1 : 0.5,
          transform: `translateY(${lit > 0.5 ? -14 : 0}px)`,
          borderColor: lit > 0.5 ? C.amber : C.frame,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', width: 120, height: 120 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 0, background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 0, background: h.grad, opacity: lit > 0.5 ? 1 : 0, border: `5px solid ${C.bg}` }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <h.icon size={58} color={lit > 0.5 ? '#1a1c2c' : C.ink} />
            </div>
          </div>
          <div style={{ fontFamily: PIXEL, fontSize: 56, color: 'rgba(255,255,255,0.15)' }}>0{i + 1}</div>
        </div>
        <div style={{ fontFamily: PIXEL, fontSize: 34, lineHeight: 1.45, textShadow: pxShadow(34) }}>{h.title}</div>
        <div style={{ fontSize: 30, color: C.dim, lineHeight: 1.35 }}>{h.sub}</div>
      </div>
    </Reveal>
  )
}

/** Three habit cards; each lights up as the narrator names it. */
export function Habits({ duration, cue }: SceneProps) {
  return (
    <Scene duration={duration}>
      {HABITS.map((h, i) => (
        <Sfx key={h.word} name={(['blip3', 'blip4', 'blip5'] as const)[i]} at={cue(h.word)} volume={0.4} />
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50 }}>
        <Headline
          size={110}
          parts={[
            { t: 'Three habits', at: 0 },
            { t: 'to trust a job.', at: cue('three'), grad: GRAD_WARM },
          ]}
        />
        <div style={{ display: 'flex', gap: 36 }}>
          {HABITS.map((h, i) => (
            <HabitCard key={h.word} h={h} i={i} at={cue(h.word)} />
          ))}
        </div>
      </div>
    </Scene>
  )
}

const FEATURES: [IconType, string, string, string][] = [
  [FaBookOpen, '8 stages', 'One short lesson each, slide by slide', 'lessons'],
  [FaFlask, 'Training demos', 'Build cron lines, decode results', 'simulators'],
  [FaTerminal, 'Terminal Lab dungeons', 'Type real commands, safely', 'terminal'],
  [FaClipboardCheck, 'Boss battles & XP', 'Every quiz is a boss fight', 'quizzes'],
]

const TERM: { at: number; text: string; color: string; prompt?: boolean }[] = [
  { at: 8, text: 'crontab -e', color: '#fff', prompt: true },
  { at: 30, text: '30 1 * * * /home/student/lab/backup.sh', color: C.amber },
  { at: 50, text: 'timewarp 6h', color: '#fff', prompt: true },
  { at: 72, text: '⏩ Sat 21:00 → Sun 03:00', color: '#8ab4ff' },
  { at: 86, text: '   01:30 cron ran backup.sh  ✓ exit 0', color: '#d6deeb' },
  { at: 104, text: '✔ Step complete!  +10 XP', color: C.ok },
]
const PROMPT_SPEED = 0.6

export function Site({ duration, cue }: SceneProps) {
  const f = useCurrentFrame()
  return (
    <Scene duration={duration}>
      {TERM.filter((l) => l.prompt).map((l) => (
        <Sfx key={l.at} name="typing" at={l.at} dur={Math.ceil(l.text.length / PROMPT_SPEED)} volume={0.5} />
      ))}
      <Sfx name="chime" at={104} volume={0.35} />
      {FEATURES.map(([, , , w]) => (
        <Sfx key={w} name="tap" at={cue(w)} volume={0.3} />
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 90 }}>
        <div style={{ width: 720 }}>
          <Kicker>This website</Kicker>
          <Headline
            size={120}
            align="left"
            style={{ marginTop: 10 }}
            parts={[
              { t: 'Learn it', at: 0 },
              { t: 'by doing.', at: cue('doing'), grad: GRAD_WARM, br: true },
            ]}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 36 }}>
            {FEATURES.map(([Icon, t, d, w], i) => (
              <Reveal key={t} at={cue(w)} y={20}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
                  <div
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: C.window,
                      border: `5px solid ${C.frame}`,
                    }}
                  >
                    <Icon size={36} color={i % 2 ? C.teal : C.amber} />
                  </div>
                  <div>
                    <div style={{ fontSize: 38 }}>{t}</div>
                    <div style={{ fontSize: 27, color: C.dim }}>{d}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal at={0} y={40}>
          <div style={{ ...glass, width: 900, height: 540, borderRadius: 0, overflow: 'hidden', background: C.night }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 26px', borderBottom: `6px solid ${C.frame}`, background: C.window }}>
              {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                <span key={c} style={{ width: 18, height: 18, borderRadius: 0, background: c }} />
              ))}
              <span style={{ marginLeft: 16, fontSize: 22, color: C.dim, fontFamily: MONO }}>Terminal Lab · Schedule it with cron</span>
            </div>
            <div style={{ padding: '30px 34px', fontFamily: MONO, fontSize: 27, lineHeight: 1.8 }}>
              {TERM.filter((l) => f >= l.at).map((l) => (
                <div key={l.at} style={{ color: l.color, opacity: l.prompt ? 1 : interpolate(f, [l.at, l.at + 6], [0, 1], clamp), whiteSpace: 'pre' }}>
                  {l.prompt ? <span style={{ color: '#7ee0a1' }}>student@lab:~$ </span> : null}
                  {l.prompt ? typed(l.text, f, l.at, PROMPT_SPEED) : l.text}
                </div>
              ))}
              <span style={{ color: '#7ee0a1', opacity: Math.floor(f / 12) % 2 ? 1 : 0 }}>▋</span>
            </div>
          </div>
        </Reveal>
      </div>
    </Scene>
  )
}

export function End({ duration, cue }: SceneProps) {
  const f = useCurrentFrame()
  const glow = useLit(cue('lesson'), 14)
  return (
    <Scene duration={duration} fadeOut={false}>
      <Sfx name="hit" at={cue('start')} volume={0.4} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <BrandMark size={170} at={0} />
        <Headline
          size={96}
          parts={[
            { t: 'Task Scheduling', at: 2 },
            { t: '& Automation', at: 6, grad: GRAD_WARM },
          ]}
        />
        <Reveal at={cue('start')} y={20}>
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '26px 54px',
              borderRadius: 0,
              background: C.amber,
              color: '#1a1c2c',
              fontFamily: PIXEL,
              fontSize: 34,
              border: `6px solid ${C.bg}`,
              boxShadow: `inset -8px -8px 0 0 rgba(0,0,0,0.22), 12px 12px 0 0 rgba(0,0,0,0.45)`,
              transform: `translateY(${glow > 0 && glow < 1 ? 6 : 0}px)`,
            }}
          >
            <span style={{ opacity: Math.floor(f / 12) % 2 ? 1 : 0.2 }}>▶</span> Press start: Lesson 1 <FaArrowRight />
          </div>
        </Reveal>
        <Reveal at={cue('one') + 8}>
          <div style={{ fontSize: 32, color: C.dim, marginTop: 16 }}>
            A sysadmin quest by <span style={{ color: C.amber }}>Tagify Group</span>
          </div>
        </Reveal>
      </div>
    </Scene>
  )
}
