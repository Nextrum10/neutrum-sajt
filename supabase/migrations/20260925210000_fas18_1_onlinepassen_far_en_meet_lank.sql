-- ============================================================
-- NEXTRUM — Fas 18.1: onlinepassen får en Meet-länk
--
-- Leo 2026-09-25: "kan du integrera min google workspace med
-- hemsidan". Av fyra förslag valde han ett: varje bekräftat
-- onlinepass får en egen Google Meet-länk, som syns på passets sida
-- hos familjen och hos studiehjälparen. Kalendern, inbjudningarna och
-- rekryteringsmötet valdes bort. Mejlen går redan från nextrum.se
-- genom Resend och ska inte gå genom Google.
--
-- Förut stod det "Skicka länken i meddelanden" hos studiehjälparen
-- och "Länken kommer i meddelanden" hos familjen. En länk i en chatt
-- är en länk som ska letas fram fem minuter innan passet.
--
--
-- GOOGLE_KOPPLING bär nyckeln till Nextrums Google-konto: den
-- refresh-token Google lämnar när någon godkänt kopplingen under
-- System → Integrationer. En rad, aldrig fler. RLS utan en enda
-- policy, som notis_konfig och stripe_handelser: bara service_role
-- ser den, alltså bara edge-funktionerna.
--
-- Tokenen ligger i en tabell och inte bland funktionernas secrets
-- eftersom den skapas av ett klick i adminvyn, och en funktion kan
-- inte skriva sina egna secrets. Den räcker inte ensam: Google lämnar
-- ut en åtkomst först mot tokenen OCH klienthemligheten, och
-- hemligheten är en secret. Två ställen måste läcka samtidigt. Och
-- det tokenen når är ett enda scope: att skapa Meet-rum.
--
-- integrationer, som redan fanns, är fortfarande statusen adminvyn
-- läser. Den bär ingen nyckel nu heller.
--
--
-- PASS_MOTEN är länken per pass. Familjen och studiehjälparen läser
-- raden för sitt eget pass, admin alla. Ingen skriver utom
-- service_role: en länk som en familj kunde sätta själv hade kunnat
-- leda studiehjälparen vart som helst, med vår sida som avsändare.
-- Villkoret på kolumnen släpper bara igenom en adress hos
-- meet.google.com, samma form som google.ts prövar, så att inte ens
-- ett fel i funktionen kan lägga något annat där.
--
-- Raden skapas första gången någon öppnar ett bekräftat onlinepass
-- (edge-funktionen google-meet), inte av en trigger. Varför står i
-- funktionens filhuvud.
--
-- Ingen auditrad. Länken är inte ett steg i passets liv — passet
-- bekräftades redan, och det står i loggen — och en länk är precis
-- den sortens innehåll loggen aldrig ska bära.
-- ============================================================

-- ---------- 1. nyckeln ----------
create table public.google_koppling (
  id            boolean primary key default true check (id),
  konto         text not null,
  refresh_token text not null,
  scopes        text not null,
  kopplad_at    timestamptz not null default now()
);

comment on table public.google_koppling is
  'Nextrums koppling till Google (Fas 18.1): kontot som godkände och dess refresh-token. En rad. '
  'RLS utan policy: bara service_role, alltså edge-funktionerna google-koppla och google-meet. '
  'Tokenen är oanvändbar utan klienthemligheten, som är en secret. Statusen står i integrationer.';

alter table public.google_koppling enable row level security;
revoke all on public.google_koppling from anon, authenticated;

-- ---------- 2. länken per pass ----------
create table public.pass_moten (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  lank       text not null
             check (lank ~ '^https://meet\.google\.com/[a-z]+-[a-z]+-[a-z]+$'),
  rum        text not null check (rum ~ '^spaces/[A-Za-z0-9_-]+$'),
  skapad     timestamptz not null default now()
);

comment on table public.pass_moten is
  'Meet-länken till ett onlinepass (Fas 18.1). Skapas av google-meet första gången någon öppnar '
  'ett bekräftat onlinepass. Parterna och admin läser, bara service_role skriver. '
  'Ligger kvar när passet flyttas; visas inte för avbokade och genomförda pass.';
comment on column public.pass_moten.rum is
  'Rummets namn hos Google (spaces/…). Det Meet-API:t behöver om något om rummet ska göras senare.';

alter table public.pass_moten enable row level security;
revoke all on public.pass_moten from anon, authenticated;
grant select on public.pass_moten to authenticated;

drop policy if exists "parterna läser passets möte" on public.pass_moten;
create policy "parterna läser passets möte" on public.pass_moten
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
       where b.id = pass_moten.booking_id
         and (b.parent_id = auth.uid() or b.tutor_id = auth.uid())
    )
  );

-- ---------- 3. statusraden säger var nyckeln bor ----------
comment on table public.integrationer is
  'Statusrad per extern tjänst. Innehåller AVSIKTLIGT inga nycklar, tokens eller hemligheter: '
  'klienthemligheten är en secret på edge-funktionen, och Googles refresh-token ligger i '
  'google_koppling (Fas 18.1), som bara service_role når. Skrivs bara av service_role.';
