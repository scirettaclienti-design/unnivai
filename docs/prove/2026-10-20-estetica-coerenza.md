# ESTETICA-COERENZA — le schermate 5, 6, 11, 12, 13, 15 alla palette dell'app

Ramo `classi-trasparenti` (da `79cc996`), `~/unnivai-2`. Regola in `docs/estetica/palette.md`. Solo classi di colore, bordo, ombra, fondo: nessun layout, spaziatura, font, testo o logica; nessun file in `src/services`, `src/lib`, `supabase/`. Spesa API: 0 $. Nessun push su main, nessun deploy.

Schermate (numero = prefisso del file in `docs/prove/schermate/classi-trasparenti/dopo/`): 05-navigazione, 06-mappa-scheda-tappa, 11-tour-live, 12-trending, 13-impostazioni-notifiche, 15-prossimamente.

**Raggiungibilità in V1** (verificata in `App.jsx`, `BottomNavigation`, link nel codice), come da indicazione di Ivano le 6 sono lavorate tutte e la visibilità non cambia:
- 15 `/prossimamente/*`: visibile (link in Landing e Home, rimando di `V1LockedGuard`).
- 11 `/tour-live`: nessun link visibile (solo da `BecomeGuide`, bloccata); la rotta è aperta.
- 12 `/trending`: nessun link; la rotta è aperta (`ComingSoonOverlay`).
- 05, 06, 13: visibili.

## 1. Colori trovati → sostituiti

| Schermata | File / componente | Fuori palette trovato | Ora |
|---|---|---|---|
| 05 Navigazione | `Map/NavigationHUD.jsx` | `text-status-warning` (icona avviso), `text-status-error` (tasto) | `text-brand-orange` |
| 06 Scheda tappa | `Map/POIDetailDrawer.jsx`, `Map/POIPopupCard.jsx` | `bg-black/40`, `hover:bg-black/60`, `text-white` (tasto chiudi); ombra `rgba(0,0,0,.5)` | `bg-obsidian-bg/60`, `/80`, `text-obsidian-primary`; ombra `rgb(14 12 11/.5)` |
| 11 Tour live | `pages/TourLive.jsx` (88 righe) | fondi `ochre`, gradienti rosso/rosa/terracotta/oliva/ocra, `bg-white/NN`, `text-gray-*`, `text-yellow-400`, `text-terracotta-*`, `border-white/NN` | fondo `obsidian-bg`/`card`, accento unico `brand-orange` (tasti con testo `obsidian-bg`), testi `obsidian-primary/secondary`, bordi `obsidian-border` |
| 12 Trending | `components/ComingSoonOverlay.jsx` (`Trending.jsx` non ha classi) | terracotta, `bg-red-*`/`ring-red-*` (variante `red`), ocra, `bg-white/NN`, `text-gray-*`, gradiente `ochre/white` | stesse regole; le due varianti `terracotta` e `red` ora coincidono (accento unico) |
| 13 Impostazioni notifiche | `pages/NotificationSettings.jsx` | tutta la pagina in tema chiaro: `bg-gray-50`, `bg-white`, `border-gray-100`, `text-gray-*`, `bg-orange-50/500`, gradiente `orange→amber`, `shadow-orange-*` | `obsidian-bg/card/raised`, bordi `obsidian-border`, pallino `obsidian-primary`, tasto spento con bordo `obsidian-border-elevated`, accento `brand-orange` |
| 15 Prossimamente | `pages/Prossimamente.jsx` | `from-orange-50/40 to-white`, `text-gray-*`, `terracotta-50/200/500/600/700`, `shadow-terracotta-500/20`, `hover:bg-gray-100` | `obsidian-bg`, testi Ossidiana, badge `brand-orange/10` con bordo `/30`, tasto `brand-orange` + hover `brand-orange-hover` |

Nessun valore di colore, classe o stile fuori palette resta nei file toccati (scansione su classi e `#rrggbb`/`rgba`).

**Lasciati com'erano, da decidere (non toccati: sono sistemi propri):** le copertine per categoria (`getCoverPalette`, `TourCover`: gradienti con tinte ambra/rosa sulla scheda tappa senza foto, 06 e le altre schede).

## 2. Contrasti (calcolati sui valori reali dei token, AA = 4,5:1)

primario su bg/card/raised 17,9 / 17,0 / 15,8 · secondario su bg/card/raised 7,7 / 7,3 / 6,9 · arancione su bg/card/raised 7,0 / 6,6 / 6,2 · arancione su icona `/10` 5,8 · badge `/10` 6,2 · testo `obsidian-bg` su arancione 7,0 (hover 5,5) · primario su chip `/20` 12,6 · tasto chiudi su foto, caso peggiore (foto bianca) 4,7. **Tutti ≥ 4,5:1**; i testi bianchi su arancione (2,8:1) sono spariti. Il calcolo è sui token, non pixel per pixel sulle immagini.

## 3. Screenshot (WebKit, iPhone 13, account di prova, GPS finto)

`docs/prove/schermate/estetica-coerenza/prima/` e `…/dopo/` (stesso nome): 01-home, 04-profilo, 05, 06, 11, 12, 13, 15. Script: `scripts/prova-nav/estetica-coerenza.webkit.mjs` (porta 5193, vite di questo repo, titolo «DoveVai» verificato prima delle credenziali). Home e Profilo: nessun file toccato che le compone. Nelle schermate compare il riquadro «Hai un giro in corso» (giro salvato nel browser di prova), presente anche nel «prima».

## 4. Controlli

| Controllo | Esito |
|---|---|
| Suite | 171 file, **2165 test verdi** |
| Lint | **0 errori** (194 avvisi, già presenti) |
| Build | ok |
| Guardia della home | **PASSATA 12/12** |

## 5. Processi

Il `vite preview` (porta 5193) e i browser WebKit sono chiusi; nessun processo avviato da me resta acceso.

## 6. Cosa ho dato per vero senza verificarlo

- Che «CLASSI-TRASPARENTI-2» fosse `79cc996`: sul ramo non c'è un commit con quel nome; ho proseguito dopo la conferma delle schermate senza una risposta esplicita su questo punto.
- Che il «prima» siano le `dopo/` di classi-trasparenti: stesso script e stesso codice (`79cc996`), ma non le ho riscattate.
- Che gli stati non fotografati (lista con tour live veri in 11, scheda tappa con foto in 06, varianti di `ComingSoonOverlay` oltre Trending) usino solo le classi sostituite: ho controllato le classi nel codice, non li ho aperti.
- Che `status-*` e le copertine per categoria siano fuori dall'ambito: ho cambiato `status-*` solo nella barra (05) e lasciato le copertine.
- Il tetto di 0,30 $ e i 60 minuti: non ho un contatore della spesa della sessione.
