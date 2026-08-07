// Next.js loest `server-only` erst im Bundler auf. Unter Vitest existiert kein
// aufloesbares Modul, deshalb wird dieser leere Stub per Alias eingehaengt.
// Damit lassen sich servergebundene Module wie `src/lib/supabase/server.ts`
// ueberhaupt testen.
export {};
