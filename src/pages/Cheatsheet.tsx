import { FaPrint } from 'react-icons/fa'
import { C, PageHeader, Section } from '../components/ui'
import { CodeBlock } from '../components/CodeBlock'
import { CronBuilder } from '../demos/CronBuilder'
import { RESULT_CODES } from '../lib/resultCodes'

export default function Cheatsheet() {
  return (
    <>
      <PageHeader
        kicker="Reference · supports all lessons"
        title="Cheat Sheet"
        intro="Everything on one page. Print it (the buttons and menus are hidden when printing) or keep it open in a tab."
      />
      <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>
        <FaPrint aria-hidden /> Print this page
      </button>

      <Section title="cron line format">
        <CodeBlock
          lang="crontab"
          code={`# ┌───────── minute (0-59)
# │ ┌─────── hour (0-23)
# │ │ ┌───── day of month (1-31)
# │ │ │ ┌─── month (1-12)
# │ │ │ │ ┌─ day of week (0-7, 0 and 7 = Sunday)
# │ │ │ │ │
  * * * * *  /full/path/to/command >> /full/path/to/log 2>&1`}
        />
        <div className="grid gap-x-6 md:grid-cols-2">
          <table className="w-full text-left text-[0.95rem]">
            <tbody>
              {[
                ['*/15 * * * *', 'Every 15 minutes'],
                ['0 * * * *', 'Every hour'],
                ['0 2 * * *', 'Every day at 2:00 AM'],
                ['30 18 * * 1-5', 'Weekdays at 6:30 PM'],
                ['0 3 * * 0', 'Sundays at 3:00 AM'],
                ['0 0 1 * *', 'First day of every month'],
              ].map(([e, m]) => (
                <tr key={e} className="border-b border-line">
                  <td className="py-1.5 pr-3 font-mono font-bold text-navy">{e}</td>
                  <td className="py-1.5">{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-3 space-y-1 text-[0.95rem] md:mt-0">
            <li><C>*</C> every · <C>,</C> list · <C>-</C> range · <C>/</C> every so many</li>
            <li className="text-danger-dark"><strong>Wrong:</strong> <C>* 2 * * *</C> runs 60 times. <strong>Right:</strong> <C>0 2 * * *</C></li>
            <li>Escape <C>%</C> as <C>\%</C> inside a crontab line.</li>
            <li>Day of month AND day of week both set = runs on either (OR).</li>
            <li>End the crontab file with a new line.</li>
          </ul>
        </div>
        <div className="no-print">
          <CronBuilder initial="0 2 * * * /home/student/lab/backup.sh" />
        </div>
      </Section>

      <Section title="crontab and at">
        <div className="grid gap-x-6 md:grid-cols-2">
          <CodeBlock
            lang="bash"
            title="crontab"
            code={`crontab -e      # edit your jobs
crontab -l      # list your jobs
crontab -l > /home/student/lab/crontab.bak   # back up
sudo crontab -l -u svc-backup                # another user's jobs
# crontab -r  deletes ALL jobs without asking. Avoid!`}
          />
          <CodeBlock
            lang="bash"
            title="at (one-time jobs)"
            code={`at 23:00                 # type command, then Ctrl+D
echo "/home/student/report.sh" | at now + 2 hours
at 09:00 tomorrow < /home/student/lab/job.txt
atq                      # list waiting jobs
atrm 3                   # remove job 3`}
          />
        </div>
      </Section>

      <Section title="schtasks (Windows Command Prompt)">
        <CodeBlock
          lang="batch"
          code={`schtasks /create /tn "IT-Lab\\Report" /tr "C:\\Lab\\report.bat" /sc daily /st 18:00
schtasks /create /tn "IT-Lab\\Weekly" /tr "C:\\Lab\\weekly.bat" /sc weekly /d SUN /st 03:00
schtasks /create /tn "IT-Lab\\Boot" /tr "C:\\Lab\\boot.bat" /sc onstart /ru SYSTEM
schtasks /run    /tn "IT-Lab\\Report"
schtasks /query  /tn "IT-Lab\\Report" /v /fo list
schtasks /change /tn "IT-Lab\\Report" /disable
schtasks /delete /tn "IT-Lab\\Report" /f`}
        />
      </Section>

      <Section title="PowerShell ScheduledTasks cmdlets">
        <CodeBlock
          lang="powershell"
          code={`$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -File C:\\Lab\\report.ps1' -WorkingDirectory 'C:\\Lab'
$t = New-ScheduledTaskTrigger -Daily -At '18:00'
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskPath '\\IT-Lab\\' -TaskName 'Report' -Action $a -Trigger $t -Settings $s

Get-ScheduledTask -TaskPath '\\IT-Lab\\'                         # list
Start-ScheduledTask -TaskPath '\\IT-Lab\\' -TaskName 'Report'    # run now
Get-ScheduledTaskInfo -TaskPath '\\IT-Lab\\' -TaskName 'Report'  # LastRunTime, LastTaskResult
Disable-ScheduledTask -TaskPath '\\IT-Lab\\' -TaskName 'Report'
Unregister-ScheduledTask -TaskPath '\\IT-Lab\\' -TaskName 'Report' -Confirm:$false

# Safe delete: preview first
Get-ChildItem C:\\Lab\\Logs -Filter *.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -WhatIf`}
        />
        <CodeBlock lang="bash" title="Linux safe delete" code={`find /home/student/lab/logs -type f -name '*.log' -mtime +7 -print           # preview
find /home/student/lab/logs -type f -name '*.log' -mtime +7 -print -delete   # then delete`} />
      </Section>

      <Section title="Task Scheduler Last Run Result codes">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Last Run Result codes (scrolls sideways)">
          <table className="w-full min-w-[560px] text-left text-[0.95rem]">
            <thead className="bg-navy text-white">
              <tr>
                <th scope="col" className="p-2">Code</th>
                <th scope="col" className="p-2">Meaning</th>
                <th scope="col" className="p-2">What to check</th>
              </tr>
            </thead>
            <tbody>
              {RESULT_CODES.map((c, i) => (
                <tr key={c.code} className={i % 2 ? 'bg-card' : ''}>
                  <td className="p-2 font-mono font-bold text-navy">{c.code}</td>
                  <td className="p-2">
                    <strong>{c.name}.</strong> {c.meaning}
                  </td>
                  <td className="p-2">{c.check}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Troubleshooting order">
        <ol className="list-decimal space-y-1 pl-6">
          <li>Did the scheduler start it? (History tab / <C>grep CRON /var/log/syslog</C> or <C>journalctl -u cron</C>)</li>
          <li>Did the script start and finish? Read its log and exit code.</li>
          <li>Run the exact command by hand, as the same user.</li>
          <li>Fix one thing at a time, then test again.</li>
        </ol>
      </Section>
    </>
  )
}
