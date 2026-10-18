// Renders the intro video and the website's mixed soundtrack, both loudness-normalised for the web (-16 LUFS).
//   out/intro.mp4                 the full video, for presentations or uploading
//   public/video/soundtrack.mp3   one pre-mixed track that the website's player plays in sync with the animation
// Uses the ffmpeg bundled with Remotion, so nothing else needs to be installed.
import { execSync } from 'node:child_process'
import { mkdirSync, renameSync, rmSync } from 'node:fs'

const run = (cmd) => execSync(cmd, { stdio: 'inherit' })
const LOUDNORM = 'loudnorm=I=-16:TP=-1.5:LRA=11'

mkdirSync('out', { recursive: true })
run('npx remotion render src/video/index.ts Intro out/intro.raw.mp4')
run(`npx remotion ffmpeg -y -loglevel error -i out/intro.raw.mp4 -c:v copy -af ${LOUDNORM} -ar 48000 -c:a aac -b:a 192k out/intro.mp4`)
rmSync('out/intro.raw.mp4')

run('npx remotion render src/video/index.ts Intro out/soundtrack.raw.mp3 --codec=mp3')
run(`npx remotion ffmpeg -y -loglevel error -i out/soundtrack.raw.mp3 -af ${LOUDNORM} -ar 44100 -b:a 128k out/soundtrack.mp3`)
rmSync('out/soundtrack.raw.mp3')
renameSync('out/soundtrack.mp3', 'public/video/soundtrack.mp3')
console.log('Done: out/intro.mp4 and public/video/soundtrack.mp3')
