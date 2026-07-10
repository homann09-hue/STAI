# ADR-017: Mobile Integration

- Status: accepted, web-first
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Capacitor kapselt die produktive HTTPS-PWA; keine API-Secrets oder lokale native Finanzlogik im Bundle.

## Alternativen

Native Swift-App, reine PWA, React Native.

## Auswirkungen

Gemeinsamer Code, WebView-/Offline-Grenzen.

## Sicherheitsfolgen

HTTPS, CSP, sichere Deep Links; Devicekompromittierung bleibt.

## Skalierungsfolgen

Webbackend skaliert gemeinsam.

## Kostenfolgen

Geringerer Entwicklungsaufwand, App-Store-Prozess separat.

## Betriebsfolgen

WebView-, Offline-, iOS-Gerätetests und Releaseprozess.

## Rückbauoption

Native Wrapper entfernen; PWA bleibt nutzbar.
