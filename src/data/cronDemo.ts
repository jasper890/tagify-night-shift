// Content of the "Linux cron & at demo" page: ten steps to run on a real Linux terminal
// (steps 4-8 upgrade the script into a full workflow), and a ten-question cron quiz.
// The site never runs these on your computer. Its simulated terminal runs the same commands
// (see src/terminal/demoTrack.ts, which takes each step's id, title and code from here).

export interface DemoStep {
  id: string
  title: string
  /** Commands to copy, exactly as typed in the terminal. */
  code: string
  /** Short note shown under the code. */
  note?: string
  /** `warn` draws the note as a danger box. */
  noteTone?: 'info' | 'warn'
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: 'script',
    title: 'Create the backup script',
    code: `mkdir -p ~/lab/data ~/lab/backups
echo "Grades: Juan 95" > ~/lab/data/grades.txt
cat > ~/lab/backup.sh << 'EOF'
#!/bin/bash
tar -czf $HOME/lab/backups/data-$(date +%H%M%S).tar.gz -C $HOME/lab data
echo "Backup done: $(date)"
EOF
chmod +x ~/lab/backup.sh
~/lab/backup.sh`,
  },
  {
    id: 'schedule',
    title: 'Schedule it with cron (every minute)',
    code: `(crontab -l 2>/dev/null; echo "* * * * * $HOME/lab/backup.sh >> $HOME/lab/backup.log 2>&1") | crontab -
crontab -l`,
  },
  {
    id: 'check',
    title: 'Wait 1 minute, then check it worked',
    code: `cat ~/lab/backup.log
ls ~/lab/backups`,
  },
  {
    id: 'automate',
    title: 'Upgrade the script into a full workflow',
    code: `cat > ~/lab/backup.sh << 'EOF'
#!/bin/bash
# Automated backup workflow: check -> back up -> verify -> clean up -> log
SRC=$HOME/lab/data
DEST=$HOME/lab/backups
FILE=$DEST/data-$(date +%H%M%S).tar.gz

echo "$(date +%T)  INFO   Backup started"

# 1. Check: does the folder exist?
if [ ! -d $SRC ]; then
  echo "$(date +%T)  ERROR  Folder not found"
  exit 1
fi

# 2. Back up
tar -czf $FILE -C $HOME/lab data

# 3. Verify: is the backup file there and not empty?
if [ ! -s $FILE ]; then
  echo "$(date +%T)  ERROR  Backup file is empty"
  exit 1
fi
echo "$(date +%T)  INFO   Created $(basename $FILE)"

# 4. Clean up: keep only the 3 newest backups
ls -t $DEST/*.tar.gz | tail -n +4 | xargs -r rm
echo "$(date +%T)  INFO   Old backups removed, $(ls $DEST | wc -l) kept"

echo "$(date +%T)  INFO   Backup finished"
exit 0
EOF`,
    note: 'cron is the scheduling part (WHEN) and the script is the automation part (HOW). cron still runs backup.sh, so it picks up this new version by itself. No change to cron needed.',
  },
  {
    id: 'show-code',
    title: 'Show the code: the automation part',
    code: `cat ~/lab/backup.sh`,
    note: 'Say: “This is the automation part. The script does 4 steps by itself: it checks the folder, makes the backup, verifies the file isn’t empty, and deletes old copies. It also logs each step.”',
  },
  {
    id: 'run-cleanup',
    title: 'Run it and show the cleanup',
    code: `ls ~/lab/backups
~/lab/backup.sh; echo "Exit code: $?"
ls ~/lab/backups`,
    note: 'Say: “Before, we had many backups. Now it keeps only the newest 3, so the disk won’t fill up. Exit code 0 means success.”',
  },
  {
    id: 'fail',
    title: 'Show what happens when something fails',
    code: `mv ~/lab/data ~/lab/data_hidden
~/lab/backup.sh; echo "Exit code: $?"
mv ~/lab/data_hidden ~/lab/data`,
    note: 'Say: “The folder is missing, so the script stops, logs an ERROR, and returns exit code 1. That’s how the system knows the job failed.”',
  },
  {
    id: 'watch',
    title: 'Watch cron and the script work together',
    code: `tail -f ~/lab/backup.log`,
    note: 'Wait for the next minute, then press Ctrl+C. Say: “cron decides WHEN, every minute. The script decides HOW, with all 4 steps. Nobody touched anything, and the log proves it ran.”',
  },
  {
    id: 'at',
    title: 'One-time job with at',
    code: `echo "$HOME/lab/backup.sh" | at 23:00
atq
atrm 1`,
    note: 'Use the job number shown by atq.',
  },
  {
    id: 'remove',
    title: 'Remove the cron job safely',
    code: `crontab -l | grep -v backup.sh | crontab -
crontab -l`,
    note: 'Never use crontab -r. It deletes ALL your jobs without asking.',
    noteTone: 'warn',
  },
]

export const TROUBLESHOOTING = { problem: 'Log empty after 1 minute?', command: 'sudo service cron start' }

