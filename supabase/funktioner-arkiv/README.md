# Arkiv: edge-funktioner som ligger i driften utan att ha funnits i git

**Det här är inte levande kod.** Katalogen ligger med flit utanför
`supabase/functions/`, så att varken CI (`deno check
supabase/functions/*/index.ts`) eller en `supabase functions deploy`
tar den för en funktion att underhålla eller driftsätta. `.vercelignore`
utesluter hela `/supabase`, så inget här serveras från nextrum.se.

Koden hämtades 2026-09-21 ur Supabase med `get_edge_function`, eftersom
den inte fanns i någon gren — `git log --all --find-object` gav noll
träffar. Den skrevs av två gånger, oberoende av varandra, och de två
avskrifterna jämfördes med `diff -r`. `_delad/auth.ts` och
`_delad/http.ts` är dessutom byte för byte lika repots egna filer.
`META.json` i varje mapp bär driftversionens id, version och tidpunkt.

Varje mapp är en **hel bunt**, precis som den driftsattes: entrypointen
ligger på `<slug>/index.ts` relativt buntens rot, och `_delad/` är
buntens egen kopia. Därav den dubbla `notis-ko/notis-ko/`.

---

## Läget i driften, 2026-09-21

| | notis-ko | notis-avanmal |
|---|---|---|
| Status | ACTIVE, version 1 | ACTIVE, version 1 |
| `verify_jwt` | **false** | **false** |
| Driftsatt | 2026-09-19 23:11 UTC | 2026-09-19 23:12 UTC |
| Anropad sedan dess | aldrig | aldrig |
| Vad den gör i dag | svarar 401, eller 500 med rätt hemlighet | svarar 503 på varje anrop |

**Ingen av dem kan skicka ett mejl, läsa data eller skriva något i dag.**
Ingen trigger, webhook, databasfunktion eller cron-jobb anropar dem, och
`pg_cron` är inte installerat. Loggarna visar fyra anrop totalt, alla
inom två minuter efter driftsättningen, från sessionen som driftsatte
dem.

---

## notis-ko

**Tänkt att göra:** köa notismejl i en tabell och skicka dem i
omgångar, i stället för att varje händelse mejlar direkt. Enligt
filhuvudet skulle den väckas varje minut av ett `pg_cron`-jobb som
heter `notis_vack_arbetaren`.

**Steg för steg** (`notis-ko/index.ts`, `notis-ko/arbetare.ts`):

1. `OPTIONS` ger 200.
2. Kräver `SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY`.
3. Saknas headern `x-nextrum-notis` → **401**, ingenting läses.
   Annars läses `notis_konfig.hemlighet` med service_role och jämförs i
   konstant tid. Fel värde → 401.
4. Läser `notis_konfig.avanmal_nyckel` och `notis_konfig.lage`. **Båda
   kolumnerna saknas**, felet ignoreras och konfigurationen blir tom.
5. Läget tas från secreten `NOTIS_LAGE`, annars `notis_konfig.lage`,
   annars `'logg'` — som betyder att inga riktiga mejl skickas.
6. Anropar `rpc notis_hamta(max_antal=25)`. **Funktionen saknas**, så
   svaret blir 500 här.
7. *Om kön hade funnits:* varje rad renderas ur `mallar/sv.json` och
   skickas via Resend med idempotensnyckeln `nextrum-notis-<id>` och
   `List-Unsubscribe`-headers, varefter `notis_klar(...)` anropas.

**Läser:** `notis_konfig` (hemlighet, avanmal_nyckel, lage).
**Skriver:** ingenting direkt — allt skulle gå via `notis_hamta` och
`notis_klar`.

**Databasobjekt den förutsätter, och som INTE finns:** tabellen
`notis_ko`, funktionerna `notis_hamta` och `notis_klar`, kolumnerna
`notis_konfig.lage` och `notis_konfig.avanmal_nyckel`, `pg_cron`.
Filhuvudet hänvisar till en migration "v26" som inte finns i någon gren.

**Miljövariabler och hemligheter:** `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTIS_LAGE`,
`NOTIS_BAS_URL`, `NOTIS_FUNKTION_URL`, `NOTIS_LOGO_URL`,
`NOTIS_FRAN_EPOST` (förval `info@nextrum.se`), `NOTIS_FRAN_NAMN`,
`NOTIS_SVARA_TILL`, `NOTIS_SANDLADA_TILL`, samt hemligheten i
`notis_konfig.hemlighet`. Vilka av dem som är satta i Supabase går inte
att läsa med de verktyg som finns.

