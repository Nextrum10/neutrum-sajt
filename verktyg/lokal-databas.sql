-- ============================================================
-- NEXTRUM — det Supabase har i driften och en lokal databas saknar
--
-- Körs av verktyg/lokal-databas.sh som supabase_admin, före arkivet och
-- migrationerna. Ingenting här är en del av Nextrums schema: det är
-- delar av Auth, Storage och databaswebhookarna som GoTrue och
-- storage-api lägger till i driften, och som bilden supabase/postgres
-- bara har gamla stubbar för.
--
-- Varje rad finns för att något i migrationerna eller i
-- verktyg/rls-test.sql läser den. Faller ett prov lokalt med "column
-- ... does not exist" i auth eller storage hör rättelsen hemma här,
-- inte i en migration.
-- ============================================================

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text, created_by text);

-- Storage: hinkarnas inställningar och objektens sökväg (v6, v11, Fas 9.10, 13.2).
alter table storage.buckets
  add column if not exists public boolean default false,
  add column if not exists file_size_limit bigint,
  add column if not exists allowed_mime_types text[],
  add column if not exists owner_id text,
  add column if not exists type text default 'STANDARD';
alter table storage.objects
  add column if not exists path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  add column if not exists owner_id text,
  add column if not exists version text,
  add column if not exists user_metadata jsonb;

-- Auth: det radera_person() och inloggningen läser och skriver.
alter table auth.users
  add column if not exists phone text,
  add column if not exists deleted_at timestamptz,
  add column if not exists banned_until timestamptz,
  add column if not exists is_anonymous boolean default false,
  add column if not exists is_sso_user boolean default false,
  add column if not exists email_confirmed_at timestamptz,
  add column if not exists phone_change text default '',
  add column if not exists email_change_token_current text default '',
  add column if not exists email_change_token_new text default '',
  add column if not exists phone_change_token text default '',
  add column if not exists reauthentication_token text default '';
alter table auth.refresh_tokens
  add column if not exists session_id uuid,
  add column if not exists parent text;
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(), updated_at timestamptz, not_after timestamptz);
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text, provider_id text, identity_data jsonb, email text,
  created_at timestamptz default now(), updated_at timestamptz, last_sign_in_at timestamptz);
create table if not exists auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade);
create table if not exists auth.one_time_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade);

-- Inloggningen som PostgREST sätter den: request.jwt.claims, som
-- rls-test.sql skriver per prov.
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;

-- Databaswebhookarna (webhooken för intresseanmälan, notisfel()).
create schema if not exists supabase_functions;
create table if not exists supabase_functions.hooks (
  id bigserial primary key, hook_table_id int, hook_name text,
  created_at timestamptz default now(), request_id bigint);
create or replace function supabase_functions.http_request() returns trigger
  language plpgsql as $$ begin return new; end $$;

create extension if not exists pg_net;

-- I driften når postgres det här; raderingen och notisfel() läser det.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;
grant all on auth.users, auth.refresh_tokens, auth.sessions, auth.identities,
             auth.mfa_factors, auth.one_time_tokens to postgres;
grant usage on schema supabase_functions to postgres;
grant all on all tables in schema supabase_functions to postgres;
grant all on all sequences in schema supabase_functions to postgres;
