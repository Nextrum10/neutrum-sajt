# -*- coding: utf-8 -*-
"""Kollar att inloggningsvyerna tål den skarpa CSP:n.

       python3 verktyg/kolla-csp.py

Sedan Fas 3.5 skickar vercel.json en skarp Content-Security-Policy för
/admin, /larare och /foralder, med script-src 'self'. Det betyder att
webbläsaren vägrar köra all JavaScript som står direkt i sidan:

  · <script> utan src
  · händelseattribut som onclick="…"
  · javascript:-adresser

Blir något sådant kvar i en av vyerna slutar den delen av sidan att
fungera i produktion, utan fel någon annanstans än i besökarens konsol.
Förhandsgranskningen med .claude/serve.py skickar ingen CSP och visar
därför ingenting. Den här kontrollen gör det.

Stilattribut (style="…") är tillåtna, eftersom style-src har
'unsafe-inline'.
"""
import io, os, re, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VYER = ['admin.html', 'larare.html', 'foralder.html']

# Samma filer som vyerna laddar och som bygger html av strängar.
SKRIPT = ['nextrum-app.js', 'nextrum-kontakt.js', 'nextrum-studie.js', 'nextrum-arbetsyta.js',
          'nextrum-media.js', 'nextrum-betalning.js', 'nextrum-agent.js',
          'nextrum-admin-agenter.js', 'nextrum-admin.js', 'nextrum-admin-karna.js',
          'nextrum-admin-detalj.js', 'nextrum-admin-oversikt.js', 'nextrum-admin-kunder.js',
          'nextrum-admin-rekrytering.js', 'nextrum-admin-bibliotek.js',
          'nextrum-admin-kommunikation.js',
          'nextrum-admin-drift.js', 'nextrum-admin-ekonomi.js', 'nextrum-admin-tjanster.js',
          'nextrum-admin-system.js', 'nextrum-admin-automationer.js',
          'nextrum-admin-ai.js', 'nextrum-admin-konsol.js',
          'nextrum-larare-vy.js', 'nextrum-studie-vy.js',
          'nextrum-tjanster.js', 'nextrum-modulvakt.js', 'nextrum-fel.js']


def main():
    fynd = []

    for f in VYER:
        s = io.open(os.path.join(ROT, f), encoding='utf-8').read()
        utan_kommentarer = re.sub(r'<!--.*?-->', '', s, flags=re.S)
        for m in re.finditer(r'<script\b([^>]*)>', utan_kommentarer):
            if 'src=' not in m.group(1):
                fynd.append('INLINE-SKRIPT  %s' % f)
        for m in re.finditer(r'<[^>]*\son[a-z]+\s*=', utan_kommentarer):
            fynd.append('HÄNDELSEATTRIBUT  %s: %s' % (f, m.group(0)[:60]))
        if re.search(r'javascript:', utan_kommentarer, re.I):
            fynd.append('JAVASCRIPT-ADRESS  %s' % f)

    # html som byggs i koden och sätts med innerHTML lyder under samma
    # regel. Kommentarer tas bort först; de nämner ibland <script>.
    for f in SKRIPT:
        s = io.open(os.path.join(ROT, f), encoding='utf-8').read()
        kod = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
        kod = re.sub(r'(?m)^\s*//.*$', '', kod)
        for m in re.finditer(r'''['"`][^'"`\n]*\son[a-z]+\s*=\s*\\?['"]''', kod):
            fynd.append('HÄNDELSEATTRIBUT I STRÄNG  %s: %s' % (f, m.group(0)[:60]))
        if re.search(r'javascript:', kod, re.I):
            fynd.append('JAVASCRIPT-ADRESS  %s' % f)
        if re.search(r'\beval\s*\(|new\s+Function\s*\(|set(?:Timeout|Interval)\s*\(\s*[\'"`]', kod):
            fynd.append('KOD FRÅN STRÄNG  %s' % f)

    if fynd:
        print('\n'.join(fynd))
        print('\n%d ställen som den skarpa CSP:n blockerar.' % len(fynd))
        return 1

    print('ok   %d vyer och %d skript utan inline-kod' % (len(VYER), len(SKRIPT)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
