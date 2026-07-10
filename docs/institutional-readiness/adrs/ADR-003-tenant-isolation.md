# ADR-003: Mandantentrennung

- Status: accepted, prepared
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Aktiv bleibt user_id-RLS; Organisationstenants und genau eine kontrollierte Rolle pro Nutzer/Tenant sind vorbereitet, aber nicht clientseitig mutierbar.

## Alternativen

Clientseitige tenant_id, separate DB pro Tenant, Schema pro Tenant.

## Auswirkungen

Sicherer Fail-closed-Pilot; Teamfunktionen warten auf Adminworkflow.

## Sicherheitsfolgen

Tenant-ID nie aus ungeprüftem Body; RLS-Negativtests verpflichtend.

## Skalierungsfolgen

Shared Schema skaliert, braucht konsequente Indizes und Policies.

## Kostenfolgen

Günstiger als DB pro Tenant; Enterprise-Isolation kann Mehrkosten erfordern.

## Betriebsfolgen

Policy-Review bei jeder neuen Tabelle.

## Rückbauoption

Orgmodus deaktivieren; user_id-RLS bleibt unverändert.
