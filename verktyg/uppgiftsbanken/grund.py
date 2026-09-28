# -*- coding: utf-8 -*-
"""Byggstenarna för uppgiftsbanken (Fas 23.1).

Varje fil bredvid den här beskriver banorna i ett ämne och har en lista
BANOR. verktyg/bygg-uppgifter.py läser dem, prövar dem och skriver SQL.

    from grund import bana, niva, val, skriv, ordna, tal

    BANOR = [
        bana('Matematik', 'ak5', [
            niva('ma-ak5-brak-1', 'Delar av en helhet', 'Bråk', [
                val('Hur stor del av pizzan är kvar om 3 av 8 bitar är uppätna?',
                    ['3/8', '5/8', '8/5'], '5/8',
                    'Det fanns 8 bitar. 8 − 3 = 5 är kvar, alltså 5/8.'),
                skriv('Vad är 1/4 av 20?', tal(20 / 4)),
            ]),
        ]),
    ]

TRE FRÅGETYPER, för att det är de som går att rätta av en maskin
och göra med en tumme:

    val    tryck på ett av 2–5 alternativ. Ange rätt svar som TEXTEN,
           inte som ett index: då kan ingen räkna fel på platsen, och
           ordningen blandas ändå i spelaren.
    skriv  skriv ett kort svar. Flera godtagna svar går att ange som
           en lista. Rättningen struntar i stora och små bokstäver,
           mellanslag och punkt sist, och tal jämförs som tal:
           "0,5", "0.50" och ",5" är samma svar, och "1 250" är 1250.
           En enhet efter talet rättas INTE ("12 cm" räknas som 12):
           ska enheten vara svaret, gör frågan till val.
    ordna  sätt brickor i rätt ordning, som att bygga en mening. Ange
           brickorna i rätt ordning; extra brickor som inte hör till
           svaret får anges som extra.

RÄKNA UT FACIT I KOD när det går. tal(7 * 8) i stället för '56': ett
facit som räknats fel är värre än en fråga som inte finns, för barnet
får höra att det rätta svaret är fel.

FÖRKLARINGEN visas efter svaret, rätt eller fel. Skriv den till
barnet, kort, och så att den förklarar VARFÖR, inte bara vad.

Ändras en fråga (texten, alternativen eller facit) får den ett nytt id
av sig själv, och den gamla står kvar som inaktiv i databasen. Det är
med flit: gamla svar ska fortsätta peka på det som faktiskt frågades.
Förklaringen och ordningen går att ändra utan att id:t byts.
"""
import json
import re

TYPER = ('val', 'skriv', 'ordna')


def tal(x, decimaler=None):
    """Ett tal som det skrivs på svenska: decimalkomma och mellanslag
    mellan tusental. Heltal utan decimaler, flyttal utan nollor sist.
    tal(1250) → '1 250', tal(0.5) → '0,5', tal(2.0) → '2'."""
    if isinstance(x, float):
        if decimaler is not None:
            x = round(x, decimaler)
        if abs(x - round(x)) < 1e-9:
            x = int(round(x))
    if isinstance(x, int):
        tecken = '-' if x < 0 else ''
        s = str(abs(x))
        grupper = []
        while len(s) > 3:
            grupper.insert(0, s[-3:])
            s = s[:-3]
        grupper.insert(0, s)
        # Fyrsiffriga tal skrivs ihop (1250 → 1 250 är också rätt, men
        # "2026" som år ser konstigt ut med mellanslag). Från fem siffror
        # delas de.
        if len(str(abs(x))) <= 4:
            return tecken + str(abs(x))
        return tecken + ' '.join(grupper)
    s = ('%.' + str(decimaler if decimaler is not None else 6) + 'f') % x
    s = s.rstrip('0').rstrip('.') if decimaler is None else s
    return s.replace('.', ',')


def _text(v, vad):
    if not isinstance(v, str):
        raise TypeError('%s ska vara text, fick %r' % (vad, v))
    return v.strip()


def val(fraga, alternativ, ratt, forklaring=None):
    alternativ = [_text(a if isinstance(a, str) else tal(a), 'ett alternativ') for a in alternativ]
    ratt = ratt if isinstance(ratt, str) else tal(ratt)
    if ratt.strip() not in alternativ:
        raise ValueError('Rätt svar %r står inte bland alternativen %r i: %s' % (ratt, alternativ, fraga))
    return dict(typ='val', fraga=_text(fraga, 'frågan'), alternativ=alternativ,
                ratt=alternativ.index(ratt.strip()), forklaring=forklaring)


def skriv(fraga, svar, forklaring=None):
    if not isinstance(svar, (list, tuple)):
        svar = [svar]
    svar = [_text(s if isinstance(s, str) else tal(s), 'ett svar') for s in svar]
    return dict(typ='skriv', fraga=_text(fraga, 'frågan'), alternativ=None, ratt=svar,
                forklaring=forklaring)


def ordna(fraga, brickor, extra=None, forklaring=None):
    if isinstance(brickor, str):
        brickor = brickor.split()
    if isinstance(extra, str):
        extra = extra.split()
    return dict(typ='ordna', fraga=_text(fraga, 'frågan'),
                alternativ=[_text(b, 'en bricka') for b in extra] if extra else None,
                ratt=[_text(b, 'en bricka') for b in brickor], forklaring=forklaring)


def niva(nyckel, titel, omrade, fragor, beskrivning=None):
    return dict(nyckel=nyckel, titel=titel, omrade=omrade, fragor=list(fragor),
                beskrivning=beskrivning)


def bana(amne, arskurs, nivaer):
    return dict(amne=amne, arskurs=arskurs, nivaer=list(nivaer))


def norm(t):
    """Samma som intern.niva_norm() i databasen, för att kontrollen ska
    se när två svar eller alternativ i själva verket är samma sak."""
    t = (t or '').strip().lower()
    for fran, till in zip('−–—’‘´`', '---\'\'\'\''):
        t = t.replace(fran, till)
    t = re.sub(r'\s+', ' ', t)
    return re.sub(r'[.!]+$', '', t).strip()


def talvarde(t, enhet=True):
    """Samma som intern.niva_tal() i databasen. enhet=True för elevens
    svar ("12 cm" är 12), enhet=False för facit: bara ett rent tal, med
    ett procenttecken som enda tillägg. Ett facit som "5y" är inget tal."""
    t = re.sub(r'(\d) (\d)', r'\1\2', re.sub(r'(\d) (\d)', r'\1\2', t))
    if enhet:
        m = re.match(r'^([-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(?:%|[a-zåäö²³°ω]{1,12}\.?(?: [a-zåäö²³°ω]{1,12}\.?)?)?$', t)
    else:
        m = re.match(r'^([-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*%?$', t)
    return float(m.group(1).replace(',', '.')) if m else None


def lika(facit, svar):
    """Samma som intern.niva_lika(): rättas svaret som rätt mot det här
    facit? För att pröva en fråga innan den går ut:
        lika('5y', '5')    → False
        lika('12', '12 cm') → True"""
    a, b = norm(facit), norm(svar)
    if not b:
        return False
    if a == b:
        return True
    ta, tb = talvarde(a, False), talvarde(b, True)
    return ta is not None and tb is not None and abs(ta - tb) < 1e-12


def json_text(v):
    return json.dumps(v, ensure_ascii=False, separators=(',', ':'))
