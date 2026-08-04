import AppKit
import Foundation

let sourceDirectory = URL(fileURLWithPath: "/Users/faeez/motionboards/FatHopes IMG/push-live-creative-mini-tanker/originals")
let outputDirectory = URL(fileURLWithPath: "/Users/faeez/motionboards/FatHopes IMG/push-live-creative-mini-tanker/edited")

let placements: [(String, CGFloat)] = [
    ("280dc7e22c317a03aa60e09b0c590adb", 0.265),
    ("6bfac433e398fd365d57561680743d02", 0.365),
    ("6e177c92912eb2eae44bdb79fa942fbc", 0.285),
    ("ae982e26c729247249781c7204ad3d7b", 0.310),
    ("b89489dda8b0559009d523b4403e16db", 0.325),
    ("ca368167bdfe1f6ceb6284daec24635f", 0.305),
    ("d359932632f8b53333ae3bdea3e913e6", 0.295),
    ("d47670dec6fe2a461da98ee9fb46a76a", 0.285),
    ("e298cccd7e5bfe2cda483d19b8a919e8", 0.285),
    ("f54659e7bccffb196562e71fdf87bb49", 0.300),
    ("f84e29dbcc1567e1a0a177dece4e4c5b", 0.245),
]

try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

for (hash, topRatio) in placements {
    let inputURL = sourceDirectory.appendingPathComponent("\(hash).jpg")
    let outputURL = outputDirectory.appendingPathComponent("\(hash)-mini-tanker.png")

    guard
        let source = NSImage(contentsOf: inputURL),
        let sourceRepresentation = source.representations.first
    else {
        fputs("Unable to read \(inputURL.path)\n", stderr)
        exit(1)
    }

    let width = sourceRepresentation.pixelsWide
    let height = sourceRepresentation.pixelsHigh
    guard let canvas = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        fputs("Unable to create canvas for \(hash)\n", stderr)
        exit(1)
    }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: canvas)
    NSGraphicsContext.current?.imageInterpolation = .high

    let fullRect = NSRect(x: 0, y: 0, width: width, height: height)
    source.draw(in: fullRect, from: .zero, operation: .copy, fraction: 1)

    let boxWidth = CGFloat(width) * 0.82
    let boxHeight = CGFloat(height) * 0.052
    let boxX = CGFloat(width) * 0.09
    let boxY = CGFloat(height) - CGFloat(height) * topRatio - boxHeight
    let boxRect = NSRect(x: boxX, y: boxY, width: boxWidth, height: boxHeight)

    NSColor(calibratedRed: 21 / 255, green: 60 / 255, blue: 46 / 255, alpha: 0.96).setFill()
    NSBezierPath(roundedRect: boxRect, xRadius: boxHeight * 0.28, yRadius: boxHeight * 0.28).fill()

    let accentRect = NSRect(x: boxX, y: boxY, width: CGFloat(width) * 0.012, height: boxHeight)
    NSColor(calibratedRed: 168 / 255, green: 217 / 255, blue: 54 / 255, alpha: 1).setFill()
    NSBezierPath(
        roundedRect: accentRect,
        xRadius: accentRect.width * 0.35,
        yRadius: accentRect.width * 0.35
    ).fill()

    let text = "Pandu Mini Tanker Dan Kutip!"
    let fontSize = CGFloat(width) * 0.038
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont(name: "Arial-BoldMT", size: fontSize) ?? NSFont.boldSystemFont(ofSize: fontSize),
        .foregroundColor: NSColor.white,
        .kern: -fontSize * 0.015,
    ]
    let measured = (text as NSString).size(withAttributes: attributes)
    let textPoint = NSPoint(
        x: CGFloat(width) * 0.13,
        y: boxY + (boxHeight - measured.height) / 2
    )
    (text as NSString).draw(at: textPoint, withAttributes: attributes)

    NSGraphicsContext.restoreGraphicsState()

    guard let png = canvas.representation(using: .png, properties: [:]) else {
        fputs("Unable to encode \(hash)\n", stderr)
        exit(1)
    }
    try png.write(to: outputURL)
}

print("Created \(placements.count) poster overlays in \(outputDirectory.path)")
