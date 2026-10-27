# -*- coding: utf-8 -*-
"""Faktabladen till fortsättningen i engelska för åk 6 och 7 (2026-10-27),
ett per område i verktyg/uppgiftsbanken/fortsattning_engelska_ak6_7.py.
Skrivna efter vad nivåerna övar, med exempel som inte är någon av frågorna.

Skrivna med AI och inte lästa av en lärare."""
from fakta import blad

FAKTABLAD = [
    blad('Engelska', 'ak6', 'Datum och klockan',
         mal=['Säga och stava räkneord och ordningstal, som thirty, first och twelfth.',
              'Säga ett datum på engelska, som the fifth of May.',
              'Säga vad klockan är med past och to, och förstå a.m. och p.m.'],
         fakta=['-teen är talen 13–19 (thirteen) och -ty är tiotalen 20–90 (thirty). Fyrtio stavas forty, '
                'utan u.',
                'Ordningstal: first, second och third är oregelbundna, de andra får -th: fourth, fifth, '
                'twelfth. I ett sammansatt tal blir bara sista delen ordningstal: twenty-first.',
                'Datum säger man med ordningstal: the third of June. Månader och veckodagar har stor bokstav.',
                'Past betyder över och to betyder i: quarter past four är 4.15 och twenty to four är 3.40. '
                'Half past four är 4.30, halv fem på svenska.',
                'A.m. är tiden från midnatt till tolv på dagen och p.m. från tolv till midnatt. Före ett '
                'klockslag står at, före dagar och datum on.'],
         exempel=[('Hur säger man datumet 22/9 på engelska?',
                   'Dagen blir ett ordningstal, och bara sista delen ändras: the twenty-second of September.'),
                  ("Vad är klockan när den är 'twenty-five past six'?",
                   'Past betyder över: tjugofem minuter över sex, alltså 6.25.')],
         ord=[('quarter', 'en kvart'),
              ('past', 'över (om klockan)'),
              ('to', 'i, före hela timmen (om klockan)'),
              ("o'clock", "prick, hel timme: five o'clock"),
              ('a.m. / p.m.', 'före / efter klockan tolv mitt på dagen')],
         tips='Engelskan räknar halvtimmen från timmen som har varit: half past seven är 7.30, fast vi '
              'säger halv åtta.'),

    blad('Engelska', 'ak6', 'Ägande och genitiv',
         mal=['Välja rätt ägandeord: my, your, his, her, its, our och their.',
              'Säga sin på engelska, där ordet beror på vem som äger.',
              "Skriva genitiv med apostrof: Tom's, the girls' och the children's.",
              "Skilja its från it's och whose från who's."],
         fakta=['My = min, your = din, his = hans, her = hennes, its = dess (om djur och saker), our = vår '
                'och their = deras.',
                'Engelskan har inget ord för sin. Du väljer efter ägaren: Tom takes his bag, Anna takes her '
                'bag, they take their bags.',
                "En ägare får apostrof och s: the dog's ball. Ett ord i plural som slutar på s får bara en "
                "apostrof: the dogs' balls.",
                "Plural som inte slutar på s får apostrof och s: the children's toys, the men's room.",
                "Its och whose har ingen apostrof. It's betyder it is och who's betyder who is."],
         exempel=[('Hur säger man katternas mat, när det är flera katter?',
                   "Cats slutar på s, så det får bara en apostrof efter: the cats' food."),
                  ('Hur säger man Lisa och Ali går till sin skola?',
                   'Ägarna är två personer, så sin blir their: Lisa and Ali go to their school.')],
         ord=[('whose', 'vems'),
              ('its', 'dess, sin (om djur och saker)'),
              ('their', 'deras, sin (om flera)'),
              ('apostrophe', "apostrof, tecknet '")],
         tips="Fråga dig: en ägare eller flera? En ägare: 's (the girl's). Flera, och ordet slutar på s: s' "
              "(the girls')."),

    blad('Engelska', 'ak6', 'Handla och hitta vägen',
         mal=['Be om något artigt i en affär eller på ett kafé.',
              'Fråga vad något kostar och förstå svaret.',
              'Förstå och ge en vägbeskrivning med left, right, straight on och opposite.',
              'Hitta vägen och priset i en text med en vägbeskrivning.'],
         fakta=["Artigt: Can I have ..., please? eller I'd like ..., please. Tack heter thank you eller "
                'thanks.',
                'Priset: How much is it? eller How much does it cost? Here you are betyder varsågod, när '
                'man räcker fram något.',
                'Vägen: turn left (sväng vänster), turn right (sväng höger), go straight on (gå rakt fram) '
                'och go past (gå förbi).',
                'Platser: next to (bredvid), opposite (mitt emot), between (mellan) och on the corner (på '
                'hörnet).'],
         exempel=[('Hur frågar du artigt var toaletten är på ett kafé?',
                   'Excuse me, where is the toilet, please? På amerikansk engelska säger man oftare restroom '
                   'eller bathroom.')],
         ord=[('change', 'växel, pengarna man får tillbaka'),
              ('receipt', 'kvitto'),
              ('traffic lights', 'trafikljus'),
              ('crossroads', 'korsning'),
              ('opposite', 'mitt emot')],
         tips='Börja en fråga till någon du inte känner med Excuse me. Det låter artigt och får folk att '
              'lyssna.'),

    blad('Engelska', 'ak7', 'Present perfect',
         mal=['Bilda present perfect med have eller has och verbets tredje form.',
              'Kunna de vanligaste oregelbundna formerna, som seen, gone och written.',
              'Välja mellan present perfect och past simple.',
              'Använda ever, never, just, already, yet, since och for.'],
         fakta=['Present perfect = have eller has + verbets tredje form: I have played, she has seen. Has '
                'står efter he, she och it.',
                'Present perfect säger att något har hänt någon gång fram till nu, utan att säga när: Have '
                'you ever been to Rome?',
                'Säger du när det hände (yesterday, last week, in 2019) används past simple: I saw it '
                'yesterday.',
                'Since + tidpunkt (since Monday) och for + tidslängd (for two weeks). Just, already och '
                'never står oftast före verbet, yet sist.',
                'Has gone betyder har gått dit och är kvar där. Has been betyder har varit där och kommit '
                'tillbaka.'],
         exempel=[('Read eller have read? I ___ that book last year.',
                   'Last year säger när det hände, så det blir past simple: I read that book last year.'),
                  ('Hur säger man Hon har bott här i tre år?',
                   'Det pågår fortfarande, så det blir present perfect, och tre år är en tidslängd: She has '
                   'lived here for three years.')],
         ord=[('ever', 'någonsin'),
              ('never', 'aldrig'),
              ('just', 'nyss, precis'),
              ('already', 'redan'),
              ('yet', 'än, ännu (i frågor och nekande meningar)'),
              ('since', 'sedan (en tidpunkt)')],
         tips='Leta efter tidsorden. Yesterday, ago och last ger past simple, medan ever, never, yet och '
              'since oftast ger present perfect.'),

    blad('Engelska', 'ak7', 'Some, any, much och many',
         mal=['Välja mellan some och any i jakande meningar, nekande meningar och frågor.',
              'Välja mellan much och many, och mellan a few och a little.',
              'Känna igen ord som inte går att räkna på engelska, som advice och homework.'],
         fakta=["Some i jakande meningar: I have some apples. Any i nekande meningar och de flesta frågor: I "
                "don't have any. Have you got any?",
                'Some i frågor när man bjuder på eller ber om något: Would you like some tea?',
                'Many och a few med sådant som går att räkna (books, people). Much och a little med sådant '
                'som inte går att räkna (milk, time).',
                'A lot of passar med båda: a lot of books, a lot of milk.',
                'Information, advice, homework och furniture går inte att räkna på engelska: some advice, '
                'inte an advice.'],
         exempel=[('Much eller many? How ___ eggs do we need?',
                   'Ägg går att räkna, så det blir many: How many eggs do we need?'),
                  ("Some eller any? There isn't ___ juice in the glass.",
                   "Isn't gör meningen nekande, så det blir any: There isn't any juice in the glass.")],
         ord=[('countable', 'räknebar, går att räkna'),
              ('uncountable', 'oräknebar, går inte att räkna'),
              ('a few', 'några få (om sådant som går att räkna)'),
              ('a little', 'lite (om sådant som inte går att räkna)'),
              ('advice', 'råd, alltid utan plural')],
         tips='Pröva att sätta en siffra framför ordet: three books går, men inte three homeworks. Går det '
              'blir det many och a few.'),

    blad('Engelska', 'ak7', 'Brittisk och amerikansk engelska',
         mal=['Känna igen vanliga ord som skiljer sig åt, som flat och apartment eller lift och elevator.',
              'Känna igen brittisk och amerikansk stavning, som colour och color.',
              'Förstå skillnaderna i hur man räknar våningar och skriver datum.'],
         fakta=['Båda varianterna är rätt. Välj en och håll dig till den i samma text.',
                'Ord, det brittiska först: flat/apartment, lift/elevator, autumn/fall, holiday/vacation, '
                'rubbish/trash, sweets/candy, crisps/chips och underground/subway.',
                'Stavning: brittiskt -our och -re blir ofta -or och -er i USA: colour/color, centre/center. '
                'Brittiskt travelled stavas traveled i USA.',
                'Våningar: i USA är bottenvåningen the first floor. I Storbritannien heter den the ground '
                'floor, och the first floor är en trappa upp.',
                'Datum: i USA står månaden först, så 4/7 är den 7 april. I Storbritannien står dagen först, '
                'så 4/7 är den 4 juli.'],
         exempel=[('Är det brittisk eller amerikansk engelska? I put the rubbish in the bin.',
                   'Rubbish och bin är brittiska ord. En amerikan hade sagt I put the trash in the trash can.')],
         ord=[('British English', 'brittisk engelska'),
              ('American English', 'amerikansk engelska'),
              ('ground floor', 'bottenvåning (brittiskt)'),
              ('pavement / sidewalk', 'trottoar (brittiskt / amerikanskt)'),
              ('queue / line', 'kö (brittiskt / amerikanskt)')],
         tips='Blanda inte i samma text: skriver du colour, skriv också favourite och centre.'),
]
