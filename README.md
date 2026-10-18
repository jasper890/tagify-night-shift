# Task Scheduling and Automation: Interactive Demo Website

A self-study website where students learn **"Task Scheduling and Automation in System Administration"** on their own, by Tagify Group. It follows the 23-slide PowerPoint lesson by lesson, with hands-on simulators, a **Terminal Lab** where students type real commands and code in a simulated terminal, a quiz at the end of each lesson, a Practice Lab of guided missions, and a "Beyond the Basics" section on modern tools.

It is dressed as a **retro pixel RPG, "the night shift"**: each lesson is a stage, each lesson quiz is a boss battle, and students earn XP, levels, stars and badges as they learn (see [Game layer](#game-layer)).

- **No backend, no database, no login.** It is a static site; everything runs in the browser.
- **Nothing real is ever executed.** Every terminal and script is a simulation with prepared output. Examples use only sandbox paths (`C:\Lab\...`, `/home/student/lab/...`) and contain no real secrets.

## Tech stack

Vite + React + TypeScript, Tailwind CSS v4, React Router, react-icons (Font Awesome), cronstrue, cron-parser, Prism (syntax highlighting), Vitest, and the pixel fonts DotGothic16 and Press Start 2P (bundled with `@fontsource`, so no font CDN is needed). Dependency versions are pinned in `package.json`.

## Run it locally

You need Node.js 20 or newer.

```bash
npm install        # install dependencies
npm run dev        # start the dev server at http://localhost:5173
npm test           # run the unit tests (Vitest)
npm run build      # type-check and build the production site into dist/
npm run preview    # serve the built site locally
npm run check-links   # check internal routes and external documentation links
npm run video:studio  # open the intro video in Remotion Studio to edit it
npm run video:render  # export out/intro.mp4 and the website soundtrack
```

## Deploy to Vercel

The project is ready for Vercel as-is (`vercel.json` sets the Vite framework, the `dist` output folder, and a rewrite so that page refreshes on routes like `/lesson/4` work).

**Option A: from GitHub (recommended)**

1. Push this folder to a GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new), import the repository, and click **Deploy**. Vercel detects Vite automatically; no settings or environment variables are required.
3. Every push to `main` redeploys the site automatically.

**Option B: from your computer with the Vercel CLI**

```bash
npm install -g vercel
vercel          # first time: log in and link the project (preview deploy)
vercel --prod   # deploy to production
```

**Optional:** set the environment variable `VITE_REPO_URL` (for example `https://github.com/your-name/your-repo`) in Vercel. The GitHub Actions page will then link to this repository's real scheduled workflow and its runs.

## Intro video (Remotion)

The Home page opens with a narrated intro (~86 s) built with [Remotion](https://www.remotion.dev/) in `src/video/`, styled as the game's tutorial level. It is taught like a lesson: a neural voice explains, and every graphic appears on the word that names it. The captions are an RPG dialog box where the Old Admin (the game's mentor) "speaks" word by word; a HUD shows a tutorial XP bar that fills as the video plays; scenes step into each other over one pixel night sky with blinking server racks, with an original 8-bit chiptune soundtrack (pulse-wave melody, triangle bass, noise drums, 140 bpm) that dips under the voice, and retro game sound effects (text-box beeps, menu blips, a power-up arpeggio, a stage-clear fanfare). The narrator is a cheerful cartoon game voice: a lively neural voice, pitched up a little and played through a light "old console speaker" filter, so it sounds like a game but every word stays clear.

1. The 2 AM problem: backups, updates, cleanups, reports
2. Scheduling = **when**, automation = **how**
3. How a job runs: trigger → scheduler → script → log → verify
4. Reading a cron line (`30 1 * * *`)
5. The tools: Task Scheduler, PowerShell, cron, at, Bash, systemd timers, then Ansible, GitHub Actions, Jenkins, Kubernetes CronJob and cloud schedulers
6. Same five ideas in every tool; a 24-hour dial of jobs running overnight
7. The three habits, and how to use this site

**How it fits together**

| Piece | What it is |
|---|---|
| `scripts/generate-audio.py` | Writes the narration (`edge-tts`, voice `en-US-RogerNeural` at +12 Hz pitch and +6% speed, then a light retro filter) with per-word timings, synthesizes the chiptune music and 8-bit effects from square, triangle and noise waves, and saves `src/video/audio.json`. Needs Python with `pip install edge-tts numpy`, ffmpeg, and internet. |
| `src/video/timeline.ts` | Sizes every scene from its narration and turns words into animation cues (`cue('cron')`). |
| `npm run video:render` | Renders `out/intro.mp4` and the pre-mixed `public/video/soundtrack.mp3`, both normalized to -16 LUFS. |
| `src/components/IntroVideo.tsx` | Plays the animation with `@remotion/player` and the soundtrack in a plain `<audio>` element kept in sync with play, pause and seek. It autoplays silently with captions; **Tap for sound** restarts it with the narration. |

To change the script: edit `NARRATION` in `scripts/generate-audio.py`, run it, adjust the cue words in `src/video/scenes/` if needed (`src/video/cues.test.ts` fails if a cue word is no longer spoken), then run `npm run video:render`. `npm run video:studio` previews everything. Remotion is free for individuals and small teams; see its license for company use.

## The repository is a live example

- `.github/workflows/nightly-check.yml` is a **scheduled workflow** (`cron: '0 18 * * *'` = 18:00 UTC = **2:00 AM Philippine time**, UTC+8) plus `workflow_dispatch`. It runs the tests, the build, and the broken-link check every night, so the site demonstrates scheduling on itself.
- `.github/workflows/ci.yml` runs tests and the build on every push and pull request. Deployment is handled by Vercel.

## Slide-to-page mapping

| Route | Page | Slides |
|---|---|---|
| `/` | Home: title screen, the intro video, the world map of the 8 stages ("What We Will Learn Today"), and the tools of automation | 1–2 |
| `/lesson/1` | Introduction: Scheduling = When, Automation = How | 3–5 |
| `/lesson/2` | Scheduling concepts + Phone Night-Update and Job Queue simulators | 6–7 |
| `/lesson/3` | Windows Task Scheduler + Tab Explorer and Last Run Result decoder | 8–10 |
| `/lesson/4` | Linux cron and at + Cron Explainer & Builder | 11–13 |
| `/lesson/5` | PowerShell and Bash + Safe Cleanup Previewer | 14–15 |
| `/lesson/6` | Reliable jobs + "Works by Hand, Fails When Scheduled" Troubleshooter | 16–17 |
| `/lesson/7` | Security and monitoring + Security Before/After and Log Viewer | 18–19 |
| `/lesson/8` | Comparing the tools + Tool Comparison Table and 24-Hour Lab Clock | 20–21 |
| `/summary` | Three habits; thank you | 22–23 |
| `/beyond`, `/beyond/:tool` | GitHub Actions, Ansible, systemd timers, Kubernetes CronJob, Jenkins, PowerShell ScheduledTasks, cloud schedulers | new |
| `/cheatsheet` | Printable cheat sheet | all |
| `/glossary` | Searchable glossary | all |
| `/terminal`, `/terminal/:track` | Terminal Lab: 6 guided hands-on labs in a simulated terminal | all |
| `/practice` | Practice Lab: 11 guided missions with the simulators | all |
| `/player` | Player profile: level, XP, stars, defeated bosses, badges, and "Start a new game" | new |

## Terminal Lab

A guided, simulated terminal (Linux bash or Windows PowerShell) that runs entirely in the browser. Each step explains one idea, shows exactly what to type or code, checks the student's work, and shows realistic output. An editor opens for `nano` / `notepad` / `crontab -e`, with live warnings for cron mistakes and YAML errors. The simulator-only command `timewarp 6h` fast-forwards the clock so students can watch cron jobs, `at` jobs, Task Scheduler tasks and GitHub Actions schedules run.

| Lab | What students do |
|---|---|
| Your first Bash script | `pwd`, `cd`, `ls -l`, write `backup.sh`, hit "Permission denied", `chmod +x`, run it, read the log |
| Schedule it with cron | `crontab -e`, `timewarp`, `grep CRON /var/log/syslog`, then break and fix a relative-path job |
| Clean up safely + one-time jobs | `find -mtime +7 -print` then `-delete`; `echo ... \| at now + 2 hours`, `atq` |
| PowerShell & Task Scheduler | `Get-ChildItem \| Where-Object \| Remove-Item -WhatIf`, write a `.ps1`, `schtasks /create /run /query /delete`, see Last Result 0 vs 2 |
| Ansible for network automation | inventory for 3 Cisco devices, `ansible -m ping`, backup playbook (`cisco.ios.ios_config`), `--check`, `--diff`, idempotence, nightly cron |
| GitHub Actions | write a workflow (schedule in UTC + `workflow_dispatch` + secrets), `git add/commit/push`, `gh workflow run`, `gh run view --log` |

The engine lives in `src/terminal/` (`linux.ts`, `windows.ts`, `devops.ts`, `tracks.ts`). `terminal.test.ts` plays every step of every lab to make sure the whole course can be completed.

## How students use it

1. Read a lesson (a **stage**) and play with its **Training** simulators, then do the matching **Terminal Lab** (all pretend; nothing runs on the computer).
2. Beat the **boss battle** at the end: the lesson quiz, one question at a time. Answering every question clears the stage.
3. Do the **Practice Lab** missions and tick them off.

Progress (cleared stages, stars, missions and Terminal Lab steps) is saved only in the student's own browser with `localStorage`. There are no accounts and no database.

## Game layer

The game is a skin over the same lessons: every lesson text, simulator and quiz question is unchanged, and every game moment teaches.

| Piece | How it works |
|---|---|
| Stages and world map | The 8 lessons are stages on a path on the Home page; the next one is marked "You are here". Nothing is locked, so a teacher can open any lesson during a class. |
| Boss battles (`src/components/Quiz.tsx`) | Each lesson quiz is a fight with a boss that stands for a bad habit (`src/data/bosses.ts`), from the Toil Slime to the 2 AM Dragon. A right answer hits the boss; a wrong answer costs one of 3 hearts **and shows the explanation**, then the student picks again. Losing all hearts is "Game over: try again". The victory screen lists every question with its answer and explanation ("What you learned"). Stars = hearts left. Keys 1–4 answer and Enter moves on, which is handy when demoing on a projector. |
| The Old Admin | The pixel mentor who delivers each lesson's everyday analogy as an RPG dialog, and narrates the intro video. |
| XP, levels, badges (`src/lib/game.ts`) | Everything is worked out from the saved progress: 100 XP per stage, 25 per star, 40 per mission, 10 per Terminal Lab step. 8 levels from Intern to Night Shift Legend, and 13 badges. Level-up and badge popups appear once (`src/components/pixel/GameEvents.tsx`). `game.test.ts` checks the math and that the top level can be reached. |
| Sound | Short 8-bit effects made with the Web Audio API (`src/lib/sfx.ts`), only after a click or key press. The speaker button in the header mutes them. |
| Pixel art | Sprites are 16x16 character grids drawn as SVG rects (`src/components/pixel/sprites.ts`), so they stay sharp at any size. |
| Fonts | DotGothic16 for all reading text: it is pixel-style but its digits and symbols stay clear (2 never looks like 8, `*` is large), which matters in a cron course. Press Start 2P only for the title and short labels. |

**Before a class demo:** open **Player & Badges** and press **Start a new game** to reset to Stage 1.

## Project structure

```
src/
  components/   Layout (HUD header, quest-log sidebar, game window), Quiz (boss battle), CodeBlock, shared UI
    pixel/      Sprites, HUD, level-up and badge popups, title-screen scenery
  demos/        The interactive simulators
  lib/          Pure logic with unit tests (cron warnings, cleanup filter, queue simulator, result codes, game XP/levels/badges), progress saving, sound effects
  data/         Lessons, quizzes, bosses, Practice Lab missions, glossary, Beyond-the-Basics tool pages, comparison table
  terminal/     Simulated Linux/PowerShell shells, Ansible/git/GitHub simulators, and the guided labs
  video/        The Remotion intro video (scenes, theme, CLI entry point)
  pages/        One file per route
scripts/check-links.mjs   Broken-link checker used by the nightly workflow
```

## Notes on accuracy

- The spec asked for `ansible.windows.win_scheduled_task`. That module actually lives in the **community.windows** collection, so the site uses `community.windows.win_scheduled_task`.
- Every tool page links to the official documentation for the options it shows.
