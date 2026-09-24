# -*- coding: utf-8 -*-
"""Kollar att betalningslöftet säger samma sak överallt.

       python3 verktyg/kolla-betalningsvillkor.py

SEDAN FAS 14.2 ÄR LÖFTET INTE ETT ANTAL DAGAR. Familjen betalar varje
pass med kort, FÖRE passet, och ett pass som inte är betalt hålls inte.
Ingen månadsfaktura och inget betalningsvillkor.

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
    båda språken. Antalet står med för att ett sökuttryck som inte
    hittar något annars ser ut som ett godkännande: formuleras
    meningen om slutar mönstret matcha, och då ska verktyget säga det
    i stället för att tiga om ett ställe det slutat bevaka.

  · DET GAMLA LÖFTET — formuleringar som inte får stå i någon sida
    som serveras, eller i maskotens svarsfil.

Verktyget rättar ingenting. Vad löftet ska vara är ett affärsbeslut,
inte något ett skript ska gissa.

TÄCKS INTE: konstanten BETALNINGSVILLKOR_DAGAR i _delad/konstanter.ts.
Den finns kvar för fakturor som skapades före Fas 14.2 — och sådana
fanns det noll av — och lovar ingenting om ett nytt pass. Mejlmallarna
i _delad/notiser/ täcks inte heller; de säger i dag ingenting om
betalning.

TÄCKER INTE HELLER det som faktiskt körs: att spärren kortsparr är på
är en flagga i databasen, inte en mening på en sida. Se CLAUDE.md
avsnitt 11.
"""
import glob, io, os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LOFTE_SV = r'[Ee]tt pass som inte är betalt hålls inte'
LOFTE_EN = r'[Aa] session that has not been paid is not held'

# (fil, mönster, hur många träffar som ska finnas, vad stället är)
LOFTET = [
    ('anvandarvillkor.html', LOFTE_SV, 1, 'användarvillkoren: pris och betalning'),
    ('priser.html', LOFTE_SV, 1, 'prissidan: när betalar vi'),
    ('faq.html', LOFTE_SV, 2, 'FAQ: hur betalningen fungerar (text + schema)'),
    ('foralder.html', LOFTE_SV, 2, 'studievyn: Betalning och Pris & villkor'),
    ('nextrum-studie-vy.js', LOFTE_SV, 1, 'studievyn: notisen om pass att betala'),

    ('en/anvandarvillkor.html', LOFTE_EN, 1, 'terms of use in English'),
    ('en/priser.html', LOFTE_EN, 1, 'pricing page in English'),
    ('en/faq.html', LOFTE_EN, 2, 'FAQ in English (text + schema)'),

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

    if fynd:
        print('\n'.join(fynd))
        print('\n%d problem. Betalningslöftet måste säga samma sak på alla ställen.' % len(fynd))
        return 1

    print('ok   betalningslöftet står på alla %d ställen i %d filer, och det gamla ingenstans'
          % (sum(antal for _, _, antal, _ in LOFTET), len({fil for fil, _, _, _ in LOFTET})))
    return 0


if __name__ == '__main__':
    sys.exit(main())
