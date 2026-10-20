# -*- coding: utf-8 -*-
"""Kollar att adminvyn visar samma nej och samma intervjumejl som mejlen säger.

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

INTERVJUMEJLET (2026-10-21) på samma sätt: Skicka vidare till intervju
visar mejlet innan steget sätts (INTERVJU_MEJLET i
nextrum-admin-rekrytering.js), och mejlet byggs ur INTERVJU i
supabase/functions/_delad/notiser/intervju.ts. Texten är Leos.

BOKNINGSLÄNKEN (2026-10-20) står i intervjumejlet (lank) och ska vara
bokningssidan i nextrum-config.js (INTERVJU_BOKNING_URL), den som Skriv
till hen också skickar. Mallen kan inte läsa configen, så adressen står
på tre ställen, och byts bokningssidan på ett av dem går kallelsen till
den gamla.
"""
import io, os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FALT = ('amne', 'rubrik', 'mening', 'avslutning')
INTERVJU_FALT = ('amne', 'forsta', 'boka', 'lank', 'andra', 'halsning', 'signatur')


def las(rel):
    return io.open(os.path.join(ROT, rel), encoding='utf-8').read()


def objektet(text, namn, fil):
    """Texten mellan `namn = {` och första `}` efter den."""
    m = re.search(r'\b' + re.escape(namn) + r'\s*=\s*\{(.*?)\}', text, re.S)
    if not m:
        raise SystemExit('Hittar inte %s i %s.' % (namn, fil))
    return m.group(1)


def falten(kropp, falt=FALT):
    """{fält: text} där texten är strängarna efter fältet, ihopsatta."""
    ut = {}
    delar = re.split(r'\b(' + '|'.join(falt) + r')\s*:', kropp)
    # ['', 'amne', " '...',\n  ", 'rubrik', ...]
    for i in range(1, len(delar) - 1, 2):
        strangar = re.findall(r"'((?:[^'\\]|\\.)*)'", delar[i + 1])
        ut[delar[i]] = ''.join(strangar)
    return ut


def jamfor(ts_fil, ts_namn, js_namn, falt):
    js_fil = 'nextrum-admin-rekrytering.js'
    mallen = falten(objektet(las(ts_fil), ts_namn, ts_fil), falt)
    vyn = falten(objektet(las(js_fil), js_namn, js_fil), falt)
    fynd = []
    for f in falt:
        if f not in mallen:
            fynd.append('SAKNAS  %s i %s (%s)' % (f, ts_namn, ts_fil))
            continue
        if f not in vyn:
            fynd.append('SAKNAS  %s i %s (%s)' % (f, js_namn, js_fil))
            continue
        if mallen[f] != vyn[f]:
            fynd.append('OLIKA   %s.%s\n          mejlet:   %s\n          adminvyn: %s' % (ts_namn, f, mallen[f], vyn[f]))
    return fynd


def bokningslanken():
    """Intervjumejlets länk mot bokningssidan i configen."""
    ts_fil = 'supabase/functions/_delad/notiser/intervju.ts'
    lank = falten(objektet(las(ts_fil), 'INTERVJU', ts_fil), INTERVJU_FALT).get('lank', '')
    m = re.search(r"\bINTERVJU_BOKNING_URL\s*:\s*'([^']*)'", las('nextrum-config.js'))
    if not m:
        return ['SAKNAS  INTERVJU_BOKNING_URL i nextrum-config.js']
    if m.group(1).strip() != lank:
        return ['OLIKA   bokningslänken\n          mejlet:  %s\n          configen: %s' % (lank, m.group(1))]
    return []


def main():
    fynd = jamfor('supabase/functions/_delad/notiser/ansokan.ts', 'NEJ', 'NEJ_MEJLET', FALT)
    fynd += jamfor('supabase/functions/_delad/notiser/intervju.ts', 'INTERVJU', 'INTERVJU_MEJLET', INTERVJU_FALT)
    fynd += bokningslanken()

    if fynd:
        print('\n'.join(fynd))
        print('\nAdminvyn, mejlet och configen säger inte samma sak. Ändra alla.')
        return 1
    print('ok   nejet och intervjumejlet säger samma sak i adminvyn och i mejlen (%d och %d fält), '
          'och intervjumejlet länkar till bokningssidan i configen'
          % (len(FALT), len(INTERVJU_FALT)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
