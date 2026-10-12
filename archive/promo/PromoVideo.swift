import Foundation
import AppKit
import AVFoundation
import CoreVideo

let width = 1080
let height = 1920
let fps: Int32 = 30
let duration = 6.0
let frameCount = Int(duration * Double(fps))

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> NSColor {
    NSColor(
        calibratedRed: CGFloat((hex >> 16) & 255) / 255,
        green: CGFloat((hex >> 8) & 255) / 255,
        blue: CGFloat(hex & 255) / 255,
        alpha: alpha
    )
}

let bg = color(0x07090C)
let panel = color(0x111318)
let panel2 = color(0x181B21)
let line = color(0x2A2E37)
let text = color(0xF1F5F9)
let muted = color(0x89919F)
let cyan = color(0x22D3EE)
let amber = color(0xF59E0B)
let green = color(0x84CC16)

func clamp(_ x: CGFloat, _ a: CGFloat = 0, _ b: CGFloat = 1) -> CGFloat { min(b, max(a, x)) }
func smooth(_ x: CGFloat) -> CGFloat {
    let v = clamp(x)
    return v * v * (3 - 2 * v)
}
func easeOut(_ x: CGFloat) -> CGFloat { 1 - pow(1 - clamp(x), 3) }

func fill(_ ctx: CGContext, _ rect: CGRect, _ c: NSColor, radius: CGFloat = 0) {
    ctx.setFillColor(c.cgColor)
    if radius > 0 {
        ctx.addPath(CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil))
        ctx.fillPath()
    } else { ctx.fill(rect) }
}

func stroke(_ ctx: CGContext, _ rect: CGRect, _ c: NSColor, radius: CGFloat = 0, width: CGFloat = 2) {
    ctx.setStrokeColor(c.cgColor)
    ctx.setLineWidth(width)
    let inset = rect.insetBy(dx: width / 2, dy: width / 2)
    if radius > 0 {
        ctx.addPath(CGPath(roundedRect: inset, cornerWidth: radius, cornerHeight: radius, transform: nil))
    } else { ctx.addRect(inset) }
    ctx.strokePath()
}

func drawText(_ value: String, at point: CGPoint, size: CGFloat, weight: NSFont.Weight = .regular,
              color c: NSColor = text, align: NSTextAlignment = .left, width: CGFloat = 900,
              tracking: CGFloat = 0) {
    let style = NSMutableParagraphStyle()
    style.alignment = align
    let attrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: c,
        .paragraphStyle: style,
        .kern: tracking
    ]
    NSAttributedString(string: value, attributes: attrs).draw(in: CGRect(x: point.x, y: point.y, width: width, height: size * 1.35))
}

func drawLogo(_ ctx: CGContext, center: CGPoint, scale: CGFloat, alpha: CGFloat) {
    ctx.saveGState()
    ctx.setAlpha(alpha)
    ctx.translateBy(x: center.x, y: center.y)
    ctx.scaleBy(x: scale, y: scale)
    ctx.setStrokeColor(cyan.cgColor)
    ctx.setLineWidth(12)
    ctx.setLineCap(.round)
    ctx.addArc(center: .zero, radius: 68, startAngle: .pi * 0.72, endAngle: .pi * 2.28, clockwise: false)
    ctx.strokePath()
    ctx.setStrokeColor(color(0xB8F3FF).cgColor)
    ctx.setLineWidth(9)
    ctx.move(to: CGPoint(x: 0, y: -64))
    ctx.addLine(to: CGPoint(x: 0, y: -10))
    ctx.strokePath()
    ctx.setFillColor(cyan.cgColor)
    ctx.fillEllipse(in: CGRect(x: -10, y: -10, width: 20, height: 20))
    ctx.restoreGState()
}

