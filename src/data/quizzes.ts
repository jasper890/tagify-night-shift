export interface QuizQuestion {
  q: string
  options: string[]
  answer: number
  why: string
}

export const QUIZZES: Record<number, QuizQuestion[]> = {
  1: [
    { q: 'In the coffee maker analogy, what is the timer?', options: ['The script', 'The scheduler', 'The log'], answer: 1, why: 'The timer decides WHEN. The coffee and water (the steps) are the script, which decides HOW.' },
    { q: 'Checking 50 servers by hand at 10 minutes each takes about…', options: ['50 minutes', '2 hours', '8+ hours'], answer: 2, why: '50 × 10 = 500 minutes, which is more than 8 hours every day.' },
    { q: 'A script runs a backup every night at 1:00 AM, with no checks or alerts. Which level is that?', options: ['Manual task', 'Scheduled task', 'Automated workflow'], answer: 1, why: 'A script on a timer is a scheduled task. An automated workflow adds verifying, retries and alerts.' },
  ],
  2: [
    { q: 'Your phone only updates if it is charging and on Wi-Fi. Which idea is that?', options: ['Trigger', 'Condition', 'Job queue'], answer: 1, why: 'A condition is an “only if” rule checked after the trigger fires.' },
    { q: '“Cook the rice before serving” matches which idea?', options: ['Dependency', 'Interval', 'Trigger'], answer: 0, why: 'A dependency means job B waits until job A finishes.' },
    { q: 'A job runs every 5 minutes but takes 8 minutes. With “Skip if running”, what happens?', options: ['Two copies run at once', 'Every other run is skipped', 'Runs wait in a line'], answer: 1, why: 'While a run is still busy, the next trigger is skipped. Try it in the Job Queue Simulator.' },
  ],
  3: [
    { q: 'Which Task Scheduler tab answers “WHO runs it?”', options: ['General', 'Actions', 'Settings'], answer: 0, why: 'The General tab holds the user account that runs the task.' },
    { q: 'The Last Run Result is 0x2. What should you check first?', options: ['The script’s logic', 'The path and spelling in the action', 'The network cable'], answer: 1, why: '0x2 means file not found: the program or script path is wrong, or Start in is empty.' },
    { q: 'If “Start in” is empty, a task starts in…', options: ['Your Documents folder', 'C:\\Lab', 'C:\\Windows\\System32'], answer: 2, why: 'Tasks start in System32 when Start in is empty, so relative paths break.' },
  ],
  4: [
    { q: 'What does 0 2 * * * mean?', options: ['Every minute from 2:00 to 2:59', 'Every day at 2:00 AM', 'Every 2 hours'], answer: 1, why: 'Minute 0, hour 2, every day of every month.' },
    { q: 'How many times does * 2 * * * run each day?', options: ['1', '2', '60'], answer: 2, why: '* in the minute field means every minute, so it runs 60 times between 2:00 and 2:59.' },
    { q: 'Which command runs a job ONE time later?', options: ['crontab -e', 'at', 'crontab -r'], answer: 1, why: 'at is for one-time jobs. Careful: crontab -r deletes all your cron jobs!' },
  ],
  5: [
    { q: 'What does -WhatIf do in PowerShell?', options: ['Deletes faster', 'Shows what would happen without doing it', 'Asks for a password'], answer: 1, why: 'It is a preview. Always preview before deleting.' },
    { q: 'What is the Linux way to preview a delete with find?', options: ['find … -print', 'find … -delete', 'rm -rf'], answer: 0, why: '-print lists the files; only add -delete after checking the list.' },
    { q: 'What must the first line of a Bash script be?', options: ['exit 0', '#!/bin/bash', 'chmod +x'], answer: 1, why: 'The shebang line tells Linux which program runs the script.' },
  ],
  6: [
    { q: 'Why can a script work by hand but fail when scheduled?', options: ['Schedulers are slower', 'It runs as another user, in another folder, with a shorter PATH', 'Scripts expire'], answer: 1, why: 'WHO, WHERE and WHAT it sees are all different from your own session.' },
    { q: 'What does exit 1 tell the scheduler?', options: ['Success', 'The job failed', 'Run it once more'], answer: 1, why: 'exit 0 = success; any other number = failure.' },
    { q: 'A job fails. What do you check FIRST?', options: ['Rewrite the script', 'Did the scheduler start it?', 'Reboot the server'], answer: 1, why: 'Step 1 of the 4-step method: did the scheduler start it at all?' },
  ],
  7: [
    { q: 'Least privilege is like…', options: ['A master key', 'A hotel key card that opens only certain rooms', 'Leaving the door open'], answer: 1, why: 'Give each job only the access it needs.' },
    { q: 'Where should a password used by a script be kept?', options: ['In the script', 'In a vault or credential store', 'In the file name'], answer: 1, why: 'Anyone who can read a script can read a password inside it.' },
    { q: 'History says the task ran and the log says success, but the backup is 0 bytes. Did it work?', options: ['Yes', 'No: it ran, but it did not work', 'Only on Sundays'], answer: 1, why: 'Level 3 evidence failed. “It ran” is not “it worked”.' },
  ],
  8: [
    { q: 'Which tool is best for a one-time job on Linux?', options: ['cron', 'at', 'Task Scheduler'], answer: 1, why: 'at runs a job once. cron repeats.' },
    { q: 'Why add a random delay to updates on 40 lab PCs?', options: ['So they do not all overload the server at once', 'To make updates slower', 'Because cron needs it'], answer: 0, why: 'Spreading start times avoids everyone downloading at the same second.' },
    { q: 'Schedulers decide WHEN. Scripts decide…', options: ['WHO', 'HOW', 'WHERE'], answer: 1, why: 'They work as a team.' },
  ],
}
