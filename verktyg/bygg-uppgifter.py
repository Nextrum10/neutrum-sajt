# -*- coding: utf-8 -*-
"""Bygger uppgiftsbanken: nivåerna i NexLäx (Fas 23.1, Fas 23.2).

       python3 verktyg/bygg-uppgifter.py            # sammanfattning per bana
       python3 verktyg/bygg-uppgifter.py --kolla    # prövar innehållet (CI)
       python3 verktyg/bygg-uppgifter.py --sql      # SQL till en migration
       python3 verktyg/bygg-uppgifter.py --visa [fil]  # frågorna med facit, att läsa igenom

Innehållet står i verktyg/uppgiftsbanken/, en fil per ämne, i klartext
och med facit uträknat i kod där det går. Den här filen läser dem,
prövar dem och skriver SQL som lägger in allt i nivaer och niva_fragor.

NY ELLER ÄNDRAD UPPGIFT:
  1. Ändra i verktyg/uppgiftsbanken/<ämne>.py.
  2. python3 verktyg/bygg-uppgifter.py --kolla
  3. python3 verktyg/bygg-uppgifter.py --sql > \\
       supabase/migrations/<version>_uppgiftsbanken_<vad>.sql
     Kör den med apply_migration EFTER merge, och döp om filen till
     versionen driften registrerade (avsnitt 5 i CLAUDE.md).
  --kolla jämför den senaste *_uppgiftsbanken_*.sql med det verktyget
  skriver nu. Ändras banken utan en ny migration blir CI rött.

MÄSTARPROVET OCH REPETITIONEN (Fas 23.2) läggs till här, inte i
filerna: ett Mästarprov sist i varje område och en repetition sist i
varje bana, med nycklar ur ämnet, årskursen och området. De har inga
egna frågor; databasen drar dem ur nivåerna när de startas. Ett område
där varje nivå har en lästext får inget Mästarprov: dess frågor dras
aldrig, för texten syns inte där.

SQL:en ersätter hela banken, och den är idempotent: varje nivå och
fråga har ett uuid5 ur sin nyckel och sitt innehåll. En nivå som tagits
bort ur filerna stängs av (aktiv = false), den tas inte bort: gamla
försök pekar på den. Samma sak med en fråga som ändrats, för då har den
fått ett nytt id. BANKEN ÄR SANNINGEN: en nivå som lagts in för hand i
Table Editor och inte står här stängs av vid nästa körning.

Serveras aldrig: .vercelignore utesluter /verktyg och /supabase.
"""
import glob
import hashlib
import importlib.util
import os
import re
import sys
import uuid

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANKEN = os.path.join(ROT, 'verktyg', 'uppgiftsbanken')
MIGRATIONER = os.path.join(ROT, 'supabase', 'migrations')
sys.path.insert(0, BANKEN)
# Ingen __pycache__ i repot: filerna läses en gång per körning.
sys.dont_write_bytecode = True

import grund  # noqa: E402

ARSKURSER = ['ak1', 'ak2', 'ak3', 'ak4', 'ak5', 'ak6', 'ak7', 'ak8', 'ak9', 'gy1', 'gy2', 'gy3']
NAMNRYMD = 'https://nextrum.se/uppgifter/'

# Början på nycklarna till Mästarprovet och repetitionen, per ämne. Samma
# som de handskrivna nycklarna börjar med (ma-ak8-…). Ett nytt ämne utan
# rad här får en nyckel ur sitt namn.
AMNESKORT = {'Matematik': 'ma', 'Svenska': 'sv', 'Engelska': 'en',
             'NO / Fysik / Kemi / Biologi': 'no', 'SO / Historia / Samhällskunskap': 'so',
             'Moderna språk': 'ms', 'Programmering': 'prog'}
# Området repetitionen står i. Upptaget: en handskriven nivå får inte heta så.
REPETITION = 'Repetition'
MASTARPROV = 'Mästarprov'
# Ett Mästarprov blandar frågor ur flera nivåer. I ett område med en enda
# nivå hade det varit samma frågor i ny ordning, och 50 XP för att göra om
# nivån: området får inget prov förrän det har två nivåer att dra ur.
MASTARPROV_MINST = 2


def slug(t):
    t = t.lower()
    for fran, till in (('å', 'a'), ('ä', 'a'), ('ö', 'o'), ('é', 'e'), ('ü', 'u')):
        t = t.replace(fran, till)
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', t)).strip('-')


