# -*- coding: utf-8 -*-
"""Hur bred en titel och en beskrivning blir i en sökträff hos Google.

Google kapar efter bredd i pixlar, inte efter antal tecken: titeln står i
20 px Arial och får plats på ungefär 600 px på datorn, och beskrivningen
står i 14 px Arial och kapas runt 920 px. Gränserna är branschens
uppskattningar; Google publicerar inga. Det som går över syns som "..."
och det sista ordet försvinner, och på läxhjälpssidorna var det sista
ordet länge priset (granskningen 2026-10-26).

Bredderna är Arials, i tusendelar av en em (Liberation Sans har samma
mått). Kerning räknas inte, så det kan skilja någon pixel mot en
webbläsare. Används av verktyg/bygg-omradessidor.py, som väljer titel
efter dem, och av verktyg/kolla-titlar.py, som säger ifrån i CI.
"""

TITEL_PX = 20
BESKRIVNING_PX = 14

# Gränserna Google kapar vid, ungefär, och de vi skriver mot. Målen har
# marginal: Googles egen gräns flyttar sig, och kerning gör en titel
# några pixlar bredare i en webbläsare än här.
TITEL_GRANS = 600
BESKRIVNING_GRANS = 920
TITEL_MAL = 580
BESKRIVNING_MAL = 900

BREDD = {
    ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191, '(': 333,
    ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278, '0': 556, '1': 556,
    '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556, ':': 278,
    ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015, 'A': 667, 'B': 667, 'C': 722,
    'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722, 'I': 278, 'J': 500, 'K': 667, 'L': 556,
    'M': 833, 'N': 722, 'O': 778, 'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722,
    'V': 667, 'W': 944, 'X': 667, 'Y': 667, 'Z': 611, '[': 278, '\\': 278, ']': 278, '^': 469,
    '_': 556, '`': 333, 'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556,
    'h': 556, 'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556, 'p': 556,
    'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722, 'x': 500, 'y': 500,
    'z': 500, '{': 334, '|': 260, '}': 334, '~': 584, 'Å': 667, 'Ä': 667, 'Ö': 778, 'å': 556,
    'ä': 556, 'ö': 556, 'É': 667, 'é': 556, 'Ü': 722, 'ü': 556, 'Æ': 1000, 'æ': 889, 'Ø': 778,
    'ø': 611, 'È': 667, 'è': 556, 'À': 667, 'à': 556, 'Ç': 722, 'ç': 500, 'Ñ': 722, 'ñ': 556,
    '–': 556, '—': 1000, '’': 222, '‘': 222, '“': 333, '”': 333, '…': 1000, '·': 333, '×': 584,
    '§': 556, '°': 400, '½': 834, '\xa0': 278,
}

# Ett tecken som saknas räknas som en bred bokstav, så att en okänd
# glyf aldrig gör en titel kortare än den är.
OKAND = 722


def bredd(text, px):
    """Textens bredd i pixlar i Arial i storleken px."""
    return sum(BREDD.get(c, OKAND) for c in text) * px / 1000


def titel(text):
    return bredd(text, TITEL_PX)


def beskrivning(text):
    return bredd(text, BESKRIVNING_PX)
