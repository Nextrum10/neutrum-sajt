# -*- coding: utf-8 -*-
"""Bygger Nextrums egna övningsblad till materialbanken.

       python3 verktyg/bygg-banken.py          # ritar bank/*.png
       python3 verktyg/bygg-banken.py --sql    # skriver raderna till biblioteksmaterial

Bladen är VÅRA. Leo bad om "offentliga uppgifter och läxor du hittar
för varje årskurs, helst skärmdumpar". Skärmdumpar av läromedel och
förlagens övningsblad är upphovsrättsskyddade, och en materialbank
full av andras sidor är en bank vi inte får dela ut. Så bladen skrivs
här, i klartext, och ritas till bilder av en webbläsare utan fönster.

Varför bilder och inte en sida på sajten: ett blad ska gå att skriva
ut, skicka i en chatt och öppna på en mobil utan inloggning. En PNG
gör allt det. Familjen öppnar den genom läxan (homework.bibliotek_id),
studiehjälparen genom biblioteket.

Varför en länk och inte hinken `bibliotek`: hinken fylls genom
adminvyn, en fil i taget. Bladen här är gemensamma, innehåller inga
personuppgifter och ska gå att bygga om när en uppgift rättas — då ska
rättelsen hamna i git, inte i en hink ingen kan diffa. De serveras
därför från sajten, under /bank/, och raden i biblioteksmaterial pekar
dit med `lank`.

INGET FACIT PÅ BLADEN, OCH INTE I BESKRIVNINGEN. nextrum-larare-vy.js
fyller läxans text med materialets beskrivning när studiehjälparen
inte skrivit något eget, och läxtexten läser eleven. Ett facit i
beskrivningen hade alltså följt med ut till barnet.

Id:t är ett uuid5 ur filnamnet, så att --sql alltid ger samma rader
och en migration kan köras om utan dubbletter.

Webbläsaren: CHROME i miljön, annars den första som hittas av
chromium, google-chrome, chromium-browser och Playwrights mapp.
Körs inte i CI — bilderna checkas in, precis som /en/-sidorna.
"""
import glob, html, os, shutil, subprocess, sys, tempfile, uuid

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UT = os.path.join(ROT, 'bank')
SAJT = 'https://nextrum.se'
# A4 i 150 dpi. Chromium utan fönster drar ändå av en ram (87 px i
# version 140) från höjden, så sidan fyller 100vh i stället för en
# fast höjd — annars klipptes foten, och bara punkten mellan två ord
# syntes. Remsan under blir vit marginal, ungefär lika hög som toppens.
BREDD, HOJD = 1240, 1754

ARSKURS_TEXT = {
    'ak1': 'Åk 1', 'ak2': 'Åk 2', 'ak3': 'Åk 3', 'ak4': 'Åk 4', 'ak5': 'Åk 5', 'ak6': 'Åk 6',
    'ak7': 'Åk 7', 'ak8': 'Åk 8', 'ak9': 'Åk 9', 'gy1': 'Gymnasiet 1', 'gy2': 'Gymnasiet 2',
    'gy3': 'Gymnasiet 3',
}

