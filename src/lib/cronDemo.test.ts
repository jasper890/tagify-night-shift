import { describe, expect, it } from 'vitest'
import { CRON_QUIZ, DEMO_STEPS } from '../data/cronDemo'
import { buildChoices, shuffle } from './cronDemo'

// A small seeded generator (mulberry32), so shuffles are repeatable. A plain multiplicative
// generator is not good enough here: consecutive small seeds all start near 0.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

describe('shuffle', () => {
  it('keeps every item and leaves the input alone', () => {
    const input = ['a', 'b', 'c', 'd']
    const out = shuffle(input, seeded(7))
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(input).toEqual(['a', 'b', 'c', 'd'])
  })

  it('can put an item in every position', () => {
    const seen = new Set<number>()
    for (let seed = 1; seed <= 200; seed++) seen.add(shuffle(['a', 'b', 'c', 'd'], seeded(seed)).indexOf('a'))
    expect([...seen].sort()).toEqual([0, 1, 2, 3])
  })

  it('is fair: each of the four positions gets about a quarter of the shuffles', () => {
    const rng = seeded(2024)
    const counts = [0, 0, 0, 0]
    for (let n = 0; n < 4000; n++) counts[shuffle(['a', 'b', 'c', 'd'], rng).indexOf('a')]++
    for (const c of counts) expect(c).toBeGreaterThan(850) // expected 1000 each
    for (const c of counts) expect(c).toBeLessThan(1150)
  })
})

describe('buildChoices', () => {
  const q = { answer: 'right', wrong: ['w1', 'w2', 'w3'] }

  it('offers the right answer and the three wrong ones exactly once each', () => {
    const { options } = buildChoices(q, seeded(3))
    expect([...options].sort()).toEqual(['right', 'w1', 'w2', 'w3'])
  })

  it('says where the right answer ended up', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { options, answer } = buildChoices(q, seeded(seed))
      expect(options[answer]).toBe('right')
    }
  })

  it('does not always put the right answer in the same place', () => {
    const spots = new Set<number>()
    for (let seed = 1; seed <= 200; seed++) spots.add(buildChoices(q, seeded(seed)).answer)
    expect(spots.size).toBe(4)
  })
})