export interface QuizQuestion {
  id: string
  q: string
  /** A cron line shown big under the question. */
  code?: string
  /** The choices are commands or cron lines, so show them in a monospace font. */
  codeOptions?: boolean
  answer: string
  /** Three believable wrong choices. */
  wrong: [string, string, string]
  /** Short explanation shown after answering. */
  why: string
  /** Always visible while the question is on screen. */
  hint: string
}

export const CRON_QUIZ: QuizQuestion[] = [
  {
    id: 'every-15',
    q: 'What does this cron line mean?',
    code: '*/15 * * * *',
    answer: 'Every 15 minutes',
    wrong: ['Every 15 hours', 'At minute 15 of every hour', 'On the 15th day of every month'],
    why: '*/15 in the minute field means every 15 minutes: at :00, :15, :30 and :45.',
    hint: 'The first field is the minute. */15 means “every 15”, so count by 15s.',
  },
  {
    id: 'two-am',
    q: 'What does this cron line mean?',
    code: '0 2 * * *',
    answer: 'Every day at 2:00 AM',
    wrong: ['Every 2 minutes', 'Every 2 hours', '2nd day of every month'],
    why: 'Minute 0, hour 2, every day of every month: once a day at 2:00 AM.',
    hint: 'Read left to right: minute = 0, hour = 2. The hour uses a 24-hour clock.',
  },
  {
    id: 'weekdays',
    q: 'What does this cron line mean?',
    code: '30 18 * * 1-5',
    answer: 'Weekdays at 6:30 PM',
    wrong: ['Every day at 6:30 PM', 'Weekends at 6:30 PM', 'Weekdays at 6:30 AM'],
    why: 'Minute 30, hour 18 (6 PM), and days 1-5 (Monday to Friday): weekdays at 6:30 PM.',
    hint: 'Hour 18 on a 24-hour clock is 6 PM. In the last field, 1-5 is Monday to Friday.',
  },
  {
    id: 'sundays',
    q: 'What does this cron line mean?',
    code: '0 3 * * 0',
    answer: 'Sundays at 3:00 AM',
    wrong: ['Every day at 3:00 AM', 'Mondays at 3:00 AM', 'The 3rd day of every month'],
    why: 'Minute 0, hour 3, and day of the week 0, which is Sunday: Sundays at 3:00 AM.',
    hint: 'The last field is the day of the week, and 0 means Sunday.',
  },
  {
    id: 'monthly',
    q: 'What does this cron line mean?',
    code: '0 0 1 * *',
    answer: 'First day of every month',
    wrong: ['Every day at midnight', 'Every Monday at midnight', 'January 1 only, at midnight'],
    why: 'Minute 0 and hour 0 (midnight) on day 1 of every month.',
    hint: 'The third field is the day of the month. Minute 0 and hour 0 is midnight.',
  },
  {
    id: 'hourly',
    q: 'Which cron line runs every hour?',
    codeOptions: true,
    answer: '0 * * * *',
    wrong: ['* * * * *', '0 0 * * *', '* 1 * * *'],
    why: 'Minute 0 of every hour. * * * * * is every minute, and 0 0 * * * is once a day at midnight.',
    hint: 'To run once an hour, the minute must be a fixed number (0), not *.',
  },
  {
    id: 'trap',
    q: 'What does this cron line mean?',
    code: '* 2 * * *',
    answer: 'Every minute from 2:00 to 2:59 (60 times!)',
    wrong: ['Every day at 2:00 AM', 'Every 2 minutes', 'Every 2 hours'],
    why: 'The minute field is *, so it runs every minute. For 2 AM only, use 0 2 * * *',
    hint: 'Look closely at the first field, the minute. Is it a number, or a * for “every”?',
  },
  {
    id: 'one-time',
    q: 'Which command is for a ONE-TIME job?',
    codeOptions: true,
    answer: 'at',
    wrong: ['crontab -e', 'cron', 'anacron'],
    why: 'at runs a job once, at the time you choose. cron is for jobs that repeat.',
    hint: 'cron repeats forever. Which tool runs a job just one time, later?',
  },
  {
    id: 'dangerous',
    q: 'Which command is dangerous because it deletes all cron jobs?',
    codeOptions: true,
    answer: 'crontab -r',
    wrong: ['crontab -l', 'crontab -e', 'atrm 1'],
    why: 'crontab -r deletes ALL your cron jobs without asking. crontab -l only lists them, and crontab -e edits them.',
    hint: 'The r stands for “remove”. It sits right next to e (edit) on the keyboard.',
  },
  {
    id: 'exit-0',
    q: 'What does exit code 0 mean?',
    answer: 'Success',
    wrong: ['The job failed', 'The job is still running', 'The job was skipped'],
    why: 'Exit code 0 means success. Any other number means failure, so the scheduler knows.',
    hint: 'Think of 0 as “zero problems”. A script ends with exit 0 when all went well.',
  },
]