# [] blir en svarsruta, ___ en skrivrad i texten. rader = antal tomma
# skrivrader under uppgiften, ruta = en större ruta att rita i.
BLAD = [
    dict(fil='ak1-matematik-tiokamrater', arskurs='ak1', amne='Matematik',
         titel='Tiokamrater', omrade='Addition upp till 10', tid='15 minuter',
         instruktion=['Två tal som tillsammans blir 10 kallas tiokamrater.',
                      'Skriv talet som fattas i rutan.',
                      'Rita prickar eller räkna på fingrarna om du vill.'],
         uppgifter=[('7 + [] = 10', 0), ('3 + [] = 10', 0), ('[] + 5 = 10', 0),
                    ('9 + [] = 10', 0), ('[] + 4 = 10', 0), ('2 + [] = 10', 0),
                    ('6 + [] = 10', 0), ('10 = 8 + []', 0),
                    ('Hitta på en egen tiokamrat: [] + [] = 10', 0),
                    ('Rita 10 prickar. Ringa in 4 av dem. Hur många är inte inringade? []', 'ruta')],
         beskrivning='Tio uppgifter om talkamraterna till 10, med rutor att fylla i och en att rita i.'),

    dict(fil='ak2-svenska-stor-bokstav-och-punkt', arskurs='ak2', amne='Svenska',
         titel='Stor bokstav och punkt', omrade='Meningar', tid='20 minuter',
         instruktion=['En mening börjar med stor bokstav och slutar med punkt.',
                      'Namn på personer, djur och platser börjar också med stor bokstav.',
                      'Skriv av meningarna rätt på raden under.'],
         uppgifter=[('idag regnar det i malmö', 1), ('min hund heter bamse', 1),
                    ('vi ska åka till farmor på lördag', 1), ('elsa och omar spelar fotboll', 1),
                    ('jag har en röd cykel', 1),
                    ('Skriv en egen mening om vad du gjorde i helgen.', 2)],
         beskrivning='Skriv av meningar med stor bokstav och punkt, och skriv en egen.'),

    dict(fil='ak3-matematik-multiplikation', arskurs='ak3', amne='Matematik',
         titel='Multiplikation med 2, 5 och 10', omrade='Multiplikationstabellerna', tid='20 minuter',
         instruktion=['Multiplikation är upprepad addition: 3 · 5 betyder 5 + 5 + 5.',
                      'Räkna ut och skriv svaret i rutan.',
                      'På de två sista uppgifterna skriver du hur du tänkte.'],
         uppgifter=[('4 · 2 = []', 0), ('6 · 5 = []', 0), ('3 · 10 = []', 0), ('7 · 2 = []', 0),
                    ('9 · 5 = []', 0), ('8 · 10 = []', 0), ('[] · 5 = 35', 0), ('[] · 2 = 18', 0),
                    ('Ett paket har 5 kakor. Hur många kakor finns det i 6 paket?', 2),
                    ('Lisa har 4 tiokronor. Hur mycket pengar har hon?', 2)],
         beskrivning='Tabellerna 2, 5 och 10, två saknade faktorer och två textuppgifter.'),

    dict(fil='ak4-engelska-veckodagar-och-manader', arskurs='ak4', amne='Engelska',
         titel='Days of the week and months', omrade='Veckodagar och månader', tid='15 minuter',
         instruktion=['Skriv på engelska.',
                      'Veckodagar och månader börjar alltid med stor bokstav på engelska: Monday, May.'],
         uppgifter=[('måndag = ___', 0), ('onsdag = ___', 0), ('fredag = ___', 0),
                    ('söndag = ___', 0), ('Vilken dag kommer efter Tuesday? ___', 0),
                    ('Vilken månad kommer före May? ___', 0),
                    ('Skriv månaden du fyller år på engelska: ___', 0),
                    ('Fyll i: Today is ___. Tomorrow is ___.', 0)],
         beskrivning='Veckodagar och månader på engelska, åtta korta uppgifter.'),

    dict(fil='ak5-matematik-brak', arskurs='ak5', amne='Matematik',
         titel='Bråk – en del av en helhet', omrade='Bråk', tid='25 minuter',
         instruktion=['Ett bråk visar en del av något.',
                      'Nämnaren, talet under strecket, visar hur många lika stora delar helheten har.',
                      'Täljaren, talet över strecket, visar hur många av delarna vi menar.'],
         uppgifter=[('En pizza är delad i 8 lika stora bitar. Du äter 3. Hur stor del av pizzan åt du?', 1),
                    ('Vilket är störst, 1/2 eller 1/4? Förklara hur du vet.', 2),
                    ('Skriv 2/4 på ett enklare sätt.', 1),
                    ('Hur mycket är 1/3 av 12?', 1),
                    ('Hur mycket är 3/4 av 20?', 1),
                    ('Sortera från minst till störst: 3/5, 1/5, 5/5, 2/5', 1),
                    ('Rita en rektangel och färglägg 2/3 av den.', 'ruta')],
         beskrivning='Bråk som del av en helhet: jämföra, förenkla, räkna ut en del av ett tal.'),

    dict(fil='ak6-no-igelkotten-gar-i-ide', arskurs='ak6', amne='NO / Fysik / Kemi / Biologi',
         titel='Igelkotten går i ide', omrade='Djur på vintern', tid='25 minuter',
         instruktion=['Läs texten två gånger. Stryk under det du tycker är viktigast.',
                      'Svara sedan på frågorna med egna ord.'],
         text=('Igelkotten är ett av de däggdjur i Sverige som går i ide. När hösten kommer äter '
               'den mycket för att bygga upp ett lager av fett. Sedan bygger den ett bo av löv och '
               'gräs, gärna under en buske eller i en komposthög. Där sover den ungefär från '
               'november till april. Under vintern sjunker kroppstemperaturen och hjärtat slår '
               'mycket långsammare än vanligt. Då går det åt lite energi. Om igelkotten väcks för '
               'tidigt gör den av med för mycket av sitt fett och kan få svårt att klara resten av '
               'vintern. Därför ska man inte flytta på lövhögar i trädgården på vintern.'),
         uppgifter=[('Vad betyder det att ett djur går i ide? Förklara med egna ord.', 2),
                    ('Varför äter igelkotten så mycket på hösten?', 2),
                    ('Var bygger igelkotten sitt bo?', 1),
                    ('Vad händer med igelkottens kropp under vintern?', 2),
                    ('Varför ska man inte flytta på lövhögar på vintern?', 2)],
         beskrivning='Läsförståelse om hur igelkotten klarar vintern, fem frågor.'),

    dict(fil='ak7-matematik-procent', arskurs='ak7', amne='Matematik',
         titel='Procent i vardagen', omrade='Procent', tid='30 minuter',
         instruktion=['Procent betyder hundradelar: 25 % = 25/100 = 0,25.',
                      'För att räkna ut en procentsats av ett tal kan du multiplicera talet med decimalformen.',
                      'Visa hur du räknar.'],
         uppgifter=[('Skriv 40 % i decimalform.', 1), ('Skriv 0,07 i procentform.', 1),
                    ('Hur mycket är 10 % av 350 kr?', 1), ('Hur mycket är 25 % av 80?', 1),
                    ('En tröja kostar 400 kr. Priset sänks med 30 %. Vad kostar tröjan nu?', 2),
                    ('I en klass på 25 elever har 15 elever en cykel. Hur många procent har en cykel?', 2),
                    ('Ett pris höjs från 200 kr till 250 kr. Hur många procent är höjningen?', 2)],
         beskrivning='Procentform och decimalform, procent av ett tal, rabatt och höjning.'),

    dict(fil='ak8-engelska-oregelbundna-verb', arskurs='ak8', amne='Engelska',
         titel='Irregular verbs – past tense', omrade='Oregelbundna verb', tid='25 minuter',
         instruktion=['Oregelbundna verb får inte -ed i dåtid. De måste läras in.',
                      'Skriv verbet i dåtid (past tense). Fyll sedan i meningen.'],
         uppgifter=[('go → ___   Yesterday we ___ to the cinema.', 0),
                    ('eat → ___   She ___ a big breakfast this morning.', 0),
                    ('buy → ___   I ___ a new phone last week.', 0),
                    ('think → ___   We ___ the test was easy.', 0),
                    ('write → ___   He ___ a letter to his grandmother.', 0),
                    ('take → ___   They ___ the bus to school.', 0),
                    ('Skriv tre meningar på engelska om vad du gjorde i helgen. '
                     'Använd minst två oregelbundna verb.', 3)],
         beskrivning='Sex vanliga oregelbundna verb i dåtid, och tre egna meningar.'),

    dict(fil='ak9-matematik-linjara-funktioner', arskurs='ak9', amne='Matematik',
         titel='Linjära funktioner: y = kx + m', omrade='Funktioner', tid='30 minuter',
         instruktion=['I y = kx + m är k lutningen: hur mycket y ökar när x ökar med 1.',
                      'm är värdet där linjen skär y-axeln.',
                      'Visa dina uträkningar.'],
         uppgifter=[('Vad är k och m i y = 3x + 2?', 1),
                    ('Beräkna y när x = 4 i y = 2x − 5.', 1),
                    ('En linje går genom punkterna (0, 1) och (2, 7). Bestäm k.', 2),
                    ('Skriv ekvationen för linjen i uppgiften ovan.', 1),
                    ('En taxi kostar 45 kr i startavgift och 12 kr per kilometer. '
                     'Skriv en formel för priset y kr när man åker x km.', 1),
                    ('Hur långt kan man åka för 225 kr med taxin?', 2),
                    ('Rita linjen y = −x + 3 i ett koordinatsystem.', 'ruta')],
         beskrivning='Lutning och m-värde, linjen genom två punkter, en taxiformel och en graf.'),

    dict(fil='gy1-matematik-ekvationer-och-potenser', arskurs='gy1', amne='Matematik',
         titel='Ekvationer och potenser', omrade='Matematik 1', tid='35 minuter',
         instruktion=['Lös ekvationerna och förenkla uttrycken.',
                      'Redovisa varje steg – det är stegen som visar att du förstått.'],
         uppgifter=[('Lös 4x − 7 = 21.', 2), ('Lös 3(x + 2) = 2x + 11.', 2),
                    ('Lös x/5 + 3 = 7.', 2), ('Förenkla 2³ · 2⁴.', 1), ('Förenkla (5x)².', 1),
                    ('Skriv 0,00042 i grundpotensform.', 1),
                    ('En mobil kostar 6 000 kr och minskar i värde med 15 % per år. '
                     'Vad är den värd efter 2 år?', 2)],
         beskrivning='Förstagradsekvationer, potenslagar, grundpotensform och procentuell minskning.'),

    dict(fil='gy2-matematik-andragradsekvationer', arskurs='gy2', amne='Matematik',
         titel='Andragradsekvationer', omrade='Matematik 2', tid='40 minuter',
         instruktion=['En ekvation på formen x² + px + q = 0 kan lösas med pq-formeln:',
                      'x = −p/2 ± √((p/2)² − q)',
                      'Kontrollera svaren genom att sätta in dem i ekvationen.'],
         uppgifter=[('Lös x² = 49.', 1), ('Lös x² − 6x + 8 = 0.', 2), ('Lös x² + 2x − 15 = 0.', 2),
                    ('Lös 2x² − 8x − 10 = 0. Tips: dela först med 2.', 2),
                    ('Lös x(x − 4) = 0.', 1),
                    ('Har x² + 4x + 5 = 0 några reella lösningar? Motivera.', 2),
                    ('En rektangel har arean 24 cm², och den ena sidan är 2 cm längre än den andra. '
                     'Ställ upp en ekvation och bestäm sidornas längd.', 2)],
         beskrivning='pq-formeln, nollproduktmetoden, diskriminanten och en areauppgift.'),

    dict(fil='gy3-matematik-derivata', arskurs='gy3', amne='Matematik',
         titel='Derivata – grunderna', omrade='Matematik 3', tid='40 minuter',
         instruktion=['Derivatan f′(x) anger hur snabbt f(x) ändras – lutningen på kurvans tangent.',
                      'Deriveringsregeln: om f(x) = xⁿ så är f′(x) = n · xⁿ⁻¹.'],
         uppgifter=[('Derivera f(x) = x⁵.', 1), ('Derivera f(x) = 4x³ − 2x + 7.', 1),
                    ('Beräkna f′(2) om f(x) = x² + 3x.', 2),
                    ('Derivera f(x) = 6/x. Tips: skriv först om som 6x⁻¹.', 1),
                    ('Bestäm lutningen på tangenten till y = x³ i punkten där x = −1.', 2),
                    ('För vilket x har f(x) = x² − 8x + 3 en extrempunkt? Är det ett max eller ett min?', 2),
                    ('En boll kastas uppåt och har höjden h(t) = 20t − 5t² meter efter t sekunder. '
                     'Beräkna h′(1) och förklara vad svaret betyder.', 2)],
         beskrivning='Deriveringsregler, tangentens lutning, extrempunkt och en tillämpning.'),
]


