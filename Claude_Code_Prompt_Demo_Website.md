# Prompt for Claude Code: "Task Scheduling and Automation" Demo Website

Copy everything below the line into Claude Code, started in an **empty project folder**.

---

## Role and goal

You are building an **interactive teaching website** for a college IT class presentation by **Tagify Group** on the topic **"Task Scheduling and Automation in System Administration."** The website will be shown live during our presentation as a demo, and afterwards classmates will use it to learn on their own.

The site must:
1. **Follow our PowerPoint deck exactly** (23 slides, 8 lessons; mapping below), so the presenter can move from a slide to the matching web page.
2. **Teach through interaction.** Every lesson gets at least one hands-on simulator, not just text.
3. **Go beyond the deck** with a "Beyond the Basics" section showing how modern tools (GitHub Actions, Ansible, systemd timers, Kubernetes CronJobs, Jenkins, and cloud schedulers) use the same ideas.
4. Be **easy to understand** for 2nd–3rd year IT students: short sentences, everyday analogies, no unexplained jargon.

Work in this order: (1) show me a short plan and the file structure, (2) scaffold, (3) build page by page, (4) verify in the browser, (5) run the tests and the production build. Do not stop at a skeleton. Finish every page and every demo described here.

## Tech stack

- **Vite + React + TypeScript**, **Tailwind CSS**, **React Router** (hash router, so it works on GitHub Pages).
- **react-icons** (Font Awesome set, `react-icons/fa`), the same icon family used in the slides.
- **cronstrue** to turn cron expressions into plain English, and **cron-parser** to calculate next run times.
- Syntax highlighting with **Shiki** or **Prism** (YAML, Bash, PowerShell, INI, Groovy, JSON).
- **Vitest** for unit tests.
- No backend, no database, no login. Everything runs in the browser.
- Pin dependency versions in `package.json`.

## Safety rules (important)

- The site **never runs real commands** and never touches the visitor's computer. Every "terminal" is a **simulation** with prepared outputs.
- Example scripts only use sandbox paths: `C:\Lab\...` and `/home/student/lab/...`.
- Any delete example shows the **preview first** (`-WhatIf` in PowerShell, `find ... -print` in Linux) and explains why.
- No real passwords, tokens, or keys in any example. Show secrets as `${{ secrets.NAME }}`, Ansible Vault, or a credential store, and explain why.
- Every config example must be **technically correct** for the tool and version shown. When unsure, check the official docs and link them on the page.

## Design (must match the PowerPoint)

- **Colors:** navy `#14213D` (dominant, dark sections), amber `#FCA311` (highlights, number badges, icon circles), dark teal `#1F7A70` (kicker labels, secondary icon circles), light gray-blue `#EEF2F7` (cards), red `#D1495B` (warnings/mistakes), slate blue `#3D5A80`, muted gray `#8D99AE`, text `#1B1F2A`, white backgrounds for content.
- **Fonts:** headings in Arial/Helvetica bold; body in Calibri with fallbacks `"Segoe UI", system-ui, sans-serif`; code in Consolas/`ui-monospace`.
- **Visual motif:** icons inside colored circles (amber or teal), rounded cards with soft shadows, small uppercase teal "kicker" labels above titles (e.g., `LESSON 4 · LINUX`). Do **not** add decorative accent stripes or lines under titles.
- **Hero** looks like slide 1: navy background, big white title, "Presented by Tagify Group" in amber, a large amber circle with a clock icon and a small teal circle with gears.
- Footer on every page: "Tagify Group | Task Scheduling and Automation".
- Responsive (phone to projector), keyboard accessible, visible focus states, WCAG AA contrast. Respect `prefers-reduced-motion`.
- **Presenter-friendly:** a "Presentation mode" toggle that enlarges text to 120%, hides the sidebar, and lets the arrow keys move to the previous and next lesson.

## Site map and alignment with the slides