func drawKnob(_ ctx: CGContext, center: CGPoint, value: CGFloat, accent: NSColor, label: String, number: String) {
    let radius: CGFloat = 54
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: 18, color: accent.withAlphaComponent(0.28).cgColor)
    fill(ctx, CGRect(x: center.x-radius, y: center.y-radius, width: radius*2, height: radius*2), panel2, radius: radius)
    ctx.restoreGState()
    stroke(ctx, CGRect(x: center.x-radius, y: center.y-radius, width: radius*2, height: radius*2), line, radius: radius, width: 3)
    let a = (-135 + 270 * clamp(value)) * CGFloat.pi / 180
    ctx.setStrokeColor(accent.cgColor)
    ctx.setLineWidth(7)
    ctx.setLineCap(.round)
    ctx.move(to: center)
    ctx.addLine(to: CGPoint(x: center.x + sin(a) * 37, y: center.y - cos(a) * 37))
    ctx.strokePath()
    drawText(number, at: CGPoint(x: center.x-50, y: center.y+69), size: 25, weight: .semibold, color: text, align: .center, width: 100)
    drawText(label.uppercased(), at: CGPoint(x: center.x-65, y: center.y+106), size: 17, weight: .medium, color: muted, align: .center, width: 130, tracking: 1.4)
}

func drawChain(_ ctx: CGContext, y: CGFloat, active: Int, pulse: CGFloat) {
    let labels = ["IN", "FX1", "FX2", "PED", "AMP", "CAB", "DEL", "MOD", "REV", "EQ", "OUT"]
    let start: CGFloat = 80
    let gap: CGFloat = 92
    ctx.setStrokeColor(line.cgColor)
    ctx.setLineWidth(3)
    ctx.move(to: CGPoint(x: start, y: y + 34))
    ctx.addLine(to: CGPoint(x: start + gap * CGFloat(labels.count-1), y: y + 34))
    ctx.strokePath()
    for (i, label) in labels.enumerated() {
        let x = start + gap * CGFloat(i)
        let selected = i == active
        let ac = label == "PED" ? amber : (label == "CAB" ? green : cyan)
        if selected {
            ctx.saveGState()
            ctx.setShadow(offset: .zero, blur: 18 + pulse * 10, color: ac.withAlphaComponent(0.7).cgColor)
            fill(ctx, CGRect(x: x-29, y: y+5, width: 58, height: 58), ac.withAlphaComponent(0.18), radius: 17)
            ctx.restoreGState()
            stroke(ctx, CGRect(x: x-29, y: y+5, width: 58, height: 58), ac, radius: 17, width: 3)
        } else {
            fill(ctx, CGRect(x: x-25, y: y+9, width: 50, height: 50), panel2, radius: 15)
            stroke(ctx, CGRect(x: x-25, y: y+9, width: 50, height: 50), line, radius: 15, width: 2)
        }
        drawText(label, at: CGPoint(x: x-42, y: y+76), size: 16, weight: .bold, color: selected ? ac : muted, align: .center, width: 84, tracking: 0.5)
    }
}

