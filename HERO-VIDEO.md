# Hero-videon i de inloggade vyerna

Studievyn, studiehjälparvyn och adminvyn letar alla efter samma fil:

```
bilder/hero-studievy.mp4
```

**Filen finns inte än.** Tills den gör det visar blocket `bilder/hero-nextrum.jpg`
med en långsam drift över fyrtio sekunder, så att ytan lever ändå. Läggs
filen dit tonas videon in i samma sekund den börjar spela — ingen kod
behöver ändras, ingen inställning slås på.

Så här är det byggt (`NXArbete.hero` i `nextrum-arbetsyta.js`):

- Bilden ligger alltid där, som ett eget `<img>`.
- Videon ligger ovanpå, med `opacity: 0`.
- Först när den skickar `playing` får den klassen `spelar` och tonas in.

Saknas filen, går den inte att avkoda, eller blockerar webbläsaren
autoplay — då händer ingenting alls. Bilden står kvar. Det är inget
fallback att felsöka, bara två lager där det översta råkar vara tomt.

---

## Klippet är gjort — det ligger bara inte i repot än

Genererat 10 september 2026 med **Seedance 2.0**, 8 sekunder, 1280x720,
utan ljud, med `bilder/hero-nextrum-1920.jpg` som startbild. Kostade 36
krediter.

**Adress:**

```
https://d8j0ntlcm91z4.cloudfront.net/user_3J8MIQmxILCJh11pLXUSkMe4fKw/hf_20260910_203944_b4034a63-ee02-4718-b0cd-a59f82034a7f.mp4
```

Hämta och komprimera den med skriptet:

```
./verktyg/hamta-hero-video.sh <adressen ovan>
```

Det lägger den på `bilder/hero-studievy.mp4`, och vyerna börjar spela den
utan att en rad kod ändras.

### Varför den inte redan ligger där

Utvecklingsmiljön som genererade klippet får inte hämta hem det.
`d8j0ntlcm91z4.cloudfront.net` är blockerad av organisationens
nätverkspolicy — filen finns hos Higgsfield, men inte i containern. Antingen
kör ni skriptet lokalt, eller så släpper en administratör fram den värden.

### Prompten som användes

> Locked-off camera. No zoom, no pan, no dolly — the framing stays exactly
> as in the reference image from first frame to last. A young male tutor in
> a cream sweater sits at a light wood table next to a teenage girl in a
> white t-shirt. He points at the open notebook with his pen and quietly
> explains something; she listens, nods slightly, looks down and writes on
> her paper. Only small natural movements: a slight lean forward, a turn of
> the head, a hand moving the pen across the page, a calm blink. Soft
> daylight from the window on the right stays constant and unchanged. The
> empty pale grey wall filling the left third of the frame remains
> completely still and uncluttered. Warm, calm, unhurried documentary
> feeling. No cuts, no camera shake, no new objects or people entering the
> frame, no text.

Två saker i den är inte utsmyckning. **Låst kamera** gör loopen osynlig: en
inzoomning slutar i en annan bildutsnitt än den började i, och skarven syns
varje varv. **Tom vägg till vänster** är där hälsningen står — händer det
något där blir texten oläslig.

### Om ni gör om den

| Modell | Inställning | Krediter |
|---|---|---|
| Seedance 2.0 | 8 s, 720p, std | 36 |
| Seedance 2.0 | 5 s, 1080p, std | 45 |
| Seedance 2.0 | 8 s, 1080p, std | 72 |

De fria "unlimited"-generationerna **gäller inte** Seedance 2.0. Servern
svarar `Unlimited generations aren't supported for seedance_2_0`. Modellen
står som `supports_unlim: true` i katalogen ändå — lita på felmeddelandet,
inte på flaggan.

### Recept, om ni gör om den

1. Startbild: `bilder/hero-nextrum-1920.jpg`. Samma foto som blocket visar
   när videon saknas, så bytet blir sömlöst i stället för ett hopp till ett
   annat motiv.
2. Modell `seedance_2_0`, 16:9, 8 sekunder, 720p, `mode: std`.
3. `generate_audio: false`. Videon är dekor bakom text, den spelas muted
   och har `aria-hidden` — ett ljudspår ingen hör är bara vikt.
4. Håll filen under 3 MB. Den laddas av varje inloggad person vid varje
   besök, ofta på mobil, och blocket ska stå färdigt innan någon hinner
   scrolla förbi det.

Komprimeringen sköts av `verktyg/hamta-hero-video.sh`. Flaggorna står
kommenterade där, en och en — de har alla ett skäl, och en ffmpeg-rad man
klistrar in ur ett chattfönster blir förr eller senare fel.

En sista sak: Higgsfield föreslår gärna ett färdigt preset i stället för
prompten. På den här fick vi "IN THE DARK", vilket är ungefär motsatsen
till en ljus, lugn scen. Avböj det och kör prompten som den står.