| Route | Page | Matches slides |
|---|---|---|
| `/` | Home: hero + "What We Will Learn Today" (8 numbered lesson cards) | 1–2 |
| `/lesson/1` | Introduction: Scheduling = When, Automation = How; why it matters; manual vs. scheduled vs. automated | 3–5 |
| `/lesson/2` | Scheduling concepts: trigger, schedule & interval, condition, dependency, job queue; phone night-update example | 6–7 |
| `/lesson/3` | Windows Task Scheduler: six tabs, creating a task, Last Run Result | 8–10 |
| `/lesson/4` | Linux cron and at: reading a cron line, common schedules and the big mistake, crontab vs. at | 11–13 |
| `/lesson/5` | Scripting with PowerShell and Bash; what admins automate | 14–15 |
| `/lesson/6` | Reliable jobs: "works by hand, fails when scheduled"; logging and troubleshooting | 16–17 |
| `/lesson/7` | Security and monitoring: four safety rules; "it ran" is not "it worked" | 18–19 |
| `/lesson/8` | Comparing the tools; school computer lab example | 20–21 |
| `/beyond` | Beyond the Basics: modern automation tools gallery | (new) |
| `/beyond/:tool` | One page per tool | (new) |
| `/cheatsheet` | Printable cheat sheet: cron, crontab, at, schtasks, PowerShell cmdlets, result codes | (supports all) |
| `/glossary` | Searchable glossary of key terms | (supports all) |
| `/summary` | Three habits: log everything, verify the result, least privilege; thank you | 22–23 |
| `/demo` | **Live demo script** for presenters (see below) | all |

Each lesson page shows a small badge "Slides 11–13" so the presenter knows where they are, plus Previous/Next lesson buttons.

## Lesson content (keep the same wording and analogies as the slides)

Use these analogies exactly: **coffee maker with a timer** (scheduler = when, script = how), **phone night update** (trigger, conditions, dependency, queue), **one ATM line** (job queue), **cooking rice before serving** (dependency), **stranger's kitchen at 2 AM** (full paths), **hotel key card** (least privilege). Use these key facts: 50 servers × 10 minutes = 8+ hours daily; `* 2 * * *` runs 60 times; `0x0` = success, `0x1` = script error, `0x2` = file not found, `0x41301` = still running; three levels of evidence (scheduler started it → script succeeded → result exists).

## Interactive demos (build all of them)

1. **Cron Explainer & Builder** (Lesson 4, also on the cheat sheet)
   - Text input plus five dropdown/field editors. Each field is shown in a colored box like slide 11 (minute, hour, day of month, month, day of week, command).
   - Shows the plain-English meaning (cronstrue) and the **next 5 run times** (cron-parser), with a **Local / UTC** toggle.
   - Preset buttons for the slide 12 schedules: `*/15 * * * *`, `0 * * * *`, `0 2 * * *`, `30 18 * * 1-5`, `0 3 * * 0`, `0 0 1 * *`.
   - **Mistake detector** with friendly warnings: `*` in the minute field with a fixed hour ("runs 60 times; did you mean `0 2 * * *`?"); both day-of-month and day-of-week restricted ("cron uses OR here"); `%` in the command ("escape as `\%`"); a relative command path ("use a full path"); values out of range (e.g., hour 24).
   - Put the warning logic in a pure function with **Vitest unit tests**.

2. **Phone Night-Update Simulator** (Lesson 2): toggles for *Charging*, *On Wi-Fi*, *Download finished*, *Another update running*. A "It's 2:00 AM" button animates the flow Trigger → Condition → Dependency → Queue → Run and highlights the step that stops it, with a one-line explanation.

3. **Job Queue / Overlap Simulator** (Lesson 2): sliders for the interval (e.g., every 5 min) and the job duration (1–15 min). A one-hour timeline shows the runs. A policy selector (*Run in parallel*, *Queue*, *Skip if running*) shows overlaps in red. Label the policies with their real names: Task Scheduler "If the task is already running", Linux `flock -n`, Kubernetes `concurrencyPolicy`, GitHub Actions `concurrency`.

