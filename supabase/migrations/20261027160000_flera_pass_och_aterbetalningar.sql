-- ============================================================
-- NEXTRUM — flera pass i samma kassa, och återbetalningarna i adminvyn
-- (2026-10-27)
--
-- Leo: "man ska kunna betala flera saker under samma kassa, eller
-- alltså fler pass samtidigt. antingen alla eller pass för pass." och
-- "bygg en återbetalningsfunktion för oss i admin."
--
-- PASS FÖR PASS ÄR SOM FÖRUT. Betala nu på ett pass öppnar en kassa för
-- det passet, och webhooken skriver betalningen på passets rad
-- (betalaPasset i stripe-webhook). Det här lägger till Betala alla: en
-- kassa för flera av familjens pass, med en rad per pass.
--
--   1. passkassor och passkassor_pass: en kassa för två till tjugo pass,
--      med varje pass belopp och minuter, som stripe-checkout räknade dem
--      (samma regel som för ett pass, _delad/pris.ts). Bara databasen
--      skriver, genom passkassa_skapa(), passkassa_session(),
--      passkassa_vantar(), passkassa_slapp() och passkassa_misslyckad(),
--      och bara tjänstekontot kör dem. En familj har högst en öppen kassa: en ny
--      släpper den förra, och stripe-checkout låter dess session gå ut hos
--      Stripe.
--   2. KASSAN BÄR STRIPES ID:N, INTE PASSEN. bookings har ett unikt
--      PaymentIntent och en unik session per pass (bookings_stripe_pi_uniq,
--      bookings_stripe_session_uniq, Fas 12.1), och webhooken hittar ett
--      pass på dess charge. Ett pass som betalats i en kassa för flera pass
--      pekar därför på kassan (bookings.passkassa_id), och PaymentIntent,
--      charge och session står på kassan och i liggaren. Passet bär sin
--      del av beloppet (betalt_ore), dagen, sin del av avgiften och läget,
--      som ett pass som betalats för sig. Passets egen bokföring
--      (bookings_bokfors) körs bara för ett pass med ett PaymentIntent och
--      rör alltså inte en sådan betalning.
--   3. passkassa_betald(): webhooken skriver betalningen i EN
--      transaktion. Liggarens rad med hela beloppet först, sedan varje
--      pass betalt med sin del, på samma tre vägar som betalaPasset
--      (obetalt, betalt med timmar, betalt med timbanken: kortet vinner),
--      en rad per pass i betalningsrader, och kassan betald. Ett pass som
--      hunnit betalas på annat sätt får sin rad med en beskrivning och en
--      uppgift, och pengarna betalas tillbaka från raden.
--   4. Stripes avgift delas på passen efter deras belopp
--      (intern.passkassa_avgift_dela, betalning_avgift()), så att
--      bokslutet, som räknar passens avgifter, räknar den en gång.
--      Återbetalningen per rad (betalningsrader_aterbetalda) skriver
--      passets återbetalda belopp, tvisten (betalning_tvist) liggarens rad
--      och passen, och ett pass som blev kortare än det betalade får
--      mellanskillnaden tillbaka som förut (kortare_pass_att_aterbetala).
--   5. Återbetalningarna. betalningsrad_att_aterbetala() tar också ett
--      pass i en betalning för flera pass, och en rad med syskontillägg
--      som inte hör till någon post. aterbetalningar har en rad per
--      återbetalning i Stripe, var den än gjordes: vad, hur mycket, vem
--      och varför. Anledningen töms när familjen avidentifieras, och
--      raderna raderas aldrig: de är bokföringsunderlag, som liggaren.
--      Övertid och en betalning som inte kunde skrivas ner betalas
--      tillbaka från adminvyn (stripe-aterbetalning) i stället för i
--      Stripes dashboard.
--
-- Funktionerna som fanns lappas med replace() och en vakt som räknar
-- träffarna, och en kropp som redan bär ändringen släpps igenom: filen
-- går att köra två gånger. Inget drop och inget delete.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  r record;
  m text;
begin
  if to_regclass('public.betalningsrader') is null then
    raise exception 'betalningsrader saknas. Kör syskontillagg_som_skuld först.';
  end if;
  if to_regprocedure('public.timbank_kort_vinner(uuid, jsonb)') is null then
    raise exception 'timbank_kort_vinner saknas. Läs driften.';
  end if;
  if to_regprocedure('intern.sen_avbokningens_minuter(integer)') is null then
    raise exception 'Den sena avbokningen saknas. Kör sen_avbokning först.';
  end if;
  /* Tre funktioner skrivs om hela (avsnitt 7, 7b och 8). Kroppen i driften
     ska vara den filerna lämnade (syskontillagg_som_skuld och betala_nu),
     eller den här filens när den körs en gång till: annars har någon annan
     ändrat den, och då skrivs den inte över olästa. */
  for r in select * from (values
      ('public.betalning_tvist(text, text)', 'f471f6576dd83c067206c66a8e90d096', '5aa86b73ca1965e3a2b04fbba32b5c6b'),
      ('public.kortare_pass_att_aterbetala(integer)', '854e527c9f155872dcd3979ab083b1c4', '2a36b2eafa791ccd933105128c39e53e'),
      ('public.betalningsrad_att_aterbetala(uuid)', 'e77c1326bb3b22981e74783abbbdc7b1', '23963dfe2bd967714ba6022ac91359a7')
    ) v(fn, fore, efter)
  loop
    select md5(p.prosrc) into m from pg_proc p where p.oid = to_regprocedure(r.fn);
    if m is null or m not in (r.fore, r.efter) then
      raise exception '% har en annan kropp i driften än filerna (md5 %). Läs driften.', r.fn, coalesce(m, 'saknas');
    end if;
  end loop;
end $$;