def prefix(b):
    return '%s-%s' % (AMNESKORT.get(b['amne']) or slug(b['amne'])[:12], b['arskurs'])


def omradena(b):
    """Områdena i banan i den ordning de först står, med sina nivåer."""
    ut = []
    for n in b['nivaer']:
        if ut and ut[-1][0] == n['omrade']:
            ut[-1][1].append(n)
        else:
            ut.append((n['omrade'], [n]))
    return ut


def stegen(b):
    """Banans alla nivåer i ordning: de handskrivna, ett Mästarprov sist i
    varje område med minst två nivåer att dra ur (en nivå med lästext
    räknas inte: provet visar ingen text), och repetitionen sist."""
    ut = []
    for omrade, nivaer in omradena(b):
        for n in nivaer:
            ut.append(dict(n, sort='vanlig'))
        if sum(1 for n in nivaer if not n.get('lastext')) >= MASTARPROV_MINST:
            ut.append(dict(nyckel='%s-mastare-%s' % (prefix(b), slug(omrade)),
                           titel='%s: %s' % (MASTARPROV, omrade), omrade=omrade, fragor=[],
                           beskrivning='Blandade frågor ur hela området, i ny ordning varje gång. '
                                       'Klarar du det med minst två stjärnor sitter området.',
                           lastext=None, sort='mastare'))
    if any(not n.get('lastext') for n in b['nivaer']):
        ut.append(dict(nyckel='%s-repetition' % prefix(b), titel=REPETITION, omrade=REPETITION,
                       fragor=[], lastext=None, sort='repetition',
                       beskrivning='Det du svarat fel på förut, blandat med sådant du redan klarat.'))
    return ut


def amnen_i_appen():
    """Ämnena ur NX.AMNEN i nextrum-app.js, så att en bana aldrig får
    ett ämne som vyernas filter inte känner till."""
    with open(os.path.join(ROT, 'nextrum-app.js'), encoding='utf-8') as f:
        m = re.search(r'const AMNEN = \[(.*?)\];', f.read(), re.S)
    return re.findall(r"'([^']+)'", m.group(1)) if m else []


def las_banken():
    """En fil som inte går att läsa blir ett fel i listan, inte ett
    avbrott: resten av banken ska fortfarande gå att pröva."""
    banor, fel = [], []
    for fil in sorted(glob.glob(os.path.join(BANKEN, '*.py'))):
        namn = os.path.basename(fil)
        if namn in ('grund.py', '__init__.py'):
            continue
        spec = importlib.util.spec_from_file_location('bank_' + namn[:-3], fil)
        modul = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(modul)
        except Exception as e:  # noqa: BLE001 — felet ska stå i listan, vilket det än är
            fel.append('%s går inte att läsa: %s: %s' % (namn, type(e).__name__, e))
            continue
        for b in getattr(modul, 'BANOR', []):
            b['fil'] = namn
            banor.append(b)
    return banor, fel


def niva_id(n):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, NAMNRYMD + n['nyckel']))


def fraga_id(n, q):
    """Ur innehållet: en ändrad fråga är en ny fråga."""
    innehall = grund.json_text([q['typ'], q['fraga'], q['alternativ'], q['ratt']])
    summa = hashlib.sha1(innehall.encode('utf-8')).hexdigest()
    return str(uuid.uuid5(uuid.NAMESPACE_URL, NAMNRYMD + n['nyckel'] + '#' + summa))