4. **Task Scheduler Tab Explorer** (Lesson 3): a mock Windows dialog with six tabs (General, Triggers, Actions, Conditions, Settings, History). Each tab shows realistic fields plus "WHO / WHEN / WHAT / ONLY IF / WHAT IF IT FAILS / DID IT RUN?" explanations. Highlight the **Start in** field with a callout explaining System32.
   - Include a **Last Run Result decoder**: type or pick a code and get the meaning and what to check.
   - Show the equivalent `schtasks /create` and `Register-ScheduledTask` commands for the current mock settings, with copy buttons.

5. **Safe Cleanup Previewer** (Lesson 5): a list of 10 fake log files aged 2–20 days and a "days to keep" slider. Shows which files **would** be deleted. Side-by-side tabs show the matching PowerShell (`Get-ChildItem | Where-Object | Remove-Item -WhatIf`) and Bash (`find -mtime +N -print`) commands with simulated output. A "Preview mode" switch must be ON by default.

6. **"Works by Hand, Fails When Scheduled" Troubleshooter** (Lesson 6): pick a symptom (command not found, permission denied, 0x1, 0x2, nothing happens, runs twice, `^M` bad interpreter). The tool walks through the 4-step method (did the scheduler start it → did the script finish → run the exact command as the same user → fix one thing and retest), then shows the likely cause and fix.

7. **Log Viewer with Three Levels of Evidence** (Lesson 7): a simulated nightly backup run. Three clickable panels show scheduler evidence (Task Scheduler History / cron syslog lines), script evidence (timestamped INFO/ERROR log, exit code), and result evidence (backup file with size). Include a "broken backup" scenario where levels 1–2 look fine but the file is 0 bytes. This teaches "it ran ≠ it worked".

8. **Security Before/After Toggle** (Lesson 7): cards that flip between insecure and secure versions (job runs as Domain Admin → least-privilege service account; password in script → vault/credential store; world-writable script → protected folder with `chmod 700`; no audit → Event IDs 4698–4702 reviewed).

9. **24-Hour Lab Automation Clock** (Lesson 8): a circular or horizontal 24-hour timeline showing the slide 21 jobs (10:00 PM cleanup, 1:30 AM backup, Sunday 2:00 AM updates, disk check every 10 min). Click a job to see its Task Scheduler/cron configuration.

10. **Tool Comparison Table** (Lesson 8 and `/beyond`): filterable by platform (Windows/Linux/cloud/cross-platform), recurring vs. one-time, event triggers, built-in retries, and catch-up of missed runs. It includes the four basic tools and all the Beyond-the-Basics tools.

Every code block has a **Copy** button and a language label.

## Beyond the Basics: modern tools (one page each)

Each tool page uses the **same template**:
- **What it is** (2–3 sentences) and **when to use it**
- **"Same ideas, new tool"**: a table mapping the tool to the 5 concepts from Lesson 2 (trigger, schedule/interval, condition, dependency, job queue)
- **A complete, correct example** for a realistic sysadmin job (nightly backup, log cleanup, or health check) with a line-by-line explanation
- **Common mistakes** (3–5 items)
- **Official documentation** links

Tools and required facts:

