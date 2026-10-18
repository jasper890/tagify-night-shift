import { useCurrentFrame } from 'remotion'
import { FaAws, FaBolt, FaCalendarAlt, FaFilter, FaHourglassHalf, FaLink, FaListOl, FaStopwatch, FaWindows } from 'react-icons/fa'
import { SiAnsible, SiGithubactions, SiGnubash, SiGooglecloud, SiJenkins, SiKubernetes, SiLinux } from 'react-icons/si'
import { TbBrandAzure, TbBrandPowershell } from 'react-icons/tb'
import type { IconType } from 'react-icons'
import { Headline, Kicker, Reveal, Scene, Sfx, glass, useLit, type SceneProps, type SfxName } from '../primitives'
import { C, GRAD_COOL, GRAD_WARM, PIXEL, pxShadow } from '../theme'

type Tool = { icon: IconType; color: string; name: string; desc: string; word: string }

const WINDOWS: Tool[] = [
  { icon: FaWindows, color: '#0a84ff', name: 'Task Scheduler', desc: 'Triggers, conditions, retries', word: 'task' },
  { icon: TbBrandPowershell, color: '#5391fe', name: 'PowerShell', desc: 'The steps, scripted', word: 'powershell' },
]
const LINUX: Tool[] = [
  { icon: SiLinux, color: '#e0b000', name: 'cron', desc: 'Repeat on a timetable', word: 'cron' },
  { icon: FaHourglassHalf, color: '#ff9f0a', name: 'at', desc: 'Run once, later', word: 'at' },
  { icon: SiGnubash, color: '#4eaa25', name: 'Bash', desc: 'The steps, scripted', word: 'bash' },
  { icon: FaStopwatch, color: '#bf5af2', name: 'systemd timers', desc: 'cron with catch-up and logs', word: 'systemd' },
]

function ToolTile({ t, at }: { t: Tool; at: number }) {
  const lit = useLit(at, 14)
  return (
    <Reveal at={at - 2} y={24}>
      <div
        style={{
          ...glass,
          width: 470,
          height: 170,
          borderRadius: 0,
          padding: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          borderColor: lit > 0.5 ? C.amber : C.frame,
        }}
      >
        <div
          style={{
            width: 106,
            height: 106,
            flexShrink: 0,
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: t.color,
            border: `5px solid ${C.bg}`,
            boxShadow: 'inset -8px -8px 0 0 rgba(0,0,0,0.25), inset 8px 8px 0 0 rgba(255,255,255,0.2)',
          }}
        >
          <t.icon size={58} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 38, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.name}</div>
          <div style={{ fontSize: 26, color: C.dim, marginTop: 4 }}>{t.desc}</div>
        </div>
      </div>
    </Reveal>
  )
}

function GroupLabel({ icon: Icon, label, color, at }: { icon: IconType; label: string; color: string; at: number }) {
  return (
    <Reveal at={at} y={12}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: PIXEL, fontSize: 24, color, textShadow: pxShadow(24) }}>
        <Icon size={32} /> {label}
      </div>
    </Reveal>
  )
}

