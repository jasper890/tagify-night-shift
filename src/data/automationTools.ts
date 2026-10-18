import type { IconType } from 'react-icons'
import { FaAws, FaHourglassHalf, FaStopwatch, FaWindows } from 'react-icons/fa'
import { SiAnsible, SiGithubactions, SiGnubash, SiJenkins, SiKubernetes, SiLinux } from 'react-icons/si'
import { TbBrandPowershell } from 'react-icons/tb'

export interface AutomationTool {
  name: string
  platform: string
  desc: string
  path: string
  icon: IconType
  color: string
  group: 'built-in' | 'scale'
}

/** The automation tools shown on the Home page (and in the intro video). */
export const AUTOMATION_TOOLS: AutomationTool[] = [
  { name: 'Task Scheduler', platform: 'Windows', desc: 'Repeating, one-time and event tasks with conditions and retries.', path: '/lesson/3', icon: FaWindows, color: '#0a6ed1', group: 'built-in' },
  { name: 'cron', platform: 'Linux', desc: 'Repeat a job on a timetable, like every night at 1:30.', path: '/lesson/4', icon: SiLinux, color: '#c79a00', group: 'built-in' },
  { name: 'at', platform: 'Linux', desc: 'Run a job once, later: at now + 2 hours.', path: '/lesson/4', icon: FaHourglassHalf, color: '#d97706', group: 'built-in' },
  { name: 'PowerShell', platform: 'Windows', desc: 'Script the steps: clean up, check, and log.', path: '/lesson/5', icon: TbBrandPowershell, color: '#2f6fd8', group: 'built-in' },
  { name: 'Bash', platform: 'Linux', desc: 'Script the steps on Linux servers.', path: '/lesson/5', icon: SiGnubash, color: '#3a8a1c', group: 'built-in' },
  { name: 'systemd timers', platform: 'Linux', desc: 'The modern cron, with catch-up and logs.', path: '/beyond/systemd-timers', icon: FaStopwatch, color: '#8e44ad', group: 'built-in' },
  { name: 'Ansible', platform: 'Cross-platform', desc: 'One command installs the same job on 50 servers.', path: '/beyond/ansible', icon: SiAnsible, color: '#c00000', group: 'scale' },
  { name: 'GitHub Actions', platform: 'Cloud', desc: 'Scheduled workflows next to your code.', path: '/beyond/github-actions', icon: SiGithubactions, color: '#1a6fd6', group: 'scale' },
  { name: 'Jenkins', platform: 'Server', desc: 'Build and maintenance pipelines with a dashboard.', path: '/beyond/jenkins', icon: SiJenkins, color: '#b5382a', group: 'scale' },
  { name: 'Kubernetes CronJob', platform: 'Cluster', desc: 'Scheduled jobs that run in containers.', path: '/beyond/kubernetes-cronjob', icon: SiKubernetes, color: '#326ce5', group: 'scale' },
  { name: 'Cloud schedulers', platform: 'AWS · Azure · Google', desc: 'Run jobs on a schedule with no server to keep awake.', path: '/beyond/cloud-schedulers', icon: FaAws, color: '#e07b00', group: 'scale' },
]