def blad_id(b):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, SAJT + '/bank/' + b['fil'] + '.png'))


def fyll(text):
    """[] blir en ruta och ___ en skrivrad. Allt annat escapas."""
    ut = html.escape(text)
    ut = ut.replace('[]', '<span class="ruta"></span>')
    return ut.replace('___', '<span class="linje"></span>')


def sida(b):
    typsnitt = 'file://' + os.path.join(ROT, 'typsnitt')
    uppg = []
    for i, (text, extra) in enumerate(b['uppgifter'], 1):
        under = ''
        if extra == 'ruta':
            under = '<div class="rit"></div>'
        elif extra:
            under = ''.join('<div class="rad"></div>' for _ in range(extra))
        uppg.append('<li><span class="nr">%d</span><div><p>%s</p>%s</div></li>' % (i, fyll(text), under))
    lastext = ('<div class="lastext">%s</div>' % html.escape(b['text'])) if b.get('text') else ''
    return """<!doctype html><html lang="sv"><head><meta charset="utf-8">
<style>
@font-face{font-family:'Schibsted Grotesk';font-weight:400 800;src:url(%(t)s/schibsted-grotesk-latin.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:400;src:url(%(t)s/ibm-plex-mono-latin.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:500;src:url(%(t)s/ibm-plex-mono-500-latin.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:%(w)dpx;height:100vh;background:#fff}
body{font-family:'Schibsted Grotesk',system-ui,sans-serif;color:#2E2A20;padding:84px 96px 8px;
  display:flex;flex-direction:column}
.topp{display:flex;justify-content:space-between;align-items:center;padding-bottom:22px;border-bottom:2px solid #2E2A20}
.marke{display:flex;align-items:center;gap:14px;font-weight:800;font-size:26px;letter-spacing:.02em}
.marke i{display:grid;place-items:center;width:44px;height:44px;border-radius:10px;background:#2E2A20;color:#EFE6D6;
  font-style:normal;font-size:26px}
.marke span{font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:15px;letter-spacing:.14em;color:#665C49;
  text-transform:uppercase;margin-left:6px}
.chips{display:flex;gap:10px}
.chip{border:1.5px solid #2E2A20;border-radius:99px;padding:7px 16px;font-size:18px;font-weight:600}
.chip.ak{background:#9C4520;border-color:#9C4520;color:#fff}
h1{font-size:54px;line-height:1.05;letter-spacing:-.03em;font-weight:800;margin:40px 0 10px}
.meta{font-family:'IBM Plex Mono',monospace;font-size:16px;letter-spacing:.08em;color:#665C49;text-transform:uppercase}
.namn{display:flex;gap:28px;margin:26px 0 0;font-size:19px;color:#4F4738}
.namn span{flex:1;border-bottom:1.5px solid #C9B492;padding-bottom:4px}
.instr{margin:30px 0 8px;background:#EFE6D6;border-radius:18px;padding:22px 28px}
.instr b{display:block;font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:14px;letter-spacing:.14em;
  text-transform:uppercase;color:#9C4520;margin-bottom:8px}
.instr p{font-size:21px;line-height:1.5}
.lastext{margin:22px 0 4px;font-size:20.5px;line-height:1.62;border-left:4px solid #9C4520;padding:4px 0 4px 22px}
ol{list-style:none;margin-top:22px;display:flex;flex-direction:column;gap:20px;flex:1}
li{display:flex;gap:18px;align-items:flex-start}
.nr{flex:none;width:36px;height:36px;border-radius:50%%;border:1.5px solid #2E2A20;display:grid;place-items:center;
  font-weight:700;font-size:18px;margin-top:1px}
li div{flex:1}
li p{font-size:23px;line-height:1.45}
.ruta{display:inline-block;width:62px;height:40px;border:2px solid #2E2A20;border-radius:8px;vertical-align:middle;margin:0 4px}
.linje{display:inline-block;width:170px;border-bottom:2px solid #2E2A20;height:26px;vertical-align:baseline;margin:0 4px}
.rad{height:46px;border-bottom:1.5px solid #C9B492}
.rit{height:250px;margin-top:10px;border:1.5px dashed #C9B492;border-radius:12px;
  background-image:linear-gradient(#EFE6D6 1px,transparent 1px),linear-gradient(90deg,#EFE6D6 1px,transparent 1px);
  background-size:31px 31px}
.fot{margin-top:24px;padding-top:16px;border-top:1.5px solid #DDCDB2;display:flex;justify-content:space-between;
  font-family:'IBM Plex Mono',monospace;font-size:14px;letter-spacing:.06em;color:#665C49}
</style></head><body>
<div class="topp"><div class="marke"><i>N</i>NEXTRUM<span>Övningsblad</span></div>
<div class="chips"><span class="chip">%(amne)s</span><span class="chip ak">%(ak)s</span></div></div>
<h1>%(titel)s</h1>
<div class="meta">%(omrade)s · ca %(tid)s</div>
<div class="namn"><span>Namn:</span><span>Datum:</span></div>
<div class="instr"><b>Så gör du</b>%(instr)s</div>
%(lastext)s
<ol>%(uppg)s</ol>
<div class="fot"><span>nextrum.se · Nextrums materialbank</span><span>Får skrivas ut och kopieras för eget bruk</span></div>
</body></html>""" % dict(
        t=typsnitt, w=BREDD, amne=html.escape(b['amne'].split(' / ')[0] if b['amne'].startswith('NO') else b['amne']),
        ak=ARSKURS_TEXT[b['arskurs']], titel=html.escape(b['titel']), omrade=html.escape(b['omrade']),
        tid=html.escape(b['tid']), instr=''.join('<p>%s</p>' % fyll(r) for r in b['instruktion']),
        lastext=lastext, uppg=''.join(uppg))


