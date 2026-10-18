import { FaBroom, FaChartBar, FaDatabase, FaDownload, FaHeartbeat, FaTools } from 'react-icons/fa'
import { LESSONS } from '../data/lessons'
import { C, Callout, DocLinks, IconCircle, LessonNav, PageHeader, Section, Term, TryInTerminal } from '../components/ui'
import { CodeBlock } from '../components/CodeBlock'
import { CleanupPreviewer } from '../demos/CleanupPreviewer'

const lesson = LESSONS[4]

export default function Lesson5() {
  return (
    <>
      <PageHeader
        stage={lesson.id}
        kicker={lesson.kicker}
        title={lesson.title}
        slides={lesson.slides}
        icon={lesson.icon}
        intro="The scheduler only decides when. The script does the real work. On Windows we write PowerShell; on Linux we write Bash."
      />

      <Section kicker="Slide 14" title="Scripts Do the Real Work: PowerShell and Bash">
        <div className="grid gap-x-5 lg:grid-cols-2">
          <div>
            <h3 className="text-xl">
              <Term id="powershell">PowerShell</Term> (Windows)
            </h3>
            <p>.ps1 files; readable Verb-Noun commands</p>
            <CodeBlock
              lang="powershell"
              title="C:\Lab\cleanup.ps1"
              code={`# Delete .log files older than 7 days
Get-ChildItem C:\\Lab\\Logs -Filter *.log |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } |
  Remove-Item -WhatIf   # preview first
exit 0`}
            />
            <ul className="list-disc space-y-1 pl-5 text-[0.95rem]">
              <li><C>Get-ChildItem</C> lists the files.</li>
              <li><C>Where-Object</C> keeps only those last changed more than 7 days ago.</li>
              <li><C>Remove-Item -WhatIf</C> shows what it would delete, without deleting.</li>
              <li><C>exit 0</C> tells the scheduler “success” (0x0).</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl">
              <Term id="bash">Bash</Term> (Linux)
            </h3>
            <p>
              Starts with <Term id="shebang">#!/bin/bash</Term>; run <C>chmod +x</C>
            </p>
            <CodeBlock
              lang="bash"
              title="/home/student/lab/backup.sh"
              code={`#!/bin/bash
# Back up the data folder with a date
tar -czf /home/student/backups/data.tar.gz \\
    /home/student/data
echo "Backup done: $(date)" >> /home/student/backups/backup.log
exit 0`}
            />
            <ul className="list-disc space-y-1 pl-5 text-[0.95rem]">
              <li><C>tar -czf</C> packs and compresses the folder into one file.</li>
              <li><C>\</C> at the end of a line continues the command on the next line.</li>
              <li><C>echo … &gt;&gt; backup.log</C> writes a line to the log with the date.</li>
              <li>Make it runnable once: <C>chmod +x /home/student/lab/backup.sh</C></li>
            </ul>
          </div>
        </div>
        <Callout tone="tip" title="Golden habit">
          Preview before deleting: <C>-WhatIf</C> in PowerShell, <C>find … -print</C> in Linux. See <Term id="whatif">-WhatIf / preview</Term>.
        </Callout>
        <CleanupPreviewer />
      </Section>

      <TryInTerminal track="bash" title="Do it yourself: write your first Bash script" text="Create backup.sh, fix “Permission denied” with chmod, run it and check the log." />
      <TryInTerminal track="cleanup" title="Do it yourself: clean up logs safely" text="Preview with find -print, delete with -delete, and schedule a one-time job with at." />

      <Section kicker="Slide 15" title="What System Administrators Automate">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: FaDatabase, t: 'Backups', f: 'Nightly' },
            { icon: FaBroom, t: 'Log cleanup', f: 'Daily or weekly' },
            { icon: FaDownload, t: 'Updates', f: 'Weekly' },
            { icon: FaHeartbeat, t: 'Monitoring', f: 'Every 5-15 minutes' },
            { icon: FaChartBar, t: 'Reports', f: 'Daily, weekly, monthly' },
            { icon: FaTools, t: 'Maintenance', f: 'Off-hours' },
          ].map((x, i) => (
            <li key={x.t} className="card flex items-center gap-4 p-4">
              <IconCircle icon={x.icon} tone={i % 2 ? 'teal' : 'amber'} />
              <div>
                <p className="text-lg font-bold text-navy">{x.t}</p>
                <p className="text-teal">{x.f}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <DocLinks
        links={[
          { label: 'Remove-Item (and -WhatIf)', href: 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/remove-item' },
          { label: 'find(1) manual page (-mtime, -print, -delete)', href: 'https://man7.org/linux/man-pages/man1/find.1.html' },
          { label: 'GNU Bash manual', href: 'https://www.gnu.org/software/bash/manual/bash.html' },
        ]}
      />
      <LessonNav id={5} />
    </>
  )
}
