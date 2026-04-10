# AUDIT STRIPE & MONETIZZAZIONE - DoveVAI / UNNIVAI

**Data audit:** 2026-04-10

---

## Verdetto Sintetico

**Stripe NON è integrato.** Non esiste alcuna dipendenza Stripe nel progetto (`@stripe/stripe-js`, `stripe` SDK server-side), nessuna chiave API (publishable o secret), nessun webhook, nessun endpoint di checkout. L'unico riferimento a Stripe è un commento placeholder in `src/pages/Notifications.jsx` riga 122:

```js
// Placeholder per integrazione Stripe futura
alert('Offerta accettata! In futuro qui avvieremo il pagamento con Stripe.');
```

---

## Stato Integrazione

| Componente | Stato | Dettaglio |
|---|---|---|
| **Stripe SDK (frontend)** | ❌ NON PRESENTE | `@stripe/stripe-js` assente da `package.json` |
| **Stripe SDK (backend)** | ❌ NON PRESENTE | Nessun pacchetto `stripe` server-side; nessuna Edge Function |
| **Publishable Key** | ❌ NON PRESENTE | Assente da `.env`, `.env.example`, e codebase |
| **Secret Key** | ❌ NON PRESENTE | Assente ovunque |
| **Stripe Mode (test/live)** | N/A | Nessuna chiave configurata |
| **Webhook Endpoint** | ❌ NON PRESENTE | Nessun endpoint; `vercel.json` ha solo rewrite SPA |
| **Webhook Signature Verification** | ❌ NON PRESENTE | N/A |
| **Stripe Checkout** | ❌ NON PRESENTE | Nessuna sessione Checkout creata |
| **Stripe Elements** | ❌ NON PRESENTE | Nessun `<Elements>` provider |
| **Payment Links** | ❌ NON PRESENTE | Nessun link Stripe |
| **Stripe Products/Prices** | ❌ NON PRESENTE | Nessun `price_` o `prod_` ID |
| **Customer Portal** | ❌ NON PRESENTE | Nessun Billing Portal |
| **Subscription Management** | ❌ NON PRESENTE | Nessuna logica abbonamenti Stripe |

---

## Flow Pagamento

**NON IMPLEMENTATO**

Due flow simulati:

**BookingSystem.jsx** (prenotazione tour):
1. Selezione data/ora (Step 1)
2. Numero partecipanti (Step 2)
3. Riepilogo + selezione metodo pagamento visuale: Carta/PayPal/Apple Pay (Step 3)
4. "Conferma Prenotazione" chiama `onConfirm()` — **nessun pagamento reale**

**Notifications.jsx** (guida propone prezzo):
1. Guida propone prezzo via notifica
2. Utente accetta, status diventa `payment_pending`
3. Alert placeholder Stripe — **il pagamento non avviene mai**

---

## Sistema Tier Business (senza pagamento)

Esiste un sistema tier nel DB ma senza monetizzazione:

- **`businesses_profile`**: enum `business_tier` = `free | pro | elite` (da `api/migration_backend_v2.sql`)
- **`activities`** (legacy): valori `free/base/premium` con trigger che forza `free` e blocca modifica utente
- Il frontend (`DashboardBusiness.jsx`, `MapPage.jsx`, `SmartMarker.jsx`) differenzia visivamente i tier Elite
- **Il tier viene assegnato solo manualmente via Service Role (admin)**
- Nessun form di upgrade, nessun pagamento, nessun downgrade automatico

---

## B2B (DMO/Comuni)

**NON IMPLEMENTATO** — Nessun pricing 99-500 EUR/mese, nessuna dashboard DMO, nessun multi-tenant, nessuna fatturazione ricorrente. Unico riferimento: titolo "Modello B2B2C Scalabile" in `MVPEnhancements.jsx`.

---

## Sicurezza Pagamenti

| Aspetto | Stato | Note |
|---|---|---|
| PCI Compliance | N/A | Nessun dato carta raccolto |
| Webhook Signature | N/A | Nessun webhook |
| HTTPS | ✅ OK | Vercel default |
| Secret Keys | ✅ OK | Nessuna chiave esposta |
| Protezione tier DB | ⚠️ **PARZIALE** | `activities` ha trigger, `businesses_profile` NO — utente può auto-promuoversi a elite |

---

## Problemi (per priorità)

### P0 - CRITICO
1. **Nessun sistema di pagamento** — Tour con prezzi nel DB ma zero processing. BookingSystem puramente cosmetico.
2. **Vulnerabilità tier `businesses_profile`** — Manca trigger protezione; utente può fare `update({subscription_tier: 'elite'})` via client.

### P1 - ALTO
3. **Zero revenue stream** — Nessun meccanismo di monetizzazione attivo.
4. **`payment_pending` senza follow-up** — Richieste guida restano in limbo dopo accettazione.
5. **Nessuna gestione abbonamenti** — Zero UI per upgrade/downgrade/cancellazione.

### P2 - MEDIO
6. **UI pagamento ingannevole** — BookingSystem mostra Carta/PayPal/Apple Pay ma non funzionano.
7. **B2B non implementato** — Pricing DMO/Comuni assente.
8. **Nessuna Edge Function** — Nessun backend per secret keys Stripe.

### P3 - BASSO
9. **`.env.example` senza variabili Stripe** — Da aggiungere quando si integra.
10. **Incoerenza enum tier** — `activities` usa `free/base/premium`, `businesses_profile` usa `free/pro/elite`.
