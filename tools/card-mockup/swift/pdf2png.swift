import PDFKit
import AppKit
let args = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: args[1]))!
let pages = args[3].split(separator: ",").map { Int($0)! }
let scale = CGFloat(Double(args.count > 4 ? args[4] : "2")!)
print("pages:", doc.pageCount)
for p in pages {
  guard let page = doc.page(at: p - 1) else { continue }
  let r = page.bounds(for: .mediaBox)
  let img = NSImage(size: NSSize(width: r.width*scale, height: r.height*scale))
  img.lockFocus()
  NSColor.white.set(); NSRect(x:0,y:0,width:r.width*scale,height:r.height*scale).fill()
  let ctx = NSGraphicsContext.current!.cgContext
  ctx.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: ctx)
  img.unlockFocus()
  let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(args[2])-p\(p).png"))
  print("size", r.width, r.height)
}
