-- ============================================================
-- NEXTRUM — schema v10: klientfel
-- Kör EFTER v9. Rensar ingenting.
--
-- Vyerna hanterar fel omsorgsfullt: visaFel() berättar för
-- användaren vad som hände i stället för att ladda i evighet. Men
-- den berättar bara för användaren. Går något sönder för en riktig
-- familj hör vi det när de mejlar — och de mejlar inte, de
-- försvinner.
--
-- Den här tabellen är det som förvandlar "vi tror det funkar" till
-- "vi vet".
-- ============================================================

create table if not exists public.klientfel (
  id uuid primary key default gen_random_uuid(),
  meddelande text not null,
  sida text,
  stack text,
  webblasare text,
  anvandare uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  -- Vem som helst kan skriva hit (se policyn nedan), så fälten är
  -- längdbegränsade i databasen och inte bara i webbläsaren. Ett tak
  -- som bara finns i klienten är inget tak.
  constraint klientfel_rimliga_langder check (
    length(meddelande) <= 500
    and (sida is null or length(sida) <= 300)
    and (stack is null or length(stack) <= 2000)
    and (webblasare is null or length(webblasare) <= 300)
  )
);

create index if not exists klientfel_tid_idx on public.klientfel (created_at desc);

alter table public.klientfel enable row level security;

-- ============================================================
-- VEM FÅR SKRIVA OCH LÄSA
--
-- INSERT är öppet för alla, även utloggade. Det måste det vara:
-- de mest intressanta felen är just de som inträffar innan någon
-- hunnit logga in. Priset är att en tabell vem som helst kan skriva
-- till också går att fylla med skräp. Vi tar det priset medvetet:
-- längderna är begränsade ovan, klienten skickar högst fem per
-- sidbesök, och tabellen kan tömmas utan att något går förlorat.
--
-- SELECT är stängt för alla utom admin. Ett felmeddelande kan
-- innehålla mer än man tror.
-- ============================================================
drop policy if exists "alla får rapportera fel" on public.klientfel;
create policy "alla får rapportera fel" on public.klientfel
  for insert to anon, authenticated with check (true);

drop policy if exists "bara admin läser fel" on public.klientfel;
create policy "bara admin läser fel" on public.klientfel
  for select using (public.is_admin());

drop policy if exists "bara admin rensar fel" on public.klientfel;
create policy "bara admin rensar fel" on public.klientfel
  for delete using (public.is_admin());


-- ============================================================
-- SÅ HÄR LÄSER DU DEM
--
--   select created_at, sida, meddelande, count(*) over () as totalt
--     from public.klientfel
--    order by created_at desc
--    limit 50;
--
-- Och det som faktiskt betyder något — vad som går sönder oftast:
--
--   select meddelande, sida, count(*) as antal,
--          max(created_at) as senast
--     from public.klientfel
--    where created_at > now() - interval '7 days'
--    group by meddelande, sida
--    order by antal desc;
-- ============================================================
