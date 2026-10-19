import { describe, expect, it } from 'vitest'
import { shuffledOrder } from './shuffle'

/** A repeatable random source for tests. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

describe('shuffledOrder', () => {
  it('returns every option exactly once', () => {
    const rand = seeded(1)
    for (let n = 1; n <= 5; n++) {
      for (let k = 0; k < 50; k++) expect([...shuffledOrder(n, 0, undefined, rand)].sort()).toEqual(Array.from({ length: n }, (_, i) => i))
    }
  })

  it('never puts the answer back in the slot it had last time', () => {
    const rand = seeded(7)
    for (let k = 0; k < 500; k++) {
      const answer = k % 3
      const avoid = (k * 7) % 3
      const order = shuffledOrder(3, answer, avoid, rand)
      expect(order[avoid]).not.toBe(answer)
      expect([...order].sort()).toEqual([0, 1, 2])
    }
  })

  it('moves the answer around, not just to one slot', () => {
    const rand = seeded(42)
    const slots = new Set<number>()
    for (let k = 0; k < 60; k++) slots.add(shuffledOrder(3, 1, undefined, rand).indexOf(1))
    expect(slots).toEqual(new Set([0, 1, 2]))
  })

  it('handles a single option', () => {
    expect(shuffledOrder(1, 0, 0)).toEqual([0])
  })
})
