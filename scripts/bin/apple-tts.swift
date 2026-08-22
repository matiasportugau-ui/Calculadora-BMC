import AVFoundation
import AppKit
import Foundation

/// Local Apple TTS helper. Prefers Español (Argentina) Diego / Isabela.
/// usage:
///   apple-tts --probe
///   apple-tts [--voice diego|isabela] [--out file.aiff] "texto"

let ARGENTINA_IDS: [(id: String, identifier: String, lang: String)] = [
    ("diego", "com.apple.voice.compact.es-AR.Diego", "es-AR"),
    ("diego-enhanced", "com.apple.voice.enhanced.es-AR.Diego", "es-AR"),
    ("isabela", "com.apple.voice.compact.es-AR.Isabela", "es-AR"),
    ("isabela-enhanced", "com.apple.voice.enhanced.es-AR.Isabela", "es-AR"),
]

func parseArgs() -> (voice: String, out: String?, probe: Bool, text: String) {
    var voice = "diego"
    var out: String?
    var probe = false
    var parts: [String] = []
    var i = 1
    let args = CommandLine.arguments
    while i < args.count {
        let a = args[i]
        if a == "--probe" { probe = true }
        else if a == "--voice", i + 1 < args.count { i += 1; voice = args[i] }
        else if a == "--out", i + 1 < args.count { i += 1; out = args[i] }
        else if a.hasPrefix("-") {
            fputs("unknown flag \(a)\n", stderr)
            exit(2)
        } else {
            parts.append(a)
        }
        i += 1
    }
    return (voice, out, probe, parts.joined(separator: " "))
}

func resolveVoice(requested: String) -> (voice: AVSpeechSynthesisVoice?, id: String, lang: String, installed: Bool) {
    let key = requested.lowercased()
    let wanted = ARGENTINA_IDS.filter { key.contains($0.id.replacingOccurrences(of: "-enhanced", with: "")) || key.contains("argent") || key == "es-ar" }
    let order = wanted.isEmpty ? ARGENTINA_IDS : wanted + ARGENTINA_IDS
    var seen = Set<String>()
    for row in order {
        if seen.contains(row.identifier) { continue }
        seen.insert(row.identifier)
        guard let v = AVSpeechSynthesisVoice(identifier: row.identifier) else { continue }
        let lang = v.language.lowercased()
        let name = v.name.lowercased()
        let reallyAR = lang.hasPrefix("es-ar") || name.contains("diego") && lang.contains("ar") || name.contains("isabela")
        if reallyAR {
            return (v, row.id, v.language, true)
        }
    }
    // Not installed — identifier often remaps to Paulina es-MX.
    return (nil, key, "es-AR", false)
}

func printProbe() {
    let r = resolveVoice(requested: "diego")
    var available: [[String: String]] = []
    for v in AVSpeechSynthesisVoice.speechVoices() where v.language.lowercased().hasPrefix("es") {
        available.append(["name": v.name, "lang": v.language, "id": v.identifier])
    }
    let payload: [String: Any] = [
        "ok": true,
        "argentina_installed": r.installed,
        "diego_lang": r.lang,
        "voices": available,
    ]
    if let data = try? JSONSerialization.data(withJSONObject: payload),
       let s = String(data: data, encoding: .utf8) {
        print(s)
    }
}

final class Speaker: NSObject, AVSpeechSynthesizerDelegate {
    let synth = AVSpeechSynthesizer()
    var code: Int32 = 1
    func finish(_ c: Int32) {
        code = c
        DispatchQueue.main.async { CFRunLoopStop(CFRunLoopGetMain()) }
    }
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        finish(0)
    }
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        finish(0)
    }
}

let parsed = parseArgs()
_ = NSApplication.shared

if parsed.probe {
    printProbe()
    exit(0)
}

if parsed.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
    fputs("usage: apple-tts [--voice diego|isabela] [--out file.aiff] \"texto\"\n", stderr)
    exit(2)
}

let resolved = resolveVoice(requested: parsed.voice)
if !resolved.installed {
    fputs("needs_download es-AR Diego/Isabela not installed\n", stderr)
    exit(12)
}

if let out = parsed.out {
    // File render via `say` using the resolved display name when possible.
    let name = resolved.voice?.name ?? "Diego"
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: "/usr/bin/say")
    proc.arguments = ["-v", name, "-o", out, parsed.text]
    try? proc.run()
    proc.waitUntilExit()
    if proc.terminationStatus == 0 {
        print("{\"ok\":true,\"voice\":\"\(name)\",\"lang\":\"\(resolved.lang)\",\"out\":\"\(out)\"}")
        exit(0)
    }
    fputs("say failed status=\(proc.terminationStatus)\n", stderr)
    exit(Int32(proc.terminationStatus))
}

let speaker = Speaker()
speaker.synth.delegate = speaker
let utt = AVSpeechUtterance(string: parsed.text)
utt.voice = resolved.voice
utt.rate = AVSpeechUtteranceDefaultSpeechRate
speaker.synth.speak(utt)
DispatchQueue.main.asyncAfter(deadline: .now() + 120) {
    fputs("timeout\n", stderr)
    exit(13)
}
CFRunLoopRun()
exit(speaker.code)
