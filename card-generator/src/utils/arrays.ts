import seedrandom from 'seedrandom'

export function shuffleArrayWithSeed<T>(array: T[], seed: string): T[] {
  const rng = seedrandom(seed) // Create a seeded random generator
  const shuffledArray = [...array] // Create a shallow copy to avoid mutating the original array
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]] // Swap elements
  }
  return shuffledArray
}
