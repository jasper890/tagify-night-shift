import { describe, expect, it } from 'vitest'
import { analyzeCron, describeSchedule, findRelativePath, nextRuns } from './cron'

const ids = (line: string) => analyzeCron(line).issues.map((i) => i.id)

describe('analyzeCron', () => {
  it('accepts the slide 11 example with a full path', () => {
    const result = analyzeCron('30 18 * * 1-5 /home/student/lab/backup.sh')
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.schedule).toBe('30 18 * * 1-5')
  })

  it('accepts all slide 12 presets', () => {
    for (const s of ['*/15 * * * *', '0 * * * *', '0 2 * * *', '30 18 * * 1-5', '0 3 * * 0', '0 0 1 * *']) {
      expect(analyzeCron(s).issues).toEqual([])
    }
  })

  it('warns that * 2 * * * runs 60 times and suggests 0 2 * * *', () => {
    const issue = analyzeCron('* 2 * * *').issues.find((i) => i.id === 'minute-star')
    expect(issue).toBeDefined()
    expect(issue!.message).toContain('60 times')
    expect(issue!.suggestion).toBe('0 2 * * *')
  })

  it('does not warn about * minute when the hour is also *', () => {
    expect(ids('* * * * *')).not.toContain('minute-star')
  })

  it('warns when both day of month and day of week are restricted', () => {
    expect(ids('0 0 1 * 1')).toContain('dom-dow-or')
    expect(ids('0 0 1 * *')).not.toContain('dom-dow-or')
  })

  it('warns about an unescaped % in the command', () => {
    expect(ids('0 2 * * * /bin/tar -czf /home/student/lab/b-$(date +%F).tgz /home/student/lab/data')).toContain('percent')
    expect(ids('0 2 * * * /bin/tar -czf /home/student/lab/b-$(date +\\%F).tgz /home/student/lab/data')).not.toContain('percent')
  })

  it('warns about a relative command path', () => {
    expect(ids('0 2 * * * backup.sh')).toContain('relative-path')
    expect(ids('0 2 * * * ./backup.sh')).toContain('relative-path')
    expect(ids('0 2 * * * /bin/bash backup.sh')).toContain('relative-path')
    expect(ids('0 2 * * * /home/student/lab/backup.sh >> /home/student/lab/backup.log 2>&1')).not.toContain('relative-path')
  })

  it('reports out-of-range values such as hour 24', () => {
    const result = analyzeCron('0 24 * * *')
    expect(result.valid).toBe(false)
    expect(result.issues[0].id).toBe('out-of-range')
    expect(result.issues[0].message).toContain('Midnight is hour 0')
    expect(ids('60 * * * *')).toContain('out-of-range')
    expect(ids('0 0 32 * *')).toContain('out-of-range')
    expect(ids('0 0 * 13 *')).toContain('out-of-range')
    expect(ids('0 0 * * 8')).toContain('out-of-range')
  })

  it('accepts names, lists, ranges and steps', () => {
    expect(analyzeCron('0,30 8-17/2 * JAN-JUN MON-FRI').valid).toBe(true)
  })

  it('rejects bad syntax and missing fields', () => {
    expect(ids('0 2 * *')).toEqual(['field-count'])
    expect(ids('0 2 * * abc')).toContain('invalid-syntax')
    expect(ids('*/0 * * * *')).toContain('invalid-syntax')
    expect(ids('0 5-1 * * *')).toContain('invalid-syntax')
  })
})

describe('findRelativePath', () => {
  it('returns null for full paths', () => {
    expect(findRelativePath('/home/student/lab/report.sh')).toBeNull()
  })
  it('finds the first relative token', () => {
    expect(findRelativePath('report.sh')).toBe('report.sh')
  })
})

describe('describeSchedule and nextRuns', () => {
  it('describes a schedule in plain English', () => {
    expect(describeSchedule('30 18 * * 1-5')).toBe('At 06:30 PM, Monday through Friday')
  })

  it('computes the next runs in UTC', () => {
    const from = new Date('2026-10-17T00:00:00Z')
    const runs = nextRuns('0 2 * * *', 3, 'utc', from)
    expect(runs.map((d) => d.toISOString())).toEqual([
      '2026-10-17T02:00:00.000Z',
      '2026-10-18T02:00:00.000Z',
      '2026-10-19T02:00:00.000Z',
    ])
  })

  it('returns [] for an invalid schedule', () => {
    expect(nextRuns('0 24 * * *', 5, 'utc')).toEqual([])
  })
})
