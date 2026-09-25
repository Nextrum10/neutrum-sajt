-- ============================================================
-- Fas 16.1e — ångerrätten räknas på det avtalade priset
--
-- klippkort_saldo.vid_uppsagning_ore räknar de använda timmarna till
-- ORDINARIE pris: slutar en familj får rabatten gå tillbaka (Leo
-- 2026-09-25). Det håller för en familj som slutar efter ångerfristen.
--
-- Inom de 14 dagarna gör det inte. Lagen om distansavtal 2 kap. 15 §
-- säger att den som ångrar sig betalar en PROPORTIONELL ANDEL AV DET
-- AVTALADE PRISET för det som hunnit utföras. Det avtalade priset är
-- det rabatterade: tre använda timmar på ett klippkort för 3 600 kr
-- är 1 080 kr, inte 3 × 379 = 1 137 kr. Hade adminvyn visat det andra
-- beloppet inom fristen hade vi dragit 57 kr som lagen inte ger oss.
--
-- Två kolumner läggs till sist (create or replace view får bara lägga
-- till i slutet): angerfrist_till, och vid_anger_ore som räknar
-- andelen nedåt till helt öre — ett avrundningsfel ska gå familjens väg.
-- Vilken av de två som gäller avgörs av dagens datum mot fristen; det
-- gör adminvyn, inte vyn, för en återbetalning är en människas beslut.
-- ============================================================

create or replace view public.klippkort_saldo with (security_invoker = true) as
select k.id, k.parent_id, k.erbjudande, k.namn, k.sort, k.timmar,
       coalesce(a.anvanda, 0)                                        as anvanda,
       greatest(k.timmar - coalesce(a.anvanda, 0), 0)                as kvar,
       k.giltigt_till, k.status, k.begart_ore, k.betalt_ore, k.aterbetald_ore,
       k.timpris_ore, k.betald_at, k.created_at,
       (k.status = 'betald'
        and k.giltigt_till >= (now() at time zone 'Europe/Stockholm')::date
        and k.timmar - coalesce(a.anvanda, 0) > 0)                   as brukbar,
       /* Om familjen slutar i dag, efter ångerfristen: de använda
          timmarna räknas till ordinarie pris, resten går tillbaka. */
       greatest(coalesce(k.betalt_ore, 0) - k.aterbetald_ore
                - coalesce(a.anvanda, 0) * k.timpris_ore, 0)         as vid_uppsagning_ore,
       /* Sista dagen att ångra köpet. Räknad från betalningen, som är
          när köpet blev ett avtal, och generöst: hela den fjortonde
          dagen efter räknas med. */
       ((k.betald_at at time zone 'Europe/Stockholm')::date + 14)    as angerfrist_till,
       /* Om familjen ångrar sig inom fristen: de använda timmarna
          räknas som en andel av det de faktiskt betalade. */
       greatest(coalesce(k.betalt_ore, 0) - k.aterbetald_ore
                - (floor(coalesce(a.anvanda, 0)::numeric * coalesce(k.betalt_ore, 0) / k.timmar))::int, 0)
                                                                     as vid_anger_ore
  from public.klippkort k
  left join lateral (
    select sum(greatest(1, ceil(coalesce(b.duration_min, 60) / 60.0)))::int as anvanda
      from public.bookings b
     where b.klippkort_id = k.id and b.status <> 'cancelled'
  ) a on true;

grant select on public.klippkort_saldo to authenticated;
