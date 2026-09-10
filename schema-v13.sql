-- ============================================================
-- NEXTRUM — schema v13
--
-- Körs efter schema-v12.sql.
--
-- Bord för de två agenterna: juridik och ekonomi. Inget här ändrar
-- något som redan finns, det lägger bara till fyra tabeller.
--
-- VARFÖR AGENTERNA LOGGAR VARJE STEG
-- En agent som svarar på en fråga om lagen, eller läser er ekonomi,
-- måste gå att granska i efterhand. Inte "vad svarade den" utan
-- "vad läste den innan den svarade". Utan det är svaret ett påstående
-- från en svart låda, och ett påstående från en svart låda är värdelöst
-- i exakt de lägen ni skulle vilja luta er mot det.
--
-- Därför: en rad per körning i agent_korningar, en rad per verktygs-
-- anrop i agent_steg. Ni kan alltid gå tillbaka och se vilka källor
-- ett svar faktiskt vilade på.
-- ============================================================


-- ============================================================
-- 1. KÖRNINGAR
-- ============================================================

create table if not exists public.agent_korningar (
  id          uuid primary key default gen_random_uuid(),
  agent       text not null check (agent in ('juridik', 'ekonomi')),
  fraga       text not null,
  svar        text,

  -- pagar → klar | utanfor_omrade | ingen_kalla | fel
  -- utanfor_omrade och ingen_kalla är inte fel, de är agenten som
  -- vägrar svara. Det ska synas i statistiken som det den är.
  status      text not null default 'pagar'
              check (status in ('pagar','klar','utanfor_omrade','ingen_kalla','fel')),
  anledning   text,

  -- De källor svaret faktiskt vilar på. Bara adresser agenten
  -- verkligen hämtade, aldrig adresser den skrivit i sin text.
  kallor      jsonb not null default '[]'::jsonb,

  steg_antal  integer not null default 0,
  in_tokens   integer,
  ut_tokens   integer,

  skapad_av   uuid references auth.users(id) on delete set null,
  skapad      timestamptz not null default now(),
  avslutad    timestamptz
);

create index if not exists agent_korningar_agent_idx
  on public.agent_korningar (agent, skapad desc);


-- ============================================================
-- 2. STEG
--
-- resultat_kort, inte resultat. Ett hämtat lagrum kan vara hundra
-- kilobyte och det finns ingen anledning att spara om riksdagens
-- databas i er. Det som behövs för granskning är vilket verktyg som
-- kördes, med vilka argument, och början av vad som kom tillbaka.
-- ============================================================

create table if not exists public.agent_steg (
  id            bigserial primary key,
  korning_id    uuid not null references public.agent_korningar(id) on delete cascade,
  steg          integer not null,
  verktyg       text not null,
  argument      jsonb,
  kalla         text,
  resultat_kort text,
  fel           text,
  skapad        timestamptz not null default now()
);

create index if not exists agent_steg_korning_idx
  on public.agent_steg (korning_id, steg);


-- ============================================================
-- 3. FÖRETAGSFAKTA
--
-- En enda rad. Ekonomiagenten behöver veta hur BOLAGET ser ut för att
-- kunna säga något vettigt om deklarationer, och de uppgifterna ska
-- inte stå i en prompt där ingen hittar dem och ingen uppdaterar dem.
--
-- Notera vad som INTE står här: inga datum, inga tröskelbelopp, inga
-- procentsatser. Sådant ändras genom riksdagsbeslut och ska hämtas
-- från Skatteverket vid varje fråga, inte ligga och bli inaktuellt i
-- er databas. Här står bara det som är sant om er.
-- ============================================================

create table if not exists public.foretagsfakta (
  id                    integer primary key default 1 check (id = 1),

  organisationsnummer   text,
  bolagsform            text,     -- 'ab', 'enskild firma', 'hb'
  rakenskapsar_slut     text,     -- '12-31', '04-30', ...

  momsregistrerad       boolean not null default false,
  momsperiod            text check (momsperiod in ('manad','kvartal','helar')),
  f_skatt               boolean not null default false,
  arbetsgivarregistrerad boolean not null default false,

  -- Den här är den viktigaste raden i hela tabellen. Om
  -- studiehjälparna är anställda eller uppdragstagare avgör
  -- arbetsgivaravgifter, skatteavdrag, AGI, försäkringar och
  -- arbetsmiljöansvar. Är den fel är allt agenten säger om
  -- personalekonomi fel.
  studiehjalpare_form   text check (studiehjalpare_form in ('anstallda','uppdragstagare','oklart'))
                        default 'oklart',

  bokforingssystem      text,     -- 'fortnox', 'inget', ...
  redovisningskonsult   text,     -- namn, eller null om ni sköter det själva

  anteckningar          text,
  uppdaterad            timestamptz not null default now()
);

insert into public.foretagsfakta (id) values (1) on conflict (id) do nothing;


-- ============================================================
-- 4. FORTNOX-TOKEN
--
-- Fortnox access_token lever en timme, refresh_token 45 dagar, och
-- refresh_token BYTS vid varje förnyelse. Det betyder att den måste
-- ligga någonstans som överlever en funktionsstart, alltså i
-- databasen, inte i en secret ni sätter för hand.
--
-- Följden är värd att förstå: används refresh_token aldrig på 45 dagar
-- dör kopplingen och någon måste logga in i Fortnox igen. En agent som
-- körs en gång i kvartalet håller alltså inte kopplingen vid liv av
-- sig själv.
--
-- Ingen RLS-policy alls på den här tabellen. Det är med flit: bara
-- service_role kommer åt den, och service_role finns bara på servern.
-- ============================================================

create table if not exists public.fortnox_token (
  id             integer primary key default 1 check (id = 1),
  access_token   text,
  refresh_token  text,
  gar_ut         timestamptz,
  uppdaterad     timestamptz not null default now()
);


-- ============================================================
-- 5. RLS
--
-- Allt här är adminmaterial. Ingen förälder och ingen studiehjälpare
-- har något ärende till bolagets juridik eller bokföring.
-- ============================================================

alter table public.agent_korningar enable row level security;
alter table public.agent_steg      enable row level security;
alter table public.foretagsfakta   enable row level security;
alter table public.fortnox_token   enable row level security;

drop policy if exists "admin laser korningar" on public.agent_korningar;
create policy "admin laser korningar" on public.agent_korningar
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "admin laser steg" on public.agent_steg;
create policy "admin laser steg" on public.agent_steg
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "admin laser foretagsfakta" on public.foretagsfakta;
create policy "admin laser foretagsfakta" on public.foretagsfakta
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "admin skriver foretagsfakta" on public.foretagsfakta;
create policy "admin skriver foretagsfakta" on public.foretagsfakta
  for update using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.is_admin = true)
  );

-- Ingen INSERT-policy på agent_korningar eller agent_steg. Loggen
-- skrivs av funktionerna med service_role. Kan ingen skriva i loggen
-- från webbläsaren kan ingen förfalska den heller, och en logg som går
-- att förfalska är inte en logg.

-- fortnox_token får medvetet ingen policy alls.
