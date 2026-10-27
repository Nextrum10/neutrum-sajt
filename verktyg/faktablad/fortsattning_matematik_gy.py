# -*- coding: utf-8 -*-
"""Faktabladen för de nya områdena i gymnasiematten (2026-10-27), ett per område i
verktyg/uppgiftsbanken/fortsattning_matematik_gy.py:

    gy1   Tal i grundpotensform, Trigonometri i rätvinkliga trianglar, Vektorer
    gy2   Räta linjens ekvation, Rotekvationer, Logik och bevis
    gy3   Rationella uttryck, Gränsvärden och derivatans definition, Triangelsatserna

Skrivna efter vad nivåerna faktiskt övar, och exemplen tar andra tal än
frågorna. Talen i exemplen räknas om nedan, så att ett blad aldrig visar en
räkning som inte stämmer.
"""
import math
from fractions import Fraction as F

from fakta import blad

# ---- exemplen, uträknade
assert F('7.2') / 10 ** 3 == F('0.0072')
assert F('2.5') * 10 ** 3 * 4 * F(1, 10 ** 5) == F(1, 10)
assert round(20 * math.cos(math.radians(50)), 1) == 12.9
assert (2 * 2 - (-3), 2 * -1 - 5) == (7, -7) and round(math.sqrt(7 ** 2 + 7 ** 2), 1) == 9.9
assert F(-2, 3) * F(3, 2) == -1 and 4 - F(3, 2) * 1 == F(5, 2)            # y − 4 = 1,5(x − 1) ger m = 2,5
assert all(2 * x + 3 * (F(-2, 3) * x + 2) - 6 == 0 for x in range(-3, 4))   # 2x + 3y − 6 = 0 är y = −2x/3 + 2
assert [x for x in (6, -1) if x + 10 >= 0 and x - 2 >= 0 and (x - 2) ** 2 == x + 10] == [6]
assert all(x * x - 5 * x - 6 == (x - 6) * (x + 1) for x in range(-5, 6))
assert all(2 * m + (2 * n + 1) == 2 * (m + n) + 1 for m in range(-3, 4) for n in range(-3, 4))
assert all(F(x * x - 6 * x, x * x - 36) == F(x, x + 6) for x in range(-20, 21) if x not in (6, -6))
assert all((2 * (1 + h) ** 2 - 2) / h == 4 + 2 * h for h in (F(1), F(1, 3), F(-2)))
assert round(math.degrees(math.acos((16 + 25 - 36) / 40)), 1) == 82.8 and F(16 + 25 - 36, 40) == F(1, 8)

