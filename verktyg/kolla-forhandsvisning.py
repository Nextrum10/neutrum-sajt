# -*- coding: utf-8 -*-
"""Kollar att förhandsvisningens NexLäx räknar stjärnor som databasen.

       python3 verktyg/kolla-forhandsvisning.py

Sedan 2026-10-27 spelar förhandsvisningen den riktiga banan, men inget
försök sparas i databasen: försöket och stjärnorna står i webbläsaren
(nextrum-forhandsvisning.js, bokför()). Gränserna för stjärnorna står
därför på två ställen, i niva_svara och i förhandsvisningen. Ändras de i
databasen utan att förhandsvisningen följer med, visar den andra
stjärnor än eleven får, och ingen märker det.

Det här jämför gränserna:

  · den senaste migrationen med niva_svaras stjärnregel (v_stj) har tre gränser
    (en senare migration som lappar niva_svara med replace() rör inte regeln): alla
    rätt direkt ger tre, sedan "direkt * A >= antal * B" för två och för en
  · bokför() i nextrum-forhandsvisning.js har samma tre

Ändras gränserna i niva_svara: ändra raden i bokför() i samma ändring.
"""
import os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPP = os.path.join(ROT, 'supabase', 'migrations')
VYN = os.path.join(ROT, 'nextrum-forhandsvisning.js')

DB = re.compile(r'v_stj\s*:=\s*case\s+when\s+v_direkt\s*=\s*v_antal\s+then\s+3\s+'
                r'when\s+v_direkt\s*\*\s*(\d+)\s*>=\s*v_antal\s*\*\s*(\d+)\s+then\s+2\s+'
                r'when\s+v_direkt\s*\*\s*(\d+)\s*>=\s*v_antal\s*\*\s*(\d+)\s+then\s+1\s+'
                r'else\s+0\s+end', re.I)
JS = re.compile(r'f\.stjarnor\s*=\s*f\.ratt_direkt\s*===\s*antal\s*\?\s*3\s*:\s*'
                r'f\.ratt_direkt\s*\*\s*(\d+)\s*>=\s*antal\s*\*\s*(\d+)\s*\?\s*2\s*:\s*'
                r'f\.ratt_direkt\s*\*\s*(\d+)\s*>=\s*antal\s*\*\s*(\d+)\s*\?\s*1\s*:\s*0')


def main():
    senaste = None
    for f in sorted(os.listdir(MAPP)):
        if not f.endswith('.sql'):
            continue
        text = open(os.path.join(MAPP, f), encoding='utf-8').read()
        if re.search(r'v_stj\s*:=', text, re.I):
            senaste = (f, text)
    if not senaste:
        print('FEL  ingen migration har niva_svaras stjärnregel (v_stj :=)')
        return 1
    db = DB.search(senaste[1])
    if not db:
        print('FEL  %s sätter v_stj, men stjärnornas gränser gick inte att läsa ur den.' % senaste[0])
        print('     Har regeln flyttats? Lär det här verktyget den nya formen.')
        return 1
    js = JS.search(open(VYN, encoding='utf-8').read())
    if not js:
        print('FEL  stjärnornas gränser gick inte att läsa ur bokför() i nextrum-forhandsvisning.js')
        return 1
    if db.groups() != js.groups():
        print('FEL  stjärnorna räknas olika:')
        print('     niva_svara (%s): två vid direkt*%s >= antal*%s, en vid direkt*%s >= antal*%s' % ((senaste[0],) + db.groups()))
        print('     förhandsvisningen: två vid direkt*%s >= antal*%s, en vid direkt*%s >= antal*%s' % js.groups())
        return 1
    print('ok   förhandsvisningen räknar stjärnor som niva_svara (%s)' % senaste[0])
    return 0


if __name__ == '__main__':
    sys.exit(main())
