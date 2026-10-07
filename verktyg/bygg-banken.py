# -*- coding: utf-8 -*-
"""Bygger Nextrums egna övningsblad till materialbanken.

       python3 verktyg/bygg-banken.py                 # ritar alla bank/*.png
       python3 verktyg/bygg-banken.py ak4- gy2-       # ritar bara blad vars filnamn innehåller något av dem
       python3 verktyg/bygg-banken.py --sql           # skriver raderna till biblioteksmaterial
       python3 verktyg/bygg-banken.py --sql ak4-      # bara de raderna: en ny migration tar bara de nya bladen
       python3 verktyg/bygg-banken.py --facit         # ritar facit, bank/facit/*.png (också med mönster)
       python3 verktyg/bygg-banken.py --kolla         # varje blad har en bild, ett facit och en rad i en migration

Bladen står i verktyg/bladen/ (en modul per stadium, figurer i figurer.py). Verktyget
mäter varje sida innan den ritas och vägrar ett blad som inte ryms.

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

FACIT FINNS, PÅ EN EGEN SIDA (Fas 15.9). Leo: "att det finns svar till
uppgifterna lättillgängligt". Varje blad har ett facit i
verktyg/bladen/facit_<modul>.py, ett svar per uppgift, ritat till
bank/facit/<fil>.png. Studiehjälparen och admin når det med knappen
Facit i biblioteket och på uppgiftsraden (NX.facitLänk); familjens och
barnets vy visar det aldrig. Ändras en uppgift ändras dess svar i
samma ändring: --kolla ser bara att antalet stämmer.

Id:t är ett uuid5 ur filnamnet, så att --sql alltid ger samma rader
och en migration kan köras om utan dubbletter.

Webbläsaren: CHROME i miljön, annars den första som hittas av
chromium, google-chrome, chromium-browser och Playwrights mapp.
Körs inte i CI — bilderna checkas in, precis som /en/-sidorna.
"""
import glob, html, os, re, shutil, subprocess, sys, tempfile, uuid

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bladen'))
import lagstadiet, mellanstadiet, hogstadiet, gymnasiet, np_ak6, np_ak9, np_gymnasiet, lankar  # noqa: E402

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
# Samma lista som NX.AMNEN i nextrum-app.js. Ett blad med ett ämne som inte
# står där blir osynligt i filtret, och ett filter som tyst tappar rader
# ser ut som ett tomt bibliotek.
AMNEN = ['Matematik', 'Svenska', 'Engelska', 'NO / Fysik / Kemi / Biologi',
         'SO / Historia / Samhällskunskap', 'Moderna språk']

# Bladen står i verktyg/bladen/, en fil per stadium och en per NP-serie (np_ak6, np_ak9, np_gymnasiet). Ordningen här är
# ordningen i --sql, och ett blads id kommer ur filnamnet, så en ny rad
# läggs sist i sin modul och ett befintligt blads `fil` ändras aldrig.
#
# Ett blad är en dict:
#   fil, arskurs, amne, titel, omrade, tid, instruktion=[...], uppgifter=[...], beskrivning
#   text     (valfri)  en läsetext, str eller lista med stycken, ovanför uppgifterna; ett stycke som börjar med '# ' blir en rubrik
#   chip     (valfri)  vad ämnesbrickan säger; annars ämnets första del ("NO", "SO")
# En uppgift är (text, extra) eller (text, extra, figur):
#   [] blir en svarsruta och [[]] en bred svarsruta för ett längre svar, ___ en skrivrad i texten, \n en radbrytning (en mening per rad när flera luckor ska fyllas)
#   {E}, {C} och {A} blir ett nivåmärke, som på de nationella proven
#   extra = antal tomma skrivrader under uppgiften, eller 'ruta' för en större ruta att rita i
#   figur = en HTML- eller SVG-sträng, oftast ur verktyg/bladen/figurer.py
BLAD = (lagstadiet.BLAD + mellanstadiet.BLAD + hogstadiet.BLAD + gymnasiet.BLAD
        + np_ak6.BLAD + np_ak9.BLAD + np_gymnasiet.BLAD)

# Länkar till andras material, i dag provgruppernas officiella sidor om de nationella proven. De
# ritas inte; raden i biblioteksmaterial pekar dit med `lank`. Se verktyg/bladen/lankar.py.
LANKAR = lankar.LANKAR


