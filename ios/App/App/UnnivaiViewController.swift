import UIKit
import Capacitor

/// APP-NATIVA — il controller della pagina registra i due plugin locali del progetto
/// (posizione del giro in background e voce del telefono). Main.storyboard usa questa classe.
class UnnivaiViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PosizioneGiroPlugin())
        bridge?.registerPluginInstance(VoceNativaPlugin())
    }
}
