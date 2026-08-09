begin;
select plan(9);

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

select * from finish();
rollback;
