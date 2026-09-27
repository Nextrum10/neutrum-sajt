-- ============================================================
-- Fas 19.2: familjen får betala efter passet
--
-- Leo 2026-09-27: tre sätt att betala. Kort i förväg, när tiden är
-- bekräftad. Kort efter passet, och faktura efter passet, båda i
-- samband med att familjen bekräftar rapporten. Rapporten bekräftas
-- också när passet redan är betalt. Villkoren, prissidan, FAQ:n,
-- maskoten, mejlen och /en/ säger det från samma dag, och ett pass som
-- hölls utan betalning larmar som förut, direkt, som Inte betalt.
--
-- VAD SOM ÄNDRAS HÄR
--
-- 1. Spärren kortsparr kan inte längre slås på. Påslagen nekar den
--    rapporten till ett obetalt pass, och rapporten är just det
--    familjen ska bekräfta och betala efter. Spärren och villkoren kan
--    alltså inte gälla samtidigt. Ett check-villkor och inte bara en
--    text i vyn: knappen i adminvyn är ett gränssnitt, och allt skydd
--    ligger i databasen. Ska villkoren någon gång tillbaka till
--    betalning före passet tas villkoret bort i samma migration som
--    texterna skrivs om.
--
-- 2. Flaggornas texter säger vad som gäller nu. stampla_flaggan()
--    fryser beskrivning och vantar_pa vid varje update, också från en
--    migration, så triggern stängs av runt just de här raderna och
--    slås på direkt efter, i samma transaktion (som i Fas 14.9).
--    flaggor_audit rörs inte: den loggar bara när aktiv ändras, och
--    det gör den inte här.
--
-- skydda_bokningsfalt rörs inte. Kortspärrens gren i den står kvar,
-- men kan inte nås så länge flaggan inte kan vara på.
-- ============================================================

set local lock_timeout = '5s';

do $$
begin
  if exists (select 1 from public.flaggor where kod = 'kortsparr' and aktiv) then
    raise exception 'kortsparr är på. Stäng av den under Ekonomi → Kortbetalningar innan villkoren om betalning efter passet börjar gälla.';
  end if;
end $$;

alter table public.flaggor
  add constraint flaggor_kortsparr_av check (kod <> 'kortsparr' or not aktiv);

alter table public.flaggor disable trigger flaggor_stampla;

update public.flaggor
   set beskrivning = 'Ingen betalning, inget pass. Kan inte slås på sedan Fas 19.2: villkoren låter '
                  || 'familjen betala efter passet, när de bekräftar rapporten, och spärren hade hindrat '
                  || 'studiehjälparen från att skriva just den rapporten. Ett pass som hölls utan betalning '
                  || 'syns under Ekonomi → Avvikelser som Inte betalt.',
       vantar_pa   = 'Går inte att slå på. Först ska villkoren, prissidan, FAQ:n, maskoten, mejlen och '
                  || '/en/ säga att passet betalas före, och villkoret flaggor_kortsparr_av tas bort i en '
                  || 'migration.',
       uppdaterad    = now(),
       uppdaterad_av = null
 where kod = 'kortsparr';

update public.flaggor
   set beskrivning = 'Faktura som betalsätt. På: när passet är genomfört kan familjen välja faktura i '
                  || 'stället för kort, i samband med att de bekräftar rapporten, och passet kommer med på '
                  || 'en månadsfaktura i början av nästa månad, att betala inom tio dagar. Av: bara kort. '
                  || 'Pass som redan valts för faktura faktureras ändå.',
       uppdaterad    = now(),
       uppdaterad_av = null
 where kod = 'faktura';

alter table public.flaggor enable trigger flaggor_stampla;

-- Vakten efteråt: hela migrationen rullas tillbaka om något av det
-- ovan inte blev sant.
do $$
begin
  if (select tgenabled from pg_trigger
       where tgrelid = 'public.flaggor'::regclass and tgname = 'flaggor_stampla') is distinct from 'O' then
    raise exception 'flaggor_stampla är inte påslagen igen.';
  end if;
  if not exists (select 1 from public.flaggor where kod = 'kortsparr' and beskrivning ~ 'Fas 19\.2') then
    raise exception 'kortsparr fick inte sin nya text.';
  end if;
  if not exists (select 1 from public.flaggor where kod = 'faktura' and beskrivning ~ 'bekräftar rapporten') then
    raise exception 'faktura fick inte sin nya text.';
  end if;
end $$;
