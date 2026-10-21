# -*- coding: utf-8 -*-
"""Kollar att betalningslöftet säger samma sak överallt.

       python3 verktyg/kolla-betalningsvillkor.py

SEDAN FAS 19.2 FÅR FAMILJEN BETALA EFTER PASSET. Familjen betalar varje
pass med kort, antingen i förväg eller efter passet när de bekräftar
rapporten, och ett pass som har hållits ska betalas även om rapporten
inte bekräftats. Fas 14.2 sa kort FÖRE passet och att ett obetalt pass
inte hålls; det löftet står nu bland det gamla nedan, för en sida som
fortfarande säger det lovar familjen något som inte gäller.

Förut vaktade verktyget att "10 dagars betalningsvillkor" stod likadant
på fjorton ställen. Felet det fanns för är detsamma nu, åt andra hållet:
står det kvar ett "ni betalar i efterskott" på någon sida lovar den
något systemet inte gör, och en familj som läst det har rätt att bli
förvånad när kortet dras före passet. En betalning som tas på ett annat
sätt än villkoren lovar är en tvist, inte ett skrivfel. Och precis som
förut är det en ändring där ett ställe glöms bort — det är utspritt,
det är tråkigt, och alla ställen ser ut att vara "det sista".

Två listor:

  · LÖFTET — meningen som ska stå, med antal, där betalningen
    beskrivs: villkoren, prissidan, FAQ:n, maskoten och studievyn, på
    båda språken, och sedan Fas 14.3 familjens mejl. Sedan Fas 19.2c
    också Vår idé och läxhjälpssidorna. Antalet står med
    för att ett sökuttryck som inte hittar något annars ser ut som ett
    godkännande: formuleras
    meningen om slutar mönstret matcha, och då ska verktyget säga det
    i stället för att tiga om ett ställe det slutat bevaka.

  · DET GAMLA LÖFTET — formuleringar som inte får stå i någon sida
    som serveras, eller i maskotens svarsfil.

Verktyget rättar ingenting. Vad löftet ska vara är ett affärsbeslut,
inte något ett skript ska gissa.

FAKTURAN ÄR BORTA (2026-10-21, fakturan_tas_bort). Fas 14.6 lät familjen
välja faktura, och 2026-10-16 lades obetalda pass på den av sig själva.
Varje ställe som lovade kortet sa då också att familjen kunde välja
faktura med tio dagars betalningstid, och att ett obetalt pass kom med på
fakturan, och verktyget räknade de meningarna. Ingen faktura gick till en
familj, och Leo tog bort fakturan helt. Nu står meningarna bland det gamla
löftet: en sida som säger att familjen kan välja faktura lovar ett
betalsätt som inte finns. BETALNINGSVILLKOR_DAGAR, betalningstiden på
fakturan i konstanter.ts och nextrum-config.js, gick med den.

Mejlmallarna i _delad/notiser/mallar.ts TÄCKS sedan Fas 14.3, och
säger sedan Fas 19.2 samma mening som sidorna. Mejlet är det familjen
läser sist innan passet. Meningen står en gång i källan, som en
konstant mallarna delar.

TÄCKER INTE HELLER det som faktiskt körs: spärren kortsparr är en
flagga i databasen, inte en mening på en sida. Sedan Fas 19.2 nekar
databasen att den slås på (flaggor_kortsparr_av), för den och det här
löftet kan inte gälla samtidigt. Se CLAUDE.md avsnitt 11.
"""
import glob, io, os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# BETALA NU (2026-10-21, Leo: "man betalar när man fått de bekräftat att man
# kan boka lektionen", "betala direkt med kort eller betala med klarna").
# Familjen betalar passet med kort eller Klarna så fort studiehjälparen
# bekräftat tiden, med knappen Betala nu, och hinner de inte hålls passet
# ändå och betalas efteråt. Blir passet kortare betalar vi tillbaka av oss
# själva. Kortet som reserverades två dagar före passet (kortet_reserveras,
# 2026-10-13 till 2026-10-21) och familjens bekräftelse av rapporten är
# borta: deras meningar står bland det gamla nedan.
#
# Mellanrummen är \s+: i villkoren bryts meningen över två rader i
# källan, och ett mönster med vanliga mellanslag hade sett det som ett
# omskrivet löfte.
LOFTE_SV = (r'med\s+kort\s+eller\s+Klarna\s+så\s+fort\s+studiehjälparen\s+har\s+bekräftat\s+tiden,\s+och\s+blir\s+'
            r'passet\s+kortare\s+än\s+bokat\s+betalar\s+vi\s+tillbaka\s+mellanskillnaden')
