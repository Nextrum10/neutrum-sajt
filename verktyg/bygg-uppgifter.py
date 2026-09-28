# -*- coding: utf-8 -*-
"""Bygger uppgiftsbanken: de digitala nivåerna i Uppgifter (Fas 23.1).

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
    return fel


def sql(banor):
    def q(v):
        return 'null' if v is None else "'" + str(v).replace("'", "''") + "'"

    def j(v):
        return 'null' if v is None else q(grund.json_text(v)) + '::jsonb'

    nivarader, fragerader, niva_ids, fraga_ids = [], [], [], []
    antal_fragor = 0
    for b in banor:
        for ordning, n in enumerate(b['nivaer'], 1):
            nid = niva_id(n)
            niva_ids.append(nid)
            nivarader.append('  (%s, %s, %s, %s, %s, %s, %s, %d)' % (
                q(nid), q(n['nyckel']), q(b['amne']), q(b['arskurs']), q(n['omrade'].strip()),
                q(n['titel'].strip()), q(n.get('beskrivning')), ordning))
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
    ut.append('-- NEXTRUM — uppgiftsbanken (Fas 23.1)')
    ut.append('--')
    ut.append('-- GENERERAD av verktyg/bygg-uppgifter.py --sql. Ändra inte för hand:')
    ut.append('-- ändra i verktyg/uppgiftsbanken/ och skriv en ny migration.')
    ut.append('--')
    ut.append('-- %d banor, %d nivåer, %d frågor.' % (len(banor), len(nivarader), antal_fragor))
    ut.append('-- Kräver fas23_1_uppgifterna_blir_digitala.')
    ut.append('-- ============================================================')
    ut.append('')
    ut.append('insert into public.nivaer (id, nyckel, amne, arskurs, omrade, titel, beskrivning, ordning) values')
    ut.append(',\n'.join(nivarader))
    ut.append('on conflict (id) do update set')
    ut.append('  nyckel = excluded.nyckel, amne = excluded.amne, arskurs = excluded.arskurs,')
    ut.append('  omrade = excluded.omrade, titel = excluded.titel, beskrivning = excluded.beskrivning,')
    ut.append('  ordning = excluded.ordning, aktiv = true, updated_at = now();')
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
        for n in b['nivaer']:
            print('-' * 72)
            print('%s  %s  [%s]' % (n['nyckel'], n['titel'], n['omrade']))
            for i, q in enumerate(n['fragor'], 1):
                print('  %d. (%s) %s' % (i, q['typ'], q['fraga']))
                if q['typ'] == 'val':
                    for j, a in enumerate(q['alternativ']):
                        print('       %s %s' % ('*' if j == q['ratt'] else ' ', a))
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
        fragor = sum(len(n['fragor']) for b in banor for n in b['nivaer'])
        print('ok   %d banor, %d nivåer, %d frågor' % (len(banor), nivaer, fragor))
        return 0

    for b in banor:
        fragor = sum(len(n['fragor']) for n in b['nivaer'])
        print('%-34s %-4s %2d nivåer %4d frågor  %s' % (b['amne'], b['arskurs'], len(b['nivaer']), fragor, b['fil']))
    if fel:
        print('\n' + '\n'.join(fel))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
