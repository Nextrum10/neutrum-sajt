/* ============================================================
   Fas 13.3 — studiehjälparen får eget material i samma bank

   Fas 13.2 sa "studiehjälparen LÄSER, admin SKRIVER". Regeln var
   rätt om NEXTRUMS bank och fel om allt annat: en studiehjälpare som
   gjort ett eget övningsblad hade ingenstans att lägga det som gick
   att koppla till en läxa. Materialfliken i studiehjälparvyn skrev i
   `materials`, och de raderna nådde ingen familj sedan föräldravyns
   materialflik togs bort i 13.2 — en uppladdning som såg ut att
   fungera och inte gjorde det.

   Lösningen är inte en andra tabell. Det är en kolumn.

   `delad` skiljer de två sorterna:

   · delad = true  — Nextrums bank. Bara admin skriver. Alla godkända
                     studiehjälpare ser den. Det är urvalet, och det
                     är fortfarande kurerat.
   · delad = false — studiehjälparens eget. Bara hen ser det, bara hen
                     ändrar det. Admin ser allt, som alltid.

   ATT `delad` INTE GÅR ATT SLÅ PÅ SJÄLV är hela poängen.
   Uppdateringspolicyn har `not delad` i BÅDE using och with check, så
   en studiehjälpare kan ändra sitt eget material men aldrig lyfta in
   det i den gemensamma banken. Kunde hen det vore kureringen en
   artighet, inte en regel — och den första som råkade trycka fel hade
   lagt sitt utkast framför femtio kollegor.

   Familjen når materialet via läxan som förut. Den policyn frågar
   inte efter `delad`: läxan är kopplingen, och ett eget övningsblad
   ska förstås gå att öppna för den elev som fått det.
   ============================================================ */

alter table public.biblioteksmaterial
  add column if not exists delad boolean not null default true;

comment on column public.biblioteksmaterial.delad is
  'true = Nextrums gemensamma bank, bara admin skriver. false = studiehjälparens eget, bara hen ser och ändrar. Går inte att slå på från studiehjälparvyn.';

/* Indexet i 13.2 letade på (arskurs, amne). Nu filtreras det nästan
   alltid på ägare också: studiehjälparen ser sitt eget plus det
   delade, aldrig någon annans. */
create index if not exists biblioteksmaterial_agare
  on public.biblioteksmaterial (skapad_av) where not delad;

/* ---- läsning ---- */
drop policy if exists "godkänd studiehjälpare läser biblioteket" on public.biblioteksmaterial;
create policy "godkänd studiehjälpare läser biblioteket" on public.biblioteksmaterial
  for select to authenticated
  using (
    aktiv
    and public.ar_godkand_studiehjalpare()
    and (delad or skapad_av = auth.uid())
  );

/* ---- studiehjälparens eget ----
   skapad_av måste vara en själv OCH delad måste vara false. Utan det
   första kunde man skriva material i någon annans namn; utan det
   andra vore banken öppen för alla. */
drop policy if exists "studiehjälpare lägger till eget material" on public.biblioteksmaterial;
create policy "studiehjälpare lägger till eget material" on public.biblioteksmaterial
  for insert to authenticated
  with check (
    public.ar_godkand_studiehjalpare()
    and skapad_av = auth.uid()
    and not delad
  );

drop policy if exists "studiehjälpare ändrar sitt eget material" on public.biblioteksmaterial;
create policy "studiehjälpare ändrar sitt eget material" on public.biblioteksmaterial
  for update to authenticated
  using (skapad_av = auth.uid() and not delad and public.ar_godkand_studiehjalpare())
  with check (skapad_av = auth.uid() and not delad);

drop policy if exists "studiehjälpare tar bort sitt eget material" on public.biblioteksmaterial;
create policy "studiehjälpare tar bort sitt eget material" on public.biblioteksmaterial
  for delete to authenticated
  using (skapad_av = auth.uid() and not delad and public.ar_godkand_studiehjalpare());

/* ---- hinken ----
   Samma delning. Uppladdning kräver fortfarande att raden finns
   först — sökvägens uuid slås upp i tabellen — men nu får ägaren
   ladda upp till sin egen rad. */
drop policy if exists "admin laddar upp bibliotek" on storage.objects;
create policy "bibliotek laddas upp av admin eller radens ägare" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bibliotek'
    and exists (
      select 1 from public.biblioteksmaterial b
      where b.id = public.mapp_uuid(storage.objects.name)
        and (public.is_admin() or (b.skapad_av = auth.uid() and not b.delad))));

drop policy if exists "admin ersätter bibliotek" on storage.objects;
create policy "bibliotek ersätts av admin eller radens ägare" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'bibliotek'
    and exists (
      select 1 from public.biblioteksmaterial b
      where b.id = public.mapp_uuid(storage.objects.name)
        and (public.is_admin() or (b.skapad_av = auth.uid() and not b.delad))))
  with check (
    bucket_id = 'bibliotek'
    and exists (
      select 1 from public.biblioteksmaterial b
      where b.id = public.mapp_uuid(storage.objects.name)
        and (public.is_admin() or (b.skapad_av = auth.uid() and not b.delad))));

drop policy if exists "admin tar bort bibliotek" on storage.objects;
create policy "bibliotek tas bort av admin eller radens ägare" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bibliotek'
    and exists (
      select 1 from public.biblioteksmaterial b
      where b.id = public.mapp_uuid(storage.objects.name)
        and (public.is_admin() or (b.skapad_av = auth.uid() and not b.delad))));

/* Läsningen går som förut genom raden. Den enda ändringen är att
   "godkänd studiehjälpare" nu betyder "ser raden", och radens egen
   policy avgör om hen gör det. */
drop policy if exists "bibliotek läses av admin, hjälpare och berörd familj" on storage.objects;
create policy "bibliotek läses av admin, hjälpare och berörd familj" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bibliotek'
    and exists (
      select 1 from public.biblioteksmaterial b
      where b.id = public.mapp_uuid(storage.objects.name)
        and (
          public.is_admin()
          or (b.aktiv and public.ar_godkand_studiehjalpare()
              and (b.delad or b.skapad_av = auth.uid()))
          or exists (
            select 1 from public.homework h
            join public.students s on s.id = h.student_id
            where h.bibliotek_id = b.id and s.parent_id = auth.uid())
        )));
