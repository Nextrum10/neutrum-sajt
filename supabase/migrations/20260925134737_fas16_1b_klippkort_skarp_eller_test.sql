-- ============================================================
-- Fas 16.1b: ett klippkort vet om det köptes skarpt eller i test
--
-- Samma regel som Fas 14.7 gav passen: händelsens livemode sparas, så
-- att ett klippkort köpt i Stripes sandlåda aldrig ser ut som en intäkt
-- i ett underlag. klippkort_betald får en parameter till, och eftersom
-- en funktion i Postgres identifieras av sina parametrar byts den i
-- stället för att ändras: den gamla hade annars stått kvar bredvid.
-- ============================================================

alter table public.klippkort add column stripe_skarp boolean;

comment on column public.klippkort.stripe_skarp is
  'Fas 16.1b. true = skarp betalning, false = Stripes testläge, null = okänt. Skrivs av stripe-webhook.';

drop function public.klippkort_betald(uuid, int, text, text, text, int, int);

create function public.klippkort_betald(
  p_id uuid, p_betalt int, p_pi text, p_charge text, p_bt text, p_avgift int, p_netto int, p_skarp boolean)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  update public.klippkort
     set status = 'betald',
         betald_at = now(),
         giltigt_till = ((now() at time zone 'Europe/Stockholm')::date
                         + make_interval(months => giltig_manader))::date,
         betalt_ore = p_betalt,
         stripe_payment_intent_id = p_pi,
         stripe_charge_id = p_charge,
         stripe_balanstransaktion_id = p_bt,
         stripe_avgift_ore = p_avgift,
         stripe_netto_ore = p_netto,
         stripe_skarp = p_skarp,
         aterbetald_ore = 0
   where id = p_id and status in ('vantar', 'misslyckad');
  return found;
end $$;

revoke all on function public.klippkort_betald(uuid, int, text, text, text, int, int, boolean) from public, anon, authenticated;
grant execute on function public.klippkort_betald(uuid, int, text, text, text, int, int, boolean) to service_role;
