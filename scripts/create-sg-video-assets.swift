import AppKit
import Foundation

let outputDirectory = URL(fileURLWithPath: "/Users/faeez/motionboards/FatHopes IMG/SG photossss/fathopes-singapore-video-assets")
let logoURL = URL(fileURLWithPath: "/Users/faeez/motionboards/FatHopes IMG/fathopes logo.png")
let canvasSize = NSSize(width: 576, height: 1024)

try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

func writePNG(named name: String, draw: () -> Void) throws {
    guard let canvas = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(canvasSize.width),
        pixelsHigh: Int(canvasSize.height),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else { fatalError("Unable to create PNG canvas") }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: canvas)
    draw()
    NSGraphicsContext.restoreGraphicsState()
    try canvas.representation(using: .png, properties: [:])!.write(to: outputDirectory.appendingPathComponent(name))
}

func makeOverlay(name: String, eyebrow: String, headline: String) throws {
    try writePNG(named: name) {
        let x: CGFloat = 28
        let y: CGFloat = 770
        let width: CGFloat = 520
        let height: CGFloat = 196
        NSColor(calibratedRed: 0.03, green: 0.15, blue: 0.11, alpha: 0.91).setFill()
        NSBezierPath(roundedRect: NSRect(x: x, y: y, width: width, height: height), xRadius: 24, yRadius: 24).fill()
        NSColor(calibratedRed: 0.68, green: 0.86, blue: 0.22, alpha: 1).setFill()
        NSBezierPath(roundedRect: NSRect(x: x, y: y, width: 11, height: height), xRadius: 5, yRadius: 5).fill()

        let eyebrowAttributes: [NSAttributedString.Key: Any] = [
            .font: NSFont(name: "Arial-BoldMT", size: 18) ?? NSFont.boldSystemFont(ofSize: 18),
            .foregroundColor: NSColor(calibratedRed: 0.68, green: 0.86, blue: 0.22, alpha: 1),
            .kern: 1.1
        ]
        let headlineAttributes: [NSAttributedString.Key: Any] = [
            .font: NSFont(name: "Arial-BoldMT", size: 34) ?? NSFont.boldSystemFont(ofSize: 34),
            .foregroundColor: NSColor.white,
            .kern: -0.3
        ]
        (eyebrow as NSString).draw(at: NSPoint(x: 58, y: 918), withAttributes: eyebrowAttributes)
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = 1
        let attributes = headlineAttributes.merging([.paragraphStyle: paragraph]) { $1 }
        (headline as NSString).draw(in: NSRect(x: 58, y: 798, width: 440, height: 105), withAttributes: attributes)
    }
}

try makeOverlay(name: "overlay-01-hook.png", eyebrow: "SINGAPORE", headline: "WHERE DOES USED\nCOOKING OIL GO?")
try makeOverlay(name: "overlay-02-problem.png", eyebrow: "DON'T POUR IT AWAY", headline: "DOWN THE DRAIN?\nA PROBLEM FOR THE FUTURE.")
try makeOverlay(name: "overlay-03-collect.png", eyebrow: "THE SIMPLE WAY", headline: "STORE IT.\nWE'LL COLLECT IT.")
try makeOverlay(name: "overlay-04-service.png", eyebrow: "FATHOPES ENERGY", headline: "USED-OIL COLLECTION\nACROSS SINGAPORE.")

try writePNG(named: "end-card.png") {
    NSColor(calibratedRed: 0.02, green: 0.13, blue: 0.10, alpha: 1).setFill()
    NSBezierPath(rect: NSRect(origin: .zero, size: canvasSize)).fill()
    NSColor(calibratedRed: 0.39, green: 0.72, blue: 0.42, alpha: 0.18).setFill()
    NSBezierPath(ovalIn: NSRect(x: -180, y: -120, width: 600, height: 600)).fill()
    NSColor(calibratedRed: 0.63, green: 0.84, blue: 0.20, alpha: 0.13).setFill()
    NSBezierPath(ovalIn: NSRect(x: 280, y: 640, width: 440, height: 440)).fill()

    if let logo = NSImage(contentsOf: logoURL) {
        logo.draw(in: NSRect(x: 138, y: 555, width: 300, height: 145), from: .zero, operation: .sourceOver, fraction: 1)
    }
    let tagline = "TURN WASTE INTO WEALTH"
    let taglineAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont(name: "Arial-BoldMT", size: 29) ?? NSFont.boldSystemFont(ofSize: 29),
        .foregroundColor: NSColor.white,
        .kern: 0.4
    ]
    let size = (tagline as NSString).size(withAttributes: taglineAttributes)
    (tagline as NSString).draw(at: NSPoint(x: (canvasSize.width - size.width) / 2, y: 442), withAttributes: taglineAttributes)
    let lineAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont(name: "ArialMT", size: 18) ?? NSFont.systemFont(ofSize: 18),
        .foregroundColor: NSColor(calibratedWhite: 1, alpha: 0.82)
    ]
    let line = "Used cooking oil collection across Singapore"
    let lineSize = (line as NSString).size(withAttributes: lineAttributes)
    (line as NSString).draw(at: NSPoint(x: (canvasSize.width - lineSize.width) / 2, y: 398), withAttributes: lineAttributes)
}

print("Created FatHopes Singapore video overlays and end card.")
