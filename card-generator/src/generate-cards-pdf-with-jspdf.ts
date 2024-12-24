import fs from 'fs'
import { jsPDF } from 'jspdf'
import { join } from 'path'
import { QuinaCard } from './generate-cards-json'

// Constants for layout
const CARD_WIDTH = 210 // A4 width in mm
const CARD_HEIGHT = 99 // 1/3 of A4 height in mm
const MARGIN = 10
const COLUMN_WIDTH = (CARD_WIDTH - 2 * MARGIN) / 4
const ROW_HEIGHT = (CARD_HEIGHT - 2 * MARGIN) / 3
const TITLE_FONT_SIZE = 24
const SONG_FONT_SIZE = 10
const CARD_NUMBER_FONT_SIZE = 12
const FONT = 'LondrinaSolid' // Add Londrina Solid font

export function generateQuinaCardsPDF(data: QuinaCard[], outputPath: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let currentY = 0

  // Load custom font
  const fontPath = join(
    __dirname,
    'assets/LondrinaSolid/LondrinaSolid-Regular.ttf'
  )
  if (fs.existsSync(fontPath)) {
    const fontData = fs.readFileSync(fontPath, 'base64')
    doc.addFileToVFS('LondrinaSolid-Regular.ttf', fontData)
    doc.addFont('LondrinaSolid-Regular.ttf', FONT, 'normal')
    doc.setFont(FONT)
  } else {
    throw new Error('Font file LondrinaSolid-Regular.ttf not found.')
  }

  data.forEach((card, index) => {
    if (index !== 0 && currentY + CARD_HEIGHT > 297) {
      doc.addPage()
      currentY = 0
    }

    // Draw the card border
    doc.rect(
      MARGIN,
      currentY + MARGIN,
      CARD_WIDTH - 2 * MARGIN,
      CARD_HEIGHT - 2 * MARGIN
    )

    // Add the title
    doc.setFontSize(TITLE_FONT_SIZE)
    doc.text(
      'QUINA QUINA!',
      CARD_WIDTH / 2,
      currentY + MARGIN + TITLE_FONT_SIZE,
      {
        align: 'center',
      }
    )

    // Add the card number
    doc.setFontSize(CARD_NUMBER_FONT_SIZE)
    doc.text(`CARTRÓ #${card.id}`, CARD_WIDTH - MARGIN, currentY + MARGIN + 5, {
      align: 'right',
    })

    // Add the songs
    doc.setFontSize(SONG_FONT_SIZE)
    card.lines.flat().forEach((song, i) => {
      const col = i % 4
      const row = Math.floor(i / 4)
      const x = MARGIN + col * COLUMN_WIDTH + 2
      const y = currentY + MARGIN + TITLE_FONT_SIZE + 10 + row * ROW_HEIGHT

      // Draw the song title and artist
      doc.text(song.title, x, y)
      doc.text(song.artist, x, y + 4)
    })

    currentY += CARD_HEIGHT
  })

  // Save the PDF
  doc.save(outputPath)
}
