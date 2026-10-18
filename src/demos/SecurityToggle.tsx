import { useState } from 'react'
import { FaEye, FaKey, FaLock, FaLockOpen, FaUserShield } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import { DemoFrame, IconCircle } from '../components/ui'
import { CodeBlock, type CodeLang } from '../components/CodeBlock'

interface Pair {
  id: string
  title: string
  icon: IconType
  bad: { label: string; text: string; code: string; lang: CodeLang }
  good: { label: string; text: string; code: string; lang: CodeLang }
}

const PAIRS: Pair[] = [
  {
    id: 'privilege',
    title: 'Least privilege',
    icon: FaUserShield,
    bad: {
      label: 'Runs as Domain Admin',
      text: 'The backup job runs as a Domain Admin. If the script is changed or has a bug, it can damage every computer in the domain.',
      lang: 'text',
      code: 'General tab\n  When running the task, use: LAB\\Administrator   (member of Domain Admins)\n  [x] Run with highest privileges',
    },
    good: {
      label: 'Least-privilege service account',
      text: 'A group managed service account that can only read the data folder and write to the backup folder. Like a hotel key card that opens only certain rooms.',
      lang: 'powershell',
      code: "$principal = New-ScheduledTaskPrincipal -UserId 'LAB\\svc-backup$' -LogonType Password\nSet-ScheduledTask -TaskPath '\\IT-Lab\\' -TaskName 'NightlyBackup' -Principal $principal\n\n# Give it only what it needs\nicacls C:\\Lab\\Data    /grant 'LAB\\svc-backup$:(OI)(CI)R'\nicacls C:\\Lab\\Backups /grant 'LAB\\svc-backup$:(OI)(CI)M'",
    },
  },
  {
    id: 'password',
    title: 'No passwords in scripts',
    icon: FaKey,
    bad: {
      label: 'Password typed in the script',
      text: 'Anyone who can read the script (or a copy, or a backup of it) now has the password.',
      lang: 'powershell',
      code: "# DON'T: the password is visible to anyone who opens this file\n$pass = ConvertTo-SecureString 'Example-Only-123' -AsPlainText -Force\n$cred = New-Object PSCredential('LAB\\backup', $pass)",
    },
    good: {
      label: 'Read it from a vault',
      text: 'The secret lives in a protected vault. The script asks for it by name, and nothing secret is in the file.',
      lang: 'powershell',
      code: "# Microsoft.PowerShell.SecretManagement + a vault (e.g. SecretStore)\n$cred = Get-Secret -Name 'BackupShare' -Vault 'LabVault'\nNew-PSDrive -Name B -PSProvider FileSystem -Root '\\\\fileserver\\backups' -Credential $cred",
    },
  },
  {
    id: 'protect',
    title: 'Protect your scripts',
    icon: FaLock,
    bad: {
      label: 'Anyone can edit the script',
      text: 'The script is world-writable. Any user could add a harmful command, and the job would run it with its own (higher) rights.',
      lang: 'bash',
      code: '$ ls -l /home/student/lab/scripts/backup.sh\n-rwxrwxrwx 1 student student 412 Oct 16 09:12 backup.sh   # 777: everyone can write',
    },
    good: {
      label: 'Protected folder, chmod 700',
      text: 'Only the job’s owner can read, change or run the script, and the folder is locked too.',
      lang: 'bash',
      code: 'sudo chown -R svc-backup: /home/student/lab/scripts\nsudo chmod 700 /home/student/lab/scripts /home/student/lab/scripts/backup.sh\n\n$ ls -l /home/student/lab/scripts/backup.sh\n-rwx------ 1 svc-backup svc-backup 412 Oct 16 09:12 backup.sh',
    },
  },
  {
    id: 'audit',
    title: 'Review and audit',
    icon: FaEye,
    bad: {
      label: 'Nobody looks',
      text: 'New tasks appear and nobody notices. Attackers often hide malware as a scheduled task so it starts again after every reboot.',
      lang: 'text',
      code: 'Audit policy: Audit Other Object Access Events   Not configured\nLast review of scheduled tasks:                     never',
    },
    good: {
      label: 'Event IDs 4698–4702 reviewed',
      text: 'Turn on auditing, then regularly review who created, deleted, enabled, disabled or changed a task, and list all jobs.',
      lang: 'powershell',
      code: "# 4698 created, 4699 deleted, 4700 enabled, 4701 disabled, 4702 updated\n# (needs the 'Audit Other Object Access Events' policy turned on)\nGet-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4698,4699,4700,4701,4702 } -MaxEvents 20\n\n# List tasks that are not built into Windows\nGet-ScheduledTask | Where-Object TaskPath -notlike '\\Microsoft\\*'",
    },
  },
]

export function SecurityToggle() {
  const [secure, setSecure] = useState<Record<string, boolean>>({})
  const allSecure = PAIRS.every((p) => secure[p.id])

  return (
    <DemoFrame title="Security Before / After" icon={FaLock} hint="Each card shows a risky setup. Flip it to see the safe version.">
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => setSecure(Object.fromEntries(PAIRS.map((p) => [p.id, !allSecure])))}>
          {allSecure ? <FaLockOpen aria-hidden /> : <FaLock aria-hidden />} {allSecure ? 'Show all risky versions' : 'Make everything secure'}
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {PAIRS.map((p) => {
          const isSecure = !!secure[p.id]
          const side = isSecure ? p.good : p.bad
          return (
            <article
              key={p.id}
              className={`flex flex-col rounded-xl border-2 p-4 transition-colors ${isSecure ? 'border-teal bg-teal-soft' : 'border-danger/60 bg-danger-soft'}`}
            >
              <div className="flex items-center gap-3">
                <IconCircle icon={p.icon} tone={isSecure ? 'teal' : 'danger'} size="sm" />
                <div className="min-w-0">
                  <h4 className="text-lg">{p.title}</h4>
                  <p className={`text-xs font-bold uppercase ${isSecure ? 'text-teal' : 'text-danger-dark'}`}>
                    {isSecure ? '✔ Secure' : '✖ Insecure'}: {side.label}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[0.95rem]">{side.text}</p>
              <CodeBlock lang={side.lang} code={side.code} />
              <button
                type="button"
                role="switch"
                aria-checked={isSecure}
                className={`btn mt-auto self-start ${isSecure ? 'btn-ghost' : 'bg-teal text-white hover:brightness-110'}`}
                onClick={() => setSecure((s) => ({ ...s, [p.id]: !isSecure }))}
              >
                {isSecure ? 'Show the risky version' : 'Flip to the secure version'}
              </button>
            </article>
          )
        })}
      </div>
    </DemoFrame>
  )
}
