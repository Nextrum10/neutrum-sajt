/* ============================================================
   Fas 13.1 — ansökan bär det digitala mötet

   Rekryteringsspåret hade tre stämplar (kontaktad, intervju,
   utbildad) men ingenstans att lägga VAD som bokades. Tiden och
   länken till mötet stod bara i mejlet, alltså i någons inkorg,
   och adminvyn kunde därför inte svara på "när träffar vi hen?" —
   bara på "är intervjun gjord?".

   Två kolumner, inte en tabell: en ansökan har ett möte. Blir det
   två blir det ett omtag, och det är billigare än en tabell som
   aldrig får en andra rad.

   intervju_at rörs inte. Den betyder fortfarande att mötet är
   HÅLLET, och det är en annan fråga än när det är bokat: ett möte
   som bokades men aldrig blev av ska synas som just det.
   ============================================================ */
alter table public.applications
  add column if not exists mote_tid  timestamptz,
  add column if not exists mote_lank text;

comment on column public.applications.mote_tid is
  'När det digitala mötet är bokat. intervju_at betyder att det är hållet.';
comment on column public.applications.mote_lank is
  'Möteslänken som skickades till den sökande.';
