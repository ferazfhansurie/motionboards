import AppKit
import Foundation

let outputDirectory = URL(fileURLWithPath: "/Users/faeez/motionboards/FatHopes IMG/SG photossss/sg-infographic-assets")
let logoURL = URL(fileURLWithPath: "/Users/faeez/motionboards/FatHopes IMG/fathopes logo.png")
let canvasSize = NSSize(width: 576, height: 1024)

try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

func writePNG(_ name: String, draw: () -> Void) throws {
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: 576, pixelsHigh: 1024,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ) else { fatalError("Could not make image canvas") }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    draw()
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: outputDirectory.appendingPathComponent(name))
}

let lime = NSColor(calibratedRed: 0.69, green: 0.86, blue: 0.22, alpha: 1)
let deepGreen = NSColor(calibratedRed: 0.025, green: 0.15, blue: 0.11, alpha: 0.94)

func text(_ value: String, in rect: NSRect, size: CGFloat, color: NSColor = .white, uppercase: Bool = false) {
    let style = NSMutableParagraphStyle()
    style.lineSpacing = 2
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont(name: "Arial-BoldMT", size: size) ?? NSFont.boldSystemFont(ofSize: size),
        .foregroundColor: color,
        .paragraphStyle: style,
        .kern: -0.45
    ]
    (uppercase ? value.uppercased() : value).draw(in: rect, withAttributes: attributes)
}

func header(_ kicker: String) {
    NSColor(calibratedRed: 0.02, green: 0.08, blue: 0.06, alpha: 0.62).setFill()
    NSBezierPath(roundedRect: NSRect(x: 28, y: 918, width: 220, height: 48), xRadius: 20, yRadius: 20).fill()
    text(kicker, in: NSRect(x: 47, y: 931, width: 180, height: 24), size: 15, color: lime, uppercase: true)
}

func card(_ rect: NSRect) {
    deepGreen.setFill()
    NSBezierPath(roundedRect: rect, xRadius: 28, yRadius: 28).fill()
    lime.setFill()
    NSBezierPath(roundedRect: NSRect(x: rect.minX, y: rect.minY, width: 10, height: rect.height), xRadius: 5, yRadius: 5).fill()
}

try writePNG("overlay-01.png") {
    header("Singapore knows fried food")
    card(NSRect(x: 28, y: 688, width: 520, height: 190))
    text("WHERE DOES ALL\nTHAT USED OIL GO?", in: NSRect(x: 60, y: 728, width: 442, height: 118), size: 35)
    lime.setFill()
    NSBezierPath(ovalIn: NSRect(x: 464, y: 698, width: 50, height: 50)).fill()
    text("?", in: NSRect(x: 480, y: 704, width: 30, height: 40), size: 33, color: deepGreen)
}

try writePNG("overlay-02.png") {
    header("The hidden problem")
    card(NSRect(x: 28, y: 688, width: 520, height: 190))
    text("DOWN THE DRAIN?\nA PROBLEM FOR THE FUTURE.", in: NSRect(x: 60, y: 728, width: 442, height: 118), size: 31)
    NSColor.white.withAlphaComponent(0.88).setStroke()
    let line = NSBezierPath()
    line.move(to: NSPoint(x: 460, y: 736)); line.curve(to: NSPoint(x: 500, y: 780), controlPoint1: NSPoint(x: 512, y: 720), controlPoint2: NSPoint(x: 516, y: 770))
    line.lineWidth = 4; line.stroke()
}

try writePNG("overlay-03.png") {
    header("A simple better way")
    card(NSRect(x: 28, y: 688, width: 520, height: 190))
    text("STORE IT.\nWE'LL COLLECT IT.", in: NSRect(x: 60, y: 730, width: 410, height: 110), size: 37)
    lime.setFill()
    for point in [NSPoint(x: 473, y: 802), NSPoint(x: 500, y: 776), NSPoint(x: 473, y: 750)] {
        NSBezierPath(ovalIn: NSRect(x: point.x, y: point.y, width: 18, height: 18)).fill()
    }
}

try writePNG("overlay-04.png") {
    header("FatHopes Energy")
    card(NSRect(x: 28, y: 688, width: 520, height: 190))
    text("COLLECTION ACROSS\nSINGAPORE.", in: NSRect(x: 60, y: 730, width: 420, height: 110), size: 36)
    lime.setFill()
    let route = NSBezierPath()
    route.move(to: NSPoint(x: 460, y: 735)); route.curve(to: NSPoint(x: 505, y: 790), controlPoint1: NSPoint(x: 510, y: 750), controlPoint2: NSPoint(x: 460, y: 805))
    route.lineWidth = 5; route.stroke()
    NSBezierPath(ovalIn: NSRect(x: 450, y: 725, width: 20, height: 20)).fill()
    NSBezierPath(ovalIn: NSRect(x: 495, y: 780, width: 20, height: 20)).fill()
}

try writePNG("end-card.png") {
    NSColor(calibratedRed: 0.02, green: 0.13, blue: 0.10, alpha: 1).setFill()
    NSBezierPath(rect: NSRect(origin: .zero, size: canvasSize)).fill()
    NSColor(calibratedRed: 0.58, green: 0.82, blue: 0.18, alpha: 0.15).setFill()
    NSBezierPath(ovalIn: NSRect(x: -220, y: -180, width: 680, height: 680)).fill()
    NSColor(calibratedRed: 0.25, green: 0.76, blue: 0.57, alpha: 0.13).setFill()
    NSBezierPath(ovalIn: NSRect(x: 300, y: 680, width: 460, height: 460)).fill()
    if let logo = NSImage(contentsOf: logoURL) {
        logo.draw(in: NSRect(x: 128, y: 550, width: 320, height: 155), from: .zero, operation: .sourceOver, fraction: 1)
    }
    text("TURN WASTE\nINTO WEALTH.", in: NSRect(x: 70, y: 390, width: 436, height: 110), size: 42)
    text("Used cooking oil collection across Singapore", in: NSRect(x: 72, y: 345, width: 430, height: 30), size: 18, color: NSColor.white.withAlphaComponent(0.84))
}

print("Created Singapore infographic assets.")
