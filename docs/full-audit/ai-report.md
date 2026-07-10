# AI and Analysis Report

## Architektur

- Asset-Analyse ist aktuell klar als Mock markiert, sofern kein echter Provider implementiert ist.
- Realtime Intelligence verwendet standardmäßig deterministische Regeln; OpenAI-kompatible Modelle sind optional serverseitig.
- Modellname, Version, Promptversion, Input-Hash, Tokenzahlen, Kosten und Fallbackstatus werden gespeichert.

## Schutzmaßnahmen

- Quellenpayload wird explizit als untrusted markiert; Anweisungen daraus dürfen nicht ausgeführt werden.
- Striktes Zod-Schema, eine Reparaturstufe, danach sicherer deterministischer Fallback.
- Quelltext maximal 12.000 Zeichen, Antwort maximal 64.000 Bytes, Ausgabe maximal 1.400 Tokens im Default.
- HTTPS, Timeout, Semaphore und Circuit Breaker.
- Fakten, Interpretation, Unsicherheit, Bestätigung und Human-Review-Flag sind getrennt.

## Restrisiken

- Regelbasierte Sentimentanalyse ist sprachlich begrenzt und keine Kursprognose.
- Modellanbieter, Prompt und Datenquellen müssen bei jeder Änderung erneut evaluiert werden.
- Kein LLM darf ohne Providervertrag, Kostenlimit und dokumentierte Datenschutzfreigabe aktiviert werden.
