export interface Mission {
  id: string
  title: string
  page: string
  pageLabel: string
  goal: string
  steps: string[]
  success: string
  challenge?: string
}

export const MISSIONS: Mission[] = [
  {
    id: 'phone',
    title: 'Why didn’t my phone update?',
    page: '/lesson/2',
    pageLabel: 'Lesson 2 · Phone Night-Update Simulator',
    goal: 'See how a trigger, condition, dependency and queue decide if a job runs.',
    steps: ['Press “It’s 2:00 AM” with all switches as they are.', 'Turn OFF “On Wi-Fi” and press it again.', 'Turn Wi-Fi back on, but turn ON “Another update running”.'],
    success: 'You saw the flow stop at Condition (no Wi-Fi), then at Queue (another update running).',
    challenge: 'Which switch makes the flow stop at Dependency?',
  },
  {
    id: 'queue',
    title: 'Stop a job from overlapping itself',
    page: '/lesson/2',
    pageLabel: 'Lesson 2 · Job Queue / Overlap Simulator',
    goal: 'Learn what happens when a job takes longer than the gap between runs.',
    steps: ['Set “Runs every” to 5 min and “Each run takes” to 8 min.', 'Look at the red bars with “Run in parallel”.', 'Switch to “Skip if running”, then to “Queue”.'],
    success: 'Parallel shows red overlaps; Skip has no overlaps but skips runs; Queue has no overlaps but runs drift later.',
    challenge: 'What is the Linux command that gives you “Skip if running”?',
  },
  {
    id: 'startin',
    title: 'Find the “Start in” trap',
    page: '/lesson/3',
    pageLabel: 'Lesson 3 · Task Scheduler Tab Explorer',
    goal: 'Understand why a Windows task fails when “Start in” is empty.',
    steps: ['Click each of the six tabs and read the WHO / WHEN / WHAT box.', 'On the Actions tab, delete the text in “Start in”.', 'Read the callout, then look at the PowerShell command below the window.'],
    success: 'The callout says the task would start in C:\\Windows\\System32, and -WorkingDirectory changed in the command.',
    challenge: 'Change the account on the General tab to SYSTEM. Why is that a bad idea for a report job?',
  },
  {
    id: 'codes',
    title: 'Decode the Last Run Result',
    page: '/lesson/3',
    pageLabel: 'Lesson 3 · Last Run Result Decoder',
    goal: 'Know what a task’s result code means and what to check.',
    steps: ['Type 0x0, then 0x1, then 0x2, then 0x41301.', 'Use “More codes…” to look at 0x80070005.'],
    success: 'You can say what each of the four slide codes means without looking.',
    challenge: 'A task shows 267009. Type it in. What is it in hex?',
  },
  {
    id: 'cron',
    title: 'Fix the big cron mistake',
    page: '/lesson/4',
    pageLabel: 'Lesson 4 · Cron Explainer & Builder',
    goal: 'Read and write cron schedules, and spot common mistakes.',
    steps: ['Click the red * 2 * * * button and read the warning.', 'Click “Fix it” and check the next 5 run times.', 'Build “every Saturday at 11:45 PM” yourself using the five boxes.', 'Switch between Local and UTC.'],
    success: 'The mistake detector shows “Looks good” and the meaning matches what you wanted.',
    challenge: 'Type 0 9 * * * backup.sh. Which warning appears, and how do you fix it?',
  },
  {
    id: 'cleanup',
    title: 'Delete old logs safely',
    page: '/lesson/5',
    pageLabel: 'Lesson 5 · Safe Cleanup Previewer',
    goal: 'Practise the golden habit: preview before deleting.',
    steps: ['Keep Preview mode ON and press “Run (simulated)”.', 'Move the “Days to keep” slider to 14 and run again.', 'Switch to Bash and compare the command.'],
    success: 'You can explain what -WhatIf and find -print do, and how many files would be deleted at 14 days.',
    challenge: 'Which files survive if you keep 10 days?',
  },
  {
    id: 'troubleshoot',
    title: 'Solve “works by hand, fails when scheduled”',
    page: '/lesson/6',
    pageLabel: 'Lesson 6 · Troubleshooter',
    goal: 'Use the 4-step method to find a scheduled job’s problem.',
    steps: ['Pick “command not found” and walk all 4 steps.', 'Do the same for “^M: bad interpreter”.', 'Try one more symptom of your choice.'],
    success: 'You can name the 4 steps in order and the cause of at least three symptoms.',
    challenge: 'Why does cron not find programs in /usr/local/bin?',
  },
  {
    id: 'evidence',
    title: 'Prove a backup really worked',
    page: '/lesson/7',
    pageLabel: 'Lesson 7 · Log Viewer',
    goal: 'Learn the three levels of evidence: it ran ≠ it worked.',
    steps: ['On “Normal night”, click Level 1, 2 and 3.', 'Switch to “Broken backup” and click the three levels again.', 'Read the fixed script at the bottom.'],
    success: 'You found that levels 1 and 2 looked fine but the backup file was 0 bytes.',
    challenge: 'Which line in the fixed script catches the empty file?',
  },
  {
    id: 'security',
    title: 'Make four jobs secure',
    page: '/lesson/7',
    pageLabel: 'Lesson 7 · Security Before / After',
    goal: 'Recognise risky setups and their safe versions.',
    steps: ['Read each red card first.', 'Flip each card to its secure version one by one.'],
    success: 'All four cards are green, and you can explain least privilege with the hotel key card.',
    challenge: 'Which Windows Event ID records that a new scheduled task was created?',
  },
  {
    id: 'lab',
    title: 'Plan a computer lab’s night',
    page: '/lesson/8',
    pageLabel: 'Lesson 8 · 24-Hour Lab Clock & Tool Comparison',
    goal: 'See how several scheduled jobs fit together in a real lab.',
    steps: ['Click each job on the clock and read its configuration.', 'In the comparison table, tick “Catch-up of missed runs”.'],
    success: 'You can say which tool runs each lab job, and which tools can catch up missed runs.',
    challenge: 'Why do the Sunday updates use a random delay?',
  },
  {
    id: 'cloud',
    title: 'Same cron, now in the cloud',
    page: '/beyond/github-actions',
    pageLabel: 'Beyond the Basics · GitHub Actions',
    goal: 'Connect what you learned to a modern tool.',
    steps: ['Find the cron line in the workflow.', 'Read the “Five facts” box.', 'Open the Ansible page and find the --check command.'],
    success: 'You can explain why 2:00 AM in the Philippines is 0 18 * * * in GitHub Actions.',
    challenge: 'What does --check in Ansible have in common with -WhatIf?',
  },
]
