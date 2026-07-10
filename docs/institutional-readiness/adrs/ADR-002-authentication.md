# ADR-002: Authentifizierung

- Status: accepted, restricted
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Supabase Auth für Endnutzer; Enterprise SSO/OIDC/SAML und SCIM bleiben deaktiviert, bis vertraglich und technisch umgesetzt.

## Alternativen

Clerk/Auth0/Descope oder eigener IdP.

## Auswirkungen

Schnelle Integration, aber Enterprise-IAM ist noch nicht erfüllt.

## Sicherheitsfolgen

JWT serverseitig prüfen; MFA/Reauth und Session Policies vor Pilot ergänzen.

## Skalierungsfolgen

Managed Auth skaliert, Organisationsprovisionierung fehlt.

## Kostenfolgen

Tarif- und MAU-Kosten überwachen.

## Betriebsfolgen

Recovery, Widerruf und Login-Monitoring benötigen Owner.

## Rückbauoption

IdP-Abstraktion und Userexport; keine appinterne Passwortdatenbank.