describe('demo steps', () => {
  it('has the ten steps, in order, with removing the cron job last', () => {
    expect(DEMO_STEPS.map((s) => s.title)).toEqual([
      'Create the backup script',
      'Schedule it with cron (every minute)',
      'Wait 1 minute, then check it worked',
      'Upgrade the script into a full workflow',
      'Show the code: the automation part',
      'Run it and show the cleanup',
      'Show what happens when something fails',
      'Watch cron and the script work together',
      'One-time job with at',
      'Remove the cron job safely',
    ])
    expect(new Set(DEMO_STEPS.map((s) => s.id)).size).toBe(10)
  })

  it('uses exactly the commands from the report', () => {
    expect(DEMO_STEPS.map((s) => s.code)).toEqual([
      [
        `mkdir -p ~/lab/data ~/lab/backups`,
        `echo "Grades: Juan 95" > ~/lab/data/grades.txt`,
        `cat > ~/lab/backup.sh << 'EOF'`,
        `#!/bin/bash`,
        `tar -czf $HOME/lab/backups/data-$(date +%H%M%S).tar.gz -C $HOME/lab data`,
        `echo "Backup done: $(date)"`,
        `EOF`,
        `chmod +x ~/lab/backup.sh`,
        `~/lab/backup.sh`,
      ].join('\n'),
      [`(crontab -l 2>/dev/null; echo "* * * * * $HOME/lab/backup.sh >> $HOME/lab/backup.log 2>&1") | crontab -`, `crontab -l`].join('\n'),
      [`cat ~/lab/backup.log`, `ls ~/lab/backups`].join('\n'),
      [
        `cat > ~/lab/backup.sh << 'EOF'`,
        `#!/bin/bash`,
        `# Automated backup workflow: check -> back up -> verify -> clean up -> log`,
        `SRC=$HOME/lab/data`,
        `DEST=$HOME/lab/backups`,
        `FILE=$DEST/data-$(date +%H%M%S).tar.gz`,
        ``,
        `echo "$(date +%T)  INFO   Backup started"`,
        ``,
        `# 1. Check: does the folder exist?`,
        `if [ ! -d $SRC ]; then`,
        `  echo "$(date +%T)  ERROR  Folder not found"`,
        `  exit 1`,
        `fi`,
        ``,
        `# 2. Back up`,
        `tar -czf $FILE -C $HOME/lab data`,
        ``,
        `# 3. Verify: is the backup file there and not empty?`,
        `if [ ! -s $FILE ]; then`,
        `  echo "$(date +%T)  ERROR  Backup file is empty"`,
        `  exit 1`,
        `fi`,
        `echo "$(date +%T)  INFO   Created $(basename $FILE)"`,
        ``,
        `# 4. Clean up: keep only the 3 newest backups`,
        `ls -t $DEST/*.tar.gz | tail -n +4 | xargs -r rm`,
        `echo "$(date +%T)  INFO   Old backups removed, $(ls $DEST | wc -l) kept"`,
        ``,
        `echo "$(date +%T)  INFO   Backup finished"`,
        `exit 0`,
        `EOF`,
      ].join('\n'),
      `cat ~/lab/backup.sh`,
      [`ls ~/lab/backups`, `~/lab/backup.sh; echo "Exit code: $?"`, `ls ~/lab/backups`].join('\n'),
      [`mv ~/lab/data ~/lab/data_hidden`, `~/lab/backup.sh; echo "Exit code: $?"`, `mv ~/lab/data_hidden ~/lab/data`].join('\n'),
      `tail -f ~/lab/backup.log`,
      [`echo "$HOME/lab/backup.sh" | at 23:00`, `atq`, `atrm 1`].join('\n'),
      [`crontab -l | grep -v backup.sh | crontab -`, `crontab -l`].join('\n'),
    ])
  })

  it('never puts the dangerous crontab -r in a command to copy', () => {
    for (const s of DEMO_STEPS) expect(s.code, s.title).not.toMatch(/crontab\s+-r/)
  })

  it('adds the notes under the at and remove steps', () => {
    expect(DEMO_STEPS.find((s) => s.id === 'at')?.note).toBe('Use the job number shown by atq.')
    expect(DEMO_STEPS.find((s) => s.id === 'remove')?.note).toBe('Never use crontab -r. It deletes ALL your jobs without asking.')
  })

  it('works for any user: the upgraded script never hard-codes /root', () => {
    for (const s of DEMO_STEPS) expect(s.code, s.title).not.toContain('/root')
  })

  it('gives each automation step a line to say, and tells you when to press Ctrl+C', () => {
    for (const id of ['show-code', 'run-cleanup', 'fail', 'watch']) {
      expect(DEMO_STEPS.find((s) => s.id === id)?.note, id).toMatch(/Say: “/)
    }
    expect(DEMO_STEPS.find((s) => s.id === 'watch')?.note).toContain('press Ctrl+C')
  })
})

describe('cron quiz', () => {
  it('has ten questions with the right answers, in order', () => {
    expect(CRON_QUIZ.map((q) => q.answer)).toEqual([
      'Every 15 minutes',
      'Every day at 2:00 AM',
      'Weekdays at 6:30 PM',
      'Sundays at 3:00 AM',
      'First day of every month',
      '0 * * * *',
      'Every minute from 2:00 to 2:59 (60 times!)',
      'at',
      'crontab -r',
      'Success',
    ])
    expect(new Set(CRON_QUIZ.map((q) => q.id)).size).toBe(10)
  })

  it('shows the cron line for the schedule questions', () => {
    expect(CRON_QUIZ.slice(0, 5).map((q) => q.code)).toEqual(['*/15 * * * *', '0 2 * * *', '30 18 * * 1-5', '0 3 * * 0', '0 0 1 * *'])
    expect(CRON_QUIZ[6].code).toBe('* 2 * * *')
  })

  it('gives every question three different wrong choices that never repeat the answer', () => {
    for (const q of CRON_QUIZ) {
      expect(q.wrong, q.id).toHaveLength(3)
      expect(new Set([q.answer, ...q.wrong]).size, q.id).toBe(4)
    }
  })

  it('uses the report’s wrong choices for question 2', () => {
    expect(CRON_QUIZ[1].wrong).toEqual(['Every 2 minutes', 'Every 2 hours', '2nd day of every month'])
  })

  it('always has a hint and an explanation', () => {
    for (const q of CRON_QUIZ) {
      expect(q.hint.trim().length, `${q.id} hint`).toBeGreaterThan(0)
      expect(q.why.trim().length, `${q.id} why`).toBeGreaterThan(0)
    }
  })

  it('explains the trap the way the report does', () => {
    expect(CRON_QUIZ[6].why).toBe('The minute field is *, so it runs every minute. For 2 AM only, use 0 2 * * *')
  })
})
