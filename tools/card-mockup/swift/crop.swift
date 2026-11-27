import PDFKit
import AppKit
// crop <out.png> <scale> <pdf>:<page>:<x>:<y>:<w>:<h> ... — stacks the regions (PDF points, origin top-left) vertically.
let a = CommandLine.arguments
let GAP = CGFloat(Double(ProcessInfo.processInfo.environment["GAP"] ?? "8")!)
let out = a[1], scale = CGFloat(Double(a[2])!)
let specs = a[3...].map { $0.split(separator: ":").map(String.init) }
let W = specs.map { CGFloat(Double($0[4])!) }.max()! * scale
let H = specs.map { CGFloat(Double($0[5])!) * scale + GAP }.reduce(0, +)
let img = NSImage(size: NSSize(width: W, height: H))
img.lockFocus()
NSColor(white: 0.85, alpha: 1).set(); NSRect(x: 0, y: 0, width: W, height: H).fill()
var top = H
for s in specs {
  let doc = PDFDocument(url: URL(fileURLWithPath: s[0]))!
  let page = doc.page(at: Int(s[1])! - 1)!
  let ph = page.bounds(for: .mediaBox).height
  let (x, y, w, h) = (CGFloat(Double(s[2])!), CGFloat(Double(s[3])!), CGFloat(Double(s[4])!), CGFloat(Double(s[5])!))
  top -= h * scale
  let ctx = NSGraphicsContext.current!.cgContext
  ctx.saveGState()
  ctx.clip(to: CGRect(x: 0, y: top, width: w * scale, height: h * scale))
  NSColor.white.set(); CGRect(x: 0, y: top, width: w * scale, height: h * scale).fill()
  ctx.translateBy(x: -x * scale, y: top - (ph - y - h) * scale)
  ctx.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: ctx)
  ctx.restoreGState()
  top -= GAP
}
img.unlockFocus()
try! NSBitmapImageRep(data: img.tiffRepresentation!)!.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
