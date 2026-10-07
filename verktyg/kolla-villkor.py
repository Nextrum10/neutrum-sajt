# -*- coding: utf-8 -*-
"""Kollar att användarvillkorens version i databasen är sidans datum.

       python3 verktyg/kolla-villkor.py

Sedan 2026-10-07 sparas vem som godkänt vilken version av
användarvillkoren (villkoren_godkanns), och den som inte godkänt den
gällande versionen får frågan vid nästa inloggning och kan inte boka
eller köpa timmar innan dess. Versionen är datumet sist i
anvandarvillkor.html ("Senast uppdaterad 30 september 2026"), och i
databasen står den i intern.villkor_version().

Ändras villkoren utan att versionen byts får ingen frågan, och den som
bokar har godkänt en text som inte står på sidan längre. Byts versionen
utan att sidan ändrats får alla frågan om något som inte ändrats. Det
här ser till att de följs åt:

  · den senaste migrationen som skriver intern.villkor_version() har
    samma datum som anvandarvillkor.html
  · den engelska sidan säger samma datum (den följer med för hand)

Ändras villkoren: byt datumet på båda sidorna och skriv en migration som
byter datumet i intern.villkor_version().
"""
import os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPP = os.path.join(ROT, 'supabase', 'migrations')

MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
           'juli', 'augusti', 'september', 'oktober', 'november', 'december']
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December']


def sidans_datum(fil, monster, manader):
    text = open(os.path.join(ROT, fil), encoding='utf-8').read()
    traffar = re.findall(monster, text)
    if len(traffar) != 1:
        return None, '%s: hittar %d datum, väntade ett' % (fil, len(traffar))
    dag, manad, ar = traffar[0]
    if manad not in manader:
        return None, '%s: okänd månad %r' % (fil, manad)
    return '%s-%02d-%02d' % (ar, manader.index(manad) + 1, int(dag)), None


def databasens_version():
    """Den senaste migrationen som skriver funktionen, och datumet i den."""
    senast = None
    for f in sorted(os.listdir(MAPP)):
        if not f.endswith('.sql'):
            continue
        text = open(os.path.join(MAPP, f), encoding='utf-8').read()
        m = re.search(r"function\s+intern\.villkor_version\(\).*?\$\$\s*select\s+'(\d{4}-\d{2}-\d{2})'",
                      text, re.S | re.I)
        if m:
            senast = (f, m.group(1))
    return senast


def main():
    fynd = []
    sv, fel = sidans_datum('anvandarvillkor.html', r'Senast uppdaterad (\d{1,2}) (\w+) (\d{4})', MANADER)
    if fel:
        fynd.append(fel)
    en, fel = sidans_datum('en/anvandarvillkor.html', r'Last updated (\d{1,2}) (\w+) (\d{4})', MONTHS)
    if fel:
        fynd.append(fel)
    db = databasens_version()
    if not db:
        fynd.append('Ingen migration skriver intern.villkor_version().')

    if sv and en and sv != en:
        fynd.append('Den svenska sidan säger %s och den engelska %s.' % (sv, en))
    if sv and db and sv != db[1]:
        fynd.append('anvandarvillkor.html säger %s, men databasens version är %s (%s). Ändrades villkoren: '
                    'skriv en migration som byter datumet i intern.villkor_version(), så får alla frågan '
                    'igen vid nästa inloggning.' % (sv, db[1], db[0]))

    if fynd:
        print('Användarvillkorens version stämmer inte:')
        for f in fynd:
            print('  · ' + f)
        return 1
    print('Användarvillkoren: sidorna och databasen säger %s (%s).' % (sv, db[0]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
