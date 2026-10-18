import { FaBell, FaClipboardList, FaEye, FaKey, FaLock, FaUserShield } from 'react-icons/fa'
import { LESSONS } from '../data/lessons'
import { Analogy, Callout, DocLinks, IconCircle, LessonNav, PageHeader, Section, Term } from '../components/ui'
import { SecurityToggle } from '../demos/SecurityToggle'
import { LogViewer } from '../demos/LogViewer'

const lesson = LESSONS[6]

export default function Lesson7() {
  return (
    <>
      <PageHeader
        stage={lesson.id}
        kicker={lesson.kicker}
        title={lesson.title}
        slides={lesson.slides}
        icon={lesson.icon}
        intro="A scheduled job runs with real power while nobody watches. Keep it safe, and check that it really did its work."
      />

      <Section kicker="Slide 18 · Security" title="Keep Automation Safe">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: FaUserShield, t: 'Least privilege', d: <>Give each job only the access it needs, like a hotel key card that opens only certain rooms. (<Term id="least-privilege">least privilege</Term>)</> },
            { icon: FaLock, t: 'Protect your scripts', d: 'Only admins should be able to edit them, or anyone could add harmful commands.' },
            { icon: FaKey, t: 'No passwords in scripts', d: <>Use a password vault, Credential Manager, or a managed service account. (<Term id="credential-store">credential store</Term>)</> },
            { icon: FaEye, t: 'Review and audit', d: <>List scheduled jobs regularly. An unknown task could be malware. (<Term id="audit">audit</Term>)</> },
          ].map((x, i) => (
            <div key={x.t} className="card flex gap-4 p-5">
              <IconCircle icon={x.icon} tone={i % 2 ? 'teal' : 'amber'} />
              <div>
                <h3 className="text-lg">{x.t}</h3>
                <p className="mt-1">{x.d}</p>
              </div>
            </div>
          ))}
        </div>
        <Analogy>
          A <strong className="text-amber">hotel key card</strong> opens your room and the gym, not every room in the building. A backup job needs to read the data and write the backup,
          nothing more.
        </Analogy>
        <SecurityToggle />
      </Section>

      <Section kicker="Slide 19 · Monitoring" title="“It Ran” Is Not the Same as “It Worked”">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { n: 1, t: 'The scheduler started it', d: 'History tab, cron log' },
            { n: 2, t: 'The script succeeded', d: 'Script log, exit code 0' },
            { n: 3, t: 'The result really exists', d: 'Backup file is there and not empty' },
          ].map((x) => (
            <div key={x.n} className="card p-5">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber text-xl font-bold text-navy">{x.n}</span>
              <p className="mt-2 text-xs font-bold tracking-[0.14em] text-teal uppercase">Level {x.n}</p>
              <h3 className="text-lg">{x.t}</h3>
              <p>{x.d}</p>
            </div>
          ))}
        </div>
        <Callout tone="tip" title="Best proof for backups">
          <FaClipboardList className="mr-1 inline" aria-hidden /> Do a <strong>test restore</strong> regularly. Also set <FaBell className="mx-1 inline" aria-hidden /> alerts so failures
          are noticed. See <Term id="evidence">three levels of evidence</Term>.
        </Callout>
        <LogViewer />
      </Section>

      <DocLinks
        links={[
          { label: 'Event 4698: A scheduled task was created', href: 'https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-4698' },
          { label: 'Group Managed Service Accounts overview', href: 'https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/group-managed-service-accounts/group-managed-service-accounts/group-managed-service-accounts-overview' },
          { label: 'PowerShell SecretManagement module', href: 'https://learn.microsoft.com/en-us/powershell/utility-modules/secretmanagement/overview' },
          { label: 'chmod(1) manual page', href: 'https://man7.org/linux/man-pages/man1/chmod.1.html' },
        ]}
      />
      <LessonNav id={7} />
    </>
  )
}
