import { loadFont as loadDotGothic } from '@remotion/google-fonts/DotGothic16'
import { loadFont as loadPressStart } from '@remotion/google-fonts/PressStart2P'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'

// The intro uses the website's "Night Shift" pixel RPG look.
/** Readable pixel font for captions and body text (its 2 never looks like an 8). */
export const SANS = loadDotGothic('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily
/** Chunky arcade font for headlines and labels only. */
export const PIXEL = loadPressStart('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily
export const MONO = loadMono('normal', { weights: ['400', '600'], subsets: ['latin'] }).fontFamily

export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

export const C = {
  bg: '#1a1c2c',
  night: '#12142a',
  window: '#1f2547',
  frame: '#f4f4f4',
  ink: '#f4f4f4',
  dim: '#94b0c2',
  faint: 'rgba(255,255,255,0.08)',
  amber: '#ffcd75',
  orange: '#ef7d57',
  pink: '#b13e53',
  teal: '#73eff7',
  blue: '#41a6f6',
  ok: '#a7f070',
  danger: '#ef5d6b',
}

// Pixel art has no gradients: the "warm" and "cool" accents are flat colors.
export const GRAD_WARM = C.amber
export const GRAD_COOL = C.teal

/** Hard pixel drop shadow for big text, scaled to the font size. */
export const pxShadow = (size: number, color = C.bg) => {
  const d = Math.max(3, Math.round(size / 14))
  return `${d}px ${d}px 0 ${color}`
}