/** Schedulers and scripting languages that ship with the operating system, each appearing as it is named. */
export function ToolsBuiltIn({ duration, cue }: SceneProps) {
  return (
    <Scene duration={duration}>
      {[...WINDOWS, ...LINUX].map((t) => (
        <Sfx key={t.name} name="tap" at={cue(t.word)} volume={0.35} />
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <Kicker>The tools</Kicker>
        <Headline
          size={100}
          parts={[
            { t: 'Built into', at: 0 },
            { t: 'every system.', at: 4, grad: GRAD_WARM },
          ]}
        />
        <div style={{ display: 'flex', gap: 70, marginTop: 34 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <GroupLabel icon={FaWindows} label="Windows" color="#4ca8ff" at={cue('windows')} />
            {WINDOWS.map((t) => (
              <ToolTile key={t.name} t={t} at={cue(t.word)} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <GroupLabel icon={SiLinux} label="Linux" color="#f5c518" at={cue('linux')} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 470px)', gap: 22 }}>
              {LINUX.map((t) => (
                <ToolTile key={t.name} t={t} at={cue(t.word)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Scene>
  )
}

const AT_SCALE: { icons: [IconType, string][]; name: string; desc: string; word: string }[] = [
  { icons: [[SiAnsible, '#ee0000']], name: 'Ansible', desc: 'The same job on 50 servers', word: 'ansible' },
  { icons: [[SiGithubactions, '#2088ff']], name: 'GitHub Actions', desc: 'cron next to your code', word: 'github' },
  { icons: [[SiJenkins, '#d24939']], name: 'Jenkins', desc: 'Pipelines with a dashboard', word: 'jenkins' },
  { icons: [[SiKubernetes, '#326ce5']], name: 'Kubernetes CronJob', desc: 'Jobs in containers', word: 'kubernetes' },
  {
    icons: [
      [FaAws, '#ff9900'],
      [TbBrandAzure, '#0089d6'],
      [SiGooglecloud, '#4285f4'],
    ],
    name: 'Cloud schedulers',
    desc: 'No server to keep awake',
    word: 'cloud',
  },
]

function ScaleTile({ t, at, i }: { t: (typeof AT_SCALE)[number]; at: number; i: number }) {
  const f = useCurrentFrame()
  const lit = useLit(at, 14)
  const many = t.icons.length > 1
  return (
    <Reveal at={at - 2} y={40}>
      <div
        style={{
          ...glass,
          width: 316,
          height: 380,
          padding: 34,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 18,
          transform: `translateY(${Math.floor((f + i * 9) / 15) % 2 ? -6 : 0}px)`,
        }}
      >
        <div style={{ display: 'flex', gap: 14, height: 140, alignItems: 'center' }}>
          {t.icons.map(([Icon, color]) => (
            <div
              key={color}
              style={{
                width: many ? 76 : 140,
                height: many ? 76 : 140,
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${color}33`,
                border: `5px solid ${lit > 0.5 ? color : `${color}88`}`,
              }}
            >
              <Icon size={many ? 40 : 72} color={color} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.1 }}>{t.name}</div>
        <div style={{ fontSize: 26, color: C.dim, lineHeight: 1.3 }}>{t.desc}</div>
      </div>
    </Reveal>
  )
}

/** DevOps and cloud tools that schedule across many machines. */
export function ToolsScale({ duration, cue }: SceneProps) {
  return (
    <Scene duration={duration}>
      {AT_SCALE.map((t) => (
        <Sfx key={t.name} name="tap" at={cue(t.word)} volume={0.35} />
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <Kicker color={C.teal}>Beyond the basics</Kicker>
        <Headline
          size={116}
          parts={[
            { t: 'Built for', at: 0 },
            { t: 'scale.', at: cue('scale'), grad: GRAD_COOL },
          ]}
        />
        <Reveal at={cue('teams')}>
          <div style={{ fontSize: 40, color: C.dim }}>One schedule. Hundreds of machines.</div>
        </Reveal>
        <div style={{ display: 'flex', gap: 30, marginTop: 40 }}>
          {AT_SCALE.map((t, i) => (
            <ScaleTile key={t.name} t={t} at={cue(t.word)} i={i} />
          ))}
        </div>
      </div>
    </Scene>
  )
}

const IDEAS: [IconType, string, string][] = [
  [FaBolt, 'Trigger', 'trigger'],
  [FaCalendarAlt, 'Schedule', 'schedule'],
  [FaFilter, 'Condition', 'condition'],
  [FaLink, 'Dependency', 'dependency'],
  [FaListOl, 'Job queue', 'queue'],
]
const BLIPS: SfxName[] = ['blip1', 'blip2', 'blip3', 'blip4', 'blip5']

export function FiveIdeas({ duration, cue }: SceneProps) {
  return (
    <Scene duration={duration} push={0.035}>
      {IDEAS.map(([, , w], i) => (
        <Sfx key={w} name={BLIPS[i]} at={cue(w)} volume={0.38} />
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Headline size={130} parts={[{ t: 'Different tools.', at: cue('different'), color: C.dim }]} />
        <Headline size={130} parts={[{ t: 'Same five ideas.', at: cue('same'), grad: GRAD_WARM }]} />
        <div style={{ display: 'flex', gap: 24, marginTop: 60 }}>
          {IDEAS.map(([Icon, label, w], i) => (
            <Reveal key={label} at={cue(w)} y={20}>
              <div style={{ ...glass, borderRadius: 0, padding: '24px 38px', display: 'flex', alignItems: 'center', gap: 16, fontSize: 40, fontWeight: 600 }}>
                <Icon size={36} color={i % 2 ? C.teal : C.amber} /> {label}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Scene>
  )
}