func drawInterface(_ ctx: CGContext, t: CGFloat) {
    let intro = easeOut((t - 0.72) / 0.48)
    let yOffset = (1 - intro) * 210
    let ui = CGRect(x: 45, y: 465 + yOffset, width: 990, height: 1065)
    ctx.saveGState()
    ctx.setAlpha(intro)
    ctx.setShadow(offset: CGSize(width: 0, height: 30), blur: 70, color: NSColor.black.withAlphaComponent(0.75).cgColor)
    fill(ctx, ui, panel, radius: 32)
    ctx.restoreGState()
    stroke(ctx, ui, line, radius: 32, width: 3)
    fill(ctx, CGRect(x: ui.minX, y: ui.minY, width: ui.width, height: 84), color(0x0D0F13), radius: 32)
    fill(ctx, CGRect(x: ui.minX, y: ui.minY+48, width: ui.width, height: 36), color(0x0D0F13))
    for (i,c) in [color(0xFF5F57), color(0xFFBD2E), color(0x28C840)].enumerated() {
        fill(ctx, CGRect(x: 78 + CGFloat(i)*31, y: ui.minY+33, width: 17, height: 17), c, radius: 9)
    }
    drawText("JimCommanD", at: CGPoint(x: 340, y: ui.minY+27), size: 25, weight: .semibold, color: text, align: .center, width: 400, tracking: 1)
    drawText("MOSAIC  •  USB", at: CGPoint(x: 805, y: ui.minY+31), size: 15, weight: .semibold, color: cyan, width: 180, tracking: 1)
    let stage: Int
    if t < 2.25 { stage = 4 } else if t < 3.25 { stage = 3 } else if t < 4.12 { stage = 5 } else { stage = 8 }
    drawChain(ctx, y: ui.minY+120, active: stage, pulse: (sin(t*8)+1)/2)
    let titles = [4:"AMPLIFIER", 3:"PEDAL CAPTURE", 5:"CABINET IR", 8:"REVERB"]
    let accent = stage == 3 ? amber : (stage == 5 ? green : cyan)
    drawText(titles[stage]!, at: CGPoint(x: 92, y: ui.minY+278), size: 23, weight: .bold, color: accent, width: 500, tracking: 2.4)
    drawText(stage == 3 ? "10 DEDICATED NAM POSITIONS" : stage == 4 ? "20 DEDICATED NAM POSITIONS" : stage == 5 ? "CUSTOM IMPULSE RESPONSE" : "ALGORITHMIC SPACE", at: CGPoint(x: 92, y: ui.minY+319), size: 16, weight: .medium, color: muted, width: 600, tracking: 1.2)
    let phase = t * 1.65
    let values: [CGFloat] = [
        0.18 + 0.64 * (sin(phase)+1)/2,
        0.22 + 0.58 * (sin(phase+1.35)+1)/2,
        0.15 + 0.72 * (sin(phase+2.7)+1)/2,
        0.25 + 0.55 * (sin(phase+4.0)+1)/2
    ]
    let knobLabels: [Int:[String]] = [
        4:["Gain","Bass","Mid","Treble"],
        3:["Input","Drive","Tone","Output"],
        5:["Low Cut","High Cut","Level","Blend"],
        8:["Decay","Pre-Delay","Mix","Damping"]
    ]
    for i in 0..<4 {
        drawKnob(ctx, center: CGPoint(x: 190 + CGFloat(i)*225, y: ui.minY+520), value: values[i], accent: accent, label: knobLabels[stage]![i], number: String(Int(values[i]*100)))
    }
    let slotText = stage == 3 ? "PEDAL 01  →  HARDWARE NAM 21" : stage == 4 ? "AMPLIFIER 01  →  HARDWARE NAM 01" : stage == 5 ? "CABINET IR 01  •  4×12 VINTAGE" : "HALL  •  PRESET-SAVED PARAMETERS"
    fill(ctx, CGRect(x: 91, y: ui.minY+730, width: 898, height: 112), panel2, radius: 18)
    stroke(ctx, CGRect(x: 91, y: ui.minY+730, width: 898, height: 112), accent.withAlphaComponent(0.45), radius: 18, width: 2)
    drawText(slotText, at: CGPoint(x: 125, y: ui.minY+760), size: 22, weight: .semibold, color: text, width: 760, tracking: 0.6)
    drawText(stage == 5 ? "+ LOAD CUSTOM IR FILE…" : "+ LOAD CUSTOM NAM / NAM2…", at: CGPoint(x: 91, y: ui.minY+879), size: 19, weight: .semibold, color: accent, width: 500, tracking: 0.5)
    drawText("MOSAIC CONNECTED", at: CGPoint(x: 91, y: ui.maxY-74), size: 15, weight: .semibold, color: color(0x28C840), width: 260, tracking: 1.2)
    drawText("INTEL MACINTOSH  •  48 kHz", at: CGPoint(x: 680, y: ui.maxY-74), size: 15, weight: .medium, color: muted, width: 300, tracking: 0.7)
}