def kontrollera():
    """Fel i bladen stoppar bygget: ett dubblerat filnamn ger två blad samma id, och en
    årskurs som inte finns tas emot av check-villkoret i databasen med ett fel först när
    migrationen körs."""
    fel, sedda = [], set()
    nycklar = {'fil', 'arskurs', 'amne', 'titel', 'omrade', 'tid', 'instruktion', 'uppgifter',
               'beskrivning', 'text', 'chip'}
    for b in BLAD:
        namn = b.get('fil', '?')
        if namn in sedda:
            fel.append('dubblett: %s' % namn)
        sedda.add(namn)
        if set(b) - nycklar:
            fel.append('%s: okänd nyckel %s' % (namn, sorted(set(b) - nycklar)))
        if b['arskurs'] not in ARSKURS_TEXT:
            fel.append('%s: okänd årskurs %s' % (namn, b['arskurs']))
        if not namn.startswith(b['arskurs'] + '-'):
            fel.append('%s: filnamnet ska börja med %s-' % (namn, b['arskurs']))
        if b['amne'] not in AMNEN:
            fel.append('%s: ämnet "%s" finns inte i NX.AMNEN' % (namn, b['amne']))
        if not re.match(r'^[a-z0-9-]+$', namn):
            fel.append('%s: filnamnet får bara ha a–z, siffror och bindestreck' % namn)
        if len(b['titel']) > 200:
            fel.append('%s: titeln är längre än 200 tecken' % namn)
        for u in b['uppgifter']:
            if len(u) not in (2, 3) or not isinstance(u[0], str):
                fel.append('%s: uppgift med fel form: %r' % (namn, u[:1]))
    for l in LANKAR:
        namn = l.get('namn', '?')
        if namn in sedda:
            fel.append('dubblett: %s' % namn)
        sedda.add(namn)
        if set(l) != {'namn', 'arskurs', 'amne', 'titel', 'beskrivning', 'lank'}:
            fel.append('%s: länken ska ha namn, arskurs, amne, titel, beskrivning och lank' % namn)
            continue
        if l['arskurs'] not in ARSKURS_TEXT or not namn.startswith(l['arskurs'] + '-'):
            fel.append('%s: årskursen saknas eller stämmer inte med namnet' % namn)
        if l['amne'] not in AMNEN:
            fel.append('%s: ämnet "%s" finns inte i NX.AMNEN' % (namn, l['amne']))
        # Samma regel som biblioteksmaterial_lank_webbadress, men bara https: vi länkar inte okrypterat.
        if not re.match(r'^https://[^\s]+$', l['lank']):
            fel.append('%s: länken ska börja med https:// och sakna mellanslag' % namn)
    return fel


