# -*- coding: utf-8 -*-
"""NO åk 5 och åk 8. Kroppen, ekologin och vattnets kretslopp i åk 5, och grunderna i kemi, biologi och fysik i åk 8 (atomen, pH, cellen, fotosyntesen och Ohms lag), ur Lgr22:s centrala innehåll, eftersom det är där eleverna oftast ber om hjälp."""
from fractions import Fraction as F

from grund import bana, niva, val, skriv, ordna, tal


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
    ]),
]
