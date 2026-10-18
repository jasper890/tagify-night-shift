import { useEffect, useState } from 'react'

// 8-bit sound effects made on the fly with the Web Audio API (square and triangle waves).
// They only play in answer to something the player did, and the HUD has a mute button.

const KEY = 'tsa-sound-v1'
const EVENT = 'tsa-sound-change'

export type Sfx = 'select' | 'hit' | 'hurt' | 'victory' | 'gameover' | 'levelup' | 'unlock' | 'start'

// [frequency Hz, start s, length s, wave]
type Note = [number, number, number, OscillatorType?]

const SONGS: Record<Sfx, Note[]> = {
  select: [[880, 0, 0.05]],
  start: [
    [523, 0, 0.08],
    [784, 0.08, 0.12],
  ],
  hit: [
    [660, 0, 0.06],
    [990, 0.06, 0.1],
  ],
  hurt: [
    [220, 0, 0.12, 'sawtooth'],
    [140, 0.1, 0.2, 'sawtooth'],
  ],
  victory: [
    [523, 0, 0.1],
    [659, 0.1, 0.1],
    [784, 0.2, 0.1],
    [1047, 0.3, 0.32],
    [784, 0.3, 0.32, 'triangle'],
  ],
  gameover: [
    [392, 0, 0.18, 'triangle'],
    [330, 0.2, 0.18, 'triangle'],
    [262, 0.4, 0.45, 'triangle'],
  ],
  levelup: [
    [392, 0, 0.08],
    [523, 0.08, 0.08],
    [659, 0.16, 0.08],
    [784, 0.24, 0.08],
    [1047, 0.32, 0.3],
  ],
  unlock: [
    [988, 0, 0.07],
    [1319, 0.07, 0.22],
  ],
}

let ctx: AudioContext | null = null

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean) {
  try {
    window.localStorage.setItem(KEY, muted ? 'off' : 'on')
  } catch {
    /* storage blocked: the setting lasts only for this visit */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function play(name: Sfx) {
  if (isMuted() || typeof window === 'undefined') return
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    const t0 = ctx.currentTime + 0.01
    for (const [freq, start, len, wave = 'square'] of SONGS[name]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = wave
      osc.frequency.setValueAtTime(freq, t0 + start)
      gain.gain.setValueAtTime(0.0001, t0 + start)
      gain.gain.exponentialRampToValueAtTime(0.06, t0 + start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + len)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + start)
      osc.stop(t0 + start + len + 0.02)
    }
  } catch {
    /* audio not available: stay silent */
  }
}

export function useSound() {
  const [muted, setState] = useState(isMuted)
  useEffect(() => {
    const sync = () => setState(isMuted())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])
  return { muted, toggle: () => setMuted(!muted) }
}