def lank_id(l):
    """Id:t kommer ur namnet, inte adressen: en adress som flyttar rättas med en update, inte en ny rad."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, SAJT + '/bank/lank/' + l['namn']))


def blad_id(b):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, SAJT + '/bank/' + b['fil'] + '.png'))


def fyll(text):
    """[] blir en ruta, [[]] en bred ruta, ___ en skrivrad, radbrytning en ny rad och {E}, {C} och {A} ett nivåmärke.
    Allt annat escapas."""
    ut = html.escape(text)
    ut = ut.replace('[[]]', '<span class="ruta bred"></span>')
    ut = ut.replace('[]', '<span class="ruta"></span>').replace('\n', '<br>')
    for niva in ('E', 'C', 'A'):
        ut = ut.replace('{%s}' % niva, '<span class="niva">%s</span>' % niva)
    return ut.replace('___', '<span class="linje"></span>')


# Stilen delas av bladet och facit. %(t)s är typsnittsmappen och %(w)d sidans bredd.
CSS = """@font-face{font-family:'Schibsted Grotesk';font-weight:400 800;src:url(%(t)s/schibsted-grotesk-latin.woff2) format('woff2')}
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
.lastext{margin:22px 0 4px;font-size:20.5px;line-height:1.62;border-left:4px solid #9C4520;padding:4px 0 4px 22px;white-space:pre-line}
.lastext p+p{margin-top:10px}
ol{list-style:none;margin-top:22px;display:flex;flex-direction:column;gap:20px;flex:1}
li{display:flex;gap:18px;align-items:flex-start}
.nr{flex:none;width:36px;height:36px;border-radius:50%%;border:1.5px solid #2E2A20;display:grid;place-items:center;
  font-weight:700;font-size:18px;margin-top:1px}
li div{flex:1}
li p{font-size:23px;line-height:1.45}
.ruta{display:inline-block;width:62px;height:40px;border:2px solid #2E2A20;border-radius:8px;vertical-align:middle;margin:0 4px}
.ruta.bred{width:150px}
.linje{display:inline-block;width:170px;border-bottom:2px solid #2E2A20;height:26px;vertical-align:baseline;margin:0 4px}
.rad{height:46px;border-bottom:1.5px solid #C9B492}
.rit{height:250px;margin-top:10px;border:1.5px dashed #C9B492;border-radius:12px;
  background-image:linear-gradient(#EFE6D6 1px,transparent 1px),linear-gradient(90deg,#EFE6D6 1px,transparent 1px);
  background-size:31px 31px}
.niva{display:inline-block;margin-left:10px;padding:0 8px;border:1.5px solid #9C4520;border-radius:6px;color:#9C4520;
  font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:15px;line-height:24px;vertical-align:2px}
.fot{margin-top:24px;padding-top:16px;border-top:1.5px solid #DDCDB2;display:flex;justify-content:space-between;
  font-family:'IBM Plex Mono',monospace;font-size:14px;letter-spacing:.06em;color:#665C49}
"""


def stil():
    return CSS % dict(t='file://' + os.path.join(ROT, 'typsnitt'), w=BREDD)


def sida(b, mat=False):
    uppg = []
    for i, u in enumerate(b['uppgifter'], 1):
        text, extra = u[0], u[1]
        figur = u[2] if len(u) > 2 else ''
        under = ''
        if extra == 'ruta':
            under = '<div class="rit"></div>'
        elif extra:
            under = ''.join('<div class="rad"></div>' for _ in range(extra))
        uppg.append('<li><span class="nr">%d</span><div><p>%s</p>%s%s</div></li>' % (i, fyll(text), figur, under))
    lastext = ''
    if b.get('text'):
        t = b['text']
        lastext = ('<div class="lastext">%s</div>' % html.escape(t)) if isinstance(t, str) else \
            '<div class="lastext">%s</div>' % ''.join(
                ('<p><b>%s</b></p>' % html.escape(s[2:])) if s.startswith('# ') else ('<p>%s</p>' % html.escape(s)) for s in t)
    return """<!doctype html><html lang="sv"><head><meta charset="utf-8">
<style>
%(css)s</style></head><body>
<div class="topp"><div class="marke"><i>N</i>NEXTRUM<span>Övningsblad</span></div>
<div class="chips"><span class="chip">%(amne)s</span><span class="chip ak">%(ak)s</span></div></div>
<h1>%(titel)s</h1>
<div class="meta">%(omrade)s · ca %(tid)s</div>
<div class="namn"><span>Namn:</span><span>Datum:</span></div>
<div class="instr"><b>Så gör du</b>%(instr)s</div>
%(lastext)s
<ol>%(uppg)s</ol>
<div class="fot"><span>nextrum.se · Nextrums materialbank</span><span>Får skrivas ut och kopieras för eget bruk</span></div>
%(mat)s</body></html>""" % dict(
        mat=MATSKRIPT if mat else '', css=stil(),
        amne=html.escape(b.get('chip') or b['amne'].split(' / ')[0]),
        ak=ARSKURS_TEXT[b['arskurs']], titel=html.escape(b['titel']), omrade=html.escape(b['omrade']),
        tid=html.escape(b['tid']), instr=''.join('<p>%s</p>' % fyll(r) for r in b['instruktion']),
        lastext=lastext, uppg=''.join(uppg))


# Mäter om sidan ryms: innehållet får inte vara högre än fönstret, annars klipps foten och
# de sista uppgifterna syns inte. Skriver resultatet i <html data-over data-ledigt>.
MATSKRIPT = """<script>document.fonts.ready.then(function(){
var h=document.documentElement,li=document.querySelectorAll('li'),sist=li[li.length-1].getBoundingClientRect().bottom,
fot=document.querySelector('.fot').getBoundingClientRect().top;
h.setAttribute('data-over',String(h.scrollHeight-innerHeight));h.setAttribute('data-ledigt',String(Math.round(fot-sist)))})</script>"""


# ---- Facit ----
# Facit står i verktyg/bladen/facit_<modul>.py, en fil per modul med bladen:
#   FACIT = {'ak4-matematik-brak': ['svar på uppgift 1', 'svar på uppgift 2', ...], ...}
# Ett svar per uppgift, i bladets ordning. \n blir en radbrytning. Där svaren kan variera börjar
# svaret med "Eget svar." och säger vad ett bra svar innehåller.
#
# Facit ritas till bank/facit/<fil>.png, en egen sida, och aldrig på bladet: bladet skrivs ut och
# lämnas till eleven, och beskrivningen blir läxans text. Studiehjälparen når facit från biblioteket.
# Repot är publikt, så facit är inte hemligt för den som letar; det är ett facit i bokens baksida,
# inte ett prov.
FACITMODULER = ('lagstadiet', 'mellanstadiet', 'hogstadiet', 'gymnasiet', 'np_ak6', 'np_ak9', 'np_gymnasiet')
FACIT_UT = os.path.join(UT, 'facit')


def las_facit():
    """Läser facitfilerna som finns. En fil som saknas är ett tomt facit, så att bladen kan ritas
    medan facit skrivs; --kolla säger vad som fattas."""
    import importlib
    facit, fel = {}, []
    for m in FACITMODULER:
        if not os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bladen', 'facit_%s.py' % m)):
            continue
        for fil, svar in importlib.import_module('facit_' + m).FACIT.items():
            if fil in facit:
                fel.append('facit: %s står i två facitfiler' % fil)
            facit[fil] = svar
    return facit, fel


def kontrollera_facit(facit):
    """Varje blad har ett svar per uppgift. Ett facit med ett svar för lite flyttar alla svar efter
    luckan ett steg, och då stämmer inget av dem."""
    fel, blad = [], {b['fil']: b for b in BLAD}
    for b in BLAD:
        svar = facit.get(b['fil'])
        if svar is None:
            fel.append('%s: facit saknas' % b['fil'])
        elif len(svar) != len(b['uppgifter']):
            fel.append('%s: facit har %d svar men bladet %d uppgifter' % (b['fil'], len(svar), len(b['uppgifter'])))
        elif any(not isinstance(s, str) or not s.strip() for s in svar):
            fel.append('%s: ett svar i facit är tomt' % b['fil'])
    for f in sorted(set(facit) - set(blad)):
        fel.append('facit: %s har inget blad' % f)
    return fel


def fraga_kort(text):
    """Uppgiftens första rad, utan rutor och linjer, så att facit går att läsa utan bladet bredvid."""
    rad = text.split('\n')[0]
    rad = re.sub(r'\s*(\[\[\]\]|\[\]|___)\s*', ' … ', rad)
    rad = re.sub(r'\s*\{[ECA]\}', '', rad).strip()
    rad = re.sub(r'(\s*…)+$', '', rad)
    return rad if len(rad) <= 150 else rad[:147].rsplit(' ', 1)[0] + ' …'


def facit_text(s):
    # Ett minus framför en siffra blir ett riktigt minustecken, som på bladen.
    return html.escape(re.sub(r'(?<![\w)])-(?=\d)', '−', s)).replace('\n', '<br>')


def facitsida(b, svar, tathet=0, mat=False):
    """tathet 0: frågan och svaret. 1: bara svaret. 2: bara svaret, i mindre stil."""
    rader = []
    for i, (u, s) in enumerate(zip(b['uppgifter'], svar), 1):
        fraga = '' if tathet else '<p class="ff">%s</p>' % html.escape(fraga_kort(u[0]))
        rader.append('<li><span class="nr">%d</span><div>%s<p class="fs">%s</p></div></li>' % (i, fraga, facit_text(s)))
    return """<!doctype html><html lang="sv"><head><meta charset="utf-8">
<style>
%(css)s
ol.facit{gap:%(gap)dpx}
.ff{font-size:18px;line-height:1.4;color:#665C49}
.fs{font-size:%(fs)dpx;line-height:1.42;font-weight:600;margin-top:3px}
</style></head><body>
<div class="topp"><div class="marke"><i>N</i>NEXTRUM<span>Facit</span></div>
<div class="chips"><span class="chip">%(amne)s</span><span class="chip ak">%(ak)s</span></div></div>
<h1>%(titel)s</h1>
<div class="meta">Facit · %(omrade)s</div>
<div class="instr"><b>Till den som rättar</b><p>Svar till övningsbladet med samma namn. Där svaren kan variera står vad ett bra svar innehåller, och ett annat svar kan också vara rätt om det är väl motiverat.</p></div>
<ol class="facit">%(rader)s</ol>
<div class="fot"><span>nextrum.se · Nextrums materialbank</span><span>Facit, inte för eleven</span></div>
%(mat)s</body></html>""" % dict(
        css=stil(), gap=(18, 14, 10)[tathet], fs=(21, 21, 18)[tathet], mat=MATSKRIPT if mat else '',
        amne=html.escape(b.get('chip') or b['amne'].split(' / ')[0]), ak=ARSKURS_TEXT[b['arskurs']],
        titel=html.escape(b['titel']), omrade=html.escape(b['omrade']), rader=''.join(rader))


def hitta_chrome():
    if os.environ.get('CHROME'):
        return os.environ['CHROME']
    for namn in ('chromium', 'google-chrome', 'chromium-browser'):
        p = shutil.which(namn)
        if p:
            return p
    kandidater = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'))
    return kandidater[-1] if kandidater else None


def kolla():
    """Glapp mellan bladen, bilderna och databasen: ett blad utan bild ger en trasig länk, en bild utan
    blad blir aldrig ombyggd, och ett blad utan rad i en migration syns aldrig i biblioteket."""
    fel = kontrollera()
    bilder = {os.path.basename(p)[:-4] for p in glob.glob(os.path.join(UT, '*.png'))}
    blad = {b['fil'] for b in BLAD}
    for f in sorted(blad - bilder):
        fel.append('%s: bank/%s.png saknas, kör verktyget' % (f, f))
    for f in sorted(bilder - blad):
        fel.append('bank/%s.png: ingen post i verktyg/bladen/' % f)
    migrationer = ''
    for p in glob.glob(os.path.join(ROT, 'supabase', 'migrations', '*.sql')):
        with open(p, encoding='utf-8') as fil:
            migrationer += fil.read()
    for b in BLAD:
        if blad_id(b) not in migrationer:
            fel.append('%s: raden saknas i supabase/migrations/, skriv en ny migration med --sql %s' % (b['fil'], b['fil']))
    for l in LANKAR:
        if lank_id(l) not in migrationer:
            fel.append('%s: länkens rad saknas i supabase/migrations/, skriv en ny migration med --sql %s' % (l['namn'], l['namn']))
    facit, facitfel = las_facit()
    fel += facitfel + kontrollera_facit(facit)
    facitbilder = {os.path.basename(p)[:-4] for p in glob.glob(os.path.join(FACIT_UT, '*.png'))}
    for f in sorted(blad - facitbilder):
        fel.append('%s: bank/facit/%s.png saknas, kör verktyget med --facit' % (f, f))
    for f in sorted(facitbilder - blad):
        fel.append('bank/facit/%s.png: inget blad med det namnet' % f)
    if fel:
        print('\n'.join('FEL  ' + f for f in fel))
        return 1
    print('ok   %d blad och %d länkar, alla med bild, facit och migration' % (len(BLAD), len(LANKAR)))
    return 0


def urval(monster):
    return [b for b in BLAD if not monster or any(m in b['fil'] for m in monster)]


def mat(chrome, kalla):
    """(för mycket, ledigt) i pixlar. För mycket > 0: sidan ryms inte."""
    ut = subprocess.run([chrome, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                         '--force-device-scale-factor=1', '--window-size=%d,%d' % (BREDD, HOJD),
                         '--virtual-time-budget=4000', '--dump-dom', 'file://' + kalla],
                        check=True, capture_output=True, text=True).stdout
    over = re.search(r'data-over="(-?\d+)"', ut)
    ledigt = re.search(r'data-ledigt="(-?\d+)"', ut)
    if not over or not ledigt:
        return None
    return int(over.group(1)), int(ledigt.group(1))


def fota(chrome, kalla, mal):
    subprocess.run([chrome, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                    '--force-device-scale-factor=1', '--window-size=%d,%d' % (BREDD, HOJD),
                    '--screenshot=' + mal, 'file://' + kalla],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def rita(monster):
    fel = kontrollera()
    if fel:
        print('\n'.join('FEL  ' + f for f in fel))
        return 1
    chrome = hitta_chrome()
    if not chrome:
        print('Hittar ingen Chromium. Sätt CHROME=/sökväg/till/chrome.')
        return 1
    valda = urval(monster)
    if not valda:
        print('Inga blad matchar %s.' % ' '.join(monster))
        return 1
    os.makedirs(UT, exist_ok=True)
    problem = 0
    with tempfile.TemporaryDirectory() as tmp:
        for b in valda:
            kalla = os.path.join(tmp, b['fil'] + '.html')
            with open(kalla, 'w', encoding='utf-8') as f:
                f.write(sida(b, mat=True))
            m = mat(chrome, kalla)
            if m is None:
                print('FEL  bank/%s.png: kunde inte mäta sidan' % b['fil'])
                problem += 1
                continue
            if m[0] > 0:
                print('FEL  bank/%s.png: sidan är %d px för hög, korta bladet' % (b['fil'], m[0]))
                problem += 1
                continue
            with open(kalla, 'w', encoding='utf-8') as f:
                f.write(sida(b))
            fota(chrome, kalla, os.path.join(UT, b['fil'] + '.png'))
            print('ok   bank/%s.png%s' % (b['fil'], '   (%d px ledigt, glest)' % m[1] if m[1] > 420 else ''))
    return 1 if problem else 0


def rita_facit(monster):
    """Ritar bank/facit/<fil>.png. Ryms inte frågan och svaret tas frågan bort, och ryms inte det
    heller blir stilen mindre; ryms facit inte ens då ska svaren kortas."""
    facit, fel = las_facit()
    valda = urval(monster)
    namn = {b['fil'] for b in valda}
    fel += kontrollera() + [f for f in kontrollera_facit(facit) if f.split(':')[0] in namn]
    if fel:
        print('\n'.join('FEL  ' + f for f in fel))
        return 1
    chrome = hitta_chrome()
    if not chrome:
        print('Hittar ingen Chromium. Sätt CHROME=/sökväg/till/chrome.')
        return 1
    if not valda:
        print('Inga blad matchar %s.' % ' '.join(monster))
        return 1
    os.makedirs(FACIT_UT, exist_ok=True)
    problem = 0
    with tempfile.TemporaryDirectory() as tmp:
        for b in valda:
            kalla = os.path.join(tmp, b['fil'] + '.html')
            for tathet in (0, 1, 2):
                with open(kalla, 'w', encoding='utf-8') as f:
                    f.write(facitsida(b, facit[b['fil']], tathet, mat=True))
                m = mat(chrome, kalla)
                if m is not None and m[0] <= 0:
                    break
            if m is None:
                print('FEL  bank/facit/%s.png: kunde inte mäta sidan' % b['fil'])
                problem += 1
                continue
            if m[0] > 0:
                print('FEL  bank/facit/%s.png: facit är %d px för högt, korta svaren' % (b['fil'], m[0]))
                problem += 1
                continue
            with open(kalla, 'w', encoding='utf-8') as f:
                f.write(facitsida(b, facit[b['fil']], tathet))
            fota(chrome, kalla, os.path.join(FACIT_UT, b['fil'] + '.png'))
            print('ok   bank/facit/%s.png%s' % (b['fil'], ('', '   (utan frågorna)', '   (utan frågorna, liten stil)')[tathet]))
    return 1 if problem else 0


def sql():
    fel = kontrollera()
    if fel:
        print('\n'.join('FEL  ' + f for f in fel), file=sys.stderr)
        return 1

    def q(v):
        return "'" + v.replace("'", "''") + "'"
    rader = []
    for b in urval(MONSTER_SQL):
        rader.append('  (%s, %s, %s, %s, %s, %s)' % (
            q(blad_id(b)), q(b['titel']), q(b['beskrivning']), q(b['amne']), q(b['arskurs']),
            q(SAJT + '/bank/' + b['fil'] + '.png')))
    for l in LANKAR:
        if not MONSTER_SQL or any(m in l['namn'] for m in MONSTER_SQL):
            rader.append('  (%s, %s, %s, %s, %s, %s)' % (
                q(lank_id(l)), q(l['titel']), q(l['beskrivning']), q(l['amne']), q(l['arskurs']), q(l['lank'])))
    print('insert into public.biblioteksmaterial (id, titel, beskrivning, amne, arskurs, lank) values')
    print(',\n'.join(rader))
    print('on conflict (id) do nothing;')
    return 0


MONSTER_SQL = []

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--kolla' in sys.argv:
        sys.exit(kolla())
    if '--facit' in sys.argv:
        sys.exit(rita_facit(args))
    if '--sql' in sys.argv:
        MONSTER_SQL = args
        sys.exit(sql())
    sys.exit(rita(args))
