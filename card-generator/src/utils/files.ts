import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

/**
 * Saves a JSON object to a file asynchronously.
 *
 * @param data - The JSON object to save.
 * @param filename - The name of the file to save the data to.
 * @returns A promise that resolves when the file is saved.
 */
export async function saveJsonToFile(
  data: object,
  filename: string,
  prettyPrint: boolean = false
) {
  const outputPath = path.resolve(filename)
  await mkdir(path.dirname(outputPath), { recursive: true })

  const jsonData = prettyPrint
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data)

  await writeFile(outputPath, jsonData, 'utf-8')
}
