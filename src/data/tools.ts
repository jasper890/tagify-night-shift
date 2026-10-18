import type { CodeLang } from '../components/CodeBlock'

export interface ToolExample {
  title: string
  lang: CodeLang
  code: string
}

export interface ToolPage {
  slug: string
  name: string
  tagline: string
  platform: string
  what: string
  whenToUse: string[]
  concepts: { trigger: string; schedule: string; condition: string; dependency: string; queue: string }
  scenario: string
  examples: ToolExample[]
  explain: { code: string; text: string }[]
  extra?: { title: string; body: string; examples?: ToolExample[] }[]
  mistakes: string[]
  docs: { label: string; href: string }[]
}

export const TOOL_PAGES: ToolPage[] = [
  {
    slug: 'github-actions',
    name: 'GitHub Actions',
    tagline: 'cron in the cloud, next to your code',
    platform: 'Cloud (GitHub)',
    what: 'GitHub Actions runs workflows: YAML files in a repository’s .github/workflows folder. A workflow can start on events (a push, a pull request) or on a cron schedule. GitHub provides the machine (a “runner”), so you need no server of your own.',
    whenToUse: [
      'Jobs that belong to a code project: nightly tests, link checks, reports, deploys.',
      'You want logs, history and alerts in a web page without running a server.',
      'Not for jobs that must run at an exact minute: scheduled runs can be late.',
    ],
    concepts: {
      trigger: 'on: schedule (cron) and on: workflow_dispatch (manual button), plus events like push',
      schedule: "cron: '30 1 * * *' in UTC, at most once every 5 minutes",
      condition: 'if: on a job or step, e.g. if: failure()',
      dependency: 'needs: build makes a job wait for the build job',
      queue: 'concurrency: one run per group; cancel-in-progress: false keeps the next one waiting',
    },
    scenario: 'Every night, build this website, check every link, upload the report as an artifact, and alert the team if it fails.',
    examples: [
      {
        title: '.github/workflows/nightly-link-check.yml',
        lang: 'yaml',
        code: `name: Nightly link check

on:
  schedule:
    - cron: '30 1 * * *'     # 01:30 UTC every day = 9:30 AM in the Philippines (UTC+8)
  workflow_dispatch:          # adds a "Run workflow" button for manual runs

concurrency:
  group: nightly-link-check
  cancel-in-progress: false   # never two runs at once; the next one waits

permissions:
  contents: read              # least privilege for the built-in token

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm test
      - run: npm run build

  link-check:
    needs: build              # dependency: only after build succeeds
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node scripts/check-links.mjs | tee link-report.txt
      - name: Upload the report
        if: always()          # condition: upload even if the check failed
        uses: actions/upload-artifact@v4
        with:
          name: link-report
          path: link-report.txt
          retention-days: 14
      - name: Alert the team
        if: failure()         # condition: only when something failed
        run: |
          curl -fsS -X POST -H 'Content-Type: application/json' \\
            -d '{"text":"Nightly link check failed"}' "$ALERT_WEBHOOK"
        env:
          ALERT_WEBHOOK: \${{ secrets.ALERT_WEBHOOK_URL }}`,
      },
    ],
    explain: [
      { code: "cron: '30 1 * * *'", text: 'The same five fields as Linux cron. GitHub always reads them as UTC, so convert from your local time.' },
      { code: 'workflow_dispatch:', text: 'Lets you run the workflow by hand from the Actions tab, so you can test it without waiting for 1:30.' },
      { code: 'concurrency:', text: 'The job queue. Only one run in the group at a time; with cancel-in-progress: false a new run waits (GitHub keeps at most one waiting).' },
      { code: 'permissions: contents: read', text: 'The workflow’s token can only read the code. Least privilege again.' },
      { code: 'needs: build', text: 'Dependency: link-check starts only after build finishes successfully.' },
      { code: 'if: always() / if: failure()', text: 'Conditions on steps: always upload the report; send the alert only on failure.' },
      { code: '${{ secrets.ALERT_WEBHOOK_URL }}', text: 'The webhook address is stored encrypted in the repository settings, never typed in the file. GitHub hides it in logs.' },
    ],
    extra: [
      {
        title: 'Five facts to remember about scheduled workflows',
        body: '1) Schedules use UTC. 2) The shortest interval is every 5 minutes. 3) Runs can be delayed at busy times (the start of every hour is busiest), and very delayed runs may be dropped. 4) Schedules only run from the workflow file on the default branch. 5) In public repositories, scheduled workflows are turned off automatically after 60 days with no repository activity.',
      },
    ],
    mistakes: [
      'Forgetting UTC: 0 2 * * * runs at 10:00 AM in Manila, not 2:00 AM. For 2:00 AM Manila time use 0 18 * * * (the day before in UTC).',
      'Scheduling at minute 0 (0 * * * *). Everyone does that, so runs are often late. Pick an odd minute such as 17.',
      'Editing the schedule on a feature branch and wondering why nothing happens: only the default branch counts.',
      'Writing a password or token in the YAML. Use repository secrets: ${{ secrets.NAME }}.',
      'Not noticing a public repository’s schedule was disabled after 60 quiet days. Check the Actions tab.',
    ],
    docs: [
      { label: 'Events that trigger workflows: schedule', href: 'https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule' },
      { label: 'Control the concurrency of workflows and jobs', href: 'https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs' },
      { label: 'Using secrets in GitHub Actions', href: 'https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions' },
      { label: 'Disabling and enabling a workflow (60-day rule)', href: 'https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow' },
    ],
  },
  {
    slug: 'ansible',
    name: 'Ansible',
    tagline: 'one command, the same job on 50 servers',
    platform: 'Cross-platform (Linux over SSH, Windows over WinRM)',
    what: 'Ansible is a configuration tool. You describe how servers should look in a YAML “playbook”, and Ansible makes every server in your inventory match it. It is not a scheduler itself; it installs cron jobs and scheduled tasks for you, the same way on every machine.',
    whenToUse: [
      'You manage many servers and want the same jobs on all of them.',
      'You want your scheduled jobs written down in files you can review and track in Git.',
      'You want to preview changes before making them (--check).',
    ],
    concepts: {
      trigger: 'You (or a scheduler like cron, Jenkins or AWX) run ansible-playbook',
      schedule: 'It installs the schedule: ansible.builtin.cron minute/hour fields, or Windows task triggers',
      condition: 'when: on a task, e.g. when: ansible_os_family == "Debian"',
      dependency: 'Tasks run top to bottom; handlers run only after a change',
      queue: 'serial: 10 updates 10 servers at a time; forks limits parallel connections',
    },
    scenario: 'Install the 1:30 AM backup job, its script and its service account on 50 Linux servers, and the 10 PM cleanup task on the Windows lab PCs.',
    examples: [
      {
        title: 'inventory.ini',
        lang: 'ini',
        code: `[linux_servers]
web[01:25].lab.local
db[01:25].lab.local

[lab_pcs]
pc[01:40].lab.local

[lab_pcs:vars]
ansible_connection=winrm
ansible_winrm_transport=kerberos`,
      },
      {
        title: 'backup.yml',
        lang: 'yaml',
        code: `- name: Install the nightly backup on all Linux servers
  hosts: linux_servers
  become: true                  # run tasks with sudo
  vars_files:
    - vault.yml                 # encrypted with ansible-vault

  tasks:
    - name: Create the service account
      ansible.builtin.user:
        name: svc-backup
        system: true
        shell: /usr/sbin/nologin

    - name: Create the lab folder
      ansible.builtin.file:
        path: /home/student/lab/logs
        state: directory
        owner: svc-backup
        mode: '0700'

    - name: Copy the backup script (only svc-backup can run it)
      ansible.builtin.copy:
        src: files/backup.sh
        dest: /home/student/lab/backup.sh
        owner: svc-backup
        group: svc-backup
        mode: '0700'

    - name: Store the database login from the vault
      ansible.builtin.copy:
        dest: /home/svc-backup/.my.cnf
        content: |
          [client]
          user=backup
          password={{ vault_db_password }}
        owner: svc-backup
        mode: '0600'
      no_log: true              # never print the secret

    - name: Schedule the backup every night at 1:30 AM
      ansible.builtin.cron:
        name: nightly backup    # Ansible finds the line again by this name
        user: svc-backup
        minute: '30'
        hour: '1'
        job: /home/student/lab/backup.sh >> /home/student/lab/logs/backup.log 2>&1`,
      },
      {
        title: 'Run it: preview first, then for real',
        lang: 'bash',
        code: `ansible-vault create vault.yml          # type: vault_db_password: ...
ansible-playbook -i inventory.ini backup.yml --check --diff --ask-vault-pass   # preview
ansible-playbook -i inventory.ini backup.yml --ask-vault-pass                  # apply

# Run it again: nothing changes (idempotence)
PLAY RECAP *********************************************************
db01.lab.local  : ok=6  changed=0  unreachable=0  failed=0  skipped=0
web01.lab.local : ok=6  changed=0  unreachable=0  failed=0  skipped=0`,
      },
    ],
    explain: [
      { code: 'hosts: linux_servers', text: 'Which group from the inventory to work on: here all 50 Linux servers.' },
      { code: 'become: true', text: 'Run the tasks with administrator rights (sudo), because creating users and system files needs them.' },
      { code: 'vars_files: vault.yml', text: 'Secrets live in a file encrypted with Ansible Vault. The playbook can be shared; the password cannot be read.' },
      { code: "mode: '0700'", text: 'Protect the script: only its owner can read, change or run it.' },
      { code: 'no_log: true', text: 'Stops Ansible from printing this task’s values, so the password never appears in logs.' },
      { code: 'ansible.builtin.cron:', text: 'Adds the line 30 1 * * * … to svc-backup’s crontab. The name: tag lets Ansible update this line instead of adding a duplicate.' },
      { code: '--check --diff', text: 'Preview mode, like -WhatIf: shows what would change on each server without changing anything.' },
    ],
    extra: [
      {
        title: 'Windows lab PCs: the same idea',
        body: 'The scheduled task module for Windows is community.windows.win_scheduled_task (it lives in the community.windows collection, not ansible.windows). It creates the same task you built in Lesson 3.',
        examples: [
          {
            title: 'cleanup.yml',
            lang: 'yaml',
            code: `- name: Install the cleanup task on all lab PCs
  hosts: lab_pcs
  tasks:
    - name: Clear student files at 10 PM, only if idle
      community.windows.win_scheduled_task:
        name: ClearStudentFiles
        path: \\IT-Lab\\
        actions:
          - path: powershell.exe
            arguments: -NoProfile -File C:\\Lab\\clear-student-files.ps1
            working_directory: C:\\Lab        # the "Start in" field
        triggers:
          - type: daily
            start_boundary: '2026-01-01T22:00:00'
        run_only_if_idle: true
        username: SYSTEM
        state: present
        enabled: true`,
          },
        ],
      },
      {
        title: 'Idempotence, in plain words',
        body: 'Idempotent means “running it twice gives the same result as running it once”. Ansible checks first and changes only what is different. That is why changed=0 on the second run is good news: every server already matches the playbook.',
      },
    ],
    mistakes: [
      'Using ansible.builtin.shell to run “echo … >> crontab”. It adds a duplicate line on every run. Use the cron module with a name.',
      'Leaving out name: in the cron task. Without it Ansible cannot find the line again and adds a new one each run.',
      'Putting passwords in plain YAML. Use Ansible Vault and no_log: true.',
      'Skipping --check. Preview first, especially on 50 servers.',
      'Expecting --check to be perfect: tasks that depend on earlier tasks (like a user that is not created yet) can show errors in check mode.',
    ],
    docs: [
      { label: 'ansible.builtin.cron module', href: 'https://docs.ansible.com/ansible/latest/collections/ansible/builtin/cron_module.html' },
      { label: 'community.windows.win_scheduled_task module', href: 'https://docs.ansible.com/ansible/latest/collections/community/windows/win_scheduled_task_module.html' },
      { label: 'Ansible Vault guide', href: 'https://docs.ansible.com/ansible/latest/vault_guide/index.html' },
      { label: 'Check mode and diff mode', href: 'https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html' },
    ],
  },
  {
    slug: 'systemd-timers',
    name: 'systemd timers',
    tagline: 'the modern Linux cron, with catch-up and logs',
    platform: 'Linux (with systemd)',
    what: 'Most modern Linux systems run systemd. A timer is a small .timer file that starts a matching .service file on a schedule. Compared with cron, timers can catch up runs missed while the PC was off, add a random delay, and keep every run’s output in the journal.',
    whenToUse: [
      'Linux servers where you want missed runs to happen after a reboot (Persistent=true).',
      'Many machines that should not all start at the same second (RandomizedDelaySec=).',
      'You want logs, exit codes and run history without writing your own log code.',
    ],
    concepts: {
      trigger: 'OnCalendar= (a time), OnBootSec= (after startup), OnUnitActiveSec= (after the last run)',
      schedule: 'OnCalendar=*-*-* 02:00:00 means every day at 2:00',
      condition: 'ConditionACPower=true, ConditionPathExists=/home/student/lab/data',
      dependency: 'After= and Requires= in the .service, e.g. After=network-online.target',
      queue: 'A running service is not started twice: if the last run is still going, the timer waits for it',
    },
    scenario: 'Run the backup every night at 2:00, catch up if the server was off, and spread the start by up to 15 minutes.',
    examples: [
      {
        title: '/etc/systemd/system/lab-backup.service',
        lang: 'ini',
        code: `[Unit]
Description=Nightly lab backup
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=svc-backup
ExecStart=/home/student/lab/backup.sh`,
      },
      {
        title: '/etc/systemd/system/lab-backup.timer',
        lang: 'ini',
        code: `[Unit]
Description=Run the lab backup every night at 2:00

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
RandomizedDelaySec=15min

[Install]
WantedBy=timers.target`,
      },
      {
        title: 'Turn it on and check it',
        lang: 'bash',
        code: `sudo systemctl daemon-reload                  # read the new files
sudo systemctl enable --now lab-backup.timer  # start now and after every boot
systemctl list-timers lab-backup.timer        # NEXT and LAST run times
systemd-analyze calendar '*-*-* 02:00:00'     # test the schedule
sudo systemctl start lab-backup.service       # run it once now, to test
journalctl -u lab-backup.service --since today   # the job's log`,
      },
    ],
    explain: [
      { code: 'Type=oneshot', text: 'The service does one job and then stops, like a script. That is what scheduled jobs are.' },
      { code: 'User=svc-backup', text: 'Runs as the service account, not root. Least privilege.' },
      { code: 'After=network-online.target', text: 'Dependency: wait until the network is up before starting.' },
      { code: 'OnCalendar=*-*-* 02:00:00', text: 'Year-month-day hour:minute:second. * means any, so: every day at 2:00:00.' },
      { code: 'Persistent=true', text: 'Catch-up: if the server was off at 2:00, run as soon as it starts again. cron cannot do this.' },
      { code: 'RandomizedDelaySec=15min', text: 'Wait a random 0–15 minutes first, so 40 machines do not hit the backup server at once (like slide 21).' },
      { code: 'journalctl -u', text: 'Everything the script printed, with timestamps, kept by systemd. Evidence level 1 and 2 in one place.' },
    ],
    mistakes: [
      'Enabling the .service instead of the .timer. Enable and start the timer; the timer starts the service.',
      'Forgetting systemctl daemon-reload after editing the files.',
      'Writing OnCalendar=2:00 and assuming a time zone. Timers use the system’s time zone unless you add one (e.g. OnCalendar=*-*-* 02:00:00 Asia/Manila).',
      'Leaving out Persistent=true and wondering why missed nights never ran.',
    ],
    docs: [
      { label: 'systemd.timer manual', href: 'https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html' },
      { label: 'systemd.time: calendar event syntax', href: 'https://www.freedesktop.org/software/systemd/man/latest/systemd.time.html' },
      { label: 'systemd-analyze calendar', href: 'https://www.freedesktop.org/software/systemd/man/latest/systemd-analyze.html' },
      { label: 'journalctl manual', href: 'https://www.freedesktop.org/software/systemd/man/latest/journalctl.html' },
    ],
  },
  {
    slug: 'kubernetes-cronjob',
    name: 'Kubernetes CronJob',
    tagline: 'scheduled jobs that run in containers',
    platform: 'Kubernetes cluster (any cloud or on-premises)',
    what: 'Kubernetes runs programs in containers across many machines. A CronJob is a Kubernetes object that creates a Job on a cron schedule; the Job starts a container, runs it to the end, and retries if it fails.',
    whenToUse: [
      'Your apps already run on Kubernetes and the job needs the same environment.',
      'You want built-in retries, history limits and a rule for overlapping runs.',
      'Not worth it for one small server: plain cron or a systemd timer is simpler.',
    ],
    concepts: {
      trigger: 'The CronJob controller creates a Job when the schedule matches',
      schedule: 'schedule: "0 2 * * *" with timeZone: "Asia/Manila"',
      condition: 'startingDeadlineSeconds: skip a run that could not start in time',
      dependency: 'Init containers run before the main container; for chains of jobs use a workflow tool',
      queue: 'concurrencyPolicy: Allow (parallel), Forbid (skip if running), Replace (stop the old one)',
    },
    scenario: 'Dump the school database every night at 2:00 Manila time, never two at once, with retries and a short history.',
    examples: [
      {
        title: 'nightly-backup.yaml',
        lang: 'yaml',
        code: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-backup
spec:
  schedule: "0 2 * * *"
  timeZone: "Asia/Manila"
  concurrencyPolicy: Forbid          # job queue: skip if the last run is still going
  startingDeadlineSeconds: 600       # if it cannot start within 10 minutes, skip this run
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      backoffLimit: 2                # retry up to 2 more times
      activeDeadlineSeconds: 3600    # stop after 1 hour
      template:
        spec:
          restartPolicy: OnFailure
          securityContext:
            runAsNonRoot: true
            runAsUser: 999
            fsGroup: 999
          containers:
            - name: backup
              image: postgres:16
              command: ["/bin/sh", "-c"]
              args:
                - pg_dump "$DATABASE_URL" > /backup/school-$(date +%F).sql
              env:
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: backup-db
                      key: url
              volumeMounts:
                - name: backup
                  mountPath: /backup
          volumes:
            - name: backup
              persistentVolumeClaim:
                claimName: backup-pvc`,
      },
      {
        title: 'Apply, test and check',
        lang: 'bash',
        code: `kubectl apply -f nightly-backup.yaml
kubectl get cronjob nightly-backup                          # SCHEDULE, LAST SCHEDULE
kubectl create job --from=cronjob/nightly-backup test-run   # run once now
kubectl get jobs
kubectl logs job/test-run`,
      },
    ],
    explain: [
      { code: 'schedule / timeZone', text: 'Normal five-field cron, read in the time zone you name (supported since Kubernetes 1.27). Without timeZone it uses the controller’s time zone.' },
      { code: 'concurrencyPolicy: Forbid', text: 'If yesterday’s job is somehow still running, today’s is skipped. Allow would run both; Replace would stop the old one.' },
      { code: 'startingDeadlineSeconds: 600', text: 'If the cluster was busy or down, a run may start up to 10 minutes late; after that it counts as missed.' },
      { code: 'successfulJobsHistoryLimit / failedJobsHistoryLimit', text: 'How many finished Jobs to keep so you can read their logs. Old ones are cleaned up.' },
      { code: 'backoffLimit: 2', text: 'Retries: if the container fails, Kubernetes tries again, waiting longer each time.' },
      { code: 'secretKeyRef', text: 'The database address and password come from a Kubernetes Secret, not from the YAML file.' },
      { code: 'runAsNonRoot: true', text: 'The container may not run as root. Least privilege.' },
    ],
    mistakes: [
      'Leaving concurrencyPolicy at the default (Allow) for jobs that must never overlap.',
      'Forgetting timeZone and getting UTC (or the cluster’s zone) instead of local time.',
      'Not setting history limits, then having no logs (or too many old Jobs) when you need them.',
      'Putting the password in env: value:. Use a Secret.',
      'Trusting “Completed” alone. Like Lesson 7, check that the backup file exists and is not empty.',
    ],
    docs: [
      { label: 'Kubernetes: CronJob', href: 'https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/' },
      { label: 'Kubernetes: Jobs (backoffLimit, activeDeadlineSeconds)', href: 'https://kubernetes.io/docs/concepts/workloads/controllers/job/' },
      { label: 'Kubernetes: Secrets', href: 'https://kubernetes.io/docs/concepts/configuration/secret/' },
    ],
  },
  {
    slug: 'jenkins',
    name: 'Jenkins',
    tagline: 'pipelines with a web dashboard',
    platform: 'Cross-platform server (Java)',
    what: 'Jenkins is a free automation server with a web interface. You describe a pipeline (a list of stages) in a file called a Jenkinsfile. Pipelines can start on a schedule, after code changes, or by hand, and Jenkins keeps the log of every run.',
    whenToUse: [
      'Your team already uses Jenkins for building and testing code.',
      'You want a dashboard of every run, with logs, for many jobs.',
      'You need agents on both Windows and Linux machines from one place.',
    ],
    concepts: {
      trigger: "triggers { cron('H 2 * * *') }, pollSCM, webhooks, or Build Now",
      schedule: 'Cron syntax with the extra H symbol to spread jobs out',
      condition: 'when { branch "main" } on a stage',
      dependency: 'Stages run in order; a failed stage stops the rest',
      queue: 'options { disableConcurrentBuilds() } makes new runs wait in the queue',
    },
    scenario: 'Every night around 2 AM, run the backup script on a Linux agent, verify the file, and email the team if it fails.',
    examples: [
      {
        title: 'Jenkinsfile',
        lang: 'groovy',
        code: `pipeline {
  agent { label 'linux' }

  triggers {
    cron('H 2 * * *')          // once between 2:00 and 2:59, same minute every night
  }

  options {
    disableConcurrentBuilds()   // job queue: never two runs at once
    timeout(time: 1, unit: 'HOURS')
    buildDiscarder(logRotator(numToKeepStr: '30'))
  }

  environment {
    DB = credentials('backup-db')   // from the Jenkins credential store: DB_USR, DB_PSW
  }

  stages {
    stage('Backup') {
      steps {
        retry(2) {
          sh '/home/student/lab/backup.sh'
        }
      }
    }
    stage('Verify') {
      steps {
        // -s: the file exists and is not empty
        sh 'test -s /home/student/lab/backups/latest.sql'
      }
    }
  }

  post {
    failure {
      mail to: 'it-team@example.com',
           subject: "Backup FAILED: \${env.JOB_NAME} #\${env.BUILD_NUMBER}",
           body: "See the log: \${env.BUILD_URL}"
    }
  }
}`,
      },
    ],
    explain: [
      { code: "cron('H 2 * * *')", text: 'H means “hash”: Jenkins picks one minute for this job from its name. Different jobs get different minutes, so 100 jobs “at 2 AM” do not all start at 2:00:00.' },
      { code: 'disableConcurrentBuilds()', text: 'If a run is still going, the next one waits in the queue.' },
      { code: "credentials('backup-db')", text: 'Reads a saved username and password from Jenkins. Jenkins hides them in the log.' },
      { code: 'retry(2)', text: 'If the backup step fails, try it again (2 tries in total).' },
      { code: "sh 'test -s …'", text: 'Evidence level 3: fail the build if the backup file is missing or empty.' },
      { code: 'post { failure { … } }', text: 'Runs after the stages, only if the build failed: send an alert so a person notices.' },
    ],
    extra: [
      {
        title: 'More about H',
        body: 'H 2 * * * = one fixed minute in the 2 AM hour. H(0-29) 2 * * * = a minute between 2:00 and 2:29. H/15 * * * * = every 15 minutes, starting at a minute chosen per job. You can also write @midnight, which Jenkins spreads between 12:00 and 2:59 AM.',
      },
    ],
    mistakes: [
      'Writing 0 2 * * * for every job, so they all start at once. Use H.',
      'Typing passwords into the Jenkinsfile. Use the credentials store.',
      'No post { failure } block, so a failed nightly job goes unnoticed.',
      'Forgetting the Jenkins server’s time zone: cron() uses the server’s zone unless you add TZ=Asia/Manila on the first line of the trigger.',
    ],
    docs: [
      { label: 'Pipeline syntax: triggers', href: 'https://www.jenkins.io/doc/book/pipeline/syntax/#triggers' },
      { label: 'Pipeline syntax: post', href: 'https://www.jenkins.io/doc/book/pipeline/syntax/#post' },
      { label: 'Using credentials in a Jenkinsfile', href: 'https://www.jenkins.io/doc/book/pipeline/jenkinsfile/#handling-credentials' },
    ],
  },
  {
    slug: 'powershell-scheduledtasks',
    name: 'PowerShell ScheduledTasks module',
    tagline: 'Task Scheduler, written as a script',
    platform: 'Windows',
    what: 'Everything you click in Task Scheduler can also be done with the ScheduledTasks PowerShell module, built into Windows. A script creates the same task the same way on every PC, which is faster and more reliable than clicking on 40 computers.',
    whenToUse: [
      'You need the same scheduled task on many Windows PCs or servers.',
      'You want the task’s settings saved in a file you can review.',
      'You need settings schtasks cannot set (Start in, retries, MultipleInstances).',
    ],
    concepts: {
      trigger: 'New-ScheduledTaskTrigger -Daily / -Weekly / -Once / -AtStartup / -AtLogOn',
      schedule: "-At '01:30', -DaysOfWeek, -RandomDelay",
      condition: 'New-ScheduledTaskSettingsSet -RunOnlyIfIdle, -RunOnlyIfNetworkAvailable',
      dependency: 'Several actions on one task run one after another, in order',
      queue: '-MultipleInstances IgnoreNew | Queue | Parallel | StopExisting',
    },
    scenario: 'Create the 1:30 AM backup task, with retries, a time limit, catch-up and a service account, then read its result.',
    examples: [
      {
        title: 'C:\\Lab\\install-backup-task.ps1 (run as administrator)',
        lang: 'powershell',
        code: `$action = New-ScheduledTaskAction -Execute 'powershell.exe' \`
  -Argument '-NoProfile -ExecutionPolicy Bypass -File C:\\Lab\\backup.ps1' \`
  -WorkingDirectory 'C:\\Lab'

$trigger = New-ScheduledTaskTrigger -Daily -At '01:30'

$settings = New-ScheduledTaskSettingsSet \`
  -MultipleInstances IgnoreNew \`
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) \`
  -StartWhenAvailable \`
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10) \`
  -RunOnlyIfNetworkAvailable

$principal = New-ScheduledTaskPrincipal -UserId 'LAB\\svc-backup$' -LogonType Password

Register-ScheduledTask -TaskPath '\\IT-Lab\\' -TaskName 'NightlyBackup' \`
  -Description 'Back up C:\\Lab\\Data every night' \`
  -Action $action -Trigger $trigger -Settings $settings -Principal $principal`,
      },
      {
        title: 'Test it and read the result',
        lang: 'powershell',
        code: `Start-ScheduledTask -TaskPath '\\IT-Lab\\' -TaskName 'NightlyBackup'

Get-ScheduledTaskInfo -TaskPath '\\IT-Lab\\' -TaskName 'NightlyBackup' |
  Select-Object LastRunTime, LastTaskResult, NextRunTime, NumberOfMissedRuns

# LastTaskResult 0 = 0x0 = success; 267009 = 0x41301 = still running`,
      },
      {
        title: 'The same task on many PCs at once',
        lang: 'powershell',
        code: `$pcs = Get-Content C:\\Lab\\lab-pcs.txt          # one computer name per line
$sessions = New-CimSession -ComputerName $pcs
Register-ScheduledTask -CimSession $sessions -TaskPath '\\IT-Lab\\' -TaskName 'NightlyBackup' \`
  -Action $action -Trigger $trigger -Settings $settings -Principal $principal`,
      },
    ],
    explain: [
      { code: 'New-ScheduledTaskAction … -WorkingDirectory', text: 'WHAT runs. -WorkingDirectory is the “Start in” field, so the script does not start in System32.' },
      { code: 'New-ScheduledTaskTrigger -Daily', text: 'WHEN it runs: every day at 1:30 AM.' },
      { code: '-MultipleInstances IgnoreNew', text: 'Job queue: if it is still running, do not start another copy.' },
      { code: '-ExecutionTimeLimit', text: 'Stop it if it runs longer than 2 hours (it is probably stuck).' },
      { code: '-StartWhenAvailable', text: 'Catch-up: if the PC was off at 1:30, run as soon as possible afterwards.' },
      { code: '-RestartCount / -RestartInterval', text: 'Retries: if it fails, try again every 10 minutes, up to 3 times.' },
      { code: "-UserId 'LAB\\svc-backup$' -LogonType Password", text: 'Run as a group managed service account. Windows handles its password; nobody types it.' },
      { code: 'Get-ScheduledTaskInfo', text: 'Reads LastTaskResult (the Last Run Result as a number) and NumberOfMissedRuns.' },
    ],
    mistakes: [
      'Leaving out -WorkingDirectory, then getting 0x1 or 0x2 because relative paths look in System32.',
      'Running the task as your own admin account. Use a service account with only the rights it needs.',
      'Passing -Password in the script. Use a gMSA (no password) or let an admin type it once.',
      'Forgetting -StartWhenAvailable on laptops and lab PCs that are often off at night.',
    ],
    docs: [
      { label: 'New-ScheduledTaskSettingsSet', href: 'https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset' },
      { label: 'New-ScheduledTaskTrigger', href: 'https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasktrigger' },
      { label: 'Register-ScheduledTask', href: 'https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/register-scheduledtask' },
      { label: 'Get-ScheduledTaskInfo', href: 'https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/get-scheduledtaskinfo' },
    ],
  },
  {
    slug: 'cloud-schedulers',
    name: 'Cloud schedulers',
    tagline: 'AWS, Azure and Google: no server to keep awake',
    platform: 'Cloud (AWS, Azure, Google Cloud)',
    what: 'Every big cloud has a managed scheduler. It is always on, so you never miss a run because a PC was off. It does not do the work itself: at the right time it starts something else (a function, a script, a container, or a web address). All three use cron or rate expressions, and all three let you pick a time zone.',
    whenToUse: [
      'The job already runs in the cloud (a function, a container, an API).',
      'You do not want to keep a server running just to start a job.',
      'You need retries and alerts managed for you.',
    ],
    concepts: {
      trigger: 'The scheduler calls a target: a Lambda function, a runbook, a URL, a Pub/Sub topic',
      schedule: 'cron(…) or rate(5 minutes), with a time zone',
      condition: 'Usually in the target code; Logic Apps can add conditions in the workflow',
      dependency: 'Chain steps in Step Functions, Logic Apps or Workflows',
      queue: 'Retry policies and flexible time windows; overlap is handled by the target',
    },
    scenario: 'Start the nightly backup at 1:30 AM Manila time on each cloud.',
    examples: [
      {
        title: 'AWS EventBridge Scheduler (AWS CLI)',
        lang: 'bash',
        code: `aws scheduler create-schedule \\
  --name nightly-backup \\
  --schedule-expression "cron(30 1 * * ? *)" \\
  --schedule-expression-timezone "Asia/Manila" \\
  --flexible-time-window '{"Mode": "OFF"}' \\
  --target '{
    "Arn": "arn:aws:lambda:ap-southeast-1:123456789012:function:lab-backup",
    "RoleArn": "arn:aws:iam::123456789012:role/scheduler-invoke-lab-backup",
    "RetryPolicy": {"MaximumRetryAttempts": 3}
  }'

# Other expressions:  rate(5 minutes)   at(2026-12-24T22:00:00)`,
      },
      {
        title: 'Azure Automation schedule (Az PowerShell)',
        lang: 'powershell',
        code: `New-AzAutomationSchedule -ResourceGroupName 'rg-lab' -AutomationAccountName 'lab-automation' \`
  -Name 'Nightly-0130' -StartTime (Get-Date '01:30').AddDays(1) -DayInterval 1 -TimeZone 'Asia/Manila'

Register-AzAutomationScheduledRunbook -ResourceGroupName 'rg-lab' -AutomationAccountName 'lab-automation' \`
  -RunbookName 'Backup-LabFiles' -ScheduleName 'Nightly-0130'`,
      },
      {
        title: 'Azure Logic Apps: Recurrence trigger (workflow JSON)',
        lang: 'json',
        code: `"triggers": {
  "Recurrence": {
    "type": "Recurrence",
    "recurrence": {
      "frequency": "Day",
      "interval": 1,
      "schedule": { "hours": [1], "minutes": [30] },
      "timeZone": "Singapore Standard Time"
    }
  }
}`,
      },
      {
        title: 'Google Cloud Scheduler (gcloud)',
        lang: 'bash',
        code: `gcloud scheduler jobs create http nightly-backup \\
  --location=asia-southeast1 \\
  --schedule="30 1 * * *" \\
  --time-zone="Asia/Manila" \\
  --uri="https://lab-backup-example.a.run.app/run" \\
  --http-method=POST \\
  --oidc-service-account-email=scheduler-invoker@lab-project.iam.gserviceaccount.com \\
  --max-retry-attempts=3`,
      },
    ],
    explain: [
      { code: 'cron(30 1 * * ? *)', text: 'AWS cron has SIX fields: minute, hour, day of month, month, day of week, year. One of the two “day” fields must be ?.' },
      { code: '--schedule-expression-timezone', text: 'AWS reads the schedule in Manila time, so 1:30 means 1:30 AM local.' },
      { code: 'RoleArn', text: 'The scheduler uses a role that may only start this one function. Least privilege.' },
      { code: '-TimeZone / "timeZone"', text: 'Azure Automation uses IANA names like Asia/Manila; Logic Apps uses Windows names, where UTC+8 Manila is “Singapore Standard Time”.' },
      { code: '--schedule="30 1 * * *"', text: 'Google uses normal five-field Unix cron, the same as Lesson 4.' },
      { code: '--oidc-service-account-email', text: 'Google signs the request as a service account, so the backup service can check who is calling. No password in the job.' },
    ],
    mistakes: [
      'Copying a Linux cron line into AWS: AWS needs six fields and a ?.',
      'Forgetting the time zone and getting UTC.',
      'Giving the scheduler’s role full admin rights instead of permission to start one target.',
      'Assuming the scheduler checks the result. It only starts the job; you still need logs and alerts.',
    ],
    docs: [
      { label: 'AWS EventBridge Scheduler: schedule types (cron, rate, at)', href: 'https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html' },
      { label: 'Azure Automation: manage schedules', href: 'https://learn.microsoft.com/en-us/azure/automation/shared-resources/schedules' },
      { label: 'Azure Logic Apps: Recurrence trigger', href: 'https://learn.microsoft.com/en-us/azure/connectors/connectors-native-recurrence' },
      { label: 'Google Cloud Scheduler: cron job format and time zone', href: 'https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules' },
    ],
  },
]