-- ---------- 1. kassan för flera pass ----------
create table if not exists public.passkassor (
  id                    uuid primary key default gen_random_uuid(),
  familj                uuid not null references public.profiles(id) on delete cascade,
  status                text not null default 'oppen' check (status in ('oppen', 'betald', 'slappt')),
  belopp_ore            integer not null check (belopp_ore > 0),
  antal_pass            integer not null check (antal_pass between 2 and 20),
  stripe_session_id     text check (stripe_session_id is null or stripe_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  stripe_payment_intent text check (stripe_payment_intent is null or stripe_payment_intent ~ '^pi_[A-Za-z0-9_]+$'),
  betalning_id          uuid references public.betalningar(id) on delete restrict,
  skapad_at             timestamptz not null default now(),
  upphor_at             timestamptz not null,
  avslutad_at           timestamptz,
  slapp_orsak           text check (slapp_orsak is null or slapp_orsak in ('utgangen', 'ersatt', 'avbruten')),
  -- Sessionen är klar men pengarna kommer senare (Klarna): passkassa_vantar().
  vantar_at             timestamptz
);
create index if not exists passkassor_familj on public.passkassor (familj, skapad_at desc);
create unique index if not exists passkassor_session on public.passkassor (stripe_session_id)
  where stripe_session_id is not null;

comment on table public.passkassor is
  '2026-10-27 (flera_pass_och_aterbetalningar). Betala alla: en kassa för två till tjugo av familjens pass. Belopp '
  'och pass står fast, läget går från öppen till betald eller släppt, och en släppt kan bli betald när pengarna ändå '
  'kom. En öppen kassa vars betalning väntar på Klarna (vantar_at) släpps inte av en ny kassa. Skrivs bara av '
  'databasens funktioner (passkassa_*), som tjänstekontot kör. Bara superadmin läser.';

create table if not exists public.passkassor_pass (
  kassa_id    uuid not null references public.passkassor(id) on delete cascade,
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  belopp_ore  integer not null check (belopp_ore > 0),
  minuter     integer not null check (minuter between 1 and 240),
  primary key (kassa_id, booking_id)
);
create index if not exists passkassor_pass_pass on public.passkassor_pass (booking_id);

comment on table public.passkassor_pass is
  '2026-10-27 (flera_pass_och_aterbetalningar). Passen i en kassa för flera pass, med beloppet och minuterna som '
  'stripe-checkout räknade för passet. Står fast.';

/* Kassans lägen, som betalningsförsöken för syskontillägget
   (intern.tillagg_forsok_vakt): öppen till betald eller släppt, och en
   släppt till betald när pengarna ändå kom. Sessionen och väntan på
   Klarna skrivs en gång. */
create or replace function intern.passkassor_vakt()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
begin
  if tg_op = 'INSERT' then
    if new.status <> 'oppen' or new.stripe_session_id is not null or new.stripe_payment_intent is not null
       or new.betalning_id is not null or new.avslutad_at is not null or new.slapp_orsak is not null
       or new.vantar_at is not null then
      raise exception using errcode = '42501', message = 'En ny kassa är öppen och obetald.';
    end if;
    new.skapad_at := now();
    return new;
  end if;
  if (new.id, new.familj, new.belopp_ore, new.antal_pass, new.skapad_at, new.upphor_at)
     is distinct from
     (old.id, old.familj, old.belopp_ore, old.antal_pass, old.skapad_at, old.upphor_at) then
    raise exception using errcode = '42501', message = 'En kassas belopp och pass står fast.';
  end if;
  if old.stripe_session_id is not null and new.stripe_session_id is distinct from old.stripe_session_id then
    raise exception using errcode = '42501', message = 'Kassans session skrivs en gång.';
  end if;
  if new.vantar_at is distinct from old.vantar_at
     and (old.vantar_at is not null or old.status <> 'oppen' or new.stripe_session_id is null) then
    raise exception using errcode = '42501', message = 'En öppen kassa med en session väntar på betalningen en gång.';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'oppen' and new.status in ('betald', 'slappt'))
            or (old.status = 'slappt' and new.status = 'betald')) then
      raise exception using errcode = '23514',
        message = format('Kassan kan inte gå från %s till %s.', old.status, new.status);
    end if;
    new.avslutad_at := now();
  elsif (new.stripe_payment_intent, new.betalning_id, new.slapp_orsak, new.avslutad_at)
        is distinct from
        (old.stripe_payment_intent, old.betalning_id, old.slapp_orsak, old.avslutad_at) then
    raise exception using errcode = '42501', message = 'Kassans betalning följer bara läget.';
  end if;
  return new;
end $function$;

revoke all on function intern.passkassor_vakt() from public, anon, authenticated;

create or replace trigger passkassor_vakt
  before insert or update on public.passkassor
  for each row execute function intern.passkassor_vakt();

-- Kassan som betalade passet. Bara databasen och admin skriver den: en
-- ändring av ett bokat pass släpper bara fram status och tid
-- (skydda_bokningsfalt), och ett nytt pass har ingen (nedan).
alter table public.bookings add column if not exists passkassa_id uuid
  references public.passkassor(id) on delete set null;
create index if not exists bookings_passkassa on public.bookings (passkassa_id) where passkassa_id is not null;
comment on column public.bookings.passkassa_id is
  '2026-10-27 (flera_pass_och_aterbetalningar). Kassan för flera pass som betalade passet: PaymentIntent, charge och '
  'session står på kassan och i liggaren, för de är unika per pass här. Null för ett pass som betalats för sig.';
create unique index if not exists passkassor_pi on public.passkassor (stripe_payment_intent)
  where stripe_payment_intent is not null;

create or replace function intern.passkassa_ny_vakt()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27): ett nytt pass har ingen betalning.
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception using errcode = '42501', message = 'Ett nytt pass har ingen betalning. Den sätts när passet betalas.';
  end if;
  return new;
end $function$;

revoke all on function intern.passkassa_ny_vakt() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.bookings'::regclass
                  and tgname = 'bookings_passkassa_ny') then
    create trigger bookings_passkassa_ny
      before insert on public.bookings
      for each row when (new.passkassa_id is not null)
      execute function intern.passkassa_ny_vakt();
  end if;
end $$;

-- Passen i en kassa ändras aldrig (intern.tillagg_star_fast säger det).
do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.passkassor_pass'::regclass
                  and tgname = 'passkassor_pass_star_fast') then
    create trigger passkassor_pass_star_fast
      before update on public.passkassor_pass
      for each row execute function intern.tillagg_star_fast();
  end if;
end $$;


-- ---------- 2. kassan öppnas ----------
/* stripe-checkout har läst passen med familjens token och räknat varje
   pass belopp och minuter med samma regel som för ett pass. Här prövas
   passen igen, under familjens lås och med radlås: familjens, betalbara
   (bekräftade, genomförda eller sent avbokade med en avgift), obetalda,
   inte undantagna och med en studiehjälpare. En sen avbokning kostar
   databasens avgift och inget annat.

   En öppen kassa med exakt samma pass, belopp och minuter, och minst 35
   minuter kvar, återanvänds: två tryck på Betala alla blir samma kassa
   och samma session hos Stripe. Annars släpps familjens öppna kassor och
   en ny skapas; de släppta sessionerna står i svaret (ersatta), och
   stripe-checkout låter dem gå ut innan den nya öppnas. Stripe kräver
   minst 30 minuter till en kassas utgång, och kassan gäller en timme.
   En kassa vars betalning väntar på Klarna (vantar_at) släpps inte, och
   dess pass går inte att lägga i en ny kassa förrän den är avgjord.

   Svarar {forsok, belopp_ore, antal_pass, aterbruk, upphor_at, session,
   ersatta}, samma form som syskontilläggets försök, eller {fel} med ett
   besked till familjen. */
