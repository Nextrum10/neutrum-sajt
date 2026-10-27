# -*- coding: utf-8 -*-
"""Bygger faktabladen i NexLäx (2026-10-27): ett per område i banken.

       python3 verktyg/bygg-faktablad.py              # sammanfattning, och vilka som saknas
       python3 verktyg/bygg-faktablad.py --skriv      # skriver nexlax-fakta/*.json
       python3 verktyg/bygg-faktablad.py --kolla      # prövar allt (CI)
       python3 verktyg/bygg-faktablad.py --saknas [ämne] [årskurs]
       python3 verktyg/bygg-faktablad.py --omraden <ämne> <årskurs>   # banans områden i ordning
       python3 verktyg/bygg-faktablad.py --omrade <ämne> <årskurs> <område>
                                                       # nivåerna och frågorna, att skriva bladet efter

Bladen står i verktyg/faktablad/, i klartext (se fakta.py). Områdena står
i verktyg/uppgiftsbanken/, och den här filen läser dem genom
bygg-uppgifter.py, så att ett blad aldrig pekar på ett område som inte
finns och varje område har ett blad.

VARFÖR EN FIL I SAJTEN OCH INTE EN TABELL: ett område är ingen rad i
databasen (nivaer.omrade är text), bladet är inte hemligt, och barnets
roll når inga tabeller. En statisk fil per bana (nexlax-fakta/
<ämne>-<årskurs>.json, ämnet som i slug() nedan) hämtas av NexLäx när
banan visas, i studievyn, studiehjälparvyn och barnets vy, och kostar
ingenting förrän den behövs.

--kolla (CI) nekar ett område utan blad, ett blad utan område, för långa
fält, och en JSON-fil som inte är det verktyget skriver nu. Ändras ett
blad: kör --skriv och checka in filen.
"""
import glob
import importlib.util
import io
import json
import os
import re
import sys
import unicodedata

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLADEN = os.path.join(ROT, 'verktyg', 'faktablad')
UT = os.path.join(ROT, 'nexlax-fakta')
sys.dont_write_bytecode = True
sys.path.insert(0, BLADEN)

_spec = importlib.util.spec_from_file_location('bygg_uppgifter', os.path.join(ROT, 'verktyg', 'bygg-uppgifter.py'))
bygg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bygg)

# Gränserna: ett faktablad är kort. Det ska gå att läsa på en telefon
# innan första frågan, inte vara ett kapitel.
GRANS = {
    'mal': (2, 4, 160),
    'fakta': (2, 5, 220),
    'exempel': (0, 2, None),
    'ord': (0, 6, None),
}
EXEMPEL_FRAGA, EXEMPEL_SVAR = 180, 320
ORD_ORD, ORD_FORKLARING = 50, 160
TIPS = 220


