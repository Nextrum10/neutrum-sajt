# Avveckla `prissattning` (Fas 5.5)

*Plan, skriven 2026-09-19. Ingenting här är gjort än utom det som står under "Redan gjort".*

`prissattning` är en tabell med en enda rad: läxhjälpens timpris. Den fanns före
tjänstekatalogen. Sedan schema-v18 är det `tjanster` som är källan för priset, och
triggern `tjanster_synka_pris` (funktionen `synka_laxhjalpspris()`) kopierar
läxhjälpens pris hit så att de gamla läsarna inte går sönder.

Två ställen för samma pris kan glida isär. Därför ska tabellen bort. Men planens
avsnitt D säger att `prissattning` och triggern står kvar **tills ingen läser dem**.
Ordningen nedan följer det: först flyttas läsarna, en i taget, sedan tas triggern
bort, och sist tabellen.

## Läget i dag

| Läsare | Var | Vad den gör | Steg |
|---|---|---|---|
| Faktureringen | `supabase/functions/fakturering/index.ts:162` | Reserv när standardtjänsten saknar pris | 3 |
| Ekonomiagenten | `supabase/functions/ekonomi/index.ts:143–150` | Frågan `prissattning` i verktyget `las_siffror` | 1 |
| Adminvyn, månadskörningen | `nextrum-admin.js:200`, `:219`, `ritaPris()` `:2234` | Visar priset i #kor-pris | 2 |
| Adminvyn, tjänstekorten | `nextrum-admin.js:3394–3401` | Speglar läxhjälpens pris till `S.pris` efter spara | 2 |
| Triggern | `tjanster_synka_pris` → `synka_laxhjalpspris()` | Skriver läxhjälpens pris till tabellen | 4 |

**Redan gjort i Fas 5:** familjens uppskattning under Betalning
(`nextrum-studie-vy.js`, `laddaBetalning()`) läser nu priset ur tjänstekatalogen.

## Steg

Varje steg är en egen commit och, där det behövs, en egen driftsättning. Gå inte
vidare förrän kontrollen i steget är gjord.

1. **Ekonomiagenten.**
   - Byt frågan `prissattning` i `FRAGOR` mot `tjanster`, som läser
     `kod, namn, aktiv, pris_per_timme_ore, extra_personer_ore, ersattning_per_timme_ore, rut_berattigad, rut_procent`.
   - Enum-listan i verktyget och självtestets `fragor` byggs ur `Object.keys(FRAGOR)`,
     så de följer med av sig själva. Uppdatera systemprompten om den nämner prissättningen.
   - Jämför `get_edge_function ekonomi` med repot och driftsätt sedan.
   - **Kontroll:** självtestet listar `tjanster` och inte `prissattning`.
2. **Adminvyn.**
   - `ritaPris()` visar standardtjänstens pris ur `S.tjanster`, med samma regel
     som `standardTjanst()` i `_delad/pris.ts`.
   - Ta bort hämtningen av `prissattning` i `hämtaAllt()` och speglingen till `S.pris` efter spara.
   - Bekräftelsen vid prisändring ska gälla aktiva tjänster, inte `kod === 'laxhjalp'`.
   - **Kontroll:** månadskörningen visar samma pris som tjänstekortet, också direkt efter att priset sparats.
3. **Faktureringen.**
   - Ta bort reserven: saknar standardtjänsten pris är det ett fel att säga, inte att gissa runt.
   - Felmeddelandet ska peka på tjänstekatalogen.
   - `pris_test.ts` ska fortfarande vara grön.
   - **Kontroll:** torrkörningen före och efter ger samma svar.
4. **Triggern.**
   - Kontrollera först att ingen läser tabellen längre:
     - grep i repot
     - `pg_stat_statements` för `prissattning`
     - API-loggarna i Supabase
   - Ny migration: `drop trigger tjanster_synka_pris on public.tjanster;` och
     `drop function public.synka_laxhjalpspris();`.
   - Ta bort funktionen ur listan i `verktyg/rls-test.sql`.
   - **Kontroll:** att ändra läxhjälpens pris i adminvyn ändrar bara `tjanster`.
5. **Tabellen.**
   - Ta en kopia av raden i migrationsfilens kommentar (det är en rad).
   - `drop table public.prissattning;`
   - **Kontroll:** hela `rls-test.sql` är grön, och studievyn, studiehjälparvyn och admin
     laddas utan fel i konsolen.

## Risker

- **Något som inte står i tabellen läser priset.** Grep är inte nog, eftersom en driftsatt
  edge-funktion kan skilja sig från repot. Därför kommer steg 4 först efter
  kontrollerna där, och `get_edge_function` före varje driftsättning.
- **Standardtjänsten byts.** Om en annan tjänst någon gång får lägre `ordning` än
  läxhjälp blir den standard. Den dagen gäller dess pris som reserv i faktureringen
  (fram till steg 3) och i gränssnittet. Det är avsiktligt, men värt att veta.