def kolla(banor):
    fel = []
    amnen = amnen_i_appen()
    if not amnen:
        fel.append('Hittar inte AMNEN i nextrum-app.js')
    nycklar, banornas = {}, set()

    for b in banor:
        var = '%s (%s %s)' % (b['fil'], b['amne'], b['arskurs'])
        if amnen and b['amne'] not in amnen:
            fel.append('%s: ämnet %r finns inte i NX.AMNEN' % (var, b['amne']))
        if b['arskurs'] not in ARSKURSER:
            fel.append('%s: okänd årskurs %r' % (var, b['arskurs']))
        if (b['amne'], b['arskurs']) in banornas:
            fel.append('%s: banan finns redan, lägg nivåerna i samma bana' % var)
        banornas.add((b['amne'], b['arskurs']))
        if not b['nivaer']:
            fel.append('%s: banan är tom' % var)

        # Ett område på två ställen i banan hade blivit två block i
        # NexLäx med samma namn, och Mästarprovet hade hamnat i det första.
        namn = [o for o, _ in omradena(b)]
        for o in set(namn):
            if namn.count(o) > 1:
                fel.append('%s: området %r står på två ställen, håll dess nivåer intill varandra' % (var, o))

        for n in b['nivaer']:
            vid = '%s, nivå %s' % (var, n['nyckel'])
            if not re.match(r'^[a-z0-9-]{3,80}$', n['nyckel']):
                fel.append('%s: nyckeln får bara ha a–z, 0–9 och bindestreck' % vid)
            if n['nyckel'] in nycklar:
                fel.append('%s: nyckeln finns redan i %s' % (vid, nycklar[n['nyckel']]))
            nycklar[n['nyckel']] = var
            if not (1 <= len(n['titel'].strip()) <= 120):
                fel.append('%s: titeln ska vara 1–120 tecken' % vid)
            if not (1 <= len(n['omrade'].strip()) <= 80):
                fel.append('%s: området ska vara 1–80 tecken' % vid)
            if n['omrade'].strip() == REPETITION:
                fel.append('%s: området %r är upptaget av repetitionen' % (vid, REPETITION))
            if n['nyckel'].split('-')[2:3] in (['mastare'], ['repetition']):
                fel.append('%s: nycklar med mastare och repetition skrivs av verktyget' % vid)
            if n.get('lastext') is not None and not (1 <= len(n['lastext']) <= 3000):
                fel.append('%s: lästexten ska vara 1–3000 tecken' % vid)
            if n.get('beskrivning') and len(n['beskrivning']) > 400:
                fel.append('%s: beskrivningen är längre än 400 tecken' % vid)
            if not (5 <= len(n['fragor']) <= 12):
                fel.append('%s: %d frågor, ska vara 5–12' % (vid, len(n['fragor'])))

            sedda = set()
            for i, q in enumerate(n['fragor'], 1):
                qv = '%s, fråga %d' % (vid, i)
                if q['typ'] not in grund.TYPER:
                    fel.append('%s: okänd typ %r' % (qv, q['typ']))
                    continue
                if not (1 <= len(q['fraga']) <= 600):
                    fel.append('%s: frågan ska vara 1–600 tecken' % qv)
                if q.get('forklaring') and len(q['forklaring']) > 600:
                    fel.append('%s: förklaringen är längre än 600 tecken' % qv)
                if grund.norm(q['fraga']) in sedda:
                    fel.append('%s: samma fråga står två gånger i nivån' % qv)
                sedda.add(grund.norm(q['fraga']))

                if q['typ'] == 'val':
                    alt = q['alternativ']
                    if not (2 <= len(alt) <= 5):
                        fel.append('%s: %d alternativ, ska vara 2–5' % (qv, len(alt)))
                    if len({grund.norm(a) for a in alt}) != len(alt):
                        fel.append('%s: två alternativ är samma svar: %r' % (qv, alt))
                    if any(not a for a in alt):
                        fel.append('%s: ett alternativ är tomt' % qv)
                    # Spelaren ritar sant eller falskt när alternativen är
                    # exakt Sant, Falskt. I annan ordning, eller med ett
                    # tredje, blir det en vanlig fråga med knappar som
                    # ser ut som ett misstag.
                    if {grund.norm(a) for a in alt} & {'sant', 'falskt'} and alt != [grund.SANT, grund.FALSKT]:
                        fel.append('%s: sant eller falskt skrivs med sant(), alternativen %r' % (qv, alt))
                elif q['typ'] == 'para':
                    par = q['ratt']
                    if not (2 <= len(par) <= 6):
                        fel.append('%s: %d par, ska vara 2–6' % (qv, len(par)))
                    for sida, namn_ in ((0, 'vänster'), (1, 'höger')):
                        delar = [p[sida] for p in par]
                        if any(not grund.norm(d) for d in delar):
                            fel.append('%s: en %ssida är tom' % (qv, namn_))
                        if any(len(d) > 80 for d in delar):
                            fel.append('%s: en %ssida är längre än 80 tecken' % (qv, namn_))
                        if len({grund.norm(d) for d in delar}) != len(delar):
                            fel.append('%s: två %ssidor är samma: %r' % (qv, namn_, delar))
                elif q['typ'] == 'skriv':
                    if not (1 <= len(q['ratt']) <= 12):
                        fel.append('%s: 1–12 godtagna svar' % qv)
                    if any(not grund.norm(s) for s in q['ratt']):
                        fel.append('%s: ett godtaget svar är tomt' % qv)
                    if any(len(s) > 200 for s in q['ratt']):
                        fel.append('%s: ett godtaget svar är längre än 200 tecken' % qv)
                else:
                    if not (2 <= len(q['ratt']) + len(q['alternativ'] or []) <= 14) or len(q['ratt']) < 2:
                        fel.append('%s: en ordna-fråga har 2–14 brickor' % qv)
                    if any(not b for b in q['ratt'] + (q['alternativ'] or [])):
                        fel.append('%s: en bricka är tom' % qv)
    # Nycklarna verktyget skriver: giltiga och inte redan tagna.
    for b in banor:
        for n in stegen(b):
            if n['sort'] == 'vanlig':
                continue
            if not re.match(r'^[a-z0-9-]{3,80}$', n['nyckel']):
                fel.append('%s %s: den genererade nyckeln %r är ogiltig' % (b['amne'], b['arskurs'], n['nyckel']))
            if n['nyckel'] in nycklar:
                fel.append('%s %s: den genererade nyckeln %r finns redan' % (b['amne'], b['arskurs'], n['nyckel']))
            nycklar[n['nyckel']] = 'verktyget'
            if len(n['titel']) > 120:
                fel.append('%s %s: titeln %r är för lång' % (b['amne'], b['arskurs'], n['titel']))
    return fel


