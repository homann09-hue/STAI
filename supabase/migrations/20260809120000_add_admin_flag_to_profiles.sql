-- Adminrolle am Profil verankern.
--
-- Bisher war „Admin" ein geteiltes Geheimnis in `STOCKPILOT_ADMIN_SECRET`.
-- Für Cron-Aufrufe ist das richtig — für ein Adminkonto nicht: ein Geheimnis
-- kennt niemanden, es lässt sich weitergeben, und es lässt sich nicht entziehen,
-- ohne alle anderen Nutzungen mitzunehmen.
--
-- ## Warum RLS hier nicht reicht
--
-- Die naheliegende Annahme wäre: `profiles` hat schon eine saubere
-- UPDATE-Policy mit `auth.uid() = id` in USING und WITH CHECK, also ist die
-- neue Spalte geschützt.
--
-- Sie ist es nicht. **RLS ist zeilenbasiert.** Die Zeile gehört dem Nutzer, er
-- darf sie also ändern — und `is_admin` ist Teil dieser Zeile. Mit dem
-- bisherigen Tabellen-Grant hätte jeder angemeldete Nutzer schreiben können:
--
--     update public.profiles set is_admin = true where id = auth.uid();
--
-- RLS hätte das durchgelassen, weil die Bedingung erfüllt ist. Ein
-- Admin-System, in dem man sich selbst zum Admin macht, ist keines.
--
-- Der Schutz gehört deshalb auf die **Spaltenebene**: Postgres kann Grants je
-- Spalte vergeben, und was nicht gewährt ist, ist verboten — unabhängig von
-- jeder Policy.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Adminrechte. Nur mit Service-Rolle setzbar - fuer authenticated ist die Spalte nicht beschreibbar (siehe Spalten-Grants unten).';

-- Der pauschale Tabellen-Grant faellt weg. Danach steht ausdruecklich da,
-- welche Spalten ein angemeldeter Nutzer schreiben darf.
revoke insert, update on public.profiles from authenticated;

-- Anlegen darf er sein eigenes Profil mit Kennung, E-Mail und Anzeigename.
-- `is_admin` fehlt hier bewusst: sonst waere die Rechteerhebung nur einen
-- INSERT statt eines UPDATE entfernt.
grant insert (id, email, display_name) on public.profiles to authenticated;

-- Aendern darf er E-Mail und Anzeigename. `updated_at` setzt der Trigger
-- `set_profiles_updated_at`, nicht der Nutzer.
grant update (email, display_name) on public.profiles to authenticated;

-- Lesen bleibt wie bisher: die eigene Zeile, inklusive `is_admin`. Der Nutzer
-- soll sehen koennen, ob er Adminrechte hat -- er soll sie nur nicht vergeben
-- koennen.
--
-- Wichtig fuer die Anwendung: die Berechtigungspruefung liest `is_admin`
-- trotzdem **serverseitig ueber den Service-Client** und nicht aus dem Token.
-- JWT-Claims sind bis zur naechsten Erneuerung veraltet, und alles, was der
-- Client mitschickt, ist eine Behauptung.

-- Ein Index waere hier Ballast: gelesen wird immer genau eine Zeile ueber den
-- Primaerschluessel.
