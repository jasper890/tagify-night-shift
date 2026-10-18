import type { SpriteId } from '../components/pixel/sprites'

export interface Boss {
  /** Lesson id this boss guards. */
  lesson: number
  name: string
  sprite: SpriteId
  /** What the boss says when the battle starts. */
  taunt: string
  /** What it says when it is defeated. */
  defeat: string
}

// One boss at the end of every lesson. Each one is a bad habit the lesson teaches you to beat.
export const BOSSES: Boss[] = [
  { lesson: 1, name: 'Toil Slime', sprite: 'slime', taunt: 'Do it by hand. Again. And again. And again…', defeat: 'Nooo… the computer does it by itself now…' },
  { lesson: 2, name: 'Queue Golem', sprite: 'golem', taunt: 'Your jobs will wait in my line forever!', defeat: 'Trigger… condition… dependency… I understand now…' },
  { lesson: 3, name: 'The 0x2 Phantom', sprite: 'ghost', taunt: 'File not found… file not found… file not found…', defeat: 'You checked the path. I fade away…' },
  { lesson: 4, name: 'Asterisk Bat', sprite: 'bat', taunt: '* * * * * — I strike every single minute!', defeat: 'Five fields… read correctly… impossible!' },
  { lesson: 5, name: 'Rogue Script Bug', sprite: 'bug', taunt: 'Delete first, preview never. Hehehe.', defeat: '-WhatIf… my one weakness…' },
  { lesson: 6, name: 'Silent Failure', sprite: 'skull', taunt: 'No logs. No alerts. Nobody will ever know.', defeat: 'Logged, verified, alerted. I am undone.' },
  { lesson: 7, name: 'Admin Rights Imp', sprite: 'imp', taunt: 'Give my job admin rights. All of them!', defeat: 'Least privilege?! Curse you!' },
  { lesson: 8, name: 'The 2 AM Dragon', sprite: 'dragon', taunt: 'So many tools. Which one will you choose, little admin?', defeat: 'The right tool for the job… you are ready.' },
]

export const bossFor = (lesson: number) => BOSSES.find((b) => b.lesson === lesson) ?? BOSSES[0]