def sql(banor):
    def q(v):
        return 'null' if v is None else "'" + str(v).replace("'", "''") + "'"

    def j(v):
        return 'null' if v is None else q(grund.json_text(v)) + '::jsonb'

    nivarader, fragerader, niva_ids, fraga_ids = [], [], [], []
    antal_fragor = 0
    genererade = 0
    for b in banor:
        for ordning, n in enumerate(stegen(b), 1):
            nid = niva_id(n)
            niva_ids.append(nid)
            genererade += n['sort'] != 'vanlig'
            nivarader.append('  (%s, %s, %s, %s, %s, %s, %s, %d, %s, %s)' % (
                q(nid), q(n['nyckel']), q(b['amne']), q(b['arskurs']), q(n['omrade'].strip()),
                q(n['titel'].strip()), q(n.get('beskrivning')), ordning, q(n['sort']), q(n.get('lastext'))))
            for fnr, fr in enumerate(n['fragor'], 1):
                fid = fraga_id(n, fr)
                fraga_ids.append(fid)
                antal_fragor += 1
                ratt = fr['ratt']
                fragerader.append('  (%s, %s, %d, %s, %s, %s, %s, %s)' % (
                    q(fid), q(nid), fnr, q(fr['typ']), q(fr['fraga']), j(fr['alternativ']),
                    j(ratt), q(fr.get('forklaring'))))

    ut = []
    ut.append('-- ============================================================')
    ut.append('-- NEXTRUM — uppgiftsbanken (Fas 23.1, NexLäx i Fas 23.2)')
    ut.append('--')
    ut.append('-- GENERERAD av verktyg/bygg-uppgifter.py --sql. Ändra inte för hand:')
    ut.append('-- ändra i verktyg/uppgiftsbanken/ och skriv en ny migration.')
    ut.append('--')
    ut.append('-- %d banor, %d nivåer (varav %d Mästarprov och repetitioner), %d frågor.'
              % (len(banor), len(nivarader), genererade, antal_fragor))
    ut.append('-- Kräver fas23_1_uppgifterna_blir_digitala och fas23_2_nexlax.')
    ut.append('-- ============================================================')
    ut.append('')
    ut.append('insert into public.nivaer (id, nyckel, amne, arskurs, omrade, titel, beskrivning, ordning, sort, lastext) values')
    ut.append(',\n'.join(nivarader))
    ut.append('on conflict (id) do update set')
    ut.append('  nyckel = excluded.nyckel, amne = excluded.amne, arskurs = excluded.arskurs,')
    ut.append('  omrade = excluded.omrade, titel = excluded.titel, beskrivning = excluded.beskrivning,')
    ut.append('  ordning = excluded.ordning, sort = excluded.sort, lastext = excluded.lastext,')
    ut.append('  aktiv = true, updated_at = now();')
    ut.append('')
    ut.append('-- Nivåer som inte längre står i banken stängs av. Försöken pekar på dem.')
    ut.append('update public.nivaer set aktiv = false, updated_at = now()')
    ut.append(' where aktiv and id not in (%s);' % ', '.join(q(x) for x in niva_ids))
    ut.append('')
    ut.append('-- Frågor som ändrats har fått ett nytt id. De gamla stängs av, så att')
    ut.append('-- svar som redan getts fortfarande pekar på det som frågades.')
    ut.append('update public.niva_fragor set aktiv = false')
    ut.append(' where aktiv and id not in (%s);' % ', '.join(q(x) for x in fraga_ids))
    ut.append('')
    ut.append('insert into public.niva_fragor (id, niva_id, ordning, typ, fraga, alternativ, ratt, forklaring) values')
    ut.append(',\n'.join(fragerader))
    ut.append('on conflict (id) do update set')
    ut.append('  ordning = excluded.ordning, forklaring = excluded.forklaring, aktiv = true;')
    return '\n'.join(ut) + '\n'


