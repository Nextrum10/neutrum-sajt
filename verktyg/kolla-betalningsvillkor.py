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

BETALNINGSTIDEN PÅ FAKTURAN (Fas 14.6). Familjen kan välja faktura på
ett pass, och då står antalet dagar på två ställen i koden:
BETALNINGSVILLKOR_DAGAR i _delad/konstanter.ts och i nextrum-config.js,
som vyerna läser. Verktyget kräver att de är samma tal. Fakturan skapas
i Fortnox, och inställningen där ser verktyget inte: den ska vara samma
siffra, och det står i DEPLOY-BETALNING.md 9.11.

FAKTURAN ÄR ETT VAL SEDAN 2026-09-28. Flaggan 'faktura' står på, och
varje ställe som lovar kortet säger också att familjen efter passet kan
välja faktura, med betalningstiden i ord och utan avgift. Verktyget
räknar den meningen på samma ställen och lika många gånger som
kortmeningen, och bygger siffran i den ur BETALNINGSVILLKOR_DAGAR: en
ändrad betalningstid som inte når texterna blir rött här, inte en tvist
om vad familjen lovades. Slås flaggan av ska meningen bort i samma
ändring, och FAKTURA_I_TEXTEN nedan sättas till False
(DEPLOY-BETALNING.md 9.11).

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

# Mellanrummen är \s+: i villkoren bryts meningen över två rader i
# källan, och ett mönster med vanliga mellanslag hade sett det som ett
# omskrivet löfte.
LOFTE_SV = r'antingen\s+i\s+förväg\s+eller\s+efter\s+passet\s+när\s+ni\s+bekräftar\s+rapporten'
LOFTE_EN = r'either\s+in\s+advance\s+or\s+after\s+the\s+session\s+when\s+you\s+confirm\s+the\s+report'

# Fakturameningen, med betalningstiden i ord. Står den på ett ställe som
# lovar kortet ska den stå på alla: en familj som läst prissidan och
# sedan villkoren ska inte få två olika svar på hur de kan betala.
FAKTURA_I_TEXTEN = True
DAGAR_I_ORD = {10: ('tio', 'ten'), 14: ('fjorton', 'fourteen'), 20: ('tjugo', 'twenty'), 30: ('trettio', 'thirty')}


def fakturameningen(dagar, svenska):
    sv, en = DAGAR_I_ORD[dagar]
    if svenska:
        return (r'välja\s+faktura,\s+som\s+kommer\s+i\s+början\s+av\s+nästa\s+månad\s+med\s+'
                + sv + r'\s+dagars\s+betalningstid\s+och\s+utan\s+avgift')
    return (r'choose\s+an\s+invoice\s+instead,\s+which\s+comes\s+at\s+the\s+start\s+of\s+the\s+following\s+month\s+with\s+'
            + en + r'\s+days\s+to\s+pay\s+and\s+no\s+fee')

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


def las(fil):
    return io.open(os.path.join(ROT, fil), encoding='utf-8').read()


def dagar(fil, monster):
    m = re.search(monster, las(fil))
    return int(m.group(1)) if m else None


def main():
    fynd = []

    i_koden = dagar('supabase/functions/_delad/konstanter.ts', r'BETALNINGSVILLKOR_DAGAR\s*=\s*(\d+)')
    i_vyn = dagar('nextrum-config.js', r'BETALNINGSVILLKOR_DAGAR\s*:\s*(\d+)')
    if i_koden is None or i_vyn is None or i_koden != i_vyn:
        fynd.append('DAGAR      konstanter.ts säger %s, nextrum-config.js säger %s. Fakturans betalningstid '
                    'ska vara samma tal på båda ställena.' % (i_koden, i_vyn))

    if FAKTURA_I_TEXTEN and i_koden not in DAGAR_I_ORD:
        fynd.append('DAGAR      betalningstiden är %s dagar, och verktyget vet inte hur det skrivs i ord. '
                    'Lägg till det i DAGAR_I_ORD och skriv om fakturameningen.' % i_koden)

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
        if FAKTURA_I_TEXTEN and i_koden in DAGAR_I_ORD:
            faktura = fakturameningen(i_koden, monster == LOFTE_SV)
            n = len(re.findall(faktura, text))
            if n != antal:
                fynd.append('FAKTURA    %s — %s: väntade %d gång%s att familjen kan välja faktura '
                            '(%s dagar, utan avgift), hittade %d'
                            % (fil, vad, antal, '' if antal == 1 else 'er', i_koden, n))

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

    if fynd:
        print('\n'.join(fynd))
        print('\n%d problem. Betalningslöftet måste säga samma sak på alla ställen.' % len(fynd))
        return 1

    print('ok   betalningslöftet står på alla %d ställen i %d filer%s, det gamla ingenstans, '
          'och fakturans betalningstid är %d dagar i båda filerna'
          % (sum(antal for _, _, antal, _ in LOFTET), len({fil for fil, _, _, _ in LOFTET}),
             ', med fakturan bredvid' if FAKTURA_I_TEXTEN else '', i_koden))
    return 0


if __name__ == '__main__':
    sys.exit(main())
