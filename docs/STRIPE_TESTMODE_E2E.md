# Stripe-Testmode-End-to-End-Gate

Stand: 2026-08-22

## Zweck und Sicherheitsgrenze

`npm run test:billing:testmode` prüft die StockPilot-Billing-Kette gegen echte Stripe-Testmode-Ressourcen und eine lokale Supabase-Instanz. Der Harness verweigert:

- `sk_live_`- und `rk_live_`-Schlüssel,
- eine nicht lokale App-URL,
- eine nicht lokale Supabase-URL,
- Stripe-Liveobjekte und Live-Checkout-Sessions.

Damit kann der Lauf weder das Vercel-Produktionsprojekt noch die Produktionsdatenbank oder ein fremdes Stripe-Livekonto verändern.

## Geprüfter Lebenszyklus

1. Temporäres Pro-Produkt, Monats-Price und Portal-Konfiguration im Stripe-Testmodus anlegen.
2. Temporären Nutzer in der lokalen Supabase-Instanz erzeugen und authentifizieren.
3. Checkout über `/api/billing/checkout` erstellen und die echte Stripe-Testsession prüfen.
4. Testabo auf demselben Customer erzeugen und einen signierten Subscription-Webhook zustellen.
5. Aktives Pro-Entitlement über die öffentliche API prüfen.
6. Kundenportal über `/api/billing/portal` öffnen.
7. `past_due` zustellen, Paid-Zugriff entziehen und Doppelabo-Schutz prüfen.
8. Wiederherstellung, Kündigung und idempotente doppelte Zustellung prüfen.
9. Nach terminaler Kündigung einen neuen Checkout erlauben.
10. Sessions, Subscription, Customer, Price, Produkt, Portal-Konfiguration und Testnutzer aufräumen beziehungsweise deaktivieren.

Die Statusübergänge werden mit realen Testmode-Objekten und einer echten Stripe-Signatur durch die produktive Webhook-Route geprüft. Die Übermittlung wird lokal erzeugt; ein separater Stripe-Dashboard-Webhook-Endpunkt ist dafür nicht erforderlich.

## Lokal ausführen

Voraussetzungen: Docker, Supabase CLI, installierte Node-Abhängigkeiten, ein Stripe-Testmode-Schlüssel und ein Production-Build.

```bash
supabase start --exclude edge-runtime,imgproxy,logflare,mailpit,postgres-meta,realtime,storage-api,studio,supavisor,vector
supabase db reset --local --no-seed
eval "$(supabase status -o env)"

export SUPABASE_URL="$API_URL"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export SUPABASE_ANON_KEY="$ANON_KEY"
export STRIPE_TESTMODE_E2E_SECRET_KEY="<aus Secret Store>"
export STRIPE_TESTMODE_E2E_APP_URL="http://127.0.0.1:3012"

npm run build
npm run test:billing:testmode
supabase stop --no-backup
```

Den Schlüssel niemals in Shell-History, Quellcode, `.env.example`, Logs oder Tickets eintragen. Für CI ist ein auf den Testmodus begrenzter Restricted Key mit den minimal nötigen Rechten vorzuziehen.

## GitHub Actions

Der manuelle Workflow `Stripe Testmode E2E` nutzt die geschützte GitHub-Environment `stripe-testmode`. Dort muss ausschließlich dieses Secret hinterlegt sein:

| Secret | Inhalt |
|---|---|
| `STOCKPILOT_STRIPE_TEST_SECRET_KEY` | `rk_test_...` oder `sk_test_...`, niemals Live |

Der Workflow startet eine isolierte lokale Supabase-Instanz, erzeugt kurzlebige Stripe-Testressourcen und fährt die Infrastruktur auch nach einem Fehler herunter. Er läuft absichtlich nicht auf jedem Pull Request, damit fremde Branches keinen Zugriff auf Billing-Secrets erhalten und keine unnötigen Stripe-Ressourcen erzeugen.

## Noch vor Live-Billing erforderlich

- echten Stripe-Dashboard-Webhook im StockPilot-Testprojekt zustellen und Delivery-/Retry-Logs archivieren,
- Checkout mit Stripe-Testkarte im gehosteten UI durchführen,
- 3-D-Secure, fehlgeschlagene Verlängerung und Dunning mit Stripe Test Clocks prüfen,
- Steuer-, Rechnungs-, Widerrufs- und Verbraucherrechtskonzept freigeben,
- Stripe Tax nur nach korrekten Registrierungen konfigurieren,
- getrennten minimal berechtigten Live-Key erst nach erfolgreicher Testmode-Abnahme erzeugen.
