import Foundation
import AVFoundation
import Capacitor

/// APP-NATIVA — la voce del telefono detta dall'app, non dalla pagina.
///
/// Nell'app la voce di ripiego (quando la voce umana di VOCE-1 non c'è) era lo speechSynthesis della WKWebView,
/// che vive nel processo della pagina: a schermo bloccato quel processo può essere sospeso a metà frase.
/// AVSpeechSynthesizer parla dal processo dell'app, che la posizione in background tiene vivo, con la sessione
/// audio dell'app (.playback / .voicePrompt, AppDelegate) e UIBackgroundModes = audio.
///
/// Dal JavaScript (src/lib/voceNativa.js):
///   parla({ testo, lingua, velocita }) → si risolve a fine frase: { detta: true } oppure { detta: false } se interrotta
///   ferma()                            → tace subito
@objc(VoceNativaPlugin)
public class VoceNativaPlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate {
    public let identifier = "VoceNativaPlugin"
    public let jsName = "VoceNativa"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "parla", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ferma", returnType: CAPPluginReturnPromise)
    ]

    private let sintetizzatore = AVSpeechSynthesizer()
    private var chiamataInCorso: CAPPluginCall?
    private var fraseInCorso: AVSpeechUtterance?

    override public func load() {
        sintetizzatore.delegate = self
    }

    @objc func parla(_ call: CAPPluginCall) {
        guard let testo = call.getString("testo"), !testo.isEmpty else {
            call.reject("Testo mancante")
            return
        }
        let lingua = call.getString("lingua", "it-IT")
        let velocita = Float(call.getDouble("velocita", 0.95))
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            // l'ultima frase vince: quella di prima si chiude come «non detta»
            self.chiudi(detta: false)
            if self.sintetizzatore.isSpeaking {
                self.sintetizzatore.stopSpeaking(at: .immediate)
            }
            do {
                try AVAudioSession.sharedInstance().setActive(true)
            } catch {
                print("Unnivai: sessione audio non attivata: \(error)")
            }
            let frase = AVSpeechUtterance(string: testo)
            frase.voice = AVSpeechSynthesisVoice(language: lingua)
            frase.rate = min(AVSpeechUtteranceMaximumSpeechRate, AVSpeechUtteranceDefaultSpeechRate * velocita)
            self.fraseInCorso = frase
            self.chiamataInCorso = call
            self.sintetizzatore.speak(frase)
        }
    }

    @objc func ferma(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.chiudi(detta: false)
            if self.sintetizzatore.isSpeaking {
                self.sintetizzatore.stopSpeaking(at: .immediate)
            }
            self.rilasciaSessione()
            call.resolve()
        }
    }

    // MARK: - AVSpeechSynthesizerDelegate

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        guard utterance === fraseInCorso else { return }
        chiudi(detta: true)
        rilasciaSessione()
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        guard utterance === fraseInCorso else { return }
        chiudi(detta: false)
    }

    // MARK: - utilità

    private func chiudi(detta: Bool) {
        if let call = chiamataInCorso {
            call.resolve(["detta": detta])
        }
        chiamataInCorso = nil
        fraseInCorso = nil
    }

    /// La musica dell'utente, abbassata durante la frase (.duckOthers), torna al suo volume.
    private func rilasciaSessione() {
        if sintetizzatore.isSpeaking { return }
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            // un altro audio dell'app è in corso: la sessione resta attiva
        }
    }
}
