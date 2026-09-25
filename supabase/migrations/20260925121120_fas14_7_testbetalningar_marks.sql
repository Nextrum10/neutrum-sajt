-- ============================================================
-- NEXTRUM — Fas 14.7: en testbetalning går att skilja från en riktig
--
-- De två första betalningarna som gick hela vägen (2026-09-25) kom från
-- Stripes sandlåda. I bookings och stripe_handelser ser de ut precis
-- som intäkter: 379 kr, betald, med datum. Ett underlag till
-- bokföringen hade tagit med dem. Bara stripe_tvister bar livemode
-- (kolumnen skarp), för att en tvist i testläge inte ska räknas.
--
-- stripe_skarp på passet och skarp på händelsen, båda ur Stripes egen
-- livemode. Satta av stripe-webhook, och för betalningar som redan
-- kommit in av stripe-avstamning, som frågar Stripe om chargen.
-- null betyder "vet inte", inte "test": en gissning hade gjort en
-- riktig betalning osynlig eller en testbetalning till intäkt.
--
-- stripe_skarp börjar på stripe_ med flit. Fas 14.6a nekar varje
-- stripe_-kolumn som inte är null när en familj skapar ett pass, så
-- kolumnen är skyddad från första raden utan att triggern ändras.
-- ============================================================

alter table public.bookings add column if not exists stripe_skarp boolean;
comment on column public.bookings.stripe_skarp is
  'Stripes livemode för betalningen (Fas 14.7). true skarp, false test, null okänt. Satt av '
  'stripe-webhook eller stripe-avstamning, aldrig av en vy.';

alter table public.stripe_handelser add column if not exists skarp boolean;
comment on column public.stripe_handelser.skarp is
  'Händelsens livemode (Fas 14.7). null för händelser som kom in före kolumnen.';
