# -*- coding: utf-8 -*-
"""Kollar att betalningsvillkoret säger samma antal dagar överallt.

       python3 verktyg/kolla-betalningsvillkor.py

Villkoret står på fjorton ställen i fyra olika sorters filer: en
konstant i edge-funktionernas delade _delad/konstanter.ts (sedan Fas 3,
förut två kopior), den synliga texten på fyra sidor på två språk,
FAQ-schemat, raden i adminvyn och maskotens svarsfil. Koden vet om det —
konstanten bär en kommentar om att den måste stämma med prissidan,
FAQ:n och användarvillkoren. Men en kommentar kan inte köras.

Det som gör det här värt ett verktyg är vad felet kostar. En faktura
som förfaller på en annan dag än villkoret lovar är en tvist, inte ett
skrivfel: familjen har läst tio dagar på prissidan, systemet har räknat
fjorton, och det finns ingenting i en betalningspåminnelse som gör den
diskussionen trevlig. Att ändra villkoret är dessutom precis den sortens
uppgift där ett ställe glöms bort — det är utspritt, det är tråkigt, och
alla ställen ser ut att vara "det sista".

Verktyget läser siffran där den står och säger ifrån om de inte är
överens. Det rättar ingenting. Vilken siffra som är den rätta är ett
affärsbeslut, inte något ett skript ska gissa.

TÄCKS INTE: DEPLOY-BETALNING.md och kommentaren om förfallodagen i
faktura-utskick skriver ut antalet med bokstäver ("tio dagar") och
räknar dessutom ett exempel på det. Ändrar du villkoret får du läsa
igenom dem för hand.

TÄCKER INTE HELLER det som faktiskt körs. Konstanten i repot är inte
konstanten i Supabase förrän funktionerna har deployats om. Se
DEPLOY-BETALNING.md.
"""
import io, os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (fil, mönster, hur många träffar som ska finnas, vad stället är)
#
# Antalet träffar står med för att ett sökuttryck som inte hittar något
# annars ser ut som ett godkännande. Formuleras meningen om på
# prissidan slutar mönstret matcha, och utan den här siffran skulle
# verktyget tiga om ett ställe det har slutat bevaka.
STALLEN = [
    # En konstant, importerad av fakturering (förfallodagen när fakturan
    # skapas) och faktura-utskick (förfallodagen när den skickas).
    ('supabase/functions/_delad/konstanter.ts',
     r'^export const BETALNINGSVILLKOR_DAGAR = (\d+);$', 1,
     'förfallodagen i fakturering och faktura-utskick'),

    ('faq.html', r'(\d+) dagars betalningsvillkor', 2,
     'FAQ: hur betalningen fungerar (text + schema)'),
    ('faq.html', r'betalningsvillkoret är (\d+) dagar', 2,
     'FAQ: när fakturan kommer (text + schema)'),
    ('priser.html', r'(\d+) dagars betalningsvillkor', 1,
     'prissidan: när betalar vi'),
    ('anvandarvillkor.html', r'Betalningsvillkor är (\d+) dagar', 1,
     'användarvillkoren'),
    ('admin.html', r'adm-tal">(\d+) dagar<', 1,
     'adminvyn: rutan om månadskörningen'),

    ('en/faq.html', r'(\d+)-day payment terms', 2,
     'FAQ in English: how payment works (text + schema)'),
    ('en/faq.html', r'payment terms are (\d+) days', 2,
     'FAQ in English: when the invoice arrives (text + schema)'),
    ('en/priser.html', r'(\d+)-day payment terms', 1,
     'pricing page in English'),
    ('en/anvandarvillkor.html', r'Payment terms are (\d+) days', 1,
     'terms of use in English'),

    # Maskoten citerar FAQ:n ordagrant och byggs av
    # verktyg/bygg-maskotsvar.py. Står en gammal siffra kvar här har
    # någon ändrat FAQ:n utan att köra om verktyget — och då svarar
    # chatten fortfarande det gamla villkoret.
    ('nextrum-maskot-svar.js', r'(\d+) dagars betalningsvillkor', 2,
     'maskoten (svenska)'),
    ('nextrum-maskot-svar.js', r'betalningsvillkoret är (\d+) dagar', 1,
     'maskoten (svenska)'),
    ('nextrum-maskot-svar.js', r'(\d+)-day payment terms', 2,
     'maskoten (engelska)'),
    ('nextrum-maskot-svar.js', r'payment terms are (\d+) days', 1,
     'maskoten (engelska)'),
]


def las(fil):
    return io.open(os.path.join(ROT, fil), encoding='utf-8').read()


def main():
    cache, fynd, dagar = {}, [], {}

    for fil, monster, antal, vad in STALLEN:
        if fil not in cache:
            try:
                cache[fil] = las(fil)
            except IOError:
                fynd.append('SAKNAS   %s' % fil)
                cache[fil] = ''
        traffar = re.findall(monster, cache[fil], re.M)

        if len(traffar) != antal:
            fynd.append('OMSKRIVET  %s — %s: väntade %d träff%s på /%s/, hittade %d'
                        % (fil, vad, antal, '' if antal == 1 else 'ar', monster, len(traffar)))
        for t in traffar:
            dagar.setdefault(int(t), []).append('%s (%s)' % (fil, vad))

    if len(dagar) > 1:
        rader = ['SPRETAR  villkoret står med olika antal dagar:']
        for n in sorted(dagar):
            for var in sorted(set(dagar[n])):
                rader.append('    %2d dagar   %s' % (n, var))
        fynd.append('\n'.join(rader))

    if fynd:
        print('\n'.join(fynd))
        print('\n%d problem. Villkoret måste säga samma sak på alla ställen.'
              % len(fynd))
        return 1

    n = list(dagar)[0]
    print('ok   betalningsvillkoret är %d dagar på alla %d ställen'
          % (n, sum(len(v) for v in dagar.values())))
    return 0


if __name__ == '__main__':
    sys.exit(main())
