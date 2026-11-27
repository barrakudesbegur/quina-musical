// share <out.png> <font.ttf> <paperHex> <scale> then per card: <pdf>:<page>:<x>:<y>:<w>:<h>:<title>
// Stacks the cards vertically on white, each printed onto the paper colour (multiply, as ink on coloured paper), all at
// the same scale, with its title above it.
import AppKit
import CoreText
import PDFKit

let a = CommandLine.arguments
let out = a[1]
let fontURL = URL(fileURLWithPath: a[2]) as CFURL
CTFontManagerRegisterFontsForURL(fontURL, .process, nil)
let hex = Int(a[3].dropFirst(), radix: 16)!
let paper = CGColor(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
let s = CGFloat(Double(a[4])!)
struct Card { let pdf: PDFDocument; let page: Int; let r: CGRect; let title: String }
let cards: [Card] = a[5...].map {
  let p = $0.split(separator: ":", maxSplits: 6).map(String.init)
  return Card(pdf: PDFDocument(url: URL(fileURLWithPath: p[0]))!, page: Int(p[1])!,
              r: CGRect(x: Double(p[2])!, y: Double(p[3])!, width: Double(p[4])!, height: Double(p[5])!), title: p[6])
}

let margin: CGFloat = 70 * s / 3, gapTitle: CGFloat = 28 * s / 3, gapCards: CGFloat = 90 * s / 3, titleSize: CGFloat = 60 * s / 3
let font = CTFontCreateWithName("LondrinaSolid-Regular" as CFString, titleSize, nil)
let W = cards.map { $0.r.width * s }.max()! + 2 * margin
let H = cards.reduce(2 * margin - gapCards) { $0 + titleSize + gapTitle + $1.r.height * s + gapCards }

let ctx = CGContext(data: nil, width: Int(W), height: Int(H), bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.setFillColor(CGColor(gray: 1, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))

var top: CGFloat = margin // distance from the image's top
for c in cards {
  let w = c.r.width * s, h = c.r.height * s
  let x = (W - w) / 2
  // The title, centred above the card.
  let attr = NSAttributedString(string: c.title, attributes: [.font: font, .foregroundColor: NSColor(white: 0.1, alpha: 1)])
  let line = CTLineCreateWithAttributedString(attr)
  let tw = CTLineGetTypographicBounds(line, nil, nil, nil)
  ctx.textPosition = CGPoint(x: (W - CGFloat(tw)) / 2, y: H - top - titleSize * 0.8)
  CTLineDraw(line, ctx)
  top += titleSize + gapTitle
  // The paper, with a soft shadow, then the card printed onto it.
  let rect = CGRect(x: x, y: H - top - h, width: w, height: h)
  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: -6 * s / 3), blur: 24 * s / 3, color: CGColor(gray: 0, alpha: 0.22))
  ctx.setFillColor(paper); ctx.fill(rect)
  ctx.restoreGState()
  ctx.saveGState()
  ctx.clip(to: rect)
  ctx.setBlendMode(.multiply)
  let page = c.pdf.page(at: c.page - 1)!
  let mb = page.bounds(for: .mediaBox)
  // PDF points, origin top-left in the arguments: move the card's corner onto rect's.
  ctx.translateBy(x: rect.minX - c.r.minX * s, y: rect.minY - (mb.height - c.r.maxY) * s)
  ctx.scaleBy(x: s, y: s)
  page.draw(with: .mediaBox, to: ctx)
  ctx.restoreGState()
  top += h + gapCards
}
let img = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: img)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
print("wrote", out, Int(W), "×", Int(H))
