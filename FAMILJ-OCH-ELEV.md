# Familj och elev: varför datamodellen har båda

*Program 2, Fas 1, punkt 7. Kontrollerat mot driften 2026-09-21.*

Leos gissning var: föräldern betalar och är kontaktperson, eleven är
ofta minderårig, och en familj kan ha flera barn. **Det stämmer, med
ett förbehåll om åldern.** Nedan står vad schemat faktiskt säger, var
gränssnittet blandar ihop begreppen, vad som rättats i Fas 1 och vad
som väntar på ett beslut.

## Två saker, två tabeller

| | Familj | Elev |
|---|---|---|
| Tabell | `profiles` med `role = 'parent'` | `students` |
| Loggar in | ja, det är kontot | nej, har ingen koppling till Auth |
| Kontaktuppgifter | e-post, telefon | inga |
| Betalar | ja: `invoices.parent_id`, en faktura per familj och månad oavsett antal barn | nej |
| Är kund | ja: `uppdrag.kund_id`, `leads.kund_id`, `bookings.parent_id` | nej |
| Matchas | nej (se nedan) | **ja**: `students.matched_tutor_id` + `match_status` |
| Bär det pedagogiska | nej | ja: rapporter, studieplan, läxor, material, utveckling, uppdrag |
| Meddelanden | ja: en tråd är familj och studiehjälpare, inget `student_id` | nej |

**Familjen är den som betalar, tar kontakt och har kontot. Eleven är
den som får hjälpen.** Allt pedagogiskt och själva matchningen hänger
på eleven; allt som rör pengar och kontakt hänger på familjen.

### Stämmer gissningen?

- **Föräldern betalar:** ja. Fakturan är per familj (`UNIQUE(parent_id, period)`).
- **Föräldern är kontaktperson:** ja. Bara `profiles` har e-post och
  telefon, och alla aviseringar går dit.
- **En familj kan ha flera barn:** ja i schemat (`students.parent_id`
  är ett till många, och `bookings.antal_barn` finns). I driften har
  ingen familj fler än ett barn än.
- **Eleven är ofta minderårig:** går inte att belägga. `students` har
  ingen ålder. Årskurserna går från åk 1 till gymnasiet år 3, så en
  del elever är myndiga. En myndig elev kan i dag vara sin egen
  "familj": hen registrerar sig och lägger in sig själv som barn.

**Slutsats: modellen är rätt och ska inte slås ihop.** En sammanslagning
skulle antingen ge barn inloggningar och kontaktuppgifter som de inte
ska ha, eller tvinga syskon att dela rapporter och matchning.

## Kvarlevan som förvirrar: `profiles.matched_tutor_id`

Före v14 matchades familjen. Sedan v14 matchas varje elev, och
familjens `matched_tutor_id` är en härledd kopia som triggern
`synka_familjens_match` sätter till studiehjälparen för det **äldsta**
matchade barnet. Kopian används fortfarande på några ställen, och det
är där syskon med olika studiehjälpare går sönder:

| Vad | Läser | Följd med syskon hos olika studiehjälpare |
|---|---|---|
| Familjens chatt | `ar_matchade`, studievyn | bara tråden till det äldsta barnets studiehjälpare |
| Studiehjälparens läsning av familjens profil | policyn "lärare läser sina matchade föräldrars profiler" | den andra studiehjälparen ser inte familjens kontaktuppgifter |
| Studievyns kort, bokning och flytt | `S.profil.matched_tutor_id` | allt pekar på det äldsta barnets studiehjälpare |

I driften finns i dag noll familjer med syskon hos olika
studiehjälpare, så felet har inte slagit till.

## Rättat i Fas 1

- **Studiehjälparen ser bara sina egna elever** (migration 1.6).
  Integritetspolicyn lovade det, men policyn på `students` släppte
  igenom hela familjen så fort ett barn var matchat. Samma sak för
  `uppdrag`.
- **Bara en godkänd studiehjälpare kan matchas** (1.5), och **ett pass
  gäller alltid en elev, och rapporten gäller passets elev** (1.4).
- **Adminvyn räknar per elev:** familjefiltret och talet "Elever" i
  studiehjälparlistan räknas ur barnen, inte ur familjens kopia.
- **Inaktuella texter rättade:** "Matchningen görs här" i Familjer
  (matchningen görs per elev under Matchning), "Familjen lägger till
  dem i studievyn" (studievyn är låst tills ett barn är matchat), och
  studiehjälparvyns texter om att familjen lägger in sitt barn efter
  matchningen.
- **Admin kan lägga till barn** direkt i familjepanelen, och skapa en
  familj utan en intresseanmälan. En familj som registrerat sig själv
  fastnade förut: vyn var låst tills ett barn var matchat, och ett barn
  gick bara att lägga in från den låsta vyn.

## Förslag som kräver ett beslut

1. **Syskon med olika studiehjälpare.** Ska det gå? Om ja: studievyn
   följer det valda barnets studiehjälpare (kort, chatt, bokning), och
   `ar_matchade` och profilpolicyn läser per elev. Det är det enda som
   löser syskonfallet, och det förutsätter att `profiles.matched_tutor_id`
   till sist tas bort.
2. **Admin: Familjer, Elever och Uppdrag som tre listor.** Så länge
   varje familj har ett barn är relationen ett till ett till ett. Ett
   förslag är en kundlista där familjen är raden och barnen står under,
   med Elever kvar som arbetslista för matchningen.
3. **En myndig elev som egen kund.** Vad ska kontosidan och anmälan
   säga? I dag står det "Förälder eller elev" på ett ställe och
   "föräldrakonto" på ett annat.
4. **Ett pausat barn.** Om familjens enda barn pausas låses hela
   studievyn med "Vi jobbar på er matchning". Ska den i stället visa
   historiken?
5. **Studievyns tilltal.** Rubrikerna är skrivna som om eleven vore
   inloggad ("Mina lektioner", "Min utveckling"), fast kontot är
   förälderns. Fas 1 behåller "Mina lektioner" eftersom punkt 3 i
   programmet använder just det namnet.
6. **Syskon i samma pass** (`antal_barn` > 1) sparas på ett barn. Ska
   passet visa "Alva och ett syskon"?
