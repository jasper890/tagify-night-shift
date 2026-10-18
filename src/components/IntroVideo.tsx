import { useEffect, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { FaPlay, FaVolumeMute, FaVolumeUp } from 'react-icons/fa'
import { Intro, INTRO_DURATION } from '../video/Intro'
import { FPS, HEIGHT, WIDTH } from '../video/theme'
import { duckMusic } from '../lib/music'

const SOUNDTRACK = '/video/soundtrack.mp3'
/** Re-sync the soundtrack when it drifts further than this from the picture (seconds). */
const MAX_DRIFT = 0.15

/**
 * The narrated intro. The Remotion player draws the animation; one pre-mixed soundtrack (voice, music and effects,
 * exported by `npm run video:render`) plays in a normal <audio> element that follows the player's play, pause and seek.
 * Browsers only allow silent autoplay, so it starts muted with captions; "Tap for sound" restarts it with the narration.
 * It does not autoplay for students who prefer reduced motion, and pauses when scrolled away.
 */
export default function IntroVideo() {
  const ref = useRef<PlayerRef>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [soundOn, setSoundOn] = useState(false)
  const soundOnRef = useRef(false)
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const player = ref.current
    const audio = audioRef.current
    if (!player || !audio) return
    const at = () => player.getCurrentFrame() / FPS
    const onPlay = () => {
      if (!soundOnRef.current) return
      audio.currentTime = at()
      audio.play().catch(() => undefined)
    }
    const onPause = () => audio.pause()
    const onSeeked = () => {
      audio.currentTime = at()
    }
    const onTime = () => {
      if (!soundOnRef.current || !player.isPlaying()) return
      if (Math.abs(audio.currentTime - at()) > MAX_DRIFT) audio.currentTime = at()
      if (audio.paused) audio.play().catch(() => undefined)
    }
    player.addEventListener('play', onPlay)
    player.addEventListener('pause', onPause)
    player.addEventListener('seeked', onSeeked)
    player.addEventListener('timeupdate', onTime)
    return () => {
      player.removeEventListener('play', onPlay)
      player.removeEventListener('pause', onPause)
      player.removeEventListener('seeked', onSeeked)
      player.removeEventListener('timeupdate', onTime)
    }
  }, [])

  // The site's background music goes quiet while the narration plays.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const on = () => duckMusic('intro-video', true)
    const off = () => duckMusic('intro-video', false)
    audio.addEventListener('play', on)
    audio.addEventListener('pause', off)
    audio.addEventListener('ended', off)
    return () => {
      audio.removeEventListener('play', on)
      audio.removeEventListener('pause', off)
      audio.removeEventListener('ended', off)
      off()
    }
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) ref.current?.pause()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const setSound = (on: boolean) => {
    soundOnRef.current = on
    setSoundOn(on)
    const player = ref.current
    const audio = audioRef.current
    if (!player || !audio) return
    if (on) {
      // Start from the beginning so the narration is heard in full; play() runs inside the click, so the browser allows sound.
      audio.currentTime = 0
      audio.play().catch(() => undefined)
      player.seekTo(0)
      player.play()
    } else {
      audio.pause()
    }
  }

  return (
    <div ref={box} className="video-scope relative overflow-hidden border-4 border-ink bg-black shadow-[8px_8px_0_0_rgb(0_0_0/0.45)]">
      <Player
        ref={ref}
        component={Intro}
        inputProps={{ audio: 'none' }}
        durationInFrames={INTRO_DURATION}
        fps={FPS}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        style={{ width: '100%', aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        controls
        showVolumeControls={false}
        loop
        autoPlay={!reduceMotion}
        clickToPlay
        doubleClickToFullscreen
        showPosterWhenUnplayed
        renderPoster={() => (
          <div className="flex h-full w-full items-center justify-center bg-black/40">
            <span className="btn btn-amber px-6 py-3 text-base">
              <FaPlay aria-hidden /> Watch the intro ({Math.round(INTRO_DURATION / FPS)} s)
            </span>
          </div>
        )}
        acknowledgeRemotionLicense
      />
      <audio ref={audioRef} src={SOUNDTRACK} preload="auto" />
      <button
        type="button"
        onClick={() => setSound(!soundOn)}
        aria-pressed={soundOn}
        className={`btn absolute top-[12%] right-3 z-10 text-sm sm:right-5 sm:text-base ${soundOn ? 'bg-ink/70 text-white' : 'btn-amber'}`}
      >
        {soundOn ? <FaVolumeMute aria-hidden /> : <FaVolumeUp aria-hidden />}
        {soundOn ? 'Mute' : 'Tap for sound'}
      </button>
    </div>
  )
}
