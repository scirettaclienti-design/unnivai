import Foundation
import UIKit
import CoreLocation
import Capacitor

/// APP-NATIVA — la posizione del giro anche a schermo bloccato, con il solo permesso «Durante l'uso».
///
/// Apple (CLLocationManager.allowsBackgroundLocationUpdates): con la proprietà a true e gli aggiornamenti avviati
/// in primo piano, Core Location tiene l'app in esecuzione e mostra l'indicatore blu; gli aggiornamenti continuano
/// anche dopo il passaggio in background. Serve `location` in UIBackgroundModes (senza, l'app si chiude).
/// Su iOS 17+ in più una CLBackgroundActivitySession, creata in primo piano.
/// Non si chiede mai «Sempre»: niente requestAlwaysAuthorization, niente chiave Always in Info.plist.
///
/// Dal JavaScript (src/lib/posizioneNativa.js):
///   avvia({ distanzaMinima })  → parte (chiede «Durante l'uso» se non è mai stato chiesto); rifiuto → codice NEGATO
///   ferma()                    → spegne aggiornamenti, background e sessione
///   stato()                    → { autorizzazione, attivo }
/// Eventi: «posizione» { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed, timestamp, sfondo }
///         «errore»    { code: 1 (negato) | 2 (non disponibile), message }
@objc(PosizioneGiroPlugin)
public class PosizioneGiroPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "PosizioneGiroPlugin"
    public let jsName = "PosizioneGiro"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "avvia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ferma", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stato", returnType: CAPPluginReturnPromise)
    ]

    private var manager: CLLocationManager?
    /// CLBackgroundActivitySession su iOS 17+ (tenuta come AnyObject per restare compatibili con iOS 15).
    private var sessione: AnyObject?
    private var inAttesaDelPermesso: CAPPluginCall?
    private var attivo = false
    private var distanzaMinima: Double = 5
    /// Al massimo tante posizioni per consegna: dopo una pausa iOS può consegnarne molte insieme.
    private let massimoPerConsegna = 5

    @objc func avvia(_ call: CAPPluginCall) {
        let richiesta = call.getDouble("distanzaMinima", 5)
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.distanzaMinima = max(0, richiesta)
            let gestore = self.manager ?? CLLocationManager()
            gestore.delegate = self
            self.manager = gestore
            switch gestore.authorizationStatus {
            case .notDetermined:
                // la risposta arriva in locationManagerDidChangeAuthorization
                self.inAttesaDelPermesso = call
                gestore.requestWhenInUseAuthorization()
            case .denied, .restricted:
                call.reject("Posizione non concessa", "NEGATO")
            default:
                self.parti(gestore)
                call.resolve(["autorizzazione": self.nomeAutorizzazione(gestore.authorizationStatus), "attivo": true])
            }
        }
    }

    @objc func ferma(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.spegni()
            call.resolve()
        }
    }

    @objc func stato(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let stato = self.manager?.authorizationStatus ?? CLLocationManager().authorizationStatus
            call.resolve(["autorizzazione": self.nomeAutorizzazione(stato), "attivo": self.attivo])
        }
    }

    // MARK: - avvio e arresto (sempre sul main thread)

    private func parti(_ gestore: CLLocationManager) {
        gestore.desiredAccuracy = kCLLocationAccuracyBest
        gestore.distanceFilter = distanzaMinima > 0 ? distanzaMinima : kCLDistanceFilterNone
        gestore.activityType = .fitness
        gestore.pausesLocationUpdatesAutomatically = false
        gestore.allowsBackgroundLocationUpdates = true
        gestore.showsBackgroundLocationIndicator = true
        if #available(iOS 17.0, *) {
            if sessione == nil {
                sessione = CLBackgroundActivitySession()
            }
        }
        if !attivo {
            gestore.startUpdatingLocation()
            attivo = true
        }
    }

    private func spegni() {
        if let gestore = manager {
            gestore.stopUpdatingLocation()
            gestore.allowsBackgroundLocationUpdates = false
        }
        if #available(iOS 17.0, *) {
            if let attuale = sessione as? CLBackgroundActivitySession {
                attuale.invalidate()
            }
        }
        sessione = nil
        attivo = false
    }

    // MARK: - CLLocationManagerDelegate

    public func locationManagerDidChangeAuthorization(_ gestore: CLLocationManager) {
        let stato = gestore.authorizationStatus
        guard let call = inAttesaDelPermesso else {
            if attivo && (stato == .denied || stato == .restricted) {
                spegni()
                notifyListeners("errore", data: ["code": 1, "message": "Posizione non concessa"])
            }
            return
        }
        switch stato {
        case .notDetermined:
            return
        case .denied, .restricted:
            inAttesaDelPermesso = nil
            call.reject("Posizione non concessa", "NEGATO")
        default:
            inAttesaDelPermesso = nil
            parti(gestore)
            call.resolve(["autorizzazione": nomeAutorizzazione(stato), "attivo": true])
        }
    }

    public func locationManager(_ gestore: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let ultime = locations.suffix(massimoPerConsegna)
        for posizione in ultime {
            notifyListeners("posizione", data: dati(di: posizione))
        }
    }

    public func locationManager(_ gestore: CLLocationManager, didFailWithError error: Error) {
        if let errore = error as? CLError {
            if errore.code == .locationUnknown {
                // temporaneo: Core Location continua a provare da solo
                return
            }
            if errore.code == .denied {
                notifyListeners("errore", data: ["code": 1, "message": "Posizione non concessa"])
                return
            }
        }
        notifyListeners("errore", data: ["code": 2, "message": error.localizedDescription])
    }

    // MARK: - utilità

    private func dati(di posizione: CLLocation) -> [String: Any] {
        var risultato: [String: Any] = [
            "latitude": posizione.coordinate.latitude,
            "longitude": posizione.coordinate.longitude,
            "accuracy": posizione.horizontalAccuracy,
            "timestamp": posizione.timestamp.timeIntervalSince1970 * 1000,
            "sfondo": UIApplication.shared.applicationState == .background
        ]
        risultato["altitude"] = valore(posizione.altitude, valido: posizione.verticalAccuracy >= 0)
        risultato["altitudeAccuracy"] = valore(posizione.verticalAccuracy, valido: posizione.verticalAccuracy >= 0)
        risultato["heading"] = valore(posizione.course, valido: posizione.course >= 0)
        risultato["speed"] = valore(posizione.speed, valido: posizione.speed >= 0)
        return risultato
    }

    private func valore(_ numero: Double, valido: Bool) -> Any {
        if valido {
            return numero
        }
        return NSNull()
    }

    private func nomeAutorizzazione(_ stato: CLAuthorizationStatus) -> String {
        switch stato {
        case .authorizedWhenInUse:
            return "durante-uso"
        case .authorizedAlways:
            return "sempre"
        case .denied, .restricted:
            return "negato"
        case .notDetermined:
            return "da-chiedere"
        @unknown default:
            return "sconosciuto"
        }
    }
}
