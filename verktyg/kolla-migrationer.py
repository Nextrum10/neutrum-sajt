# -*- coding: utf-8 -*-
"""Kollar att migrationsmappen följer namnregeln.

       python3 verktyg/kolla-migrationer.py

Sedan Fas 1 heter varje migration supabase/migrations/<version>_<namn>.sql,
där versionen är exakt den som apply_migration registrerade i
supabase_migrations.schema_migrations. Det är det som gör att mappen går
att ställa mot driften rad för rad (list_migrations).

Före det låg schema-v13.sql två gånger, v16 och v17 i tre varianter, och
ingen fil sa vilken version i driften den motsvarade. De filerna ligger
nu i supabase/migrations/arkiv/ med en README som mappar dem. Verktyget
ser till att det inte börjar om:

  · varje .sql direkt i supabase/migrations/ har formen
    ÅÅÅÅMMDDTTMMSS_namn.sql, med gemener, siffror och understreck
  · ingen version finns två gånger
  · inga schema*.sql ligger kvar i projektroten
  · arkivet har kvar sin README

Det kontrollerar INTE att versionerna finns i driften — det kräver en
databasanslutning som CI inte har. Gör det för hand med list_migrations
efter varje ny migration.
"""
import os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPP = os.path.join(ROT, 'supabase', 'migrations')
NAMN = re.compile(r'^(\d{14})_[a-z0-9_]+\.sql$')


def main():
    fynd, sedda = [], {}

    for f in sorted(os.listdir(MAPP)):
        sokvag = os.path.join(MAPP, f)
        if os.path.isdir(sokvag):
            if f != 'arkiv':
                fynd.append('OKÄND MAPP  supabase/migrations/%s' % f)
            continue
        if not f.endswith('.sql'):
            fynd.append('INTE SQL    supabase/migrations/%s' % f)
            continue
        m = NAMN.match(f)
        if not m:
            fynd.append('FEL NAMN    supabase/migrations/%s — ska vara ÅÅÅÅMMDDTTMMSS_namn.sql' % f)
            continue
        version = m.group(1)
        if version in sedda:
            fynd.append('DUBBLETT    version %s: %s och %s' % (version, sedda[version], f))
        sedda[version] = f
        if os.path.getsize(sokvag) == 0:
            fynd.append('TOM FIL     supabase/migrations/%s' % f)

    for f in sorted(os.listdir(ROT)):
        if re.match(r'^schema.*\.sql$', f):
            fynd.append('I ROTEN     %s — hör hemma i supabase/migrations/arkiv/' % f)

    if not os.path.exists(os.path.join(MAPP, 'arkiv', 'README.md')):
        fynd.append('SAKNAS      supabase/migrations/arkiv/README.md')

    if fynd:
        print('\n'.join(fynd))
        print('\n%d problem i migrationsmappen.' % len(fynd))
        return 1

    print('ok   %d migrationer, alla med versionsnamn' % len(sedda))
    return 0


if __name__ == '__main__':
    sys.exit(main())
