#!/usr/bin/env bash
# APP-IPHONE-PROVA — prova dell'app iOS (Capacitor) sul simulatore iPhone, in un colpo solo.
#
#   bash scripts/ios/prova-simulatore.sh            # build, avvio, posizione, giro simulato, screenshot
#   SIM_NOME="iPhone 17" bash scripts/ios/prova-simulatore.sh
#   bash scripts/ios/prova-simulatore.sh --solo-build
#
# APP-NATIVA (03/11): prima della build controlla Swift (scripts/ios/controlla-swift.sh) e icona (genera-icona --controlla);
# dopo la build controlla nel pacchetto `location` in UIBackgroundModes e l'assenza di chiavi «Always»; nella prova
# la posizione arriva dal plugin nativo PosizioneGiro (la conferma: righe «posizione nativa in background» nel registro
# mentre l'app è in secondo piano); se .env.local ha DEMO_EMAIL e DEMO_PASSWORD prova anche l'account demo del revisore
# dal «telefono a Cupertino» (giro di Catania con «Simula il cammino» fino alla fine giro).
#
# Serve Xcode completo (non i soli Command Line Tools) e `sudo xcode-select -s /Applications/Xcode.app`.
# Nessuna firma: build per simulatore con CODE_SIGNING_ALLOWED=NO. Nessun account Apple.
#
# Variabili: le VITE_ pubbliche vengono da ~/unnivai-1b/.env, l'account di prova da ~/unnivai-1b/.env.local.
# I due file si copiano qui solo per la durata della prova e si cancellano all'uscita (anche su errore).
# Il loro contenuto non si stampa mai. Le credenziali vanno negli appunti del simulatore (pbcopy) solo dopo
# il controllo che l'app avviata sia Unnivai (bundle id + titolo della pagina impacchettata), poi si svuotano.
#
# Uscita: screenshot, registro del simulatore e riepilogo in docs/prove/schermate/ios-AAAA-MM-GG/.

set -euo pipefail

RADICE="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$RADICE"

BUNDLE_ID="it.unnivai.app"
SIM_NOME="${SIM_NOME:-}"
SORGENTE_ENV="${SORGENTE_ENV:-$HOME/unnivai-1b}"
OGGI="$(date +%Y-%m-%d)"
OUT="$RADICE/docs/prove/schermate/ios-$OGGI"
DERIVATI="$RADICE/ios/build-sim"
SOLO_BUILD=0
[ "${1:-}" = "--solo-build" ] && SOLO_BUILD=1

# --- 0. Xcode ----------------------------------------------------------------------------------------
if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode non è installato o non è selezionato."
  echo "  1) Installa Xcode dall'App Store (account di Ivano)"
  echo "  2) sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  echo "  3) sudo xcodebuild -license accept && xcodebuild -runFirstLaunch"
  echo "  4) xcodebuild -downloadPlatform iOS   (runtime del simulatore)"
  exit 2
fi
mkdir -p "$OUT"
RIEPILOGO="$OUT/riepilogo.txt"
: > "$RIEPILOGO"
nota() { echo "$*" | tee -a "$RIEPILOGO"; }
nota "Xcode: $(xcodebuild -version | tr '\n' ' ')"

# --- 0b. APP-NATIVA: Swift e icona prima di tutto ------------------------------------------------------
bash scripts/ios/controlla-swift.sh 2>&1 | grep -E "^(sintassi|tipi)" | tee -a "$RIEPILOGO"
node scripts/ios/genera-icona.mjs --controlla | tee -a "$RIEPILOGO"

# --- 1. File d'ambiente: copiati solo per la prova, cancellati all'uscita ---------------------------
COPIATI=()
PID_LOG=""
UDID=""
pulisci() {
  for f in "${COPIATI[@]:-}"; do [ -n "$f" ] && rm -f "$f"; done
  [ -n "$UDID" ] && printf '' | xcrun simctl pbcopy "$UDID" 2>/dev/null || true
  [ -n "$PID_LOG" ] && kill "$PID_LOG" 2>/dev/null || true
}
trap pulisci EXIT

for nome in .env .env.local; do
  if [ ! -f "$RADICE/$nome" ]; then
    if [ -f "$SORGENTE_ENV/$nome" ]; then
      cp "$SORGENTE_ENV/$nome" "$RADICE/$nome"
      COPIATI+=("$RADICE/$nome")
    fi
  fi
done
[ -f "$RADICE/.env" ] || { echo "Manca .env con le VITE_ pubbliche (cercato in $SORGENTE_ENV)"; exit 1; }


# --- 2. Build web + controllo chiavi + sync ----------------------------------------------------------
npm run build
node scripts/controlla-chiavi.mjs --dist
npx cap sync ios
grep -qE "<title>(Unnivai|DoveVai)" ios/App/App/public/index.html || { echo "La pagina impacchettata non è DoveVai: mi fermo."; exit 3; }