func drawFrame(_ ctx: CGContext, time: CGFloat) {
    fill(ctx, CGRect(x: 0, y: 0, width: width, height: height), bg)
    let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [cyan.withAlphaComponent(0.15).cgColor, NSColor.clear.cgColor] as CFArray, locations: [0,1])!
    ctx.drawRadialGradient(gradient, startCenter: CGPoint(x: 540, y: 280), startRadius: 0, endCenter: CGPoint(x: 540, y: 280), endRadius: 760, options: [])

    if time < 1.25 {
        let p = easeOut(time / 0.55)
        drawLogo(ctx, center: CGPoint(x: 540, y: 485), scale: 0.78 + p*0.22, alpha: p)
        drawText("JimCommanD", at: CGPoint(x: 90, y: 635), size: 83, weight: .bold, color: text.withAlphaComponent(p), align: .center, width: 900, tracking: -1)
        drawText("FOR INTEL MACINTOSH", at: CGPoint(x: 90, y: 753), size: 25, weight: .semibold, color: cyan.withAlphaComponent(p), align: .center, width: 900, tracking: 6)
        drawText("MOSAIC TONE CONTROL • REIMAGINED", at: CGPoint(x: 90, y: 822), size: 18, weight: .medium, color: muted.withAlphaComponent(p), align: .center, width: 900, tracking: 2.4)
    }

    if time >= 0.72 && time < 5.28 { drawInterface(ctx, t: time) }

    if time >= 5.0 {
        let p = smooth((time-5.0)/0.38)
        ctx.setFillColor(bg.withAlphaComponent(p).cgColor)
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        drawLogo(ctx, center: CGPoint(x: 540, y: 510), scale: 0.82, alpha: p)
        drawText("JimCommanD", at: CGPoint(x: 90, y: 658), size: 80, weight: .bold, color: text.withAlphaComponent(p), align: .center, width: 900, tracking: -1)
        drawText("YOUR MOSAIC. YOUR SOUND.", at: CGPoint(x: 90, y: 782), size: 28, weight: .bold, color: cyan.withAlphaComponent(p), align: .center, width: 900, tracking: 3)
        drawText("20 AMP  •  10 PEDAL  •  CUSTOM IR", at: CGPoint(x: 90, y: 859), size: 21, weight: .semibold, color: muted.withAlphaComponent(p), align: .center, width: 900, tracking: 1.7)
        drawText("FOR INTEL MACINTOSH", at: CGPoint(x: 90, y: 1330), size: 21, weight: .semibold, color: text.withAlphaComponent(p), align: .center, width: 900, tracking: 5)
    }
}

let outputURL = URL(fileURLWithPath: "<HOME>/Documents/Codex/2026-09-06/referenced-chatgpt-conversation-this-is-an/JimCommanD-YouTube-Short-6s.mp4")
try? FileManager.default.removeItem(at: outputURL)
let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 12_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
    ]
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferIOSurfacePropertiesKey as String: [:]
])
guard writer.canAdd(input) else { fatalError("Cannot add video input") }
writer.add(input)
guard writer.startWriting() else { fatalError(writer.error?.localizedDescription ?? "Could not start writer") }
writer.startSession(atSourceTime: .zero)

for frame in 0..<frameCount {
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
    autoreleasepool {
        var pixelBuffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pixelBuffer)
        guard let pb = pixelBuffer else { return }
        CVPixelBufferLockBaseAddress(pb, [])
        let ctx = CGContext(
            data: CVPixelBufferGetBaseAddress(pb), width: width, height: height,
            bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
        )!
        let nsContext = NSGraphicsContext(cgContext: ctx, flipped: true)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = nsContext
        drawFrame(ctx, time: CGFloat(frame) / CGFloat(fps))
        NSGraphicsContext.restoreGraphicsState()
        CVPixelBufferUnlockBaseAddress(pb, [])
        adaptor.append(pb, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: fps))
    }
}
input.markAsFinished()
let semaphore = DispatchSemaphore(value: 0)
writer.finishWriting { semaphore.signal() }
semaphore.wait()
if writer.status != .completed { fatalError(writer.error?.localizedDescription ?? "Encoding failed") }
print(outputURL.path)