1. **GitHub Actions scheduled workflows.** Use `on: schedule: - cron: '30 1 * * *'` plus `workflow_dispatch` for manual runs. Explain: schedules use **UTC**; the shortest interval is **every 5 minutes**; runs can be **delayed** at busy times; schedules run on the **default branch**; in public repositories scheduled workflows are **disabled after 60 days without repository activity**. Show `concurrency:` (job queue), `needs:` (dependency), `if:` (condition), and `${{ secrets.NAME }}`. Example: nightly backup or link check that uploads an artifact.
2. **Ansible.** A playbook using `ansible.builtin.cron` to install the backup cron job on many Linux servers, and `ansible.windows.win_scheduled_task` for Windows. Explain **idempotence** (running it twice changes nothing), inventory, `become`, and Ansible Vault for secrets. Show the run with `--check` (preview, like `-WhatIf`).
3. **systemd timers.** A `.service` + `.timer` pair with `OnCalendar=*-*-* 02:00:00`, `Persistent=true` (catch up missed runs), `RandomizedDelaySec=` (spread load, like slide 21), and the commands `systemctl list-timers`, `systemd-analyze calendar`, `journalctl -u`.
4. **Kubernetes CronJob.** YAML with `schedule`, `timeZone`, `concurrencyPolicy: Forbid` (job queue), `startingDeadlineSeconds`, `successfulJobsHistoryLimit`/`failedJobsHistoryLimit`, and `backoffLimit` (retries).
5. **Jenkins.** A declarative pipeline with `triggers { cron('H 2 * * *') }`. Explain the `H` (hash) symbol that spreads jobs to avoid everyone running at once, plus `post { failure { ... } }` for alerts.
6. **Windows PowerShell ScheduledTasks module** (deep dive): `New-ScheduledTaskAction`, `New-ScheduledTaskTrigger`, `New-ScheduledTaskSettingsSet` (`-MultipleInstances`, `-ExecutionTimeLimit`, `-StartWhenAvailable`), `Register-ScheduledTask`, `Get-ScheduledTaskInfo`.
7. **Cloud schedulers (overview page):** AWS EventBridge Scheduler, Azure Automation / Logic Apps, and Google Cloud Scheduler. One short paragraph and one simple example each; point out that they use cron or rate expressions with time zones.

## `/demo` page: live demo script for presenters

A step-by-step checklist for our live presentation (about 8–10 minutes), with a timer. Each step says which page to open, what to click, and what to say (1–2 sentences):
1. Home → agenda (30 s)
2. Phone Night-Update Simulator: turn off Wi-Fi to show a failed condition (1 min)
3. Cron Explainer: type `* 2 * * *` to show the 60-runs warning, then fix it to `0 2 * * *` (1.5 min)
4. Job Queue Simulator: 5-minute interval with an 8-minute job, then switch the policy to "Skip if running" (1 min)
5. Task Scheduler Tab Explorer: Start in callout and decode `0x2` (1 min)
6. Safe Cleanup Previewer: move the slider and show the preview (1 min)
7. Log Viewer "broken backup": it ran ≠ it worked (1 min)
8. GitHub Actions page: the same cron, now in the cloud, in UTC (1 min)
9. Ansible page: install the cron job on 50 servers with one command and `--check` (1 min)
10. Summary page: the three habits (30 s)

## The repository itself is a live example

- Add `.github/workflows/deploy.yml` that builds and deploys the site to **GitHub Pages** on push to `main`.
- Add `.github/workflows/nightly-check.yml`, a **scheduled workflow** (`cron: '0 18 * * *'`, which is 2:00 AM Philippine time, UTC+8; explain this in a comment) plus `workflow_dispatch`. It runs the tests and a broken-link check, so the site demonstrates scheduling on itself. Link to these files from the GitHub Actions page.
- Set Vite `base` correctly for GitHub Pages.

## Quality checklist (verify before you finish)

- `npm run build` succeeds with no TypeScript errors; `npm test` passes (cron warnings, cleanup previewer filter, queue simulator overlap logic).
- Run the dev server and check **every route** in the browser at desktop and phone widths. There must be no console errors, no overflowing text, and every demo must work.
- Every code example has been checked against the official documentation, and the link is on the page.
- All text is in plain, friendly English; every technical term is explained the first time it appears or links to the glossary.
- `README.md` explains how to install, run, test, build, and deploy, and lists the slide-to-page mapping.

When you finish, give me a short summary: the pages and demos built, how to run the site locally, how to deploy it, and anything you could not complete.
