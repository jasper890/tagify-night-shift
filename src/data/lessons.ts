import type { IconType } from 'react-icons'
import {
  FaBalanceScale,
  FaCode,
  FaLightbulb,
  FaLinux,
  FaProjectDiagram,
  FaShieldAlt,
  FaTools,
  FaWindows,
} from 'react-icons/fa'

export interface Lesson {
  id: number
  path: string
  title: string
  short: string
  kicker: string
  slides: string
  icon: IconType
}

export const LESSONS: Lesson[] = [
  { id: 1, path: '/lesson/1', title: 'Introduction to Scheduling and Automation', short: 'Introduction', kicker: 'Lesson 1 · Introduction', slides: 'Slides 3–5', icon: FaLightbulb },
  { id: 2, path: '/lesson/2', title: 'Scheduling Concepts', short: 'Scheduling Concepts', kicker: 'Lesson 2 · Scheduling Concepts', slides: 'Slides 6–7', icon: FaProjectDiagram },
  { id: 3, path: '/lesson/3', title: 'Windows Task Scheduler', short: 'Windows Task Scheduler', kicker: 'Lesson 3 · Windows', slides: 'Slides 8–10', icon: FaWindows },
  { id: 4, path: '/lesson/4', title: 'Linux cron and at', short: 'Linux cron and at', kicker: 'Lesson 4 · Linux', slides: 'Slides 11–13', icon: FaLinux },
  { id: 5, path: '/lesson/5', title: 'Scripting with PowerShell and Bash', short: 'Scripting', kicker: 'Lesson 5 · Scripting', slides: 'Slides 14–15', icon: FaCode },
  { id: 6, path: '/lesson/6', title: 'Making Jobs Reliable', short: 'Reliable Jobs', kicker: 'Lesson 6 · Reliable Jobs', slides: 'Slides 16–17', icon: FaTools },
  { id: 7, path: '/lesson/7', title: 'Security and Monitoring', short: 'Security and Monitoring', kicker: 'Lesson 7 · Security & Monitoring', slides: 'Slides 18–19', icon: FaShieldAlt },
  { id: 8, path: '/lesson/8', title: 'Comparing the Tools', short: 'Comparing the Tools', kicker: 'Lesson 8 · Comparing the Tools', slides: 'Slides 20–21', icon: FaBalanceScale },
]