def hitta_chrome():
    if os.environ.get('CHROME'):
        return os.environ['CHROME']
    for namn in ('chromium', 'google-chrome', 'chromium-browser'):
        p = shutil.which(namn)
        if p:
            return p
    kandidater = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'))
    return kandidater[-1] if kandidater else None


def rita():
    chrome = hitta_chrome()
    if not chrome:
        print('Hittar ingen Chromium. Sätt CHROME=/sökväg/till/chrome.')
        return 1
    os.makedirs(UT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for b in BLAD:
            kalla = os.path.join(tmp, b['fil'] + '.html')
            with open(kalla, 'w', encoding='utf-8') as f:
                f.write(sida(b))
            mal = os.path.join(UT, b['fil'] + '.png')
            subprocess.run([chrome, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                            '--force-device-scale-factor=1', '--window-size=%d,%d' % (BREDD, HOJD),
                            '--screenshot=' + mal, 'file://' + kalla],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print('ok   bank/%s.png' % b['fil'])
    return 0


def sql():
    def q(v):
        return "'" + v.replace("'", "''") + "'"
    rader = []
    for b in BLAD:
        rader.append('  (%s, %s, %s, %s, %s, %s)' % (
            q(blad_id(b)), q(b['titel']), q(b['beskrivning']), q(b['amne']), q(b['arskurs']),
            q(SAJT + '/bank/' + b['fil'] + '.png')))
    print('insert into public.biblioteksmaterial (id, titel, beskrivning, amne, arskurs, lank) values')
    print(',\n'.join(rader))
    print('on conflict (id) do nothing;')
    return 0


if __name__ == '__main__':
    sys.exit(sql() if '--sql' in sys.argv else rita())
