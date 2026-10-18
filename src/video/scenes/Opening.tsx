import { interpolate, useCurrentFrame } from 'remotion'
import { FaBroom, FaChartBar, FaDatabase, FaSyncAlt } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import { AnalogClock, EASE_OUT, Gradient, Headline, Kicker, Reveal, Scene, Sfx, glass, typed, useLit, type SceneProps } from '../primitives'
import { C, GRAD_COOL, GRAD_WARM, MONO, PIXEL, pxShadow } from '../theme'
import { Sprite } from '../../components/pixel/Sprite'
import { MoonClock } from '../../components/pixel/NightScene'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

function TaskChip({ icon: Icon, label, at, waitingAt }: { icon: IconType; label: string; at: number; waitingAt: number }) {
  const w = useLit(waitingAt, 16)
  return (
    <Reveal at={at} y={24}>
      <div
        style={{
          ...glass,
          borderRadius: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '22px 40px',
          fontSize: 44,
          borderColor: w > 0.5 ? C.amber : C.frame,
          background: w > 0.5 ? '#3b2a4a' : C.window,
        }}
      >
        <Icon color={C.amber} size={40} /> {label}
      </div>
    </Reveal>
  )
}

/** Cold open: the clock ticks to 2:00 AM while the chores pile up. */
export function Hook({ duration, cue }: SceneProps) {
  const f = useCurrentFrame()
  const two = cue('two')
  const times = ['1:59:57', '1:59:58', '1:59:59', '2:00:00']
  const idx = f < 14 ? 0 : f < 26 ? 1 : f < two ? 2 : 3
  const glow = useLit(two, 10)
  const tasks: [IconType, string, string][] = [
    [FaDatabase, 'Backups', 'backups'],
    [FaSyncAlt, 'Updates', 'updates'],
    [FaBroom, 'Cleanups', 'cleanups'],
    [FaChartBar, 'Reports', 'reports'],
  ]
  return (
    <Scene duration={duration}>
      <Sfx name="tick" at={2} volume={0.6} />
      <Sfx name="tick" at={14} volume={0.6} />
      <Sfx name="tick" at={26} volume={0.6} />
      <Sfx name="chime" at={two} volume={0.45} />
      {tasks.map(([, , w]) => (
        <Sfx key={w} name="tap" at={cue(w)} volume={0.35} />
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <Kicker color={C.dim}>Every night, somewhere</Kicker>
        <div
          style={{
            fontFamily: PIXEL,
            fontSize: 150,
            lineHeight: 1.2,
            textShadow: `${pxShadow(150)}${glow > 0.5 ? `, 0 0 0 ${C.bg}` : ''}`,
            transform: `scale(${glow > 0 && glow < 1 ? 1.04 : 1})`,
          }}
        >
          {idx === 3 ? <Gradient>{times[idx]}</Gradient> : times[idx]}
          <span style={{ fontSize: 56, color: C.dim, marginLeft: 30 }}>AM</span>
        </div>
        <div style={{ display: 'flex', gap: 28, marginTop: 10, minHeight: 110 }}>
          {tasks.map(([Icon, label, w]) => (
            <TaskChip key={label} icon={Icon} label={label} at={cue(w)} waitingAt={cue('waiting')} />
          ))}
        </div>
      </div>
    </Scene>
  )
}

export function Question({ duration, cue }: SceneProps) {
  return (
    <Scene duration={duration} push={0.05}>
      <Headline
        size={170}
        parts={[
          { t: 'What', at: cue('what') },
          { t: 'if', at: cue('if') },
          { t: 'they', at: cue('they') },
          { t: 'ran themselves?', at: cue('ran'), grad: GRAD_WARM, br: true },
        ]}
      />
    </Scene>
  )
}

export function BrandMark({ size = 260, at = 0 }: { size?: number; at?: number }) {
  const f = useCurrentFrame()
  const p = interpolate(f, [at, at + 20], [0, 1], { ...clamp, easing: EASE_OUT })
  const g = interpolate(f, [at + 8, at + 26], [0, 1], clamp)
  const step = (v: number) => Math.floor(v * 4) / 4
  return (
    <div style={{ position: 'relative', width: size * 1.25, height: size * 1.05 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: step(p), transform: `translateY(${Math.round((1 - step(p)) * 30)}px)` }}>
        <MoonClock size={size} />
      </div>
      <div style={{ position: 'absolute', right: 0, bottom: 0, opacity: step(g), transform: `translateY(${Math.floor(f / 8) % 2 ? -6 : 0}px)` }}>
        <Sprite id="hero" size={size * 0.5} />
      </div>
    </div>
  )
}

export function Title({ duration, cue }: SceneProps) {
  const task = cue('task')
  return (
    <Scene duration={duration}>
      <Sfx name="swell" at={task - 52} volume={0.45} />
      <Sfx name="hit" at={task} volume={0.55} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
        <BrandMark at={4} />
        <Headline
          size={132}
          parts={[
            { t: 'Task Scheduling', at: task },
            { t: '& Automation', at: cue('automation'), grad: GRAD_WARM, br: true },
          ]}
        />
        <Reveal at={cue('automation') + 10}>
          <div style={{ fontSize: 42, color: C.dim }}>Let computers do the repetitive work. On time, every time.</div>
        </Reveal>
      </div>
    </Scene>
  )
}

const SCRIPT = `#!/bin/bash
tar -czf backup.tar.gz ~/lab
echo "$(date) OK" >> backup.log`
const TYPE_SPEED = 1

/** Scheduling = when, automation = how. */
export function WhenHow({ duration, cue }: SceneProps) {
  const f = useCurrentFrame()
  const typeAt = cue('script')
  const typeLen = Math.ceil(SCRIPT.length / TYPE_SPEED)
  const when = useLit(cue('when'))
  const how = useLit(cue('how'))
  const panel = { ...glass, width: 640, height: 520, padding: 50, display: 'flex', flexDirection: 'column' as const, gap: 12 }
  return (
    <Scene duration={duration}>
      <Sfx name="tap" at={cue('scheduling')} volume={0.4} />
      <Sfx name="tap" at={cue('automation')} volume={0.4} />
      <Sfx name="typing" at={typeAt} dur={typeLen} volume={0.55} />
      <Sfx name="chime" at={cue('together')} volume={0.35} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 50 }}>
          <Reveal at={cue('scheduling')} y={40}>
            <div style={{ ...panel, borderColor: when > 0.5 ? C.amber : C.frame }}>
              <Kicker>Scheduling</Kicker>
              <div style={{ fontFamily: PIXEL, fontSize: 64, lineHeight: 1.5, textShadow: pxShadow(64), opacity: when > 0.5 ? 1 : 0.35 }}>
                <Gradient>When.</Gradient>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AnalogClock size={220} hour={1} minute={(f * 1.2) % 60} />
              </div>
            </div>
          </Reveal>
          <Reveal at={cue('automation') - 4} y={0}>
            <div style={{ fontFamily: PIXEL, fontSize: 70, color: C.dim, textShadow: pxShadow(70) }}>+</div>
          </Reveal>
          <Reveal at={cue('automation')} y={40}>
            <div style={{ ...panel, borderColor: how > 0.5 ? C.teal : C.frame }}>
              <Kicker color={C.teal}>Automation</Kicker>
              <div style={{ fontFamily: PIXEL, fontSize: 64, lineHeight: 1.5, textShadow: pxShadow(64), opacity: how > 0.5 ? 1 : 0.35 }}>
                <Gradient bg={GRAD_COOL}>How.</Gradient>
              </div>
              <pre
                style={{
                  flex: 1,
                  margin: 0,
                  marginTop: 8,
                  padding: 26,
                  borderRadius: 0,
                  background: C.night,
                  border: `4px solid ${C.bg}`,
                  fontFamily: MONO,
                  fontSize: 23,
                  lineHeight: 1.65,
                  color: '#d6deeb',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {typed(SCRIPT, f, typeAt, TYPE_SPEED)}
                <span style={{ opacity: Math.floor(f / 12) % 2 ? 1 : 0, color: C.teal }}>▋</span>
              </pre>
            </div>
          </Reveal>
        </div>
        <Headline
          size={72}
          weight={700}
          parts={[
            { t: 'Together,', at: cue('together') },
            { t: 'the job runs itself.', at: cue('job', 1), grad: GRAD_WARM },
          ]}
        />
      </div>
    </Scene>
  )
}
