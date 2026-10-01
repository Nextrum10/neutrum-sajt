# -*- coding: utf-8 -*-
"""Kollar att adminbehörigheterna och barnkontonas regler säger samma sak
överallt (barnkonton_och_admin).

       python3 verktyg/kolla-behorigheter.py

VARFÖR

Listan över behörigheter står på fyra ställen: i CHECK-villkoret på
admin_roller och i intern.admin_behorigheter() (båda i migrationen), i
edge-funktionen admin-skapa (_delad/adminbehorighet.ts) och i adminvyn
(nextrum-admin-behorighet.js). Villkoret kan inte fråga funktionen,
för ett CHECK körs som anroparen (CLAUDE.md, avsnitt 6), och vyn och
funktionen kan inte läsa databasen när de laddas. Glider listorna isär
blir det tyst fel: en ruta i vyn som databasen vägrar spara, eller en
inbjudan som går iväg med en behörighet villkoret sedan säger nej till.

Samma sak för barnens användarnamn och domän: databasen, edge-
funktionen barn-konto, barnets inloggning (nextrum-studie.js, som
barnets vy och studievyn delar sedan 2026-10-01) och föräldrarnas ruta
prövar dem var för sig.

Den nyaste migrationen som definierar något gäller.
"""
import glob, io, os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def las(rel):
    return io.open(os.path.join(ROT, rel), encoding='utf-8').read()


def migrationer():
    return sorted(glob.glob(os.path.join(ROT, 'supabase', 'migrations', '*.sql')))


def sista(monster, flaggor=re.S):
    """Sista träffen i den nyaste migrationen som har en."""
    svar = None
    for f in migrationer():
        for m in re.finditer(monster, io.open(f, encoding='utf-8').read(), flaggor):
            svar = (os.path.basename(f), m.group(1))
    return svar


def ord_i(text):
    return re.findall(r"'([a-z_]+)'", text)


def main():
    fynd = []

    funk = sista(r"create or replace function intern\.admin_behorigheter\(\).*?array\[(.*?)\]")
    villkor = sista(r"add constraint admin_roller_behorigheter_kanda\s+check \(behorigheter <@ array\[(.*?)\]")
    if not funk or not villkor:
        print('Hittar inte behörigheterna i migrationerna.')
        return 1
    db = ord_i(funk[1])
    if ord_i(villkor[1]) != db:
        fynd.append('Villkoret (%s) och intern.admin_behorigheter() (%s) har olika listor.' % (villkor[0], funk[0]))

    ts = re.search(r"export const BEHORIGHETER = \[(.*?)\] as const", las('supabase/functions/_delad/adminbehorighet.ts'), re.S)
    if not ts or ord_i(ts.group(1)) != db:
        fynd.append('_delad/adminbehorighet.ts har en annan lista än databasen.')

    js = re.search(r"const BEHORIGHETER = \[(.*?)\n  \];", las('nextrum-admin-behorighet.js'), re.S)
    vy = re.findall(r"\[\s*'([a-z_]+)',", js.group(1)) if js else []
    if vy != db:
        fynd.append('nextrum-admin-behorighet.js har en annan lista än databasen: %s' % ', '.join(vy))

    # Barnens användarnamn: samma mönster i databasen och i de tre klienterna.
    namn_db = sista(r"add constraint students_anvandarnamn_form\s+check \(.*?anvandarnamn ~ '(.*?)'\)")
    monster = namn_db[1] if namn_db else None
    if not monster:
        fynd.append('Hittar inte villkoret students_anvandarnamn_form i migrationerna.')
    else:
        for fil, rx in [('supabase/functions/_delad/barnkonto.ts', r"export const ANVANDARNAMN = /(.*?)/;"),
                        ('nextrum-studie.js', r"var BARNNAMN = /(.*?)/;"),
                        ('nextrum-studie-vy.js', r"const BI_NAMN = /(.*?)/;")]:
            m = re.search(rx, las(fil))
            if not m or m.group(1) != monster:
                fynd.append('%s prövar användarnamnet på ett annat sätt än databasen (%s).' % (fil, monster))

    # Domänen.
    doman = re.search(r"export const BARN_DOMAN = '(.*?)';", las('supabase/functions/_delad/barnkonto.ts'))
    doman = doman.group(1) if doman else None
    if not doman:
        fynd.append('Hittar inte BARN_DOMAN i _delad/barnkonto.ts.')
    else:
        if "var BARNDOMÄN = '@%s';" % doman not in las('nextrum-studie.js'):
            fynd.append('nextrum-studie.js bygger adressen med en annan domän än %s.' % doman)
        sql = '\n'.join(io.open(f, encoding='utf-8').read() for f in migrationer())
        if "'%%@%s'" % doman not in sql:
            fynd.append('Ingen migration spärrar domänen %s.' % doman)

    if fynd:
        print('\n'.join(fynd))
        return 1
    print('ok   %d behörigheter på fyra ställen, användarnamnet på fyra, domänen %s' % (len(db), doman))
    return 0


if __name__ == '__main__':
    sys.exit(main())
