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

## Varför den inte är gjord

Higgsfield-kontot står på **fri plan med 1,76 krediter**. En femsekunders
klipp kostar:

| Modell | Krediter |
|---|---|
| Seedance 2.5, 720p, 5 s | 32,5 |
| Kling 3.0 Turbo, 720p, 5 s (billigast användbara) | 7,5 |

Det räcker alltså inte till ett enda försök, och ett försök räcker sällan.
Räkna med tre till fem för att få ett klipp som tål att loopa.

## Så gör du den när krediterna finns

Utgå från `bilder/hero-nextrum.jpg` — det är samma foto blocket visar nu,
så bytet blir sömlöst i stället för ett hopp till ett annat motiv.

1. Ladda upp bilden och använd den som **startbild** (`start_image`).
2. Modell: `seedance_2_5`, 16:9, 5–8 sekunder, 1080p.
3. Prompt, ungefär:

   > Slow, gentle push-in. A tutor sits beside a teenage student at a
   > kitchen table, pointing at a notebook and explaining something. The
   > student nods and writes. Warm afternoon light from a window on the
   > left. Natural, unhurried movement. No camera shake, no cuts.

4. `generate_audio: false`. Videon är dekor bakom text, den är ljudlös
   och `aria-hidden`.

### Tre saker som gör eller förstör den

- **Den loopar.** Slutet måste kunna följa på början utan ett synligt
  hopp. En långsam inzoomning gör det bättre än en panorering.
- **Vänstra tredjedelen ska vara lugn.** Där står hälsningen och korten.
  Händer allt intressant där blir texten oläsbar.
- **Håll den kort och lätt.** Under 3 MB. Den laddas av varje inloggad
  person vid varje besök, ofta på mobil, och blocket ska stå färdigt
  innan någon hinner scrolla förbi det.

Komprimera innan den läggs in:

```
ffmpeg -i rå.mp4 -an -vf "scale=1600:-2" -c:v libx264 -crf 30 -preset slow \
       -movflags +faststart bilder/hero-studievy.mp4
```

`-an` tar bort ljudspåret helt, `+faststart` lägger metadatan först så att
uppspelningen kan börja innan hela filen laddats.
