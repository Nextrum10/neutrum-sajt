# -*- coding: utf-8 -*-
"""NO åk 5 och åk 8. Kroppen, ekologin, vattnets kretslopp och lösningarna i åk 5, och grunderna i kemi, biologi och fysik i åk 8 (atomen, molekyler och joner, pH, cellen, fotosyntesen, Ohms lag och kraft och rörelse), ur Lgr22:s centrala innehåll, eftersom det är där eleverna oftast ber om hjälp.

Räknefrågornas facit räknas ut här, och de vanligaste felräkningarna prövas
med assert mot samma räkning: ett fel som råkar ge rätt svar lär barnet att
räkna fel. I en ordna-fråga räknas ordningen ur värdena, och två lika värden
hade gett två rätta ordningar.
"""
from fractions import Fraction as F

from grund import bana, niva, val, skriv, ordna, sant, para, tal


def t(x):
    """Ett exakt bråk som det skrivs: heltal när det går, annars decimaltal.
    Räkningen görs med Fraction, så att 12 / 0,4 blir 30 och inte 29,999."""
    x = F(x)
    if x.denominator == 1:
        return tal(int(x))
    return tal(float(x))


# Ohms lag, U = R · I, räknad i kod. Talen står en gång och används i både
# frågan, facit och förklaringen.
U1_R, U1_I = F(20), F(1, 2)
I2_U, I2_R = F(9, 2), F(15)
R3_U, R3_I = F(12), F(2, 5)

LAMPOR_U = F(6)
LAMPOR = [('Röd', F(1, 2)), ('Blå', F(1, 5)), ('Grön', F(1)), ('Gul', F(3, 10))]
LAMPOR_ORDNADE = sorted(LAMPOR, key=lambda lampa: LAMPOR_U / lampa[1])


def lampa_bricka(lampa):
    return '%s: %s A' % (lampa[0], t(lampa[1]))


# Kraft och rörelse, räknat i kod. g står i frågan, så att svaret inte beror
# på om klassen räknar med 9,8, 9,82 eller 10 N/kg.
G = F(98, 10)
VASKA_M = F(5)
CYKEL_KM, CYKEL_MIN = F(18), F(45)
CYKEL_H = CYKEL_MIN / 60
CYKEL_FART = CYKEL_KM / CYKEL_H
# Jämna svar, och de vanliga felen ger inte rätt svar av en slump: kilogram
# skrivet som newton, g = 10 i stället för det som står i frågan, att dela
# med minuterna, att gånga med timmarna eller att strunta i tiden.
assert (VASKA_M * G).denominator == 1 and CYKEL_FART.denominator == 1
assert VASKA_M * G not in (VASKA_M, VASKA_M * 10, VASKA_M / G)
assert CYKEL_FART not in (CYKEL_KM / CYKEL_MIN, CYKEL_KM * CYKEL_H, CYKEL_KM)

SMA_SIFFROR = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')


def formel(delar):
    """Den kemiska formeln ur (tecken, antal, vad): C₆H₁₂O₆. En etta skrivs inte ut."""
    return ''.join(tecken + (str(antal).translate(SMA_SIFFROR) if antal > 1 else '')
                   for tecken, antal, _ in delar)


def uppraknat(delar):
    """a, b och c."""
    delar = list(delar)
    return ', '.join(delar[:-1]) + ' och ' + delar[-1] if len(delar) > 1 else ''.join(delar)


def laddning(x):
    """En jons laddning med tecken, som i läroboken: +2 och −1."""
    assert x != 0
    return '+%d' % x if x > 0 else '−%d' % -x


# Glukos. Formeln i frågan och svaret räknas ur samma lista.
GLUKOS = [('C', 6, 'kolatomer'), ('H', 12, 'väteatomer'), ('O', 6, 'syreatomer')]
GLUKOS_ATOMER = sum(antal for _, antal, _ in GLUKOS)
assert formel(GLUKOS) == 'C₆H₁₂O₆'

# Fyra joner: (grundämne, protoner, elektroner). Laddningen är protonerna
# minus elektronerna. Protonerna prövas mot atomnumret och laddningen mot
# den jon grundämnet faktiskt bildar, så att ingen bricka beskriver en jon
# som inte finns.
JONER = [('Natrium', 11, 10), ('Klor', 17, 18), ('Magnesium', 12, 10), ('Syre', 8, 10)]
ATOMNUMMER_OCH_LADDNING = {'Natrium': (11, 1), 'Klor': (17, -1), 'Magnesium': (12, 2), 'Syre': (8, -2)}
assert all((p, p - e) == ATOMNUMMER_OCH_LADDNING[namn] for namn, p, e in JONER)
assert len({p - e for _, p, e in JONER}) == len(JONER)
JONER_ORDNADE = sorted(JONER, key=lambda jon: jon[1] - jon[2])


def jon_bricka(jon):
    return '%s: %d p, %d e' % jon


