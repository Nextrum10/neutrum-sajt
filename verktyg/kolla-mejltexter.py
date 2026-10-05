# -*- coding: utf-8 -*-
"""Kollar att adminvyn visar samma nej som mejlet säger (2026-10-05).

       python3 verktyg/kolla-mejltexter.py

VARFÖR

När admin sätter en ansökan till Avböjd visar rullgardinen först mejlet
som går till den som sökt, ord för ord (NEJ_MEJLET i
nextrum-admin-rekrytering.js). Mejlet byggs av edge-funktionen, ur NEJ i
supabase/functions/_delad/notiser/ansokan.ts. Adminvyn kan inte läsa
TypeScript, och edge-funktionen kan inte läsa sajten, så texten står på
två ställen. Glider de isär har admin godkänt ett mejl som aldrig går,
och den som sökt får ett annat. Det här håller dem lika.

Varje fält (amne, rubrik, mening, avslutning) läses som summan av sina
strängar med enkla citattecken, så att en rad som delats med + räknas
som en.
"""
import io, os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FALT = ('amne', 'rubrik', 'mening', 'avslutning')


def las(rel):
    return io.open(os.path.join(ROT, rel), encoding='utf-8').read()


def objektet(text, namn, fil):
    """Texten mellan `namn = {` och första `}` efter den."""
    m = re.search(r'\b' + re.escape(namn) + r'\s*=\s*\{(.*?)\}', text, re.S)
    if not m:
        raise SystemExit('Hittar inte %s i %s.' % (namn, fil))
    return m.group(1)


def falten(kropp):
    """{fält: text} där texten är strängarna efter fältet, ihopsatta."""
    ut = {}
    delar = re.split(r'\b(' + '|'.join(FALT) + r')\s*:', kropp)
    # ['', 'amne', " '...',\n  ", 'rubrik', ...]
    for i in range(1, len(delar) - 1, 2):
        strangar = re.findall(r"'((?:[^'\\]|\\.)*)'", delar[i + 1])
        ut[delar[i]] = ''.join(strangar)
    return ut


def main():
    ts_fil = 'supabase/functions/_delad/notiser/ansokan.ts'
    js_fil = 'nextrum-admin-rekrytering.js'
    mallen = falten(objektet(las(ts_fil), 'NEJ', ts_fil))
    vyn = falten(objektet(las(js_fil), 'NEJ_MEJLET', js_fil))

    fynd = []
    for f in FALT:
        if f not in mallen:
            fynd.append('SAKNAS  %s i NEJ (%s)' % (f, ts_fil))
            continue
        if f not in vyn:
            fynd.append('SAKNAS  %s i NEJ_MEJLET (%s)' % (f, js_fil))
            continue
        if mallen[f] != vyn[f]:
            fynd.append('OLIKA   %s\n          mejlet:   %s\n          adminvyn: %s' % (f, mallen[f], vyn[f]))

    if fynd:
        print('\n'.join(fynd))
        print('\nNejet i adminvyn och i mejlet säger inte samma sak. Ändra båda.')
        return 1
    print('ok   nejet säger samma sak i adminvyn och i mejlet (%d fält)' % len(FALT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
