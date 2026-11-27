import PDFKit
import AppKit
// lighttable <pdf> <front page> <back page> <out.png> <scale>: the front in black, the back flipped on the sheet's long
// (vertical) edge in red, half transparent, as a sheet held up to the light.
let a = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: a[1]))!
let front = doc.page(at: Int(a[2])! - 1)!, back = doc.page(at: Int(a[3])! - 1)!
let scale = CGFloat(Double(a[5])!)
let r = front.bounds(for: .mediaBox)
let W = r.width * scale, H = r.height * scale
func render(_ p: PDFPage, mirror: Bool) -> CGImage {
  let ctx = CGContext(data: nil, width: Int(W), height: Int(H), bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.setFillColor(CGColor(gray: 1, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  if mirror { ctx.translateBy(x: W, y: 0); ctx.scaleBy(x: -1, y: 1) }
  ctx.scaleBy(x: scale, y: scale)
  p.draw(with: .mediaBox, to: ctx)
  return ctx.makeImage()!
}
let f = render(front, mirror: false), b = render(back, mirror: true)
let out = CGContext(data: nil, width: Int(W), height: Int(H), bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
out.draw(f, in: CGRect(x: 0, y: 0, width: W, height: H))
// the back tinted red at 45%: multiply a red layer over its dark pixels
out.saveGState(); out.setAlpha(0.45); out.setBlendMode(.multiply)
let tinted = CGContext(data: nil, width: Int(W), height: Int(H), bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
tinted.draw(b, in: CGRect(x: 0, y: 0, width: W, height: H))
tinted.setBlendMode(.screen); tinted.setFillColor(CGColor(red: 0, green: 0.85, blue: 0.85, alpha: 1)); tinted.fill(CGRect(x: 0, y: 0, width: W, height: H))
out.draw(tinted.makeImage()!, in: CGRect(x: 0, y: 0, width: W, height: H))
out.restoreGState()
let rep = NSBitmapImageRep(cgImage: out.makeImage()!)
try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.82])!.write(to: URL(fileURLWithPath: a[4]))