BANOR = [
    bana('NO / Fysik / Kemi / Biologi', 'ak5', [
        niva('no-ak5-biologi-1', 'Kroppens organ', 'Biologi', [
            val('Vilket organ pumpar runt blodet i kroppen?',
                ['Hjärtat', 'Lungorna', 'Levern', 'Njurarna'], 'Hjärtat',
                'Hjärtat är en muskel som drar ihop sig om och om igen och pumpar ut blodet '
                'i blodkärlen, även när du sover.'),
            val('I vilket organ kommer syret från luften in i blodet?',
                ['Lungorna', 'Hjärtat', 'Luftstrupen', 'Magsäcken'], 'Lungorna',
                'Luftstrupen leder bara luften ner. I lungorna finns mängder av små lungblåsor '
                'med tunna väggar, och där går syret över till blodet.'),
            skriv('Vilket organ tänker och styr hela kroppen? Skriv organets namn.',
                  ['hjärnan', 'hjärna'],
                  'Hjärnan tar emot signaler från ögon, öron och hud och bestämmer vad kroppen '
                  'ska göra.'),
            val('Vilka organ silar blodet och gör urin?',
                ['Njurarna', 'Urinblåsan', 'Levern', 'Lungorna'], 'Njurarna',
                'Njurarna silar bort slaggämnen och vatten som kroppen inte behöver. Det blir '
                'urin, som sedan samlas i urinblåsan.'),
            skriv('Maten åker ner genom matstrupen till ett organ där den blandas med sur saft. '
                  'Vad heter organet?',
                  ['magsäcken', 'magsäck', 'magen', 'mage'],
                  'I magsäcken blandas maten med sur magsaft, som börjar bryta ner den och '
                  'dödar många bakterier.'),
            ordna('Ordna matens väg genom kroppen, från början till slut.',
                  ['Munnen', 'Matstrupen', 'Magsäcken', 'Tunntarmen', 'Tjocktarmen'],
                  forklaring='Maten tuggas i munnen och åker genom matstrupen till magsäcken. '
                             'I tunntarmen tas näringen upp i blodet, och i tjocktarmen tas '
                             'vatten upp.'),
            val('Vad gör skelettet?',
                ['Håller upp kroppen och skyddar organen', 'Pumpar runt blodet',
                 'Tar upp näring ur maten', 'Renar blodet'],
                'Håller upp kroppen och skyddar organen',
                'Skelettet är kroppens stomme. Skallen skyddar hjärnan och revbenen skyddar '
                'hjärtat och lungorna.'),
            skriv('Hjärnan skickar signaler till musklerna genom långa trådar i kroppen. '
                  'Vad heter trådarna? Ett ord.',
                  ['nerver', 'nerverna', 'nerv', 'nerven', 'nervtrådar', 'nervtrådarna',
                   'nervceller', 'nervcellerna', 'nervbanor', 'nervbanorna'],
                  'Nerverna går ut i hela kroppen. De leder signaler från hjärnan till musklerna '
                  'och från sinnena tillbaka till hjärnan.'),
        ], beskrivning='Kroppens viktigaste organ och vad de gör.'),

        niva('no-ak5-biologi-2', 'Djur och växter', 'Biologi', [
            val('Vad behöver en växt för att kunna göra sin egen näring?',
                ['Solljus, vatten och koldioxid', 'Bara näring från jorden', 'Socker och syre',
                 'Solljus och syre'],
                'Solljus, vatten och koldioxid',
                'Med energi från solljuset gör växten socker av vatten och koldioxid. Det kallas '
                'fotosyntes.'),
            skriv('Vilken gas släpper växterna ut när de gör fotosyntes? Ett ord.',
                  ['syre', 'syret', 'syrgas', 'O2', 'O₂'],
                  'Vid fotosyntesen blir syre över. Det är det syret som människor och djur andas.'),
            val('Vad kallas en växt i en näringskedja?',
                ['Producent', 'Konsument', 'Nedbrytare', 'Rovdjur'], 'Producent',
                'Växter producerar, alltså tillverkar, sin egen näring med hjälp av solljus. '
                'Därför kallas de producenter.'),
            ordna('Ordna näringskedjan. Börja med den som får sin energi direkt från solen.',
                  ['Blad', 'Fjärilslarv', 'Blåmes', 'Sparvhök'],
                  forklaring='Bladet får sin energi från solen. Larven äter bladet, blåmesen '
                             'äter larven och sparvhöken jagar blåmesen.'),
            val('Vilka organismer bryter ner döda växter och djur?',
                ['Svampar och bakterier', 'Gräs och träd', 'Ugglor och hökar', 'Harar och rådjur'],
                'Svampar och bakterier',
                'Svampar, bakterier och till exempel daggmaskar är nedbrytare. De gör det döda '
                'till näring i jorden, som växterna kan använda igen.'),
            skriv('Ett djur som bara äter växter kallas växtätare. Vad kallas ett djur som äter '
                  'både växter och andra djur? Ett ord.',
                  ['allätare', 'allätaren', 'alätare', 'omnivor'],
                  'Allätare, som grävlingen och människan, kan äta både växter och andra djur.'),
            val('Vad är ett ekosystem?',
                ['Alla organismer i ett område och miljön de lever i',
                 'Bara djuren som lever i ett område', 'Alla växter på hela jorden',
                 'Ett djur och det som det äter'],
                'Alla organismer i ett område och miljön de lever i',
                'Ett ekosystem är både det levande (växter, djur, svampar) och det som inte lever '
                '(vatten, jord, ljus) i ett område, till exempel en sjö eller en skog.'),
            skriv('Vad heter det gröna ämnet i bladen som fångar solljuset? Ett ord.',
                  ['klorofyll', 'klorofyllet', 'klorofyl', 'bladgrönt', 'bladgröna', 'bladgröntet'],
                  'Klorofyll, eller bladgrönt, fångar energin i solljuset så att växten kan göra '
                  'fotosyntes. Det är därför bladen är gröna.'),
        ], beskrivning='Näringskedjor, ekosystem och vad växter behöver för att leva.'),

        niva('no-ak5-kemi-1', 'Vattnets kretslopp', 'Kemi', [
            val('Vilka tre former kan vatten ha?',
                ['Fast, flytande och gas', 'Is, snö och regn', 'Flytande, moln och ånga',
                 'Kallt, varmt och kokande'],
                'Fast, flytande och gas',
                'Is är vatten i fast form, vanligt vatten är flytande och vattenånga är gas. '
                'Det är samma ämne i alla tre formerna.'),
            skriv('Vid hur många grader Celsius fryser rent vatten till is? Svara med ett tal.',
                  tal(0),
                  'Rent vatten fryser vid 0 °C. Saltvatten fryser först vid en lite lägre '
                  'temperatur.'),
            skriv('Vid hur många grader Celsius kokar rent vatten vid normalt lufttryck? '
                  'Svara med ett tal.',
                  tal(100),
                  'Vid normalt lufttryck kokar rent vatten vid 100 °C. Högt upp på ett berg, '
                  'där lufttrycket är lägre, kokar det vid en lägre temperatur.'),
            val('Vad heter det när en vattenpöl torkar upp i solen och vattnet blir till gas?',
                ['Avdunstning', 'Kondensation', 'Smältning', 'Stelning'], 'Avdunstning',
                'När vattnet värms lämnar vattenpartiklar ytan och blir vattenånga i luften. '
                'Det kallas avdunstning.'),
            val('Vad heter det när vattenånga kyls av och blir små droppar, som när en kall '
                'spegel blir immig?',
                ['Kondensation', 'Avdunstning', 'Smältning', 'Kokning'], 'Kondensation',
                'Vattenångan i luften kyls av mot den kalla spegeln och blir flytande igen. '
                'Det kallas kondensation.'),
            ordna('Ordna vattnets kretslopp. Börja med solen.',
                  ['Solen värmer havet', 'Vattnet avdunstar', 'Ångan bildar moln', 'Det regnar',
                   'Vattnet rinner till havet'],
                  forklaring='Solen driver kretsloppet. Vattnet avdunstar, ångan kyls av och '
                             'bildar moln, det regnar, och vattnet rinner i bäckar och älvar '
                             'tillbaka till havet.'),
            val('Vad händer med vattnets partiklar när is smälter?',
                ['De rör sig mer och kan glida förbi varandra', 'De blir större',
                 'De försvinner', 'De slutar röra sig'],
                'De rör sig mer och kan glida förbi varandra',
                'I is sitter partiklarna fast på sina platser och vibrerar. När isen värms rör de '
                'sig mer och kan glida förbi varandra, och då är vattnet flytande.'),
            skriv('Vad kallas vatten i gasform? Ett ord.',
                  ['vattenånga', 'vattenångan', 'ånga', 'ångan'],
                  'Vattenånga är osynlig. Det vita som syns över en kastrull med kokande vatten är '
                  'små vattendroppar som redan har kondenserat.'),
        ], beskrivning='Vattnets tre former och hur vattnet går runt mellan hav, luft och land.'),

        niva('no-ak5-kemi-2', 'Lösningar och blandningar', 'Kemi', [
            val('Vilket av de här löser sig i vatten?',
                ['Socker', 'Sand', 'Matolja', 'En järnspik'], 'Socker',
                'Sockret delas upp i så små delar att de inte syns, och vattnet blir sött. Sand, '
                'olja och järn löser sig inte i vatten.'),
            sant('När socker löser sig i vatten försvinner sockret.', False,
                 'Sockret finns kvar i vattnet, men delarna är så små att du inte kan se dem. Det '
                 'är därför vattnet smakar sött.'),
            skriv('En blandning där ett ämne har löst sig i vatten, som socker i vatten, har ett eget '
                  'namn. Vad heter en sådan blandning? Ett ord.',
                  ['lösning', 'lösningen', 'lösningar', 'en lösning', 'sockerlösning',
                   'sockerlösningen', 'vattenlösning', 'losning'],
                  'Ämnet har löst sig i vattnet, och därför kallas blandningen en lösning. '
                  'Sockervatten är en sockerlösning och saltvatten en saltlösning.'),
            val('Du häller matolja i ett glas vatten och rör om ordentligt. Vad har hänt efter en '
                'stund?',
                ['Oljan ligger som ett lager överst', 'Oljan har löst sig i vattnet',
                 'Oljan ligger på botten'],
                'Oljan ligger som ett lager överst',
                'Olja löser sig inte i vatten. En liter matolja är lättare än en liter vatten, så '
                'oljan flyter upp och lägger sig överst.'),
            sant('Socker löser sig snabbare i varmt vatten än i kallt vatten.', True,
                 'I varmt vatten rör sig vattnets partiklar snabbare. De stöter oftare mot sockret '
                 'och drar loss små delar av det, så att det löser sig fortare.'),
            para('Para ihop varje sätt att dela upp en blandning med vad det kan användas till.',
                 [('Filtrering', 'Skilja sand från vatten'),
                  ('Avdunstning', 'Få tillbaka saltet ur saltvatten'),
                  ('Magnet', 'Plocka ut järnspån ur sand')],
                 'Sanden är för stor för att gå igenom ett filter. Saltet har löst sig och går '
                 'igenom filtret, men när vattnet avdunstar blir saltet kvar. Och järnspånen dras '
                 'till magneten, men sanden gör det inte.'),
            val('Varför fastnar inte saltet i filtret när du häller saltvatten genom ett filter?',
                ['Saltet har löst sig i så små delar att de går igenom filtret',
                 'Saltet sjunker till botten innan det når filtret',
                 'Saltet har smält i vattnet'],
                'Saltet har löst sig i så små delar att de går igenom filtret',
                'Saltet har inte smält, det har löst sig i så små delar att de följer med vattnet '
                'rakt igenom. Ett filter stoppar bara det som är större än hålen i filtret.'),
            ordna('Du har sand och salt blandat i en burk. Ordna stegen så att du får tillbaka både '
                  'sanden och saltet.',
                  ['Häll i vatten och rör om', 'Filtrera, så fastnar sanden',
                   'Låt vattnet avdunsta', 'Saltet blir kvar'],
                  forklaring='Saltet löser sig i vattnet men sanden gör det inte. Därför fastnar '
                             'sanden i filtret medan saltvattnet rinner igenom. När vattnet sedan '
                             'avdunstar blir saltet kvar.'),
        ], beskrivning='Vad som löser sig i vatten, vart det tar vägen och hur man delar upp en '
                       'blandning igen.'),
    ]),

    bana('NO / Fysik / Kemi / Biologi', 'ak8', [
        niva('no-ak8-kemi-1', 'Atomer och grundämnen', 'Kemi', [
            val('Vilken laddning har en proton?',
                ['Positiv', 'Negativ', 'Ingen laddning'], 'Positiv',
                'Protonen är positivt laddad, elektronen negativt laddad och neutronen har '
                'ingen laddning alls.'),
            val('Vilket kemiskt tecken har syre?',
                ['O', 'S', 'Si', 'Sy'], 'O',
                'Syre heter oxygenium på latin, därför O. S är svavel och Si är kisel.'),
            skriv('En litiumatom har 3 protoner, 4 neutroner och 3 elektroner. Hur många partiklar '
                  'finns i atomkärnan?',
                  tal(3 + 4),
                  'Kärnan består av protonerna och neutronerna: 3 + 4 = %s. Elektronerna rör sig '
                  'i skal utanför kärnan.' % tal(3 + 4)),
            val('Vilket kemiskt tecken har kol?',
                ['C', 'K', 'Co', 'Ca'], 'C',
                'C kommer av carbo, det latinska ordet för kol. K är kalium, Co är kobolt och '
                'Ca är kalcium.'),
            skriv('En neutral atom har 8 protoner. Hur många elektroner har den?',
                  tal(8),
                  'I en neutral atom är det lika många negativa elektroner som positiva protoner, '
                  'så laddningarna tar ut varandra. Atomen med 8 protoner är syre.'),
            skriv('Antalet protoner i kärnan avgör vilket grundämne en atom är. Vad kallas det '
                  'talet? Ett ord.',
                  ['atomnummer', 'atomnumret', 'atomnumer', 'atomnummret', 'atom nummer'],
                  'Atomnumret är antalet protoner. Väte har atomnummer 1, kol 6 och syre 8, och '
                  'det är i den ordningen grundämnena står i periodiska systemet.'),
            val('Vilket grundämne har det kemiska tecknet Fe?',
                ['Järn', 'Fluor', 'Fosfor', 'Silver'], 'Järn',
                'Fe kommer av ferrum, det latinska ordet för järn. Fluor är F, fosfor är P och '
                'silver är Ag.'),
            ordna('Ordna från minst till störst. Varje sak är en del av den som kommer efter.',
                  ['Proton', 'Atomkärna', 'Atom', 'Molekyl'],
                  forklaring='Protonerna sitter i atomkärnan, kärnan är atomens mitt, och '
                             'atomer sitter ihop till molekyler.'),
        ], beskrivning='Atomens delar och kemiska tecken för vanliga grundämnen.'),

        # Mellan atomen och syrorna: nivån efter bygger på jonerna, vätejoner
        # och hydroxidjoner, och den här är där ordet jon först förklaras.
        niva('no-ak8-kemi-begrepp', 'Molekyler, föreningar och joner', 'Kemi', [
            para('Para ihop begreppet med vad det betyder.',
                 [('Atom', 'Den minsta delen av ett grundämne som fortfarande är det grundämnet'),
                  ('Molekyl', 'Två eller flera atomer som sitter ihop'),
                  ('Grundämne', 'Ett ämne som bara består av ett slags atomer'),
                  ('Kemisk förening', 'Ett ämne av två eller flera olika grundämnen som sitter ihop'),
                  ('Jon', 'En atom eller atomgrupp som har en elektrisk laddning')],
                 'Atomer är byggstenarna, och de kan sitta ihop i molekyler. Finns det bara ett '
                 'slags atomer i ämnet är det ett grundämne, och är olika grundämnen bundna till '
                 'varandra är det en kemisk förening. En jon har fått sin laddning genom att ta upp '
                 'eller lämna ifrån sig elektroner.'),
            sant('Vatten är ett grundämne.', False,
                 'Vatten, H₂O, består av två grundämnen, väte och syre, som sitter ihop. Därför är '
                 'vatten en kemisk förening och inget grundämne.'),
            val('Vilket av de här ämnena är en kemisk förening?',
                ['Koldioxid (CO₂)', 'Järn (Fe)', 'Kvävgas (N₂)', 'Guld (Au)'], 'Koldioxid (CO₂)',
                'Koldioxid består av två grundämnen, kol och syre, som sitter ihop. Järn och guld '
                'är grundämnen, och kvävgas är molekyler av bara kväve.'),
            sant('Syrgas, O₂, består av molekyler men är ändå ett grundämne.', True,
                 'En syremolekyl är två syreatomer som sitter ihop. Det finns bara ett slags atomer '
                 'i den, och därför är syrgas ett grundämne och ingen kemisk förening.'),
            skriv('Glukos har formeln %s. Hur många atomer finns det i en glukosmolekyl?'
                  % formel(GLUKOS),
                  tal(GLUKOS_ATOMER),
                  'Den lilla siffran efter ett kemiskt tecken säger hur många atomer det finns av '
                  'det grundämnet: %s = %s.'
                  % (' + '.join('%d %s' % (antal, vad) for _, antal, vad in GLUKOS),
                     tal(GLUKOS_ATOMER))),
            val('Du löser salt i vatten. Vad är saltvattnet?',
                ['En blandning', 'En kemisk förening', 'Ett grundämne'], 'En blandning',
                'Saltet och vattnet bildar inget nytt ämne. Kokar du bort vattnet får du tillbaka '
                'saltet. Därför är saltvatten en blandning och ingen kemisk förening.'),
            val('En natriumatom lämnar ifrån sig en elektron. Vilken laddning får natriumjonen?',
                ['Positiv', 'Negativ', 'Ingen laddning'], 'Positiv',
                'Atomen hade lika många elektroner som protoner. När den lämnar ifrån sig en '
                'negativ elektron blir det en positiv proton för mycket, och jonen blir positiv: '
                'Na⁺.'),
            ordna('Här är fyra joner. På varje bricka står grundämnet, antalet protoner (p) och '
                  'antalet elektroner (e). Ordna jonerna från mest negativ till mest positiv '
                  'laddning.',
                  [jon_bricka(jon) for jon in JONER_ORDNADE],
                  forklaring='Laddningen är protonerna minus elektronerna: ' + uppraknat(
                      '%s %d − %d = %s' % (namn.lower(), p, e, laddning(p - e))
                      for namn, p, e in JONER_ORDNADE) + '.'),
        ], beskrivning='Vad som skiljer atomer, molekyler, grundämnen, kemiska föreningar, '
                       'blandningar och joner åt.'),

        niva('no-ak8-kemi-2', 'Syror och baser', 'Kemi', [
            skriv('Vilket pH har en neutral lösning? Svara med ett tal.',
                  tal(7),
                  'pH-skalan går från 0 till 14. Under 7 är surt, över 7 är basiskt och pH 7, '
                  'som rent vatten, är neutralt.'),
            val('En lösning har pH 3. Vad är den?',
                ['Sur', 'Neutral', 'Basisk'], 'Sur',
                'Allt under pH 7 är surt, och ju längre under 7 pH-värdet är, desto surare är '
                'lösningen.'),
            ordna('Ordna pH-värdena från surast till mest basisk.',
                  ['pH 1', 'pH 5', 'pH 7', 'pH 9', 'pH 13'],
                  forklaring='Ju lägre pH, desto surare. pH 7 är neutralt, och ju högre över 7, '
                             'desto mer basiskt.'),
            val('Vilka joner gör en lösning sur?',
                ['Vätejoner (H⁺)', 'Hydroxidjoner (OH⁻)', 'Natriumjoner (Na⁺)',
                 'Kloridjoner (Cl⁻)'],
                'Vätejoner (H⁺)',
                'En syra lämnar ifrån sig vätejoner i vattnet. Ju fler vätejoner, desto lägre pH. '
                'Hydroxidjoner är det som gör en lösning basisk.'),
            skriv('Ett ämne som byter färg och visar om en lösning är sur eller basisk kallas '
                  'en … Vilket ord fattas?',
                  ['indikator', 'indikatorn', 'indikatorer', 'pH-indikator', 'pH-indikatorn',
                   'syra-basindikator', 'indikatorlösning'],
                  'En indikator har olika färg vid olika pH. BTB är till exempel gul i en sur '
                  'lösning och blå i en basisk.'),
            val('Vilket av de här är basiskt?',
                ['Bikarbonat löst i vatten', 'Citronsaft', 'Ättika', 'Läsk'],
                'Bikarbonat löst i vatten',
                'Bikarbonat ger en svagt basisk lösning. Citronsaft, ättika och läsk innehåller '
                'syror och är sura.'),
            skriv('När en syra och en bas blandas i lagom mängder tar de ut varandra. Vad heter '
                  'det? Ett ord.',
                  ['neutralisation', 'neutralisering', 'neutralisationen', 'neutraliseringen',
                   'neutralisera', 'neutraliserar'],
                  'Det kallas neutralisation. Syrans vätejoner och basens hydroxidjoner blir '
                  'vatten, och kvar blir ett salt.'),
            val('Vilken syra finns i magsaften i magsäcken?',
                ['Saltsyra', 'Svavelsyra', 'Ättiksyra', 'Citronsyra'], 'Saltsyra',
                'Magsaften innehåller saltsyra. Den hjälper till att bryta ner maten och dödar '
                'många bakterier.'),
        ], beskrivning='pH-skalan och skillnaden mellan sura, neutrala och basiska lösningar.'),

        niva('no-ak8-biologi-1', 'Cellens delar', 'Biologi', [
            val('Var i cellen finns det mesta av arvsmassan, DNA?',
                ['I cellkärnan', 'I cellmembranet', 'I cellväggen', 'I vakuolen'], 'I cellkärnan',
                'Cellkärnan innehåller arvsmassan, som är cellens ritning. Därifrån styrs '
                'cellens arbete.'),
            skriv('Vad heter den tunna hinnan runt cellen som bestämmer vad som får komma in och '
                  'ut? Ett ord.',
                  ['cellmembran', 'cellmembranet', 'membran', 'membranet', 'cellhinna',
                   'cellhinnan', 'plasmamembran', 'plasmamembranet'],
                  'Cellmembranet omger alla celler. Det släpper in det cellen behöver, som vatten '
                  'och näring, och släpper ut avfall.'),
            val('Vilken av de här delarna har växtceller men inte djurceller?',
                ['Cellvägg', 'Cellkärna', 'Cellmembran', 'Mitokondrier'], 'Cellvägg',
                'Cellväggen är ett stadigt skal av cellulosa utanför cellmembranet, och den ger '
                'växten stadga. Djurceller har bara cellmembran.'),
            skriv('Vad heter det gröna ämnet som fångar solljuset i växternas celler? Ett ord.',
                  ['klorofyll', 'klorofyllet', 'klorofyl', 'bladgrönt', 'bladgröna', 'bladgröntet'],
                  'Klorofyll, eller bladgrönt, fångar energin i solljuset. Det är därför växter '
                  'är gröna.'),
            val('I vilka delar av växtcellen sker fotosyntesen?',
                ['I kloroplasterna', 'I mitokondrierna', 'I cellkärnan', 'I vakuolen'],
                'I kloroplasterna',
                'Kloroplasterna är små gröna korn som innehåller klorofyll. Där fångas solljuset '
                'och socker byggs.'),
            val('I vilka delar av cellen sker det mesta av cellandningen?',
                ['I mitokondrierna', 'I kloroplasterna', 'I cellkärnan', 'I cellväggen'],
                'I mitokondrierna',
                'Mitokondrierna brukar kallas cellens kraftverk. Där frigörs energin ur socker '
                'med hjälp av syre.'),
            ordna('Ordna från minst till störst.',
                  ['Cell', 'Vävnad', 'Organ', 'Organsystem', 'Organism'],
                  forklaring='Celler av samma sort bildar en vävnad, flera vävnader bildar ett '
                             'organ, organ samarbetar i organsystem, och tillsammans blir de en '
                             'organism.'),
            skriv('Organismer som bara består av en enda cell, som bakterier, kallas … organismer. '
                  'Vilket ord fattas?',
                  ['encelliga', 'encellig', 'en-celliga', 'encelliga organismer'],
                  'Encelliga organismer klarar allt livet kräver i en enda cell. Människor, djur '
                  'och de flesta växter är flercelliga.'),
        ], beskrivning='Cellens delar och skillnaden mellan växtceller och djurceller.'),

        niva('no-ak8-biologi-2', 'Fotosyntes och cellandning', 'Biologi', [
            skriv('Vilken gas tar växterna upp ur luften när de gör fotosyntes? Ett ord.',
                  ['koldioxid', 'koldioxiden', 'CO2', 'CO₂'],
                  'Växten tar in koldioxid genom små öppningar i bladen. Tillsammans med vatten '
                  'från rötterna blir den till socker.'),
            val('Varifrån får växten energin till fotosyntesen?',
                ['Från solljuset', 'Från jorden', 'Från vattnet', 'Från syret i luften'],
                'Från solljuset',
                'Energin kommer från solljuset, som klorofyllet fångar. Ur jorden får växten '
                'bara vatten och mineralämnen.'),
            val('Vilka ämnen bildas vid fotosyntesen?',
                ['Socker och syre', 'Koldioxid och vatten', 'Socker och koldioxid',
                 'Syre och vatten'],
                'Socker och syre',
                'Växten bygger socker av koldioxid och vatten. Syret blir över och släpps ut i '
                'luften.'),
            skriv('Sockret som bildas vid fotosyntesen har ett eget namn. Vad heter det? Ett ord.',
                  ['glukos', 'glukosen', 'glykos', 'druvsocker', 'druvsockret'],
                  'Sockret heter glukos, eller druvsocker. Växten använder det som energi och '
                  'bygger också stärkelse och cellulosa av det.'),
            skriv('Vilken gas behöver cellerna för att göra cellandning? Ett ord.',
                  ['syre', 'syret', 'syrgas', 'O2', 'O₂'],
                  'Vid cellandningen använder cellerna syre för att frigöra energin i sockret. '
                  'Därför andas vi.'),
            val('Vid cellandningen frigörs energi ur socker. Vilka ämnen bildas samtidigt?',
                ['Koldioxid och vatten', 'Socker och syre', 'Syre och vatten',
                 'Syre och koldioxid'],
                'Koldioxid och vatten',
                'Glukos och syre blir koldioxid och vatten, och energi frigörs. Det är '
                'fotosyntesen baklänges.'),
            val('Vilka organismer gör cellandning?',
                ['Både växter och djur', 'Bara djur', 'Bara växter', 'Bara växter på natten'],
                'Både växter och djur',
                'Alla celler behöver energi. Växter gör cellandning dygnet runt, precis som djur, '
                'och på dagen gör de dessutom fotosyntes.'),
            ordna('Bygg ordformeln för fotosyntesen.',
                  ['koldioxid + vatten', '→', 'glukos + syre'], extra=['syre + vatten'],
                  forklaring='Med energi från solljuset blir koldioxid och vatten till glukos och '
                             'syre. Åt andra hållet är det cellandningens formel.'),
        ], beskrivning='Hur växter bygger socker med solens energi och hur celler frigör energin igen.'),

        niva('no-ak8-fysik-1', 'Spänning, ström och Ohms lag', 'Fysik', [
            val('Vilken enhet mäts elektrisk spänning i?',
                ['volt (V)', 'ampere (A)', 'ohm (Ω)', 'watt (W)'], 'volt (V)',
                'Spänning mäts i volt. Ström mäts i ampere, resistans i ohm och effekt i watt.'),
            val('Vad menas med resistans?',
                ['Hur mycket något hindrar strömmen', 'Hur mycket laddning som passerar per sekund',
                 'Hur mycket energi ett batteri kan lagra'],
                'Hur mycket något hindrar strömmen',
                'Resistans är hur svårt det är för strömmen att ta sig fram, och den mäts i ohm. '
                'Laddning per sekund är strömmen.'),
            skriv('Genom en lampa med resistansen %s Ω går strömmen %s A. Hur många volt är '
                  'spänningen över lampan?' % (t(U1_R), t(U1_I)),
                  t(U1_R * U1_I),
                  'U = R · I = %s · %s = %s. Spänningen är %s V.'
                  % (t(U1_R), t(U1_I), t(U1_R * U1_I), t(U1_R * U1_I))),
            val('Du ska mäta strömmen genom en lampa med en amperemeter. Hur kopplar du den?',
                ['I serie med lampan', 'Parallellt med lampan', 'Direkt mellan batteriets poler'],
                'I serie med lampan',
                'All ström som går genom lampan måste också gå genom mätaren, så den kopplas i '
                'serie. Det är voltmetern som kopplas parallellt.'),
            skriv('Ett batteri på %s V kopplas till ett motstånd på %s Ω. Hur många ampere blir '
                  'strömmen?' % (t(I2_U), t(I2_R)),
                  t(I2_U / I2_R),
                  'I = U / R = %s / %s = %s A.' % (t(I2_U), t(I2_R), t(I2_U / I2_R))),
            val('Spänningen över ett motstånd fördubblas, och resistansen är densamma. Vad händer '
                'med strömmen?',
                ['Den fördubblas', 'Den halveras', 'Den blir densamma', 'Den blir fyra gånger större'],
                'Den fördubblas',
                'Enligt Ohms lag är I = U / R. Med samma resistans blir strömmen dubbelt så stor '
                'när spänningen blir dubbelt så stor.'),
            skriv('Över ett motstånd är spänningen %s V och strömmen %s A. Hur många ohm är '
                  'resistansen?' % (t(R3_U), t(R3_I)),
                  t(R3_U / R3_I),
                  'R = U / I = %s / %s = %s Ω.' % (t(R3_U), t(R3_I), t(R3_U / R3_I))),
            ordna('Fyra lampor kopplas en i taget till samma batteri på %s V. Strömmen genom varje '
                  'lampa står på brickan. Ordna lamporna från minst till störst resistans.'
                  % t(LAMPOR_U),
                  [lampa_bricka(lampa) for lampa in LAMPOR_ORDNADE],
                  forklaring='R = U / I, så med samma spänning ger en större ström en mindre '
                             'resistans: ' + ', '.join(
                                 '%s: %s / %s = %s Ω' % (lampa[0].lower(), t(LAMPOR_U), t(lampa[1]),
                                                        t(LAMPOR_U / lampa[1]))
                                 for lampa in LAMPOR_ORDNADE) + '.'),
        ], beskrivning='Spänning, ström och resistans, och att räkna med Ohms lag U = R · I.'),

        niva('no-ak8-fysik-2', 'Kraft och rörelse', 'Fysik', [
            val('Vad kan en kraft göra med ett föremål?',
                ['Ändra dess fart, riktning eller form', 'Ändra dess massa',
                 'Ändra vilket ämne det består av'],
                'Ändra dess fart, riktning eller form',
                'En kraft kan sätta fart på något, bromsa det, få det att svänga eller ändra dess '
                'form, som när du trycker ihop en boll. Massan och ämnet ändras inte.'),
            para('Para ihop kraften med exemplet som den förklarar.',
                 [('Tyngdkraft', 'Ett äpple faller mot marken'),
                  ('Friktion', 'Skorna halkar inte på golvet'),
                  ('Luftmotstånd', 'En fallskärm faller långsamt'),
                  ('Normalkraft', 'En bok på ett bord faller inte igenom bordet')],
                 'Tyngdkraften drar allt mot jorden, och bordets normalkraft trycker tillbaka så att '
                 'boken ligger still. Friktionen mellan skon och golvet håller emot när du går, och '
                 'luftmotståndet bromsar fallskärmen.'),
            sant('Ett föremål har mindre massa på månen än på jorden.', False,
                 'Massan är hur mycket materia föremålet består av, och den ändras inte när '
                 'föremålet flyttas. Det som blir mindre på månen är tyngden, för månen drar '
                 'svagare än jorden.'),
            skriv('En skolväska har massan %s kg. Hur många newton är tyngdkraften på väskan? '
                  'Räkna med g = %s N/kg.' % (t(VASKA_M), t(G)),
                  t(VASKA_M * G),
                  'Tyngdkraften är massan gånger g: F = m · g = %s · %s = %s N.'
                  % (t(VASKA_M), t(G), t(VASKA_M * G))),
            val('En ishockeypuck glider över isen. Tänk dig att ingenting bromsar den, varken '
                'friktion eller luftmotstånd. Vad händer med pucken?',
                ['Den fortsätter rakt fram i samma fart', 'Den saktar in och stannar',
                 'Den glider allt fortare', 'Den svänger av åt sidan'],
                'Den fortsätter rakt fram i samma fart',
                'Ett föremål fortsätter i samma fart och riktning tills en kraft ändrar rörelsen. '
                'Det kallas tröghetslagen. På riktig is stannar pucken till slut, för att '
                'friktionen och luftmotståndet bromsar den.'),
            sant('När du trycker på en vägg trycker väggen tillbaka på dig med lika stor kraft.', True,
                 'Krafter kommer alltid i par, kraft och motkraft. De är lika stora, riktade åt '
                 'motsatt håll och verkar på var sitt föremål: du på väggen och väggen på dig.'),
            skriv('En cyklist cyklar %s km på %s minuter. Hur många kilometer i timmen är '
                  'medelfarten? Svara med ett tal.' % (t(CYKEL_KM), t(CYKEL_MIN)),
                  t(CYKEL_FART),
                  '%s minuter är %s timmar. Medelfarten är sträckan delat med tiden: '
                  '%s / %s = %s km/h.'
                  % (t(CYKEL_MIN), t(CYKEL_H), t(CYKEL_KM), t(CYKEL_H), t(CYKEL_FART))),
            ordna('En bilförare ser plötsligt ett hinder på vägen och bromsar. Ordna vad som '
                  'händer, från början till slut.',
                  ['Föraren ser hindret', 'Bilen kör vidare medan föraren reagerar',
                   'Föraren trycker på bromsen', 'Bilen saktar in', 'Bilen står still'],
                  forklaring='Under reaktionstiden hinner bilen köra en bit i samma fart, och det '
                             'är reaktionssträckan. Sedan bromsar friktionen bilen tills den står '
                             'still, och det är bromssträckan. Tillsammans blir de stoppsträckan.'),
        ], beskrivning='Vad krafter gör, skillnaden mellan massa och tyngd, fart och varför en bil '
                       'inte stannar på en gång.'),
    ]),
]