FAKTABLAD = [
    # ------------------------------------------------------------------
    # Matematik gy1
    # ------------------------------------------------------------------
    blad('Matematik', 'gy1', 'Tal i grundpotensform',
         mal=['Skriva stora och små tal i grundpotensform och tillbaka till vanliga tal.',
              'Känna igen prefixen från giga till nano.',
              'Multiplicera och dividera tal i grundpotensform och skriva svaret i grundpotensform.'],
         fakta=['10ⁿ är en etta följd av n nollor, och 10⁻ⁿ = 1/10ⁿ. Till exempel är 10⁻² = 0,01.',
                'Grundpotensform är a · 10ⁿ, där a är minst 1 och mindre än 10. Till exempel är '
                '3 400 = 3,4 · 10³.',
                'Vid multiplikation adderas exponenterna: 10ᵐ · 10ⁿ = 10ᵐ⁺ⁿ. Vid division subtraheras de: '
                '10ᵐ / 10ⁿ = 10ᵐ⁻ⁿ.',
                'Prefix: giga 10⁹, mega 10⁶, kilo 10³, milli 10⁻³, mikro (µ) 10⁻⁶ och nano 10⁻⁹.'],
         exempel=[('Skriv 0,0072 i grundpotensform.',
                   'Kommat flyttas tre steg åt höger till 7,2, och det är att multiplicera med 10³. För att talet '
                   'ska vara lika stort som förut blir det 7,2 · 10⁻³.'),
                  ('Beräkna (2,5 · 10³) · (4 · 10⁻⁵).',
                   '2,5 · 4 = 10 och 10³ · 10⁻⁵ = 10⁻². Det ger 10 · 10⁻² = 1 · 10⁻¹, alltså 0,1.')],
         ord=[('grundpotensform', 'ett tal skrivet som a · 10ⁿ, där a är minst 1 och mindre än 10'),
              ('exponent', 'talet n i 10ⁿ, som säger hur många steg kommat flyttas')],
         tips='Ett tal mellan 0 och 1 får en negativ exponent, och ett tal som är 10 eller större får en positiv.'),

    blad('Matematik', 'gy1', 'Trigonometri i rätvinkliga trianglar',
         mal=['Ställa upp sinus, cosinus och tangens för en spetsig vinkel i en rätvinklig triangel.',
              'Räkna ut en okänd sida när du vet en vinkel och en sida.',
              'Räkna ut en vinkel när du vet två sidor.'],
         fakta=['Hypotenusan står mitt emot den räta vinkeln och är den längsta sidan. Kateterna bildar den räta '
                'vinkeln.',
                'sin v = motstående katet / hypotenusa och cos v = närliggande katet / hypotenusa.',
                'tan v = motstående katet / närliggande katet.',
                'Vinkeln får du med räknarens sin⁻¹, cos⁻¹ eller tan⁻¹. Räknaren ska stå i grader.'],
         exempel=[('En rätvinklig triangel har hypotenusan 20 cm och en vinkel v = 50°. Hur lång är kateten '
                   'intill v?',
                   'cos 50° = x/20, så x = 20 · cos 50° ≈ 20 · 0,643 ≈ 12,9 cm.')],
         ord=[('katet', 'en av de två sidorna som bildar den räta vinkeln'),
              ('hypotenusa', 'den längsta sidan, mitt emot den räta vinkeln')],
         tips='Markera först vilka sidor som är motstående, närliggande och hypotenusa, sett från den vinkel du '
              'räknar med.'),

    blad('Matematik', 'gy1', 'Vektorer',
         mal=['Addera och subtrahera vektorer i koordinatform.',
              'Multiplicera en vektor med ett tal och känna igen parallella vektorer.',
              'Räkna ut en vektors längd och vektorn mellan två punkter.'],
         fakta=['En vektor har en storlek och en riktning. I koordinatform skrivs den till exempel u = (3, −2).',
                'Addition och subtraktion görs koordinat för koordinat: (a, b) + (c, d) = (a + c, b + d).',
                'k · (a, b) = (ka, kb). Två vektorer är parallella om den ena är ett tal gånger den andra.',
                'Längden är |(a, b)| = √(a² + b²). Vektorn från punkten A till punkten B är B − A.'],
         exempel=[('u = (2, −1) och v = (−3, 5). Beräkna 2u − v och dess längd.',
                   '2u = (4, −2), och 2u − v = (4 − (−3), −2 − 5) = (7, −7). Längden är √(49 + 49) = √98 ≈ 9,9.')],
         ord=[('vektor', 'en storhet med både storlek och riktning, som ritas som en pil'),
              ('skalär', 'ett vanligt tal, som en vektor kan multipliceras med')],
         tips='Vektorn från A till B är alltid slutpunkten minus startpunkten, aldrig tvärtom.'),

    # ------------------------------------------------------------------
    # Matematik gy2
    # ------------------------------------------------------------------
    blad('Matematik', 'gy2', 'Räta linjens ekvation',
         mal=['Växla mellan k-form, enpunktsform och allmän form.',
              'Läsa av lutningen och var linjen skär axlarna.',
              'Känna igen och ta fram parallella och vinkelräta linjer.'],
         fakta=['k-form: y = kx + m, där k är lutningen och m är y-värdet där linjen skär y-axeln.',
                'Enpunktsform: y − y₁ = k(x − x₁) är linjen med lutningen k genom punkten (x₁, y₁).',
                'Allmän form: ax + by + c = 0. Lös ut y för att få k och m.',
                'Parallella linjer har samma lutning. Vinkelräta linjer har k₁ · k₂ = −1.',
                'En lodrät linje x = a har ingen lutning och kan inte skrivas på k-form.'],
         exempel=[('Ta fram linjen genom (1, 4) som är vinkelrät mot 2x + 3y − 6 = 0.',
                   'Den givna linjen är y = −2x/3 + 2, med k₁ = −2/3. Då är k₂ = 3/2, för (−2/3) · (3/2) = −1. '
                   'Enpunktsformen ger y − 4 = 1,5(x − 1), alltså y = 1,5x + 2,5.')],
         ord=[('lutning', 'hur mycket y ändras när x ökar med 1'),
              ('vinkelräta', 'linjer som möts i rät vinkel, 90°')],
         tips='Den vinkelräta lutningen får du genom att vända bråket och byta tecken: 2/3 blir −3/2.'),

    blad('Matematik', 'gy2', 'Rotekvationer',
         mal=['Lösa rotekvationer genom att få roten ensam och kvadrera båda leden.',
              'Pröva lösningarna och stryka falska rötter.',
              'Lösa rotekvationer som leder till andragradsekvationer.'],
         fakta=['√x är det tal som inte är negativt och som blir x i kvadrat. Därför saknar √x = −2 lösning.',
                'Få roten ensam i ena ledet och kvadrera sedan båda leden: (√(x + 1))² = x + 1.',
                'Kvadrering kan ge falska rötter: lösningar som inte stämmer i den ursprungliga ekvationen.',
                'Pröva därför alltid varje lösning i den ursprungliga ekvationen.'],
         exempel=[('Lös ekvationen √(x + 10) = x − 2.',
                   'Kvadrera: x + 10 = x² − 4x + 4, så x² − 5x − 6 = 0 och x = 6 eller x = −1. Pröva: √16 = 4 = '
                   '6 − 2 stämmer. √9 = 3 men −1 − 2 = −3, så x = −1 är falsk. Svaret är x = 6.')],
         ord=[('falsk rot', 'en lösning som kvadreringen gav men som inte stämmer i den ursprungliga ekvationen')],
         tips='Kvadrera aldrig ett led med flera termer innan roten står ensam: (√x + 3)² är inte x + 9.'),

    blad('Matematik', 'gy2', 'Logik och bevis',
         mal=['Använda implikation (⇒) och ekvivalens (⇔) mellan påståenden.',
              'Visa att ett påstående är falskt med ett motexempel.',
              'Följa och skriva enkla bevis med jämna och udda tal.'],
         fakta=['p ⇒ q betyder att q är sant när p är sant. p ⇔ q betyder att det gäller åt båda hållen.',
                'Omvändningen till ”om p, så q” är ”om q, så p”. Den kan vara falsk fast påståendet är sant.',
                'Ett motexempel räcker för att visa att ett påstående om alla tal är falskt. Exempel räcker '
                'aldrig som bevis för att något gäller för alla tal.',
                'Med ett heltal n är 2n ett jämnt tal och 2n + 1 ett udda tal.'],
         exempel=[('Visa att summan av ett jämnt och ett udda tal är udda.',
                   'Skriv talen 2m och 2n + 1, där m och n är heltal. Summan är 2m + 2n + 1 = 2(m + n) + 1. Det '
                   'är 2 gånger ett heltal plus 1, alltså ett udda tal.')],
         ord=[('implikation', 'ett ”om … så”-samband, med pilen ⇒'),
              ('ekvivalens', 'ett samband som gäller åt båda hållen, med pilen ⇔'),
              ('motexempel', 'ett exempel som visar att ett påstående inte alltid gäller')],
         tips='Fråga dig om pilen också gäller baklänges. Gör den inte det är det en implikation, inte en '
              'ekvivalens.'),

    # ------------------------------------------------------------------
    # Matematik gy3
    # ------------------------------------------------------------------
    blad('Matematik', 'gy3', 'Rationella uttryck',
         mal=['Faktorisera täljare och nämnare och förkorta rationella uttryck.',
              'Avgöra för vilka x ett rationellt uttryck inte är definierat.',
              'Addera, subtrahera och multiplicera rationella uttryck.'],
         fakta=['Ett rationellt uttryck är ett bråk med polynom i täljare och nämnare. Det är inte definierat '
                'där nämnaren är 0.',
                'Man får förkorta med en faktor, men aldrig stryka en term: (x + 3)/x är inte 3.',
                'Konjugatregeln a² − b² = (a + b)(a − b) och kvadreringsreglerna hjälper dig att faktorisera.',
                'Addera och subtrahera med gemensam nämnare, som med vanliga bråk.'],
         exempel=[('Förenkla (x² − 6x)/(x² − 36), där x ≠ 6 och x ≠ −6.',
                   'Faktorisera: x(x − 6)/((x + 6)(x − 6)). Förkorta med x − 6, och svaret är x/(x + 6).')],
         ord=[('faktor', 'en del som multipliceras, som x och x − 6 i x(x − 6)'),
              ('term', 'en del som adderas eller subtraheras, som x² och −6x i x² − 6x')],
         tips='Faktorisera först och förkorta sedan. Finns ingen gemensam faktor går uttrycket inte att förkorta.'),

    blad('Matematik', 'gy3', 'Gränsvärden och derivatans definition',
         mal=['Räkna ut ändringskvoter och tolka dem som en sekants lutning.',
              'Bestämma gränsvärden, också när x växer mot oändligheten.',
              'Använda derivatans definition för att bestämma f′(a).'],
         fakta=['Ändringskvoten Δy/Δx = (f(b) − f(a))/(b − a) är lutningen på sekanten mellan två punkter på '
                'grafen.',
                'Ett gränsvärde är det värde uttrycket närmar sig. Ger insättning 0/0 ska du förenkla först.',
                'När x → ∞ går 1/x mot 0.',
                'Derivatans definition: f′(a) är gränsvärdet av (f(a + h) − f(a))/h när h → 0.'],
         exempel=[('Bestäm f′(1) för f(x) = 2x² med derivatans definition.',
                   'f(1 + h) − f(1) = 2(1 + 2h + h²) − 2 = 4h + 2h². Delat med h blir det 4 + 2h, och när h → 0 '
                   'går det mot 4. Alltså är f′(1) = 4.')],
         ord=[('sekant', 'en rät linje genom två punkter på en kurva'),
              ('tangent', 'en rät linje som nuddar kurvan i en punkt och har samma lutning som kurvan där')],
         tips='Sätt inte in h = 0 för tidigt: förkorta bort h först, och låt sedan h gå mot 0.'),

    blad('Matematik', 'gy3', 'Triangelsatserna',
         mal=['Räkna ut arean av en triangel med areasatsen.',
              'Räkna ut sidor och vinklar med sinussatsen och cosinussatsen.',
              'Välja rätt sats efter det du vet om triangeln.'],
         fakta=['Areasatsen: T = (a · b · sin C)/2, där C är vinkeln mellan sidorna a och b.',
                'Sinussatsen: sin A/a = sin B/b = sin C/c. Den används när du vet en sida och vinkeln mitt emot '
                'den.',
                'Cosinussatsen: c² = a² + b² − 2ab · cos C. Den används med två sidor och vinkeln mellan dem, '
                'eller med tre sidor.',
                'sin v = sin(180° − v), så sinussatsen kan ge två vinklar som passar.'],
         exempel=[('En triangel har sidorna 4 cm, 5 cm och 6 cm. Hur stor är vinkeln mitt emot sidan 6 cm?',
                   'Cosinussatsen: 36 = 16 + 25 − 40 · cos C, så cos C = 5/40 = 0,125 och C ≈ 82,8°.')],
         ord=[('motstående vinkel', 'vinkeln mitt emot en sida: sidan a står mitt emot vinkeln A')],
         tips='Vet du en sida och vinkeln mitt emot den, använd sinussatsen. Annars är det oftast cosinussatsen.'),
]
