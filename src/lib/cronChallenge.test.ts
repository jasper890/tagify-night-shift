import { describe, expect, it } from 'vitest'
import { BACKUP_LOG, BACKUP_SCRIPT, CRON_CHALLENGES, DEVICES, GROUPS } from '../data/cronChallenges'
import { FIELD_SPECS } from './cron'
import { challengeStars, checkChallenge, checkLog, clockParts, cronLogLine, expandField, SIM_START, targetsFor, type Ran } from './cronChallenge'

const byId = (id: string) => CRON_CHALLENGES.find((c) => c.id === id)!
const ran = (line: string, id: string) => {
  const r = checkChallenge(line, byId(id))
  expect(r.status, JSON.stringify(r)).toBe('ran')
  return r as Ran
}
const problems = (line: string, id = 'nightly') => {
  const r = checkChallenge(line, byId(id))
  expect(r.status).toBe('error')
  return r.status === 'error' ? r.problems.join(' ') : ''
}
const spec = (key: string) => FIELD_SPECS.find((s) => s.key === key)!
const S = BACKUP_SCRIPT

describe('challenge data', () => {
  it('gives every challenge a unique id', () => {
    expect(new Set(CRON_CHALLENGES.map((c) => c.id)).size).toBe(CRON_CHALLENGES.length)
  })

  it('accepts every challenge’s own answer', () => {
    for (const c of CRON_CHALLENGES) {
      const r = checkChallenge(c.answer, c)
      expect(r.status === 'ran' && r.correct, c.id).toBe(true)
    }
  })

  it('does not accept any starting line as it is', () => {
    for (const c of CRON_CHALLENGES) {
      const r = checkChallenge(c.start, c)
      expect(r.status === 'ran' && r.correct, c.id).toBe(false)
    }
  })

  it('only uses known devices in groups', () => {
    for (const ids of Object.values(GROUPS)) for (const id of ids) expect(DEVICES.some((d) => d.id === id)).toBe(true)
  })
})

describe('checkChallenge', () => {
  it('accepts other ways to write the same schedule', () => {
    expect(ran(`30 18 * * MON-FRI ${S} lab`, 'lab').correct).toBe(true)
    expect(ran(`30 18 * * 1,2,3,4,5 ${S} lab`, 'lab').correct).toBe(true)
    expect(ran(`0 3 * * 7 ${S} mail`, 'weekly').correct).toBe(true)
    expect(ran(`0 3 * * SUN ${S} mail`, 'weekly').correct).toBe(true)
    expect(ran(`0,15,30,45 * * * * ${S} web`, 'often').correct).toBe(true)
    expect(ran(`00 02 * * * ~/lab/backup.sh files`, 'nightly').correct).toBe(true)
  })

  it('explains the big mistake without giving the answer away', () => {
    const r = ran(`* 2 * * * ${S} db`, 'flood')
    expect(r.correct).toBe(false)
    expect(r.perWeek).toBe(420)
    expect(r.expectedPerWeek).toBe(7)
    const text = r.feedback.join(' ')
    expect(text).toContain('420 times')
    expect(text).toContain('minute field')
    expect(text).not.toContain('0 2 * * *')
  })

  it('names the fields that are off', () => {
    const r = ran(`0 6 * * 1-5 ${S} lab`, 'lab')
    expect(r.feedback.join(' ')).toContain('Check the minute, hour fields.')
  })

  it('runs the line on the pretend clock', () => {
    const r = ran(`0 2 * * * ${S} files`, 'nightly')
    expect(r.runs.map((d) => d.toISOString())).toEqual(['2026-02-01T02:00:00.000Z', '2026-02-02T02:00:00.000Z', '2026-02-03T02:00:00.000Z'])
    expect(r.meaning).toBe('At 02:00 AM')
  })

  it('backs up the device you typed, even the wrong one', () => {
    const r = ran(`0 2 * * * ${S} lab2`, 'nightly')
    expect(r.correct).toBe(false)
    expect(r.targets).toEqual(['lab2'])
    expect(r.feedback[0]).toBe('You backed up lab2, but this job is for files.')
  })

  it('expands group names', () => {
    expect(targetsFor('lab')).toEqual(['lab1', 'lab2', 'lab3'])
    expect(targetsFor('LAB1')).toEqual(['lab1'])
    expect(targetsFor('printer')).toBeNull()
  })

  it('needs a full path to the script', () => {
    expect(problems('0 2 * * * backup.sh files')).toContain('not a full path')
    expect(problems('0 2 * * * ./backup.sh files')).toContain('not a full path')
    expect(problems('0 2 * * * /tmp/backup.sh files')).toContain('There is no script')
  })

  it('needs a known device', () => {
    expect(problems(`0 2 * * * ${S}`)).toContain('which device')
    expect(problems(`0 2 * * * ${S} printer`)).toContain('no device called "printer"')
    expect(problems(`0 2 * * * ${S} files db`)).toContain('one device name')
  })

  it('reports syntax errors before running', () => {
    expect(problems(`0 24 * * * ${S} files`)).toContain('Midnight is hour 0')
    expect(problems('0 2 * *')).toContain('five time fields')
  })

  it('checks the log redirect only where the challenge needs it', () => {
    expect(ran(`0 2 * * * ${S} files >> ${BACKUP_LOG} 2>&1`, 'nightly').correct).toBe(true)
    const missing = ran(`0 0 1 * * ${S} files`, 'monthly')
    expect(missing.correct).toBe(false)
    expect(missing.feedback.join(' ')).toContain('must keep a log')
    expect(ran(`0 0 1 * * ${S} files >>${BACKUP_LOG} 2>&1`, 'monthly').correct).toBe(true)
  })
})

describe('checkLog', () => {
  it('spots each common redirect mistake', () => {
    expect(checkLog('')).toEqual({ ok: 'none' })
    expect(checkLog(`>> ${BACKUP_LOG} 2>&1`)).toEqual({ ok: true })
    expect(checkLog(`>> ~/lab/backup.log 2>&1`)).toEqual({ ok: true })
    const msg = (rest: string) => {
      const r = checkLog(rest)
      return r.ok === false ? r.message : ''
    }
    expect(msg(`> ${BACKUP_LOG} 2>&1`)).toContain('Use >>')
    expect(msg(`>> ${BACKUP_LOG}`)).toContain('Add 2>&1')
    expect(msg(`2>&1 >> ${BACKUP_LOG}`)).toContain('Order matters')
    expect(msg('>> backup.log 2>&1')).toContain('full path')
  })
})

describe('helpers', () => {
  it('expands cron fields to the numbers they match', () => {
    expect([...expandField('*/15', spec('minute'))!]).toEqual([0, 15, 30, 45])
    expect([...expandField('MON-FRI', spec('dow'))!]).toEqual([1, 2, 3, 4, 5])
    expect([...expandField('7', spec('dow'))!]).toEqual([0])
    expect([...expandField('10/20', spec('minute'))!]).toEqual([10, 30, 50])
    expect(expandField('5-1', spec('hour'))).toBeNull()
  })

  it('rates a solve by hints used', () => {
    expect([0, 1, 2, 3].map(challengeStars)).toEqual([3, 2, 2, 1])
  })

  it('formats the pretend clock and cron log', () => {
    expect(clockParts(SIM_START)).toEqual({ day: 'SAT 31 JAN', time: '23:50' })
    expect(cronLogLine(new Date(Date.UTC(2026, 1, 1, 2, 0)), `${S} files`, 2101)).toBe(`Feb 01 02:00:00 lab CRON[2101]: (student) CMD (${S} files)`)
  })
})