def visa(banor, bara=None):
    """Frågorna som text, med facit och förklaring. För den som ska
    läsa igenom en bana innan den går ut: ett facit som räknats fram i
    kod syns först här."""
    for b in banor:
        if bara and b['fil'] != bara:
            continue
        print('=' * 72)
        print('%s %s  (%s)' % (b['amne'], b['arskurs'], b['fil']))
        for n in stegen(b):
            print('-' * 72)
            print('%s  %s  [%s]%s' % (n['nyckel'], n['titel'], n['omrade'],
                                      '' if n['sort'] == 'vanlig' else '  (%s, dras ur nivåerna)' % n['sort']))
            if n.get('lastext'):
                print('  TEXT: %s' % n['lastext'])
            for i, q in enumerate(n['fragor'], 1):
                print('  %d. (%s) %s' % (i, q['typ'], q['fraga']))
                if q['typ'] == 'val':
                    for j, a in enumerate(q['alternativ']):
                        print('       %s %s' % ('*' if j == q['ratt'] else ' ', a))
                elif q['typ'] == 'para':
                    for v, h in q['ratt']:
                        print('       %s  ↔  %s' % (v, h))
                elif q['typ'] == 'skriv':
                    print('       godtas: %s' % ' | '.join(q['ratt']))
                else:
                    print('       ordning: %s' % ' / '.join(q['ratt']))
                    if q['alternativ']:
                        print('       extra: %s' % ' / '.join(q['alternativ']))
                if q.get('forklaring'):
                    print('       varför: %s' % q['forklaring'])


def senaste_migrationen():
    filer = sorted(glob.glob(os.path.join(MIGRATIONER, '*_uppgiftsbanken*.sql')))
    return filer[-1] if filer else None


def main():
    banor, fel = las_banken()
    fel += kolla(banor)

    if '--sql' in sys.argv:
        if fel:
            print('\n'.join(fel), file=sys.stderr)
            return 1
        sys.stdout.write(sql(banor))
        return 0

    if '--visa' in sys.argv:
        i = sys.argv.index('--visa')
        visa(banor, sys.argv[i + 1] if len(sys.argv) > i + 1 else None)
        return 1 if fel else 0

    if '--kolla' in sys.argv:
        senast = senaste_migrationen()
        if not senast:
            fel.append('Ingen migration *_uppgiftsbanken*.sql. Skriv en med --sql.')
        else:
            with open(senast, encoding='utf-8') as f:
                if f.read() != sql(banor):
                    fel.append('%s är inte det verktyget skriver nu. Banken har ändrats utan en ny '
                               'migration: kör --sql till en ny fil (se filhuvudet).'
                               % os.path.relpath(senast, ROT))
        if fel:
            print('\n'.join(fel))
            print('\n%d problem i uppgiftsbanken.' % len(fel))
            return 1
        nivaer = sum(len(b['nivaer']) for b in banor)
        extra = sum(len(stegen(b)) - len(b['nivaer']) for b in banor)
        fragor = sum(len(n['fragor']) for b in banor for n in b['nivaer'])
        print('ok   %d banor, %d nivåer och %d Mästarprov och repetitioner, %d frågor'
              % (len(banor), nivaer, extra, fragor))
        return 0

    for b in banor:
        fragor = sum(len(n['fragor']) for n in b['nivaer'])
        extra = len(stegen(b)) - len(b['nivaer'])
        print('%-34s %-4s %2d nivåer %4d frågor  +%d genererade  %s'
              % (b['amne'], b['arskurs'], len(b['nivaer']), fragor, extra, b['fil']))
    if fel:
        print('\n' + '\n'.join(fel))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