# --- 3. Simulatore -----------------------------------------------------------------------------------
if [ -z "$SIM_NOME" ]; then
  SIM_NOME="$(xcrun simctl list devices available | grep -Eo 'iPhone [0-9]+( Pro)?' | sort -V | tail -1)"
fi
UDID="$(xcrun simctl list devices available | grep -F "$SIM_NOME (" | head -1 | grep -Eo '[0-9A-F-]{36}')"
[ -n "$UDID" ] || { echo "Nessun simulatore «$SIM_NOME». Elenco: xcrun simctl list devices available"; exit 4; }
nota "Simulatore: $SIM_NOME ($UDID)"
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator --args -CurrentDeviceUDID "$UDID" || true
xcrun simctl bootstatus "$UDID" -b

# --- 4. Build nativa per simulatore (senza firma) ----------------------------------------------------
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination "id=$UDID" \
  -derivedDataPath "$DERIVATI" \
  CODE_SIGNING_ALLOWED=NO \
  build | tee "$OUT/xcodebuild.log" | grep -E "error:|warning: .*Info.plist|BUILD (SUCCEEDED|FAILED)" || true
APP="$DERIVATI/Build/Products/Debug-iphonesimulator/App.app"
[ -d "$APP" ] || { echo "Build fallita: vedi $OUT/xcodebuild.log"; exit 5; }
nota "Build: $APP"
plutil -p "$APP/Info.plist" | grep -E "CFBundleIdentifier|UIBackgroundModes|NSLocation|ITSAppUses" -A2 >> "$RIEPILOGO" || true
[ -f "$APP/PrivacyInfo.xcprivacy" ] && nota "PrivacyInfo.xcprivacy: presente nel pacchetto" || nota "PrivacyInfo.xcprivacy: ASSENTE nel pacchetto"
# APP-NATIVA: posizione in background con il solo «Durante l'uso»
plutil -extract UIBackgroundModes json -o - "$APP/Info.plist" | grep -q '"location"' && nota "UIBackgroundModes: location presente" || { nota "UIBackgroundModes: location ASSENTE"; exit 5; }
if plutil -p "$APP/Info.plist" | grep -q "NSLocationAlways"; then nota "Chiave Always nel pacchetto: NON deve esserci"; exit 5; fi
[ -f "$APP/Assets.car" ] && nota "Assets.car: presente (icona e avvio compilati)" || nota "Assets.car: ASSENTE"
[ "$SOLO_BUILD" = 1 ] && { nota "Solo build: fine."; exit 0; }

# --- 5. Installazione, permesso posizione, avvio -----------------------------------------------------
xcrun simctl install "$UDID" "$APP"
xcrun simctl privacy "$UDID" grant location "$BUNDLE_ID" || true
# Partenza: Piazza Navona, Roma
xcrun simctl location "$UDID" set 41.8992,12.4731
xcrun simctl spawn "$UDID" log stream --style compact --level debug \
  --predicate 'process == "App" OR subsystem CONTAINS "capacitor" OR subsystem == "com.apple.WebKit"' \
  > "$OUT/registro-simulatore.log" 2>&1 &
PID_LOG=$!
LANCIO="$(xcrun simctl launch "$UDID" "$BUNDLE_ID")"
nota "Avvio: $LANCIO"
sleep 1
xcrun simctl io "$UDID" screenshot "$OUT/00-schermata-di-avvio.png"
sleep 5
xcrun simctl io "$UDID" screenshot "$OUT/01-avvio.png"

# Controllo prima delle credenziali: l'app in esecuzione è Unnivai e la sua pagina è DoveVai.
CONT="$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" app)"
grep -qE "<title>(Unnivai|DoveVai)" "$CONT/public/index.html" || { echo "L'app installata non contiene la pagina DoveVai: niente credenziali."; exit 6; }
xcrun simctl spawn "$UDID" launchctl list | grep -q "UIKitApplication:$BUNDLE_ID" || { echo "Unnivai non risulta in esecuzione: niente credenziali."; exit 6; }
nota "Controllo app: $BUNDLE_ID in esecuzione, pagina DoveVai"

passo() { echo; echo ">>> $1"; read -r -p "    Premi Invio quando hai fatto... " _; }
scatta() { xcrun simctl io "$UDID" screenshot "$OUT/$1.png"; nota "screenshot $1"; }

# --- 6. Login con l'account di prova (appunti del simulatore, mai a schermo nel terminale) ------------
set -a; . "$RADICE/.env.local"; set +a
if [ -n "${TEST_ACCOUNT_EMAIL:-}" ] && [ -n "${TEST_ACCOUNT_PASSWORD:-}" ]; then
  passo "Apri «Accedi» nell'app e tocca il campo email."
  printf '%s' "$TEST_ACCOUNT_EMAIL" | xcrun simctl pbcopy "$UDID"
  passo "Incolla (Cmd+V nel simulatore) l'email, poi tocca il campo password."
  printf '%s' "$TEST_ACCOUNT_PASSWORD" | xcrun simctl pbcopy "$UDID"
  passo "Incolla la password e premi Accedi."
  printf '' | xcrun simctl pbcopy "$UDID"
  unset TEST_ACCOUNT_EMAIL TEST_ACCOUNT_PASSWORD
  sleep 3; scatta "02-dopo-login"