LOFTE_EN = (r'by\s+card\s+or\s+Klarna\s+as\s+soon\s+as\s+the\s+tutor\s+has\s+confirmed\s+the\s+time,\s+and\s+if\s+the\s+'
            r'session\s+is\s+shorter\s+than\s+booked\s+we\s+refund\s+the\s+difference')

# (fil, mönster, hur många träffar som ska finnas, vad stället är)
LOFTET = [
    ('anvandarvillkor.html', LOFTE_SV, 1, 'användarvillkoren: pris och betalning'),
    ('priser.html', LOFTE_SV, 2, 'prissidan: per pass, och när betalar vi'),
    ('faq.html', LOFTE_SV, 2, 'FAQ: hur betalningen fungerar (text + schema)'),
    ('foralder.html', LOFTE_SV, 2, 'studievyn: Betalning och Pris & villkor'),
    ('sa-fungerar-nextrum.html', LOFTE_SV, 1, 'så fungerar Nextrum: trygg betalning'),
    ('index.html', LOFTE_SV, 1, 'startsidan: studievyn som visar sig själv'),
    ('for-elever-och-foraldrar.html', LOFTE_SV, 1, 'för elever och föräldrar: samma illustration'),
    ('supabase/functions/_delad/notiser/mallar.ts', LOFTE_SV, 1,
     'mejlen: bekräftelsen, påminnelsen och ett bokat pass till familjen'),

    ('en/anvandarvillkor.html', LOFTE_EN, 1, 'terms of use in English'),
    ('en/priser.html', LOFTE_EN, 2, 'pricing page in English'),
    ('en/faq.html', LOFTE_EN, 2, 'FAQ in English (text + schema)'),
    ('en/sa-fungerar-nextrum.html', LOFTE_EN, 1, 'how Nextrum works in English'),
    ('en/index.html', LOFTE_EN, 1, 'home page in English'),
    ('en/for-elever-och-foraldrar.html', LOFTE_EN, 1, 'for students and parents in English'),

    # Läxhjälpssidorna och Vår idé sa "innan det hålls" i ett dygn efter
    # Fas 19.2, för de stod inte i den här listan och ingen såg dem.
    # Ämnessidorna och Solna genereras av verktyg/bygg-omradessidor.py;
    # meningen ändras där, inte i sidan.
    ('var-ide.html', LOFTE_SV, 1, 'vår idé: priset'),
    ('laxhjalp-stockholm.html', LOFTE_SV, 1, 'läxhjälp i Stockholm: priset'),
    ('laxhjalp-matematik.html', LOFTE_SV, 2, 'ämnessidan matematik: vad kostar det (text + schema)'),
    ('laxhjalp-svenska.html', LOFTE_SV, 2, 'ämnessidan svenska: vad kostar det (text + schema)'),
    ('laxhjalp-engelska.html', LOFTE_SV, 2, 'ämnessidan engelska: vad kostar det (text + schema)'),
    ('laxhjalp-no.html', LOFTE_SV, 2, 'ämnessidan NO: vad kostar det (text + schema)'),
    ('laxhjalp-solna.html', LOFTE_SV, 2, 'Solna: måste vi binda upp oss (text + schema)'),
    ('en/var-ide.html', LOFTE_EN, 1, 'our idea in English: the price'),

    # Maskoten citerar FAQ:n och prissidan ordagrant och byggs av
    # verktyg/bygg-maskotsvar.py. Står det gamla kvar här har någon
    # ändrat sidorna utan att köra om verktyget — och då svarar chatten
    # fortfarande det gamla löftet.
    ('nextrum-maskot-svar.js', LOFTE_SV, 2, 'maskoten (svenska)'),
    ('nextrum-maskot-svar.js', LOFTE_EN, 2, 'maskoten (engelska)'),
]

