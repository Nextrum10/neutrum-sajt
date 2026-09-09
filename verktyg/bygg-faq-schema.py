# -*- coding: utf-8 -*-
"""
Bygger FAQPage-märkningen på faq.html och en/faq.html ur frågorna som
faktiskt står på sidan.

KÖR OM DEN VARJE GÅNG FAQ:N ÄNDRAS. Google kräver att märkningen och
den synliga texten säger samma sak — en fråga som bara finns i det ena
är ett fel, inte en bonus. Samma regel som för bygg-maskotsvar.py, och
av samma skäl: två kopior av samma text driver isär.

    python3 verktyg/bygg-faq-schema.py

En ärlig notis om nyttan: Google begränsade 2023 de utfällbara
FAQ-träffarna till myndigheter och vården. Den här märkningen ger
alltså inte den rika träffen för Nextrum. Den står här för att
beskriva sidan maskinläsbart — andra sökmotorer och svarstjänster
läser den, och den kostar ingenting att hålla aktuell när verktyget
gör jobbet.
"""
import io, json, re, sys

SIDOR = {
    'faq.html':    'https://nextrum.se/faq',
    'en/faq.html': 'https://nextrum.se/en/faq',
}

FRAGA = re.compile(
    r'<button class="faq-q"[^>]*>(?P<q>.*?)<span class="pm">',  re.S)
SVAR = re.compile(
    r'<div class="faq-a">(?P<a>.*?)</div>\s*\n\s*</div>', re.S)
ITEM = re.compile(
    r'<div class="faq-item">(?P<item>.*?)</div>\s*\n\s*</div>', re.S)


def text(html):
    """Taggar bort, blanksteg ihop. Behåller reservtexten i data-stat,
    så att priset står som en siffra och inte som ett tomrum."""
    s = re.sub(r'<[^>]+>', '', html)
    s = (s.replace('&mdash;', '—').replace('&nbsp;', ' ')
          .replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>'))
    return re.sub(r'\s+', ' ', s).strip()


def par(sidhtml):
    ut = []
    for m in ITEM.finditer(sidhtml):
        block = m.group('item')
        q = FRAGA.search('<button class="faq-q"' + block.split('<button class="faq-q"', 1)[1]) \
            if '<button class="faq-q"' in block else None
        a = SVAR.search(block + '\n</div>\n</div>')
        if not q:
            continue
        svar = re.search(r'<div class="faq-a">(.*)', block, re.S)
        if not svar:
            continue
        ut.append((text(q.group('q')), text(svar.group(1))))
    return ut


def main():
    fel = 0
    for fil, url in SIDOR.items():
        t = io.open(fil, encoding='utf-8').read()
        fragor = par(t)
        if not fragor:
            print('FEL: hittade inga frågor i %s' % fil); fel += 1; continue

        data = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "@id": url + '#faq',
            "url": url,
            "mainEntity": [{
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            } for q, a in fragor],
        }

        block = ('<!-- GENERERAD av verktyg/bygg-faq-schema.py. Ändra inte för hand:\n'
                 '     kör om verktyget när en fråga ändras, annars säger märkningen\n'
                 '     och sidan olika saker och då är den ett fel, inte en bonus. -->\n'
                 '<script type="application/ld+json" id="faq-schema">\n'
                 + json.dumps(data, ensure_ascii=False, indent=2) + '\n</script>\n')

        gammal = re.search(
            r'<!-- GENERERAD av verktyg/bygg-faq-schema\.py.*?</script>\n',
            t, re.S)
        t = t.replace(gammal.group(0), block) if gammal else \
            t.replace('</head>', block + '</head>', 1)

        io.open(fil, 'w', encoding='utf-8').write(t)
        print('%-14s %d frågor' % (fil, len(fragor)))
    return fel


if __name__ == '__main__':
    sys.exit(1 if main() else 0)
