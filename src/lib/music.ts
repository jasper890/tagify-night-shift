import { useEffect, useState } from 'react'
import TRACKS from '../data/siteMusic.json'

// Background music for the website. Two original 8-bit loops made by scripts/generate-audio.py:
// "overworld" while reading lessons, and "battle" during a boss battle.
//
// - Browsers only allow sound after the visitor clicks or presses a key, so music starts then.
// - The Web Audio API loops the music with no gap (loopStart/loopEnd come from siteMusic.json).
// - One player for the whole site, so the music keeps going when the page changes.
// - It goes quiet while the intro video's narration plays, and pauses in a hidden tab.
// - The choice to turn it off is remembered in this browser.

export type TrackId = keyof typeof TRACKS

const KEY = 'tsa-music-v1'
const EVENT = 'tsa-music-change'
/** Loudness of each loop: quiet, so it sits behind reading and never over the sound effects. */
const VOLUME: Record<TrackId, number> = { overworld: 0.16, battle: 0.2 }
const FADE = 0.7

let ctx: AudioContext | null = null
let master: GainNode | null = null
let current: { id: TrackId; src: AudioBufferSourceNode; gain: GainNode } | null = null
const buffers = new Map<TrackId, Promise<AudioBuffer>>()
/** Which part of the site asks for which track; the latest request wins, otherwise the overworld plays. */
const requests = new Map<string, TrackId>()
/** Things that need the music quiet right now, such as the intro video's narration. */
const ducks = new Set<string>()
let unlocked = false
let token = 0

export function isMusicOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setMusicOn(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* storage blocked: the setting lasts only for this visit */
  }
  window.dispatchEvent(new Event(EVENT))
  // Turning music on is itself a click, so the browser allows sound now.
  if (on) unlocked = true
  void apply()
}

/** Call on the visitor's first click or key press. */
export function unlockMusic() {
  if (unlocked) return
  unlocked = true
  void apply()
}

/** Ask for a track (for example the boss battle), or pass null to give the request back. */
export function requestTrack(owner: string, id: TrackId | null) {
  requests.delete(owner)
  if (id) requests.set(owner, id)
  void apply()
}

/** Keep the music quiet while `on` is true for this owner. */
export function duckMusic(owner: string, on: boolean) {
  if (on) ducks.add(owner)
  else ducks.delete(owner)
  void apply()
}

function wanted(): TrackId {
  return [...requests.values()].pop() ?? 'overworld'
}

function context(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.connect(ctx.destination)
  return ctx
}

function load(id: TrackId, ac: AudioContext): Promise<AudioBuffer> {
  let p = buffers.get(id)
  if (!p) {
    p = fetch(TRACKS[id].src)
      .then((r) => {
        if (!r.ok) throw new Error(`music ${id}: ${r.status}`)
        return r.arrayBuffer()
      })
      .then((data) => ac.decodeAudioData(data))
    p.catch(() => buffers.delete(id)) // allow a retry later
    buffers.set(id, p)
  }
  return p
}

function fadeOut(node: { src: AudioBufferSourceNode; gain: GainNode }, ac: AudioContext) {
  const t = ac.currentTime
  node.gain.gain.cancelScheduledValues(t)
  node.gain.gain.setValueAtTime(node.gain.gain.value, t)
  node.gain.gain.linearRampToValueAtTime(0, t + FADE)
  node.src.stop(t + FADE + 0.05)
}

async function apply() {
  const my = ++token
  const playing = unlocked && isMusicOn() && !document.hidden
  const ac = playing ? context() : ctx
  if (!ac || !master) return
  if (!playing) {
    if (current) {
      fadeOut(current, ac)
      current = null
    }
    return
  }
  if (ac.state === 'suspended') await ac.resume().catch(() => undefined)
  // Duck smoothly under narration instead of cutting out.
  const t = ac.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(master.gain.value, t)
  master.gain.linearRampToValueAtTime(ducks.size ? 0 : 1, t + 0.4)

  const id = wanted()
  if (current?.id === id) return
  let buffer: AudioBuffer
  try {
    buffer = await load(id, ac)
  } catch {
    return
  }
  if (my !== token) return // something changed while loading; the newer call takes over
  if (current) fadeOut(current, ac)
  const src = ac.createBufferSource()
  src.buffer = buffer
  src.loop = true
  src.loopStart = TRACKS[id].loopStart
  src.loopEnd = TRACKS[id].loopEnd
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0, ac.currentTime)
  gain.gain.linearRampToValueAtTime(VOLUME[id], ac.currentTime + FADE)
  src.connect(gain).connect(master)
  src.start(ac.currentTime, TRACKS[id].loopStart)
  current = { id, src, gain }
}

if (typeof document !== 'undefined') {
  // Pause in a hidden tab, carry on when the visitor comes back.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend()
    else if (unlocked && isMusicOn()) {
      void ctx.resume()
      void apply()
    }
  })
}

export function useMusic() {
  const [on, setOn] = useState(isMusicOn)
  useEffect(() => {
    const sync = () => setOn(isMusicOn())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])
  return { on, toggle: () => setMusicOn(!on) }
}
