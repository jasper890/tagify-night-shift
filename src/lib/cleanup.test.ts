import { describe, expect, it } from 'vitest'
import { SAMPLE_LOGS, filesToDelete, filesToKeep } from './cleanup'

describe('cleanup previewer filter', () => {
  it('has ten sample files aged 2 to 20 days', () => {
    expect(SAMPLE_LOGS).toHaveLength(10)
    expect(Math.min(...SAMPLE_LOGS.map((f) => f.ageDays))).toBe(2)
    expect(Math.max(...SAMPLE_LOGS.map((f) => f.ageDays))).toBe(20)
  })

  it('deletes only files strictly older than the days to keep', () => {
    const deleted = filesToDelete(SAMPLE_LOGS, 7)
    expect(deleted.every((f) => f.ageDays > 7)).toBe(true)
    expect(deleted.map((f) => f.ageDays)).toEqual([9, 11, 13, 15, 18, 20])
    // a file exactly 7 days old is kept, like find -mtime +7
    expect(filesToKeep(SAMPLE_LOGS, 7).map((f) => f.ageDays)).toContain(7)
  })

  it('keep + delete always covers every file exactly once', () => {
    for (let days = 0; days <= 30; days++) {
      expect(filesToDelete(SAMPLE_LOGS, days).length + filesToKeep(SAMPLE_LOGS, days).length).toBe(10)
    }
  })

  it('deletes nothing when keeping 20 days or more', () => {
    expect(filesToDelete(SAMPLE_LOGS, 20)).toEqual([])
  })
})