**Mallarna** (`_delad/notiser/mallar/sv.json`) täcker tio notistyper:
`intresse_bekraftelse`, `nytt_meddelande`, `nytt_tidsforslag`,
`andrad_tid`, `bekraftad_tid`, `ny_bokning`, `avbokad`, `ny_matchning`,
`paminnelse` ("pass i morgon") och `flera` (sammanslagningen "{antal}
saker"). `rendera.ts` tar bara emot förnamn, typ, antal och länk —
aldrig brödtext. Det är en bra princip att behålla.

## notis-avanmal

**Tänkt att göra:** ta emot klicket i ett mejls avregistreringslänk och
stänga av notismejl för användaren.

**Steg för steg** (`notis-avanmal/index.ts`, `_delad/notiser/token.ts`):

1. Annat än `POST` → 405. `POST` utan token `t` → 400.
2. Läser `notis_konfig.avanmal_nyckel` med service_role. **Kolumnen
   saknas** → **503** "Tjänsten är inte konfigurerad." Bekräftat i
   postgres-loggen som `42703` 2026-09-19 23:14 UTC.
3. *Om kolumnen hade funnits:* token = user_id + HMAC-SHA256 av
   `'avanmal:' + user_id` prövas, och `rpc notis_avanmal(p_user)` anropas.

**Läser:** `notis_konfig.avanmal_nyckel`. **Skriver:** ingenting direkt.

**Saknas:** kolumnen `avanmal_nyckel`, funktionen `notis_avanmal`,
kolumnen den skulle skriva till (`notismail`), och sidan
`https://nextrum.se/avanmal` som mejlets länk pekar på (svarar 404).
Token har ingen utgångstid. Avregistreringen är **global**, inte per
notistyp.

---

## Skillnad mot repots `_delad/`

| Fil | Mot `supabase/functions/_delad/` |
|---|---|
| `http.ts`, `auth.ts`, `konstanter.ts` | identiska |
| `mejl.ts` | driftens har fältet `headers?: Record<string,string>` i typen `Mejl`, och `skickaViaResend` skickar med det. Behövs för `List-Unsubscribe`. Påverkar inga andra anrop. |
| `notis.ts` | samma kod; repots har längre kommentarer |
| `notiser/*` | finns bara här |

---

## Den vilande risken

Båda funktionerna läser kolumnerna `avanmal_nyckel` och `lage` ur
`notis_konfig`. **En framtida migration som råkar lägga till kolumner
med de namnen räcker för att de ska vakna halvvägs.** Kommer
`notis_hamta` också till och `lage` sätts till `'skicka'`, skickar
notis-ko riktiga mejl från `info@nextrum.se` med kod som inte finns i
git — och med `verify_jwt` avstängt.

Därför: **använd inte de kolumnnamnen** i notis_konfig utan att först
ha bestämt vad som ska hända med de här två funktionerna.

## Konkurrerande design

Det finns en tredje notisdesign på grenen
`origin/claude/zealous-clarke-9pggx6` (commit `5b42e61`): edge-funktionen
`notis-mejl`, `_delad/mall.ts` och en migration som skapar
`public.notiser` med fem triggrar. Inget av det finns i driften.

Det finns alltså tre vägar för notiser:

1. **De tre webhookarna som körs i dag** — `lead-notis`, `pass-notis`,
   `meddelande-notis`
2. **Kön i det här arkivet** — `notis-ko` och `notis-avanmal`
3. **`notis-mejl` med `public.notiser`** — på en egen gren

Väg 2 och 3 överlappar väg 1. Körs två samtidigt får mottagaren dubbla
mejl. **Vilken som ska gälla avgörs före Fas 2.**

## Beslut som väntar

- Vilken av de tre vägarna ska byggas vidare?
- Får `notis-ko` och `notis-avanmal` tas bort ur driften? Det bryter
  ingen befintlig mejlväg, eftersom ingenting anropar dem. Det är en
  driftändring och kräver ett uttryckligt ja. Om de tas bort ska blocken
  `[functions.notis-ko]` och `[functions.notis-avanmal]` i
  `supabase/config.toml` strykas i samma ändring.
- Ska avregistreringen gälla per notistyp eller globalt, och vilka mejl
  är transaktionella och får därför inte gå att stänga av?