create or replace function public.passkassa_skapa(p_familj uuid, p_rader jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
declare
  antal   integer;
  summa   bigint := 0;
  r       record;
  b       public.bookings%rowtype;
  k       public.passkassor%rowtype;
  ny      uuid;
  ersatta jsonb := '[]'::jsonb;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara kassan öppnar en kassa för flera pass.';
  end if;
  if p_familj is null or jsonb_typeof(p_rader) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Vilka pass?';
  end if;
  antal := jsonb_array_length(p_rader);
  if antal < 2 or antal > 20 then
    return jsonb_build_object('fel', 'Välj mellan 2 och 20 pass att betala tillsammans.');
  end if;
  if (select count(distinct x ->> 'pass') from jsonb_array_elements(p_rader) x) <> antal then
    return jsonb_build_object('fel', 'Samma pass står två gånger.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('passkassa:' || p_familj::text, 0));

  for r in
    select (x ->> 'pass')::uuid as pass, (x ->> 'belopp')::integer as belopp, (x ->> 'minuter')::integer as minuter
      from jsonb_array_elements(p_rader) x
  loop
    select * into b from public.bookings where id = r.pass for update;
    if not found or b.parent_id is distinct from p_familj then
      return jsonb_build_object('fel', 'Ett av passen finns inte bland era pass.');
    end if;
    if coalesce(r.belopp, 0) <= 0 or coalesce(r.minuter, 0) < 1 or r.minuter > 240 then
      return jsonb_build_object('fel', 'Ett av passen har inget att betala.');
    end if;
    if b.betalning_status not in ('ingen', 'vantar', 'misslyckad') then
      return jsonb_build_object('fel', 'Ett av passen är redan betalt, eller har en återbetalning. Ladda om sidan.');
    end if;
    if not b.fakturerbar or b.tutor_id is null then
      return jsonb_build_object('fel', 'Ett av passen ska inte betalas.');
    end if;
    if b.status = 'cancelled' then
      -- En sen avbokning kostar avgiften, som databasen satte den.
      if coalesce(b.sen_avbokning_ore, 0) <= 0 or r.belopp <> b.sen_avbokning_ore then
        return jsonb_build_object('fel', 'Ett av passen är avbokat och har inget att betala.');
      end if;
    elsif b.status not in ('confirmed', 'completed') then
      return jsonb_build_object('fel', 'Ett pass betalas när det är bekräftat.');
    end if;
    -- En betalning för passet är på väg (Klarna): den betalas inte en gång till.
    if exists (select 1 from public.passkassor x join public.passkassor_pass kp on kp.kassa_id = x.id
                where kp.booking_id = b.id and x.status = 'oppen' and x.vantar_at is not null) then
      return jsonb_build_object('fel', 'En betalning för ett av passen är på väg. Titta under Betalning om en stund.');
    end if;
    summa := summa + r.belopp;
  end loop;
  if summa > 2000000000 then
    return jsonb_build_object('fel', 'Beloppet blir för stort för en kassa.');
  end if;

  -- Samma kassa en gång till: samma pass, belopp och minuter, och tid kvar.
  select x.* into k
    from public.passkassor x
   where x.familj = p_familj and x.status = 'oppen' and x.vantar_at is null
     and x.upphor_at > now() + interval '35 minutes'
     and x.antal_pass = antal and x.belopp_ore = summa
     and not exists (
       select 1 from jsonb_array_elements(p_rader) y
        where not exists (select 1 from public.passkassor_pass kp
                           where kp.kassa_id = x.id and kp.booking_id = (y ->> 'pass')::uuid
                             and kp.belopp_ore = (y ->> 'belopp')::integer
                             and kp.minuter = (y ->> 'minuter')::integer))
   order by x.skapad_at desc
   limit 1;
  if found then
    return jsonb_build_object('forsok', k.id, 'belopp_ore', k.belopp_ore, 'antal_pass', k.antal_pass,
                              'aterbruk', true, 'upphor_at', k.upphor_at, 'session', k.stripe_session_id,
                              'ersatta', '[]'::jsonb);
  end if;

  -- En kassa åt gången: familjens öppna kassor släpps, och deras sessioner går ut hos Stripe.
  -- En vars betalning väntar på Klarna står kvar: den är betald när pengarna kommer.
  for k in
    select * from public.passkassor x where x.familj = p_familj and x.status = 'oppen' and x.vantar_at is null
       for update
  loop
    update public.passkassor set status = 'slappt', slapp_orsak = 'ersatt' where id = k.id;
    if k.stripe_session_id is not null then
      ersatta := ersatta || to_jsonb(k.stripe_session_id);
    end if;
  end loop;

  insert into public.passkassor (familj, belopp_ore, antal_pass, upphor_at)
  values (p_familj, summa, antal, now() + interval '60 minutes')
  returning * into k;
  insert into public.passkassor_pass (kassa_id, booking_id, belopp_ore, minuter)
  select k.id, (x ->> 'pass')::uuid, (x ->> 'belopp')::integer, (x ->> 'minuter')::integer
    from jsonb_array_elements(p_rader) x;

  return jsonb_build_object('forsok', k.id, 'belopp_ore', k.belopp_ore, 'antal_pass', k.antal_pass,
                            'aterbruk', false, 'upphor_at', k.upphor_at, 'session', null, 'ersatta', ersatta);
end $function$;

/* Kassans session hos Stripe skrivs på kassan, och passen får läget
   väntar och beloppet vi bad om, som kassan för ett pass gör. Sessionen
   står inte på passen: den är unik per pass (avsnitt 2 i huvudet). Bara
   på pass som fortfarande är obetalda. Svarar sant när alla tog den;
   annars har ett pass hunnit betalas, och stripe-checkout låter sessionen
   gå ut och släpper kassan. */
create or replace function public.passkassa_session(p_kassa uuid, p_session text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
declare
  k public.passkassor%rowtype;
  n integer;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara kassan skriver kassans session.';
  end if;
  if p_session is null or p_session !~ '^cs_[A-Za-z0-9_]+$' then
    raise exception using errcode = '22023', message = 'Sessionen har fel form.';
  end if;
  select * into k from public.passkassor where id = p_kassa for update;
  if not found or k.status <> 'oppen' then
    return false;
  end if;
  if k.stripe_session_id is null then
    update public.passkassor set stripe_session_id = p_session where id = k.id;
  elsif k.stripe_session_id <> p_session then
    return false;
  end if;

  update public.bookings b
     set betalning_status = 'vantar', begart_ore = kp.belopp_ore
    from public.passkassor_pass kp
   where kp.kassa_id = k.id and kp.booking_id = b.id
     and b.betalning_status in ('ingen', 'vantar', 'misslyckad');
  get diagnostics n = row_count;
  return n = k.antal_pass;
end $function$;

/* En kassa som inte blev betald: den gick ut hos Stripe, ersattes eller
   avbröts. Passen står kvar som obetalda (väntar), som efter en kassa för
   ett pass som familjen stängde. Svarar sant när kassan släpptes nu. */
create or replace function public.passkassa_slapp(p_kassa uuid, p_orsak text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara kassan och webhooken släpper en kassa.';
  end if;
  if p_orsak not in ('utgangen', 'ersatt', 'avbruten') then
    raise exception using errcode = '22023', message = 'Okänd orsak.';
  end if;
  update public.passkassor set status = 'slappt', slapp_orsak = p_orsak
   where id = p_kassa and status = 'oppen';
  return found;
end $function$;

/* Sessionen blev klar men pengarna kommer senare (Klarna): kassan märks,
   så att en ny kassa inte släpper den och passen inte betalas en gång till
   medan betalningen är på väg. Kommer pengarna skriver passkassa_betald
   dem; säger Klarna nej släpper webhooken kassan (passkassa_slapp). Som
   tillagg_forsok_vantar för syskontillägget. Svarar sant när kassan
   märktes nu. */
create or replace function public.passkassa_vantar(p_kassa uuid, p_session text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara webhooken skriver det.';
  end if;
  update public.passkassor set vantar_at = now()
   where id = p_kassa and status = 'oppen' and vantar_at is null and stripe_session_id = p_session;
  return found;
end $function$;

/* Kortet nekades eller Klarna sa nej: passen som väntar på just den här
   kassan blir misslyckade, så att familjen ser det och kan försöka igen.
   Svarar antalet pass. */
create or replace function public.passkassa_misslyckad(p_kassa uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
declare
  n integer;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara webhooken skriver det.';
  end if;
  update public.bookings b
     set betalning_status = 'misslyckad'
    from public.passkassor_pass kp
   where kp.kassa_id = p_kassa and kp.booking_id = b.id and b.betalning_status = 'vantar';
  get diagnostics n = row_count;
  return n;
end $function$;


-- ---------- 3. Stripes avgift delas på passen ----------
/* Bokslutet (manad_lage) och Alla betalningar räknar passens avgifter.
   En betalning för flera pass har en avgift, och den delas efter passens
   belopp: avrundat nedåt, och när alla pass bär betalningen får det sista
   resten, så att summan blir avgiften. Nettot är passets belopp minus
   dess del. En avgift som redan står på ett pass skrivs inte över.
   Svarar antalet pass som fick sin del. */
create or replace function intern.passkassa_avgift_dela(p_betalning uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
declare
  b      public.betalningar%rowtype;
  r      record;
  alla   boolean;
  sista  uuid;
  delat  integer := 0;
  del    integer;
  n      integer := 0;
begin
  select * into b from public.betalningar where id = p_betalning;
  if not found or b.typ <> 'pass' or b.booking_id is not null or b.avgift_ore is null then
    return 0;
  end if;
  select bool_and(bk.passkassa_id is not distinct from k.id)
         and coalesce(sum(x.belopp_ore), 0) = b.belopp_ore
    into alla
    from public.betalningsrader x
    left join public.bookings bk on bk.id = x.booking_id
    cross join (select id from public.passkassor where betalning_id = b.id) k
   where x.betalning_id = b.id;

  for r in
    select x.booking_id, x.belopp_ore, bk.stripe_avgift_ore
      from public.betalningsrader x
      join public.bookings bk on bk.id = x.booking_id
      join public.passkassor k on k.id = bk.passkassa_id and k.betalning_id = b.id
     where x.betalning_id = b.id and x.typ = 'pass'
     order by bk.wanted_date, bk.wanted_time, bk.id
  loop
    sista := r.booking_id;
    del := floor(b.avgift_ore::numeric * r.belopp_ore / b.belopp_ore)::integer;
    delat := delat + del;
  end loop;

  for r in
    select x.booking_id, x.belopp_ore, bk.stripe_avgift_ore
      from public.betalningsrader x
      join public.bookings bk on bk.id = x.booking_id
      join public.passkassor k on k.id = bk.passkassa_id and k.betalning_id = b.id
     where x.betalning_id = b.id and x.typ = 'pass'
     order by bk.wanted_date, bk.wanted_time, bk.id
  loop
    del := floor(b.avgift_ore::numeric * r.belopp_ore / b.belopp_ore)::integer;
    if alla and r.booking_id = sista then
      del := del + (b.avgift_ore - delat);
    end if;
    if r.stripe_avgift_ore is null then
      update public.bookings
         set stripe_avgift_ore = del, stripe_netto_ore = r.belopp_ore - del
       where id = r.booking_id and stripe_avgift_ore is null;
      n := n + 1;
    end if;
  end loop;
  return n;
end $function$;

revoke all on function intern.passkassa_avgift_dela(uuid) from public, anon, authenticated;

/* Avgiften kom efteråt (charge.updated), eller hämtades av
   stripe-avstamning, för en betalning för flera pass: liggaren får den,
   och passen sin del. Svarar sant när charge:n är en sådan betalning. */
create or replace function public.betalning_avgift(p_charge text, p_bt text, p_avgift integer, p_netto integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
declare
  bet uuid;
  pi  text;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara webhooken skriver avgiften.';
  end if;
  if p_charge is null then
    return false;
  end if;
  select x.id, x.stripe_payment_intent into bet, pi
    from public.betalningar x
   where x.stripe_charge = p_charge and x.typ = 'pass' and x.booking_id is null
   limit 1;
  if bet is null then
    return false;
  end if;
  if p_avgift is not null then
    update public.betalningar x
       set avgift_ore = p_avgift, netto_ore = coalesce(p_netto, x.belopp_ore - p_avgift), andrad_at = now()
     where x.id = bet and x.avgift_ore is null;
  end if;
  if p_bt is not null then
    update public.bookings b
       set stripe_balanstransaktion_id = p_bt
      from public.passkassor k
     where k.betalning_id = bet and b.passkassa_id = k.id and b.stripe_balanstransaktion_id is null;
  end if;
  perform intern.passkassa_avgift_dela(bet);
  return true;
end $function$;


-- ---------- 4. betalningen kom ----------
/* Webhooken: pengarna för en kassa med flera pass. I en transaktion:
   liggarens rad med hela beloppet (utan pass: raderna bär dem), varje
   pass betalt med sin del på samma tre vägar som betalaPasset i
   webhooken, en rad per pass, kassan betald och avgiften delad. Passet
   får kassan (passkassa_id) i stället för PaymentIntent och charge, som
   är unika per pass.

     · Obetalt (ingen, väntar, misslyckad): betalt med kortet.
     · Betalt med timmar: kortet vinner, och timmarna kommer tillbaka
       (klippkort_id blir null, som i webhooken).
     · Betalt med timbanken: timbank_kort_vinner, som i webhooken.
     · Något annat (betalt med en annan betalning, återbetalt, i tvist):
       raden står med en beskrivning, och en uppgift säger att den ska
       betalas tillbaka.

   Svarar 'betald', 'delvis' (ett eller flera pass tog inte emot sin del),
   'redan' (samma betalning en gång till), 'dubbel' (kassan var redan
   betald med en annan betalning), 'fel_belopp' eller 'okant'. I de två
   sista före det sista står pengarna i liggaren som en betalning utan rad,
   och en uppgift säger det. */
create or replace function public.passkassa_betald(
  p_kassa uuid, p_pi text, p_charge text, p_belopp integer, p_bt text, p_avgift integer, p_netto integer,
  p_skarp boolean)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
declare
  k      public.passkassor%rowtype;
  r      record;
  bet    uuid;
  traff  integer;
  ute    integer := 0;
  rest   bigint;
  kort   jsonb;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara webhooken skriver en betalning.';
  end if;
  if p_pi is null or p_pi !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception using errcode = '22023', message = 'Betalningen saknar PaymentIntent.';
  end if;
  select * into k from public.passkassor where id = p_kassa;
  if not found then
    return 'okant';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('passkassa:' || k.familj::text, 0));
  select * into k from public.passkassor where id = p_kassa for update;

  -- Samma betalning en gång till: allt är redan skrivet.
  if exists (select 1 from public.betalningar x where x.stripe_payment_intent = p_pi) then
    return 'redan';
  end if;

  if p_belopp is distinct from k.belopp_ore or k.status = 'betald' then
    -- Pengarna rörde sig: de bokförs, och en människa avgör resten.
    insert into public.betalningar (familj, typ, belopp_ore, status, stripe_payment_intent, stripe_charge,
                                    avgift_ore, netto_ore, skarp, utan_rad, betald_at)
    values (k.familj, 'pass', greatest(coalesce(p_belopp, 0), 1), 'betald', p_pi, p_charge, p_avgift, p_netto,
            p_skarp, true, now())
    on conflict (stripe_payment_intent) do nothing;
    perform public.skapa_uppgift(
      case when k.status = 'betald' then 'En kassa för flera pass betalades två gånger'
           else 'En kassa för flera pass betalades med fel belopp' end,
      'passkassa_fel:' || p_pi,
      'problem',
      'En betalning för flera pass kom in men kunde inte skrivas på passen (kassan ' || k.id
        || '). Pengarna står i liggaren. Stäm av med familjen och betala tillbaka det som inte ska behållas.',
      'profiles', k.familj::text);
    if k.status = 'oppen' then
      update public.passkassor set status = 'slappt', slapp_orsak = 'avbruten' where id = k.id;
    end if;
    return case when k.status = 'betald' then 'dubbel' else 'fel_belopp' end;
  end if;

  -- Liggarens rad först, med hela beloppet: passens egen bokföring lämnar den
  -- (intern.betalningar_bokfor).
  insert into public.betalningar (familj, typ, belopp_ore, status, stripe_payment_intent, stripe_charge,
                                  avgift_ore, netto_ore, skarp, betald_at)
  values (k.familj, 'pass', p_belopp, 'betald', p_pi, p_charge, p_avgift, p_netto, p_skarp, now())
  returning id into bet;

  for r in
    select kp.booking_id, kp.belopp_ore, kp.minuter
      from public.passkassor_pass kp
      join public.bookings b on b.id = kp.booking_id
     where kp.kassa_id = k.id
     order by b.wanted_date, b.wanted_time, b.id
  loop
    perform 1 from public.bookings where id = r.booking_id for update;
    kort := jsonb_build_object(
      'betald_at', now(), 'stripe_payment_intent_id', null, 'stripe_charge_id', null,
      'stripe_balanstransaktion_id', p_bt, 'stripe_avgift_ore', null, 'stripe_netto_ore', null,
      'stripe_skarp', p_skarp, 'betalt_ore', r.belopp_ore, 'passkassa_id', k.id,
      'stripe_minuter', case when r.minuter between 15 and 240 then r.minuter end);

    update public.bookings
       set betalning_status = 'betald', betald_at = now(), passkassa_id = k.id,
           stripe_balanstransaktion_id = p_bt, stripe_avgift_ore = null, stripe_netto_ore = null,
           stripe_skarp = p_skarp, betalt_ore = r.belopp_ore,
           stripe_minuter = case when r.minuter between 15 and 240 then r.minuter end, aterbetald_ore = 0
     where id = r.booking_id and betalning_status in ('ingen', 'vantar', 'misslyckad');
    get diagnostics traff = row_count;

    -- Betalt med timmar medan kassan stod öppen: kortet vinner, och timmarna kommer tillbaka.
    if traff = 0 then
      update public.bookings
         set betalning_status = 'betald', betald_at = now(), passkassa_id = k.id,
             stripe_balanstransaktion_id = p_bt, stripe_avgift_ore = null, stripe_netto_ore = null,
             stripe_skarp = p_skarp, betalt_ore = r.belopp_ore,
             stripe_minuter = case when r.minuter between 15 and 240 then r.minuter end, aterbetald_ore = 0,
             klippkort_id = null
       where id = r.booking_id and betalning_status = 'betald' and klippkort_id is not null
         and stripe_payment_intent_id is null and passkassa_id is null and coalesce(betalt_ore, 0) = 0;
      get diagnostics traff = row_count;
    end if;
    -- Betalt med timbanken: samma sak, och minuterna kommer tillbaka.
    if traff = 0 and public.timbank_kort_vinner(r.booking_id, kort) then
      traff := 1;
    end if;

    if traff > 0 then
      insert into public.betalningsrader (betalning_id, typ, belopp_ore, booking_id)
      values (bet, 'pass', r.belopp_ore, r.booking_id);
    else
      insert into public.betalningsrader (betalning_id, typ, belopp_ore, booking_id, beskrivning)
      values (bet, 'pass', r.belopp_ore, r.booking_id,
              'Passet hann betalas på annat sätt. Betala tillbaka raden.');
      ute := ute + 1;
    end if;
  end loop;

  -- Ett pass som inte finns längre (raden gick med passet): dess del står för sig.
  select p_belopp - coalesce(sum(x.belopp_ore), 0) into rest from public.betalningsrader x where x.betalning_id = bet;
  if rest > 0 then
    insert into public.betalningsrader (betalning_id, typ, belopp_ore, beskrivning)
    values (bet, 'pass', rest, 'Ett pass i betalningen finns inte längre. Betala tillbaka raden.');
    ute := ute + 1;
  end if;

  update public.passkassor set status = 'betald', stripe_payment_intent = p_pi, betalning_id = bet where id = k.id;
  perform intern.passkassa_avgift_dela(bet);

  if ute > 0 then
    perform public.skapa_uppgift(
      'Ett pass i en betalning för flera pass hann betalas på annat sätt',
      'passkassa_dubbel:' || p_pi,
      'problem',
      'Familjen betalade flera pass i samma kassa, men ' || ute || ' av passen hade redan betalats på annat '
        || 'sätt, eller fanns inte längre. Betala tillbaka de raderna under Betalningar → Liggaren.',
      'profiles', k.familj::text);
    return 'delvis';
  end if;
  return 'betald';
end $function$;

revoke all on function public.passkassa_skapa(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.passkassa_session(uuid, text) from public, anon, authenticated;
revoke all on function public.passkassa_slapp(uuid, text) from public, anon, authenticated;
revoke all on function public.passkassa_misslyckad(uuid) from public, anon, authenticated;
revoke all on function public.passkassa_vantar(uuid, text) from public, anon, authenticated;
revoke all on function public.betalning_avgift(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.passkassa_betald(uuid, text, text, integer, text, integer, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.passkassa_skapa(uuid, jsonb) to service_role;
grant execute on function public.passkassa_session(uuid, text) to service_role;
grant execute on function public.passkassa_slapp(uuid, text) to service_role;
grant execute on function public.passkassa_misslyckad(uuid) to service_role;
grant execute on function public.passkassa_vantar(uuid, text) to service_role;
grant execute on function public.betalning_avgift(text, text, integer, integer) to service_role;
grant execute on function public.passkassa_betald(uuid, text, text, integer, text, integer, integer, boolean)
  to service_role;


-- ---------- 5. kortet vinner över timbanken, och passet får kassan ----------
/* timbank_kort_vinner skriver kortbetalningen på ett pass som timbanken
   betalat. Den skriver nu också kassan (passkassa_id) ur samma jsonb:
   null från webhooken för ett pass för sig, kassan från passkassa_betald. */
do $lapp$
declare
  fore    text;
  traffar integer;
  a1 text := $a$         stripe_minuter = k.stripe_minuter,$a$;
  b1 text := $b$         stripe_minuter = k.stripe_minuter,
         -- flera_pass_och_aterbetalningar (2026-10-27): kassan, för en betalning för flera pass.
         passkassa_id = k.passkassa_id,$b$;
begin
  fore := pg_get_functiondef('public.timbank_kort_vinner(uuid,jsonb)'::regprocedure);
  if position('flera_pass_och_aterbetalningar' in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then
    raise exception 'timbank_kort_vinner: % träffar på minuterna. Läs driften.', traffar;
  end if;
  execute replace(fore, a1, b1);
end $lapp$;


-- ---------- 6. återbetalningen per rad skriver passen ----------
/* En återbetalning av ett pass i en betalning för flera pass skrivs per
   rad (betalningsrader_aterbetalda), och passet får sin rads återbetalda
   belopp, aldrig hela betalningens: aterbetald_ore och läget, som en
   återbetalning av ett pass för sig. Ett pass i tvist behåller tvisten,
   och ett pass som inte bär betalningen (raden med en beskrivning) rörs
   inte. */
do $lapp$
declare
  fore    text;
  traffar integer;
  a1 text := $a$  -- Posterna följer sin rad: hela tillbaka blir aterbetald, en del står kvar som betald.$a$;
  b1 text := $b$  -- flera_pass_och_aterbetalningar (2026-10-27): passen i en betalning för flera
  -- pass följer sin rad.
  update public.bookings bk
     set aterbetald_ore = x.aterbetalt_ore,
         betalning_status = case when bk.betalning_status = 'tvist' then 'tvist'
                                 when x.aterbetalt_ore >= x.belopp_ore then 'aterbetald'
                                 else bk.betalning_status end
    from public.betalningsrader x
   where x.betalning_id = b.id and x.typ = 'pass' and x.booking_id = bk.id
     and b.typ = 'pass' and b.booking_id is null
     and bk.passkassa_id in (select k.id from public.passkassor k where k.betalning_id = b.id)
     and x.aterbetalt_ore > coalesce(bk.aterbetald_ore, 0);

  -- Posterna följer sin rad: hela tillbaka blir aterbetald, en del står kvar som betald.$b$;
begin
  fore := pg_get_functiondef('public.betalningsrader_aterbetalda(text,jsonb,integer)'::regprocedure);
  if position('flera_pass_och_aterbetalningar' in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then
    raise exception 'betalningsrader_aterbetalda: % träffar på posternas rad. Läs driften.', traffar;
  end if;
  execute replace(fore, a1, b1);
end $lapp$;


-- ---------- 7. tvisten: liggaren och passen i en betalning för flera pass ----------
/* Ingen pass-, köp- eller övertidsrad bär charge:n för en betalning för
   flera pass, så webhooken låter databasen flagga den, som en betalning
   som bara är syskontillägg: liggarens rad, och passen som kassan
   betalade, med samma regel som för ett pass för sig (betallageEfterTvist
   i _delad/stripe.ts): en vunnen tvist är betald igen, annars tvist, och
   bara ett pass som står som betalt eller i tvist ändras. */
create or replace function public.betalning_tvist(p_charge text, p_utfall text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21); flera_pass_och_aterbetalningar (2026-10-27): också flera pass.
declare
  n integer;
  m integer;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara webhooken skriver en tvist.';
  end if;
  update public.betalningar x
     set status = intern.betalning_lage(case when p_utfall = 'vunnen' then 'betald' else 'tvist' end,
                                        x.belopp_ore, x.aterbetalt_ore),
         andrad_at = now()
   where x.stripe_charge = p_charge
     and (x.typ = 'syskon' or (x.typ = 'pass' and x.booking_id is null))
     -- En helt återbetald betalning har fått tillbaka pengarna en gång; tvisten
     -- syns i stripe_tvister (granskningen 2026-10-21, som passen).
     and x.aterbetalt_ore < x.belopp_ore
     and x.status is distinct from intern.betalning_lage(case when p_utfall = 'vunnen' then 'betald' else 'tvist' end,
                                                         x.belopp_ore, x.aterbetalt_ore);
  get diagnostics n = row_count;

  update public.bookings bk
     set betalning_status = case when p_utfall = 'vunnen' then 'betald' else 'tvist' end
    from public.passkassor k
    join public.betalningar x on x.id = k.betalning_id
   where x.stripe_charge = p_charge and bk.passkassa_id = k.id
     and bk.betalning_status in ('betald', 'tvist')
     and bk.betalning_status is distinct from (case when p_utfall = 'vunnen' then 'betald' else 'tvist' end);
  get diagnostics m = row_count;
  return n + m > 0;
end $function$;

revoke all on function public.betalning_tvist(text, text) from public, anon, authenticated;
grant execute on function public.betalning_tvist(text, text) to service_role;


-- ---------- 7b. ett pass i kassan som blev kortare får mellanskillnaden tillbaka ----------
/* Samma räkning som förut (betala_nu): det betalda, minus det som redan
   gått tillbaka, minus priset för den hållna tiden. Ett pass som betalats
   i en kassa för flera pass har kassans PaymentIntent; stripe-reservation
   betalar då tillbaka på passets rad (betalningsrad i Stripes metadata). */
create or replace function public.kortare_pass_att_aterbetala(p_grans integer)
returns table(booking_id uuid, belopp_ore bigint, payment_intent text, betalt_ore integer, aterbetald_ore integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- betala_nu (2026-10-21); flera_pass_och_aterbetalningar (2026-10-27): också ett pass i en kassa.
  select b.id, a.belopp_ore, coalesce(b.stripe_payment_intent_id, k.stripe_payment_intent), b.betalt_ore,
         coalesce(b.aterbetald_ore, 0)
    from public.avvikelser_rader() a
    join public.bookings b on b.id::text = a.objekt_id
    left join public.passkassor k on k.id = b.passkassa_id
   where a.typ = 'betalt_for_lange'
     and a.belopp_ore > 0
     and b.betalning_status = 'betald'
     and coalesce(b.stripe_payment_intent_id, k.stripe_payment_intent) is not null
     and b.betalt_ore is not null
   order by a.datum, b.id
   limit greatest(coalesce(p_grans, 20), 1)
$$;
revoke all on function public.kortare_pass_att_aterbetala(integer) from public, anon, authenticated;
grant execute on function public.kortare_pass_att_aterbetala(integer) to service_role;


-- ---------- 8. vad en rad har kvar att betala tillbaka ----------
/* Admins Återbetala på en rad i en betalning med flera rader: ett pass i
   en betalning för flera pass, eller ett syskontillägg, också ett som inte
   hör till någon post (köpet med tillägget som hann betalas på annat
   sätt). Ett köp av timmar betalas tillbaka med köpet, och ett pass på en
   egen betalning med passet: där dras timmarna och skrivs passet som
   förut. stripe-aterbetalning frågar med admins token och betalar
   tillbaka med radens id i Stripes metadata. */
create or replace function public.betalningsrad_att_aterbetala(p_rad uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21); flera_pass_och_aterbetalningar (2026-10-27): också ett pass.
declare
  x  public.betalningsrader%rowtype;
  b  public.betalningar%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum betalar tillbaka.';
  end if;
  select * into x from public.betalningsrader where id = p_rad;
  if not found or x.typ not in ('syskon', 'pass') then
    raise exception using errcode = '22023',
      message = 'Raden betalas inte tillbaka här: ett köp av timmar betalas tillbaka med köpet.';
  end if;
  select * into b from public.betalningar where id = x.betalning_id;
  if x.typ = 'pass' and not (b.typ = 'pass' and b.booking_id is null) then
    raise exception using errcode = '22023', message = 'Ett pass på en egen betalning betalas tillbaka med passet.';
  end if;
  if b.status = 'tvist' then
    raise exception using errcode = '23514', message = 'Betalningen står i tvist och betalas inte tillbaka härifrån.';
  end if;
  return jsonb_build_object('rad', x.id, 'betalning', b.id, 'pi', b.stripe_payment_intent,
    'charge', b.stripe_charge, 'post', x.tillagg_post_id, 'pass', x.booking_id, 'typ', x.typ,
    'familj', b.familj, 'skarp', b.skarp, 'kvar_ore', x.belopp_ore - x.aterbetalt_ore);
end $function$;

revoke all on function public.betalningsrad_att_aterbetala(uuid) from public, anon;
grant execute on function public.betalningsrad_att_aterbetala(uuid) to authenticated;


-- ---------- 9. återbetalningarna ----------
create table if not exists public.aterbetalningar (
  id                uuid primary key default gen_random_uuid(),
  stripe_refund     text not null unique check (stripe_refund ~ '^(re|pyr)_[A-Za-z0-9_]+$'),
  betalning_id      uuid references public.betalningar(id) on delete restrict,
  betalningsrad_id  uuid references public.betalningsrader(id) on delete restrict,
  familj            uuid references public.profiles(id) on delete set null,
  vad               text not null check (vad in ('pass', 'plan', 'timbank', 'tillagg', 'syskon', 'utan_rad', 'okand')),
  booking_id        uuid references public.bookings(id) on delete set null,
  klippkort_id      uuid references public.klippkort(id) on delete set null,
  belopp_ore        integer not null check (belopp_ore > 0),
  anledning         text check (anledning is null or char_length(anledning) <= 300),
  av                uuid references public.profiles(id) on delete set null,
  satt              text not null check (satt in ('adminvyn', 'automatiskt', 'stripe')),
  skapad_at         timestamptz not null default now()
);
create index if not exists aterbetalningar_familj on public.aterbetalningar (familj, skapad_at desc);
create index if not exists aterbetalningar_betalning on public.aterbetalningar (betalning_id);

comment on table public.aterbetalningar is
  '2026-10-27 (flera_pass_och_aterbetalningar). En rad per återbetalning i Stripe: vilken betalning och rad, vad det '
  'var, beloppet, vem av oss som gjorde den och varför (adminvyn), att den gjordes av sig själv (ett kortare pass) eller '
  'i Stripes dashboard. Skrivs bara av aterbetalning_logga(), som stripe-aterbetalning, stripe-reservation och '
  'webhooken kör. Raderas aldrig; anledningen töms när familjen avidentifieras. Bara superadmin läser.';

/* Raden står fast. Det som får ändras är det databasen gör: en nyckel som
   blir null när det den pekar på tas bort, och anledningen som töms när
   familjen avidentifieras. */
create or replace function intern.aterbetalningar_star_fast()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
begin
  if tg_level = 'ROW' and tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and (new.booking_id is null or new.booking_id = old.booking_id)
     and (new.klippkort_id is null or new.klippkort_id = old.klippkort_id)
     and (new.familj is null or new.familj = old.familj)
     and (new.av is null or new.av = old.av)
     and (new.anledning is null or new.anledning = old.anledning)
     and (to_jsonb(new) - 'booking_id' - 'klippkort_id' - 'familj' - 'av' - 'anledning')
         = (to_jsonb(old) - 'booking_id' - 'klippkort_id' - 'familj' - 'av' - 'anledning') then
    return new;
  end if;
  raise exception using errcode = '42501',
    message = 'En återbetalning står fast: den ändras aldrig och tas aldrig bort.';
end $function$;

revoke all on function intern.aterbetalningar_star_fast() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.aterbetalningar'::regclass
                  and tgname = 'aterbetalningar_star_fast') then
    create trigger aterbetalningar_star_fast
      before update or delete on public.aterbetalningar
      for each row execute function intern.aterbetalningar_star_fast();
    create trigger aterbetalningar_toms_aldrig
      before truncate on public.aterbetalningar
      for each statement execute function intern.aterbetalningar_star_fast();
  end if;
end $$;

/* Anledningen är vår fritext och kan nämna familjen: den töms när
   familjen avidentifieras, som orsaken till insatta timmar. Beloppet, vad
   det var och när står kvar, för bokföringen. */
create or replace function intern.aterbetalningar_gallras()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
begin
  update public.aterbetalningar set anledning = null where familj = new.id and anledning is not null;
  return null;
end $function$;

revoke all on function intern.aterbetalningar_gallras() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass
                  and tgname = 'profiles_aterbetalningar_gallras') then
    create trigger profiles_aterbetalningar_gallras
      after update of raderad_at on public.profiles
      for each row when (old.raderad_at is null and new.raderad_at is not null)
      execute function intern.aterbetalningar_gallras();
  end if;
end $$;

/* En återbetalning skrivs ner: av stripe-aterbetalning när admin betalat
   tillbaka, av stripe-reservation när ett kortare pass fått
   mellanskillnaden, och av webhooken för varje återbetalning den ser
   (också en i Stripes dashboard). Samma återbetalning två gånger blir en
   rad (Stripes re_-id). Betalningen, familjen och vad det var läses ur
   liggaren och raden, aldrig ur anropet; anropet säger bara vilken rad,
   vilket pass eller köp, och om det var övertid. Svarar sant när raden
   skrevs nu. */
create or replace function public.aterbetalning_logga(
  p_refund text, p_pi text, p_belopp integer, p_rad uuid default null, p_booking uuid default null,
  p_klippkort uuid default null, p_tillagg boolean default false, p_anledning text default null,
  p_av uuid default null, p_satt text default 'adminvyn')
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- flera_pass_och_aterbetalningar (2026-10-27).
declare
  b    public.betalningar%rowtype;
  x    public.betalningsrader%rowtype;
  v    text;
  kk   uuid := p_klippkort;
  bk   uuid := p_booking;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara funktionerna skriver en återbetalning.';
  end if;
  if p_refund is null or p_refund !~ '^(re|pyr)_[A-Za-z0-9_]+$' or coalesce(p_belopp, 0) <= 0 then
    return false;
  end if;
  if p_satt not in ('adminvyn', 'automatiskt', 'stripe') then
    raise exception using errcode = '22023', message = 'Okänt sätt.';
  end if;
  if p_pi is not null then
    select * into b from public.betalningar where stripe_payment_intent = p_pi;
  elsif p_klippkort is not null then
    -- Ett köp som betalades tillbaka i adminvyn: köpets betalning i liggaren.
    select * into b from public.betalningar
     where klippkort_id = p_klippkort and typ in ('plan', 'timbank') order by betald_at desc limit 1;
  end if;
  if p_rad is not null then
    select * into x from public.betalningsrader where id = p_rad and betalning_id is not distinct from b.id;
    if found then
      -- Raden avgör: ett syskontillägg i ett köp är inte köpet.
      v := x.typ;
      kk := x.klippkort_id;
      bk := x.booking_id;
    end if;
  end if;
  if v is null then
    -- Utan rad (Stripes dashboard, ett pass eller köp för sig): liggaren säger vad betalningen gällde.
    kk := coalesce(kk, b.klippkort_id);
    bk := coalesce(bk, b.booking_id);
    v := case when b.utan_rad then 'utan_rad'
              when p_tillagg or b.typ = 'tillagg' then 'tillagg'
              when kk is not null then
                (select case when k.sort = 'plan' or k.erbjudande = 'plan_extra' then 'plan' else 'timbank' end
                   from public.klippkort k where k.id = kk)
              when bk is not null then 'pass'
              else coalesce(b.typ, 'okand') end;
  end if;
  if v not in ('pass', 'plan', 'timbank', 'tillagg', 'syskon', 'utan_rad') then
    v := 'okand';
  end if;

  insert into public.aterbetalningar (stripe_refund, betalning_id, betalningsrad_id, familj, vad, booking_id,
                                      klippkort_id, belopp_ore, anledning, av, satt)
  values (p_refund, b.id, case when x.id is not null then x.id end,
          coalesce(b.familj,
                   (select k.parent_id from public.klippkort k where k.id = kk),
                   (select bo.parent_id from public.bookings bo where bo.id = bk)),
          v,
          case when exists (select 1 from public.bookings bo where bo.id = bk) then bk end,
          case when exists (select 1 from public.klippkort k where k.id = kk) then kk end,
          p_belopp, nullif(left(btrim(coalesce(p_anledning, '')), 300), ''),
          case when exists (select 1 from public.profiles p where p.id = p_av) then p_av end,
          p_satt)
  on conflict (stripe_refund) do nothing;
  return found;
end $function$;

revoke all on function public.aterbetalning_logga(text, text, integer, uuid, uuid, uuid, boolean, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.aterbetalning_logga(text, text, integer, uuid, uuid, uuid, boolean, text, uuid, text)
  to service_role;


-- ---------- 10. rättigheter ----------
alter table public.passkassor enable row level security;
alter table public.passkassor_pass enable row level security;
alter table public.aterbetalningar enable row level security;

revoke all on public.passkassor, public.passkassor_pass, public.aterbetalningar from anon, authenticated;
do $$
declare
  roll text;
begin
  foreach roll in array array['nextrum_barn', 'nextrum_ai'] loop
    if exists (select 1 from pg_roles where rolname = roll) then
      execute format('revoke all on public.passkassor, public.passkassor_pass, public.aterbetalningar from %I', roll);
    end if;
  end loop;
  -- Inte heller tjänstekontot: kassan och webhooken skriver bara genom funktionerna ovan.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke insert, update, delete, truncate on public.passkassor, public.passkassor_pass, '
      || 'public.aterbetalningar from service_role';
  end if;
end $$;
grant select on public.passkassor, public.passkassor_pass, public.aterbetalningar to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passkassor'
                  and policyname = 'admin läser kassorna för flera pass') then
    create policy "admin läser kassorna för flera pass" on public.passkassor
      for select to authenticated using ((select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passkassor_pass'
                  and policyname = 'admin läser passen i kassorna') then
    create policy "admin läser passen i kassorna" on public.passkassor_pass
      for select to authenticated using ((select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'aterbetalningar'
                  and policyname = 'admin läser återbetalningarna') then
    create policy "admin läser återbetalningarna" on public.aterbetalningar
      for select to authenticated using ((select public.is_admin()));
  end if;
end $$;