# Det som gällde före Fas 14.2. Inget av det får stå kvar där en familj
# kan läsa det.
DET_GAMLA = [
    r'efterskott',
    r'samlingsfaktura',
    r'\d+ dagars betalningsvillkor',
    r'betalningsvillkor(?:et)? är \d+ dagar',
    r'aldrig i förskott',
    r'fakturan kommer från Nextrum',
    r'första faktura',
    r'in arrears',
    r'\d+-day payment terms',
    r'payment terms are \d+ days',
    r'never up front',
    r'first invoice',

    # Fas 14.2 till Fas 19.2: kort FÖRE passet, och ett obetalt pass
    # hålls inte. Familjen får sedan Fas 19.2 betala efter passet.
    r'pass som inte är betalt hålls inte',
    r'inte är betalt när det ska börja',
    r'senast innan (?:passet|det) börjar',
    r'före varje pass',
    r'ingenting dras i efterhand',
    r'inget att betala i efterhand',
    r'not been paid is not held',
    r'not been paid by the time it should start',
    r'(?:at the latest|no later than) (?:before|when) (?:the session|it) starts',
    r'before each session',
    r'nothing is charged afterwards',
    r'nothing to pay afterwards',
    r'innan det hålls',
    r'before it takes place',
]

# Fakturan (Fas 14.6 till 2026-10-21). Betalsättet finns inte längre, så
# ingen sida, inget mejl och ingen agent får erbjuda det.
FAKTURAN = [
    r'välja\s+faktura',
    r'mot\s+faktura',
    r'på\s+fakturan',
    r'månadens\s+faktura',
    r'dagars\s+betalningstid',
    r'choose\s+an\s+invoice',
    r'by\s+invoice',
    r'on\s+the\s+invoice',
    r'days\s+to\s+pay',
]
DET_GAMLA += FAKTURAN

# Mejlen och agentens fakta läses av familjerna eller svarar dem. De är
# kod, så bara fakturans mönster prövas där: det gamla löftet om kortet
# står i kommentarer om historien.
KOD_SOM_SVARAR = [
    'supabase/functions/_delad/notiser/mallar.ts',
    'supabase/functions/_delad/notiser/barn.ts',
    'supabase/functions/_delad/nextrum-fakta.ts',
]

# Kortet som reserverades (2026-10-13 till 2026-10-21) och betalningen när
# familjen bekräftar rapporten (Fas 19.2 till 2026-10-21). Ingen sida får
# lova dem: familjen betalar med Betala nu, och rapporten bekräftas inte.
DET_GAMLA += [
    r'pengarna\s+dras\s+först\s+när',
    r'reserveras\s+priset',
    r'när\s+ni\s+bekräftar\s+rapporten',
    r'antingen\s+i\s+förväg\s+eller\s+efter\s+passet',
    r'money\s+is\s+only\s+taken',
    r'price\s+is\s+reserved',
    r'when\s+you\s+confirm\s+the\s+report',
    r'either\s+in\s+advance\s+or\s+after\s+the\s+session',
]


def las(fil):
    return io.open(os.path.join(ROT, fil), encoding='utf-8').read()


def main():
    fynd = []

    for fil, monster, antal, vad in LOFTET:
        try:
            text = las(fil)
        except IOError:
            fynd.append('SAKNAS     %s' % fil)
            continue
        n = len(re.findall(monster, text))
        if n != antal:
            fynd.append('OMSKRIVET  %s — %s: väntade %d träff%s på /%s/, hittade %d'
                        % (fil, vad, antal, '' if antal == 1 else 'ar', monster, n))

    serveras = sorted(glob.glob(os.path.join(ROT, '*.html'))
                      + glob.glob(os.path.join(ROT, 'en', '*.html'))
                      + [os.path.join(ROT, 'nextrum-maskot-svar.js')])
    for sokvag in serveras:
        text = io.open(sokvag, encoding='utf-8').read()
        for monster in DET_GAMLA:
            for m in re.finditer(monster, text, re.I):
                bit = text[max(0, m.start() - 50):m.end() + 30].replace('\n', ' ')
                fynd.append('GAMMALT    %s: /%s/ … %s …'
                            % (os.path.relpath(sokvag, ROT), monster, bit.strip()))

    for fil in KOD_SOM_SVARAR:
        text = las(fil)
        for monster in FAKTURAN:
            for m in re.finditer(monster, text, re.I):
                bit = text[max(0, m.start() - 50):m.end() + 30].replace('\n', ' ')
                fynd.append('GAMMALT    %s: /%s/ … %s …' % (fil, monster, bit.strip()))

    if fynd:
        print('\n'.join(fynd))
        print('\n%d problem. Betalningslöftet måste säga samma sak på alla ställen.' % len(fynd))
        return 1

    print('ok   betalningslöftet står på alla %d ställen i %d filer, och det gamla (fakturan med) ingenstans'
          % (sum(antal for _, _, antal, _ in LOFTET), len({fil for fil, _, _, _ in LOFTET})))
    return 0


if __name__ == '__main__':
    sys.exit(main())
