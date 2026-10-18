export interface LogFile {
  name: string
  ageDays: number
  sizeKB: number
}

/** Ten fake log files for the Safe Cleanup Previewer (ages 2 to 20 days). */
export const SAMPLE_LOGS: LogFile[] = [
  { name: 'app-01.log', ageDays: 2, sizeKB: 124 },
  { name: 'app-02.log', ageDays: 4, sizeKB: 98 },
  { name: 'backup-01.log', ageDays: 6, sizeKB: 12 },
  { name: 'app-03.log', ageDays: 7, sizeKB: 143 },
  { name: 'web-01.log', ageDays: 9, sizeKB: 310 },
  { name: 'backup-02.log', ageDays: 11, sizeKB: 11 },
  { name: 'app-04.log', ageDays: 13, sizeKB: 87 },
  { name: 'web-02.log', ageDays: 15, sizeKB: 276 },
  { name: 'app-05.log', ageDays: 18, sizeKB: 102 },
  { name: 'backup-03.log', ageDays: 20, sizeKB: 13 },
]

/**
 * Files older than `keepDays`. For whole-day ages this matches both
 * PowerShell `LastWriteTime -lt (Get-Date).AddDays(-keepDays)` and
 * Linux `find -mtime +keepDays`.
 */
export function filesToDelete(files: LogFile[], keepDays: number): LogFile[] {
  return files.filter((f) => f.ageDays > keepDays)
}

export function filesToKeep(files: LogFile[], keepDays: number): LogFile[] {
  return files.filter((f) => f.ageDays <= keepDays)
}