else
  nota "Account di prova assente in .env.local: prova da ospite"
fi

# --- 7. Crea, mappa, navigazione con posizione simulata ----------------------------------------------
passo "Vai in «Crea il tuo Percorso», scrivi «un giro a piedi di due ore nel centro» e genera."
scatta "03-crea-risultato"
passo "Apri il giro sulla mappa (panoramica)."
scatta "04-mappa"
passo "Premi «Avvia» e accendi la voce. Al primo «Avvia» l'app chiede la posizione «Durante l'uso» se non l'ha già: concedila. Al tuo Invio parte il cammino simulato (1,4 m/s)."
xcrun simctl location "$UDID" start --speed=1.4 --interval=1 \
  41.8992,12.4731 41.8986,12.4747 41.8979,12.4762 41.8987,12.4768 41.8996,12.4766 \
  41.9009,12.4767 41.9018,12.4770 41.9009,12.4783 41.8990,12.4797 41.8975,12.4818
sleep 20; scatta "05-navigazione-cammino"
sleep 40; scatta "06-navigazione-dopo-un-minuto"

# --- 8. App in secondo piano: l'audio e la posizione continuano? ---------------------------------------
nota "Secondo piano: apro Impostazioni sopra l'app per 90 s (equivale a lasciare l'app), il cammino simulato continua"
INIZIO_BG="$(date '+%Y-%m-%d %H:%M:%S')"
RIGHE_PRIMA="$(grep -c "posizione nativa in background" "$OUT/registro-simulatore.log" || true)"
xcrun simctl launch "$UDID" com.apple.Preferences >/dev/null
sleep 30; scatta "06b-secondo-piano-indicatore-blu"
sleep 60
RIGHE_DOPO="$(grep -c "posizione nativa in background" "$OUT/registro-simulatore.log" || true)"
nota "Posizioni arrivate al JavaScript in secondo piano (righe di registro, 1 ogni 10): $((RIGHE_DOPO - RIGHE_PRIMA))"
xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
sleep 4; scatta "07-ritorno-dal-secondo-piano"
nota "Ascolta: la voce si è sentita mentre l'app era in secondo piano? (annotalo nel report)"
passo "Apri il racconto di una tappa (lettore) e premi Play: deve parlare con la voce umana."
scatta "08-racconto"
xcrun simctl location "$UDID" clear || true

# --- 9. APP-NATIVA: l'account demo del revisore Apple, «dal telefono a Cupertino» -----------------------
set -a; . "$RADICE/.env.local"; set +a
if [ -n "${DEMO_EMAIL:-}" ] && [ -n "${DEMO_PASSWORD:-}" ]; then
  xcrun simctl location "$UDID" set 37.3349,-122.0090
  passo "Esci dall'account di prova (Profilo → Esci) e apri «Accedi»; tocca il campo email."
  printf '%s' "$DEMO_EMAIL" | xcrun simctl pbcopy "$UDID"
  passo "Incolla l'email del demo, poi tocca il campo password."
  printf '%s' "$DEMO_PASSWORD" | xcrun simctl pbcopy "$UDID"
  passo "Incolla la password e premi Accedi."
  printf '' | xcrun simctl pbcopy "$UDID"
  unset DEMO_EMAIL DEMO_PASSWORD
  sleep 3; scatta "09-demo-home-scheda-giro-di-prova"
  passo "Tocca «Giro di prova per la revisione», poi «Avvia» e accendi la voce."
  scatta "10-demo-avviato"
  passo "Tocca «Simula il cammino». Al tuo Invio aspetto 2 minuti (prima tappa)."
  sleep 120; scatta "11-demo-arrivo-prima-tappa"
  passo "Ascolta il racconto (Play) e chiudi la scheda. Al tuo Invio aspetto 8 minuti (fine giro)."
  sleep 480; scatta "12-demo-fine-giro"
  xcrun simctl location "$UDID" clear || true
else
  nota "DEMO_EMAIL / DEMO_PASSWORD assenti in .env.local: prova dell'account demo saltata"
fi

# --- 10. Icona sulla schermata Home ---------------------------------------------------------------------
xcrun simctl terminate "$UDID" "$BUNDLE_ID" || true
sleep 2; scatta "13-home-icona"

kill "$PID_LOG" 2>/dev/null || true; PID_LOG=""
nota "Righe del registro dopo l'uscita in secondo piano ($INIZIO_BG):"
grep -c "" "$OUT/registro-simulatore.log" | xargs -I{} echo "  registro: {} righe" | tee -a "$RIEPILOGO"
grep -E "voce|Voce|geoloc|Geoloc|location|suspend|Suspend" "$OUT/registro-simulatore.log" | tail -40 >> "$RIEPILOGO" || true
nota "Fine. Cartella: $OUT"
