export interface ResultCode {
  code: string
  value: number
  name: string
  meaning: string
  check: string
  tone: 'success' | 'info' | 'error'
}

// Source: https://learn.microsoft.com/en-us/windows/win32/taskschd/task-scheduler-error-and-success-constants
export const RESULT_CODES: ResultCode[] = [
  { code: '0x0', value: 0x0, name: 'Success', meaning: 'The task completed with no errors (the program returned exit code 0).', check: 'Nothing to fix. Still check that the result really exists (Lesson 7).', tone: 'success' },
  { code: '0x1', value: 0x1, name: 'Script error', meaning: 'The program or script returned exit code 1, which usually means it failed partway.', check: 'Run the exact command by hand, as the same user, to see the error. Read the script log.', tone: 'error' },
  { code: '0x2', value: 0x2, name: 'File not found', meaning: 'Windows could not find a file: the program, the script, or a file the script opens.', check: 'Check the path and spelling in the action. Fill in "Start in" so relative paths work.', tone: 'error' },
  { code: '0x41300', value: 0x41300, name: 'Ready', meaning: 'The task is ready to run at its next scheduled time.', check: 'Nothing is wrong. It is waiting for its trigger.', tone: 'info' },
  { code: '0x41301', value: 0x41301, name: 'Still running', meaning: 'The task is currently running.', check: 'Wait, or check for a script that never ends (for example, one waiting for input).', tone: 'info' },
  { code: '0x41302', value: 0x41302, name: 'Disabled', meaning: 'The task will not run at its scheduled times because it is disabled.', check: 'Right-click the task and choose Enable, if it should run.', tone: 'info' },
  { code: '0x41303', value: 0x41303, name: 'Has not run yet', meaning: 'The task has not run since it was created.', check: 'Wait for the trigger, or right-click the task and choose Run to test it.', tone: 'info' },
  { code: '0x41306', value: 0x41306, name: 'Terminated', meaning: 'The last run was stopped by a user or by the "Stop the task if it runs longer than" setting.', check: 'Check the time limit on the Settings tab, and whether the script hangs.', tone: 'error' },
  { code: '0x41325', value: 0x41325, name: 'Queued', meaning: 'The Task Scheduler service has asked the task to run; it is waiting its turn.', check: 'Usually fine. If it stays queued, look for another instance that is still running.', tone: 'info' },
  { code: '0x8004131F', value: 0x8004131f, name: 'Already running', meaning: 'An instance of this task is already running, so a new one was not started.', check: 'Check "If the task is already running" on the Settings tab, and why the last run takes so long.', tone: 'error' },
  { code: '0x80070005', value: 0x80070005, name: 'Access denied', meaning: 'The account that runs the task does not have permission.', check: 'Check the account on the General tab and its rights to the script and folders.', tone: 'error' },
  { code: '0x800710E0', value: 0x800710e0, name: 'Request refused', meaning: 'The operator or administrator refused the request, often because the account cannot log on or a condition blocks it.', check: 'Check the Conditions tab and the "Run whether user is logged on or not" option.', tone: 'error' },
]

/** Accepts "0x2", "0X00000002", "2", decimal like "267009", or negative HRESULTs. */
export function parseResultCode(input: string): number | null {
  const text = input.trim()
  if (!text) return null
  if (/^0x[0-9a-f]{1,8}$/i.test(text)) return parseInt(text.slice(2), 16) >>> 0
  if (/^-?\d+$/.test(text)) return Number(text) >>> 0
  return null
}

export function decodeResultCode(input: string): ResultCode | null {
  const value = parseResultCode(input)
  if (value === null) return null
  return RESULT_CODES.find((c) => c.value >>> 0 === value) ?? null
}
