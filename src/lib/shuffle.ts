// Shuffled answer order for boss battles, so a player cannot win a rematch by
// remembering where the right answer was.

/**
 * A random order of option indexes, e.g. [2, 0, 1] shows option 2 first.
 * If `avoidSlot` is given, the right answer is never put back in that slot
 * (where it was in the last fight), so a rematch always moves it.
 */
export function shuffledOrder(count: number, answer: number, avoidSlot?: number, rand: () => number = Math.random): number[] {
  const order = Array.from({ length: count }, (_, i) => i)
  // Fisher–Yates
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  if (avoidSlot !== undefined && count > 1 && order[avoidSlot] === answer) {
    // Swap the answer with a random other slot.
    let other = Math.floor(rand() * (count - 1))
    if (other >= avoidSlot) other++
    ;[order[avoidSlot], order[other]] = [order[other], order[avoidSlot]]
  }
  return order
}
