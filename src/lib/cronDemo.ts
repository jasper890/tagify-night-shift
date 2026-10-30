/** A shuffled copy (Fisher-Yates). Pass your own `rng` to make it repeatable. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const keep = out[i]
    out[i] = out[j]
    out[j] = keep
  }
  return out
}

/** The four choices of a question in random order, and the index of the right one. */
export function buildChoices(q: { answer: string; wrong: readonly string[] }, rng: () => number = Math.random) {
  const options = shuffle([q.answer, ...q.wrong], rng)
  return { options, answer: options.indexOf(q.answer) }
}
