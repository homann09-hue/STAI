begin;
select plan(16);

-- Die Adminrolle lebt an `profiles`, und der Schutz liegt auf der Spalte, nicht
-- in einer Policy. Diese Tests prüfen genau die Verwechslung, die hier nahelag:
-- „die Zeile gehört dem Nutzer, RLS erlaubt UPDATE, also darf er auch
-- `is_admin` setzen."

select has_column('public', 'profiles', 'is_admin', 'profiles carry an admin flag');

select is(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_admin'),
  'boolean',
  'admin flag is a boolean'
);

select is(
  (select is_nullable from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_admin'),
  'NO',
  'admin flag is never null'
);

-- Der eigentliche Kern: die Spalte darf fuer angemeldete Nutzer nicht
-- beschreibbar sein. Waere sie es, koennte sich jeder selbst befoerdern --
-- RLS haette nichts dagegen, weil die Zeile ihm gehoert.
select ok(
  not exists (
    select 1 from information_schema.column_privileges
    where grantee = 'authenticated'
      and table_schema = 'public' and table_name = 'profiles'
      and column_name = 'is_admin' and privilege_type = 'UPDATE'
  ),
  'authenticated users cannot update their own admin flag'
);

select ok(
  not exists (
    select 1 from information_schema.column_privileges
    where grantee = 'authenticated'
      and table_schema = 'public' and table_name = 'profiles'
      and column_name = 'is_admin' and privilege_type = 'INSERT'
  ),
  'authenticated users cannot set the admin flag while creating their profile'
);

-- Der Rest des Profils muss weiter funktionieren, sonst haette die Absicherung
-- die Anmeldung mitgenommen.
select ok(
  exists (
    select 1 from information_schema.column_privileges
    where grantee = 'authenticated'
      and table_schema = 'public' and table_name = 'profiles'
      and column_name = 'display_name' and privilege_type = 'UPDATE'
  ),
  'users may still rename themselves'
);

select ok(
  exists (
    select 1 from information_schema.column_privileges
    where grantee = 'authenticated'
      and table_schema = 'public' and table_name = 'profiles'
      and column_name = 'id' and privilege_type = 'INSERT'
  ),
  'users may still create their own profile row'
);

-- Lesen bleibt erlaubt: der Nutzer soll sehen koennen, ob er Admin ist.
select ok(
  exists (
    select 1 from information_schema.column_privileges
    where grantee = 'authenticated'
      and table_schema = 'public' and table_name = 'profiles'
      and column_name = 'is_admin' and privilege_type = 'SELECT'
  ),
  'users may read whether they are admin'
);

-- Vergeben kann die Rolle nur die Service-Rolle -- also der Betreiber in der
-- Datenbank, nicht die Anwendung.
select ok(
  has_column_privilege('service_role', 'public.profiles', 'is_admin', 'UPDATE'),
  'service role may grant and revoke admin rights'
);

-- Der Grund, warum die Zeile oben ueberhaupt existiert: `admin-guard.ts` liest
-- die Rolle mit dem Service-Client. Ohne Leserecht scheitert die Pruefung, sie
-- schliesst -- und der Adminbereich funktioniert nie, mit einer Fehlermeldung,
-- die nach fehlender Konfiguration aussieht statt nach fehlendem Recht.
select ok(
  has_table_privilege('service_role', 'public.profiles', 'SELECT'),
  'service role may read profiles for the admin check'
);

-- Und die Gegenprobe: ein nicht angemeldeter Besucher hat mit Profilen nichts
-- zu tun.
--
-- Diese Zusicherung lief in der CI immer gruen -- und war in der *echten*
-- Datenbank am 2026-08-09 trotzdem verletzt: `anon` hatte dort INSERT, SELECT
-- und UPDATE auf `profiles`, aus einer Aenderung ausserhalb der Migrationen.
-- Ausnutzbar war es nicht, weil RLS ohne Policy fuer `anon` keine Zeile
-- freigibt. Ein Recht, das niemand braucht, gehoert aber nicht vergeben.
select ok(
  not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anonymous visitors cannot read profiles'
);

select ok(
  not has_table_privilege('anon', 'public.profiles', 'UPDATE'),
  'anonymous visitors cannot write profiles'
);

select ok(
  not has_column_privilege('anon', 'public.profiles', 'is_admin', 'UPDATE'),
  'anonymous visitors cannot grant themselves admin rights'
);

-- Der Anwendungsweg muss mit den eingeschraenkten Spaltenrechten wirklich
-- funktionieren: erst anlegen, spaeter nur die erlaubten Felder aktualisieren.
insert into auth.users (id, email) values
  ('77777777-7777-4777-8777-777777777777', 'profile-grants@example.invalid');

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';

select lives_ok(
  $$insert into public.profiles (id, email, display_name)
    values ('77777777-7777-4777-8777-777777777777', 'profile-grants@example.invalid', 'Initial')$$,
  'authenticated user can create the own profile through RLS'
);

select lives_ok(
  $$update public.profiles
    set email = 'profile-updated@example.invalid', display_name = 'Updated'
    where id = '77777777-7777-4777-8777-777777777777'$$,
  'authenticated user can update permitted profile fields through RLS'
);

select is(
  (select display_name from public.profiles
   where id = '77777777-7777-4777-8777-777777777777'),
  'Updated',
  'profile update persists without granting primary-key or admin writes'
);

select * from finish();
rollback;
