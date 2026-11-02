#!/usr/bin/env bash
# APP-NATIVA — controllo del codice Swift dell'app senza Xcode.
#  1) sintassi di tutti i file Swift del target App (swiftc -parse, Command Line Tools);
#  2) controllo dei TIPI dei plugin locali compilandoli per Mac Catalyst (SDK macOS + iOSSupport: UIKit,
#     CoreLocation, AVFAudio) contro uno stub delle firme di Capacitor (scripts/ios/capacitor-stub.swift),
#     per iOS 15 (deployment target) e iOS 17 (CLBackgroundActivitySession), in modalità Swift 5 come il progetto.
# Non sostituisce la build con Xcode (firme vere di Capacitor, SDK iOS): la conferma resta scripts/ios/prova-simulatore.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."
APP=ios/App/App
command -v swiftc >/dev/null || { echo "swiftc non c'è: installa le Command Line Tools (xcode-select --install)"; exit 2; }
swiftc -parse "$APP"/*.swift
echo "sintassi: ok ($(ls "$APP"/*.swift | wc -l | tr -d ' ') file)"
SDK=$(xcrun --show-sdk-path)
SUP="$SDK/System/iOSSupport"
if [ ! -d "$SUP/System/Library/Frameworks/UIKit.framework" ]; then
  echo "tipi: saltato (nell'SDK manca iOSSupport/UIKit)"; exit 0
fi
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for T in arm64-apple-ios15.0-macabi arm64-apple-ios17.0-macabi; do
  swiftc -swift-version 5 -target "$T" -sdk "$SDK" -Fsystem "$SUP/System/Library/Frameworks" -I "$SUP/usr/lib/swift" \
    -emit-module -module-name Capacitor -parse-as-library scripts/ios/capacitor-stub.swift -o "$TMP/Capacitor.swiftmodule" 2>/dev/null
  swiftc -swift-version 5 -target "$T" -sdk "$SDK" -Fsystem "$SUP/System/Library/Frameworks" -I "$SUP/usr/lib/swift" \
    -typecheck -I "$TMP" -module-name App "$APP/PosizioneGiroPlugin.swift" "$APP/VoceNativaPlugin.swift" "$APP/UnnivaiViewController.swift"
  echo "tipi ($T): ok"
done
