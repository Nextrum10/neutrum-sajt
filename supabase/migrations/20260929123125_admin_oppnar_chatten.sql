-- ============================================================
-- NEXTRUM — admin öppnar chatten mellan familj och studiehjälpare
--
-- Leo 2026-09-29: "vi på admin ska kunna gå in i elevers och lärares
-- chattar utan att de ser det. det gör vi från vår admin genom att
-- trycka på öppna chatt".
--
-- Läsrätten fanns redan: "admin läser alla meddelanden" (schema-v4).
-- Adminvyn visade bara den senaste raden i varje tråd. Det som saknades
-- var en väg att läsa en hel tråd, och ett spår efter att någon gjort
-- det.
--
-- UTAN ATT DE SER DET. Funktionen skriver ingenting i messages. read_at
-- sätts bara av mottagaren (skydda_meddelande, och admin har ingen
-- update-policy på tabellen), ingen notis köas (notisen går på INSERT
-- i messages), och vyn lyssnar inte på tråden i Realtime. Familjen och
-- studiehjälparen märker alltså inte när vi läser.
--
-- MEN DET ÄR INTE HEMLIGT. Att vi KAN läsa står i integritetspolicyn
-- på båda språken och i chatten själv ("det som sägs här stannar mellan
-- er och oss"). Osynligt i stunden är en sak; att de inte vet om att vi
-- kan är en annan, och det får vi inte (GDPR art. 5.1 a och 13).
--
-- OCH DET SYNS HOS OSS. Varje öppning blir en rad i auditloggen: vem,
-- när, vilken familj, vilken studiehjälpare och hur många meddelanden
-- tråden hade. Aldrig texten. Samma princip som personnumret (Fas
-- 6.1): en åtkomst som den registrerade inte märker ska gå att visa i
-- efterhand, också för oss själva. Raden skrivs i samma transaktion som
-- läsningen, så en läsning genom funktionen utan rad finns inte. Vyns
-- väg till en hel tråd går därför hit och inte genom en select.
-- Läsrätten på tabellen står kvar: chattlistan (senaste raden per tråd)
-- och familjens tidslinje läser den. Loggen är alltså ett spår efter
-- öppningarna, inte ett lås.
--
-- DE 500 SENASTE. PostgREST kapar ett svar vid max-rows (1 000 på
-- Supabase), och en tråd hämtad i tidsordning hade tappat de NYASTE
-- meddelandena. Funktionen tar de senaste, nyast först, och totalt
-- säger hur många tråden har, så att vyn kan säga att det finns fler.
-- ============================================================

create or replace function public.chatt_las(p_parent uuid, p_tutor uuid)
returns table (id uuid, sender_id uuid, body text, read_at timestamptz,
               created_at timestamptz, totalt bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  antal bigint;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501',
      message = 'Bara Nextrum kan öppna en chatt.';
  end if;
  if p_parent is null or p_tutor is null then
    raise exception using errcode = '22023',
      message = 'Chatten är tråden mellan en familj och en studiehjälpare. Båda behövs.';
  end if;

  select count(*) into antal
    from public.messages m
   where m.parent_id = p_parent and m.tutor_id = p_tutor;

  -- Tråden heter efter familjen i loggen (Gäller), och studiehjälparen
  -- står i efter. Id och ett antal, aldrig namn eller text.
  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, efter)
  values ((select auth.uid()), 'admin', 'chatt.oppnad', 'messages', p_parent::text,
          jsonb_build_object('tutor_id', p_tutor, 'meddelanden', antal));

  return query
    select m.id, m.sender_id, m.body, m.read_at, m.created_at, antal
      from public.messages m
     where m.parent_id = p_parent and m.tutor_id = p_tutor
     order by m.created_at desc, m.id desc
     limit 500;
end $$;

comment on function public.chatt_las(uuid, uuid) is
  'Adminvyns Öppna chatt: de 500 senaste meddelandena i tråden mellan en familj och en '
  'studiehjälpare, nyast först. Bara admin. Varje anrop skriver chatt.oppnad i audit_logg. '
  'Rör aldrig read_at och köar ingen notis: parterna märker inte att tråden läses.';

revoke execute on function public.chatt_las(uuid, uuid) from public, anon;
grant execute on function public.chatt_las(uuid, uuid) to authenticated;
