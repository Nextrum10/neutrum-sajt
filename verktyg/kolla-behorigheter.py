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
funktionen barn-konto, inloggningen (nextrum-studie.js, som alla fyra
vyerna delar sedan 2026-10-01) och föräldrarnas ruta prövar dem var för
sig.

Och för vad ett barn får se och göra (barnets_behorigheter, 2026-10-06):
listan står i intern.barn_behorigheter_alla() och, utan rapporterna, i
villkoret på students; förvalet i kolumnen och i skydda_studentfalt;
och i föräldrarnas ruta (BARN_FÅR och BARN_FÅR_FÖRVAL) och elevvyn
(FÅR). En sak som vyn erbjuder och databasen nekar blir ett fel för
föräldern; en som databasen har och vyn saknar går inte att slå av.

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

    # Vad barnet får (barnets_behorigheter).
    alla = sista(r"create or replace function intern\.barn_behorigheter_alla\(\).*?array\[(.*?)\]")
    kanda = sista(r"add constraint students_barn_behorigheter_kanda\s+check \(barn_behorigheter <@ array\[(.*?)\]")
    forval = sista(r"add column if not exists barn_behorigheter text\[\] not null default '\{(.*?)\}'")
    if not alla or not kanda or not forval:
        fynd.append('Hittar inte barnets behörigheter i migrationerna.')
        antal_far = 0
    else:
        lista = ord_i(alla[1])
        antal_far = len(lista)
        if sorted(ord_i(kanda[1])) != sorted(x for x in lista if x != 'rapporter'):
            fynd.append('Villkoret students_barn_behorigheter_kanda (%s) och intern.barn_behorigheter_alla() (%s) '
                        'har olika listor.' % (kanda[0], alla[0]))
        forvalet = forval[1].split(',')
        sql = '\n'.join(io.open(f, encoding='utf-8').read() for f in migrationer())
        if sql.count("new.barn_behorigheter         := '{%s}';" % forval[1]) < 2:
            fynd.append('skydda_studentfalt och skydda_studentfalt_ny börjar inte om från kolumnens förval {%s}.'
                        % forval[1])
        vy = las('nextrum-studie-vy.js')
        m = re.search(r"const BARN_FÅR = \[(.*?)\n  \];", vy, re.S)
        if not m or re.findall(r"\[\s*'([a-z_]+)',", m.group(1)) != lista:
            fynd.append('nextrum-studie-vy.js (BARN_FÅR) har en annan lista än databasen: %s' % ', '.join(lista))
        m = re.search(r"const BARN_FÅR_FÖRVAL = \[(.*?)\];", vy, re.S)
        if not m or ord_i(m.group(1)) != forvalet:
            fynd.append('nextrum-studie-vy.js (BARN_FÅR_FÖRVAL) har ett annat förval än kolumnen: {%s}' % forval[1])
        m = re.search(r"const FÅR = \{(.*?)\};", las('nextrum-barn-vy.js'), re.S)
        if not m or sorted(re.findall(r"^\s*([a-z_]+):", m.group(1), re.M)) != sorted(lista):
            fynd.append('nextrum-barn-vy.js (FÅR) har en annan lista än databasen: %s' % ', '.join(lista))

    if fynd:
        print('\n'.join(fynd))
        return 1
    print('ok   %d behörigheter på fyra ställen, användarnamnet på fyra, domänen %s, och barnets %d val på fem'
          % (len(db), doman, antal_far))
    return 0


if __name__ == '__main__':
    sys.exit(main())
