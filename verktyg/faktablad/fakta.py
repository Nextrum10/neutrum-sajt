# -*- coding: utf-8 -*-
"""Faktabladen i NexLäx (2026-10-27).

Leo: "Inför varje nytt område man gör på nexläx ska de finnas ett kort
strukturerat fakta blad man kan läsa lite kort om vad man kommer lära sig
när man gått igenom denna sektion samt vad man behöver veta lite som
faktabladen innan man genomför ett nytt område på matteboken."

Ett faktablad per OMRÅDE i en bana (ämne, årskurs, områdets namn, exakt
som det står i verktyg/uppgiftsbanken/). verktyg/bygg-faktablad.py läser
filerna bredvid den här, prövar dem mot banken och skriver en JSON-fil
per bana till nexlax-fakta/, som NexLäx hämtar när banan visas.

    from fakta import blad

    FAKTABLAD = [
        blad('Matematik', 'ak6', 'Procent',
             mal=['Räkna ut hur mycket ett antal procent av ett tal är.',
                  'Skriva om mellan bråk, decimaltal och procent.'],
             fakta=['Procent betyder hundradelar: 1 % = 1/100 = 0,01.',
                    'Del av ett tal: gör om procenten till decimaltal och multiplicera.'],
             exempel=[('Hur mycket är 25 % av 80?', '25 % = 0,25, och 0,25 · 80 = 20.')],
             ord=[('procent', 'hundradelar, tecknet %')],
             tips='Börja med 10 %: dela med 10. Sedan går 20 %, 5 % och 30 % lätt.'),
    ]

FÄLTEN, kort och till eleven (du-tilltal, som NexLäx):

    mal      "När du är klar kan du": 2–4 meningar om vad nivåerna övar.
             Börja med ett verb ("Räkna ut …", "Känna igen …").
    fakta    "Det här behöver du veta": 2–5 regler eller fakta, det man
             läser i rutan överst i ett kapitel i matteboken. Det som
             nivåernas frågor faktiskt frågar efter, inget mer.
    exempel  0–2 lösta exempel, (fråga, lösning). Aldrig en fråga ur
             banken ordagrant: facit lämnas aldrig ut före svaret.
    ord      0–6 ord att kunna, (ord, förklaring).
    tips     0 eller 1 mening, ett knep eller en vanlig fälla.

Allt är Nextrums egen text, skrivet mot Lgr22 och Gy11, aldrig ur en
lärobok eller ett nationellt prov. Ett faktablad som säger fel lär eleven
fel före första frågan: räkna exemplen, och skriv bara det du vet stämmer.
"""


def blad(amne, arskurs, omrade, mal, fakta, exempel=(), ord=(), tips=None):
    return {
        'amne': amne, 'arskurs': arskurs, 'omrade': omrade,
        'mal': list(mal), 'fakta': list(fakta),
        'exempel': [list(e) for e in exempel],
        'ord': [list(o) for o in ord],
        'tips': tips,
    }