def slug(t):
    """Filnamnet för ett ämne. Samma regel som filnamn() i
    nextrum-uppgifter.js: gemener, utan accenter, allt annat bindestreck."""
    t = unicodedata.normalize('NFKD', t.lower())
    t = ''.join(c for c in t if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def filnamn(amne, arskurs):
    return '%s-%s.json' % (slug(amne), arskurs)


def las_bladen():
    blad, fel = [], []
    for fil in sorted(glob.glob(os.path.join(BLADEN, '*.py'))):
        namn = os.path.basename(fil)
        if namn in ('fakta.py', '__init__.py'):
            continue
        spec = importlib.util.spec_from_file_location('fakta_' + namn[:-3], fil)
        modul = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(modul)
        except Exception as e:  # noqa: BLE001 — felet ska stå i listan
            fel.append('%s går inte att läsa: %s: %s' % (namn, type(e).__name__, e))
            continue
        for b in getattr(modul, 'FAKTABLAD', []):
            b['fil'] = namn
            blad.append(b)
    return blad, fel


def omradena():
    """{(ämne, årskurs): [område, …]} ur banken, i banans ordning."""
    banor, fel = bygg.las_banken()
    ut = {}
    for b in banor:
        ut[(b['amne'], b['arskurs'])] = [o.strip() for o, _ in bygg.omradena(b)]
    return ut, banor, fel


def text_ok(s, maxlen):
    return isinstance(s, str) and 1 <= len(s.strip()) <= maxlen and s == s.strip()


def kolla(blad, omr):
    fel = []
    sedda = {}
    for b in blad:
        var = '%s (%s %s: %s)' % (b['fil'], b['amne'], b['arskurs'], b['omrade'])
        nyckel = (b['amne'], b['arskurs'], b['omrade'])
        if nyckel in sedda:
            fel.append('%s: området har redan ett blad i %s' % (var, sedda[nyckel]))
        sedda[nyckel] = b['fil']
        if b['omrade'] not in omr.get((b['amne'], b['arskurs']), []):
            fel.append('%s: området finns inte i den banan i uppgiftsbanken' % var)
        for falt, (minst, mest, langd) in GRANS.items():
            v = b[falt]
            if not (minst <= len(v) <= mest):
                fel.append('%s: %s har %d rader, ska vara %d–%d' % (var, falt, len(v), minst, mest))
            if langd:
                for rad in v:
                    if not text_ok(rad, langd):
                        fel.append('%s: en rad i %s är tom, har mellanslag i kanten eller är längre än %d tecken: %r'
                                   % (var, falt, langd, rad))
        for e in b['exempel']:
            if len(e) != 2 or not text_ok(e[0], EXEMPEL_FRAGA) or not text_ok(e[1], EXEMPEL_SVAR):
                fel.append('%s: ett exempel ska vara (fråga ≤ %d, lösning ≤ %d tecken): %r'
                           % (var, EXEMPEL_FRAGA, EXEMPEL_SVAR, e))
        for o in b['ord']:
            if len(o) != 2 or not text_ok(o[0], ORD_ORD) or not text_ok(o[1], ORD_FORKLARING):
                fel.append('%s: ett ord ska vara (ord ≤ %d, förklaring ≤ %d tecken): %r'
                           % (var, ORD_ORD, ORD_FORKLARING, o))
        if b['tips'] is not None and not text_ok(b['tips'], TIPS):
            fel.append('%s: tipset är tomt eller längre än %d tecken' % (var, TIPS))
    return fel, sedda


def saknas(omr, sedda, amne=None, arskurs=None):
    ut = []
    for (a, k), lista in omr.items():
        if (amne and a != amne) or (arskurs and k != arskurs):
            continue
        for o in lista:
            if (a, k, o) not in sedda:
                ut.append((a, k, o))
    return ut


def filerna(blad, omr):
    """{filnamn: json-text}: ett objekt per bana med områdena i banans ordning."""
    per = {}
    for b in blad:
        per.setdefault((b['amne'], b['arskurs']), {})[b['omrade']] = b
    ut = {}
    for (a, k), lista in sorted(omr.items()):
        finns = per.get((a, k), {})
        data = {}
        for o in lista:
            if o in finns:
                b = finns[o]
                d = {'mal': b['mal'], 'fakta': b['fakta']}
                if b['exempel']:
                    d['exempel'] = b['exempel']
                if b['ord']:
                    d['ord'] = b['ord']
                if b['tips']:
                    d['tips'] = b['tips']
                data[o] = d
        if data:
            ut[filnamn(a, k)] = json.dumps(data, ensure_ascii=False, indent=1, sort_keys=False) + '\n'
    return ut


def visa_omrade(banor, amne, arskurs, omrade):
    for b in banor:
        if b['amne'] != amne or b['arskurs'] != arskurs:
            continue
        for o, nivaer in bygg.omradena(b):
            if o.strip() != omrade:
                continue
            for n in nivaer:
                print('-' * 72)
                print('%s  %s' % (n['nyckel'], n['titel']))
                if n.get('beskrivning'):
                    print('  (%s)' % n['beskrivning'])
                if n.get('lastext'):
                    print('  TEXT: %s' % n['lastext'][:400])
                for i, q in enumerate(n['fragor'], 1):
                    print('  %d. (%s) %s' % (i, q['typ'], q['fraga']))
                    if q['typ'] == 'val':
                        print('       svar: %s' % q['alternativ'][q['ratt']])
                    elif q['typ'] == 'skriv':
                        print('       svar: %s' % ' | '.join(q['ratt']))
                    elif q['typ'] == 'para':
                        print('       par: %s' % '; '.join('%s = %s' % (v, h) for v, h in q['ratt']))
                    else:
                        print('       ordning: %s' % ' / '.join(q['ratt']))
            return 0
    print('Hittar inte %s %s %r' % (amne, arskurs, omrade))
    return 1


def main():
    omr, banor, bankfel = omradena()
    blad, fel = las_bladen()
    if bankfel:
        fel += ['uppgiftsbanken: ' + f for f in bankfel]
    kfel, sedda = kolla(blad, omr)
    fel += kfel

    if '--omrade' in sys.argv:
        i = sys.argv.index('--omrade')
        return visa_omrade(banor, *sys.argv[i + 1:i + 4])

    if '--omraden' in sys.argv:
        i = sys.argv.index('--omraden')
        amne, arskurs = sys.argv[i + 1:i + 3]
        for o in omr.get((amne, arskurs), []):
            print('%s%s' % (o, '' if (amne, arskurs, o) in sedda else '\t(inget blad än)'))
        return 0

    if '--saknas' in sys.argv:
        i = sys.argv.index('--saknas')
        arg = sys.argv[i + 1:i + 3]
        for a, k, o in saknas(omr, sedda, *(arg + [None, None])[:2]):
            print('%s\t%s\t%s' % (a, k, o))
        return 0

    if '--skriv' in sys.argv:
        if fel:
            print('\n'.join(fel), file=sys.stderr)
            return 1
        os.makedirs(UT, exist_ok=True)
        nya = filerna(blad, omr)
        for gammal in glob.glob(os.path.join(UT, '*.json')):
            if os.path.basename(gammal) not in nya:
                os.remove(gammal)
        for namn, text in nya.items():
            with io.open(os.path.join(UT, namn), 'w', encoding='utf-8', newline='\n') as f:
                f.write(text)
        print('skrev %d filer i nexlax-fakta/' % len(nya))
        return 0

    if '--kolla' in sys.argv:
        for a, k, o in saknas(omr, sedda):
            fel.append('%s %s: området %r har inget faktablad' % (a, k, o))
        nya = filerna(blad, omr)
        finns = {os.path.basename(f) for f in glob.glob(os.path.join(UT, '*.json'))}
        for namn, text in nya.items():
            sokvag = os.path.join(UT, namn)
            if not os.path.exists(sokvag) or io.open(sokvag, encoding='utf-8').read() != text:
                fel.append('nexlax-fakta/%s är inte det verktyget skriver nu: kör --skriv' % namn)
        for namn in finns - set(nya):
            fel.append('nexlax-fakta/%s hör inte till någon bana: kör --skriv' % namn)
        if fel:
            print('\n'.join(fel))
            print('\n%d problem i faktabladen.' % len(fel))
            return 1
        print('ok   %d faktablad, ett per område i %d banor' % (len(blad), len(nya)))
        return 0

    tot = sum(len(v) for v in omr.values())
    print('%d av %d områden har ett faktablad' % (len(sedda), tot))
    if fel:
        print('\n' + '\n'.join(fel))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
