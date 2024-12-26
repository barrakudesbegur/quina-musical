/**
 * Normalize a string by removing accents and converting it to lowercase.
 *
 * @example
 * normalize(' Café') // 'cafe'
 */
const normalize = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Compare two strings after normalizing them.
 */
export const areSameNormalized = (str1: string, str2: string): boolean => {
  return normalize(str1) === normalize(str2)
}

/**
 * Transform a string to a different case.
 *
 * @example
 * transformCase('hello WORLD', 'lower') // 'hello world'
 * transformCase('hello WORLD', 'upper') // 'HELLO WORLD'
 * transformCase('hello WORLD', 'sentence') // 'Hello world'
 * transformCase('hello WORLD', 'title') // 'Hello World'
 * transformCase('hello WORLD', 'original') // 'hello WORLD'
 */
export const transformCase = (
  str: string,
  caseType: 'lower' | 'upper' | 'sentence' | 'title' | 'original'
) => {
  switch (caseType) {
    case 'lower':
      return str.toLowerCase()
    case 'upper':
      return str.toUpperCase()
    case 'sentence':
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
    case 'title':
      return str
        .split(' ')
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(' ')
    case 'original':
    default:
      return str
  }
}
