# -*- coding: utf-8 -*-
"""Länkar i materialbanken till provgruppernas officiella sidor om de nationella proven.

Leo 2026-10-02 bad om att ladda ner alla nationella prov från åk 6 till gymnasiet och lägga dem
i banken. Det gör vi inte: proven och deras texter är upphovsrättsskyddade, och en kopia på
nextrum.se är spridning i en kommersiell tjänst. Att LÄNKA till den sida där provgruppen själv
publicerar materialet är däremot fritt, och studiehjälparen och familjen hamnar där proven
faktiskt finns, i den version provgruppen står för.

Adresserna kommer ur webbsökningar 2026-10-02. Miljön där de lades in nådde inte sidorna, så
de är inte klickprovade; en länk som slutat fungera stängs av i adminvyn och rättas här med en
ny migration som uppdaterar raden (id:t kommer ur namnet, inte ur adressen).

2026-10-03 jämfördes varje adress med vad sökmotorerna har indexerat, eftersom miljön fortfarande
inte nådde sidorna. Tre fanns inte där och byttes mot de sidor som finns (engelska nivå 1 och 2
och Umeås tidigare prov i matematik), och PRIM-gruppens två rader pekar nu på sidan om proven i
stället för gruppens startsida (20261003020000_materialbanken_lankarna_rattas).

En länk är en dict med namn (börjar med årskursen), arskurs, amne, titel, beskrivning och lank.
Beskrivningen säger vem som står bakom sidan och lovar inget om vad som ligger där i dag.
"""

LANKAR = [
    dict(namn='ak6-matematik-np-prim-gruppen', arskurs='ak6', amne='Matematik',
         titel='Nationella proven i matematik (PRIM-gruppen)',
         beskrivning='Stockholms universitets provgrupp, som gör proven i matematik för åk 6 och åk 9. Information om proven och publicerat provmaterial.',
         lank='https://www.su.se/enheter/prim-gruppen/nationella-prov'),

    dict(namn='ak6-engelska-np-exempeluppgifter', arskurs='ak6', amne='Engelska',
         titel='Exempel på uppgifter i nationella provet i engelska, åk 6',
         beskrivning='Göteborgs universitets provgrupp visar vilka sorters uppgifter som finns i provet: tala, läsa, lyssna och skriva.',
         lank='https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-arskurs-1-6/exempel-pa-uppgiftstyper-for-engelska-for-arskurs-6'),

    dict(namn='ak9-matematik-np-tidigare-prov', arskurs='ak9', amne='Matematik',
         titel='Tidigare nationella prov i matematik, åk 9 (PRIM-gruppen)',
         beskrivning='Stockholms universitets provgrupp publicerar här prov som inte längre är hemliga, med bedömningsanvisningar.',
         lank='https://www.su.se/enheter/prim-gruppen/nationella-prov/arskurs-9'),

    dict(namn='ak9-engelska-np-provet', arskurs='ak9', amne='Engelska',
         titel='Nationella provet i engelska, åk 9',
         beskrivning='Göteborgs universitets provgrupp beskriver provets tre delar och visar exempel på uppgifter.',
         lank='https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-arskurs-7-9/nationella-prov-i-engelska-for-arskurs-9'),

    dict(namn='ak9-svenska-np-upplagg', arskurs='ak9', amne='Svenska',
         titel='Nationella provet i svenska, åk 9: upplägg och bedömning',
         beskrivning='Uppsala universitets provgrupp förklarar provets delar (tala, läsa, skriva) och hur de bedöms.',
         lank='https://www.uu.se/nationella-prov/svenska-och-svenska-som-andrasprak/grundskolan/ak9/upplagg'),

    dict(namn='ak9-no-np-forberedelsematerial', arskurs='ak9', amne='NO / Fysik / Kemi / Biologi',
         titel='Förberedelsematerial för nationella proven i NO, åk 9',
         beskrivning='Umeå universitets provgrupp, som gör proven i biologi, fysik och kemi, har tagit fram materialet för att förbereda inför proven.',
         lank='https://arkiv.edusci.umu.se/npno9/webbmaterial/F%C3%B6rberedelsematerial%20f%C3%B6r%20nationella%20prov%20i%20NO%C3%A4mnen%20%C3%A5k%209.pdf'),

    dict(namn='ak9-so-np-geografi', arskurs='ak9', amne='SO / Historia / Samhällskunskap',
         titel='Nationella provet i geografi, åk 9',
         beskrivning='Uppsala universitets provgrupp för geografi: information om provet och publicerat material.',
         lank='https://www.uu.se/nationella-prov/geografi/'),

    dict(namn='ak9-so-np-religionskunskap', arskurs='ak9', amne='SO / Historia / Samhällskunskap',
         titel='Nationella provet i religionskunskap, åk 9',
         beskrivning='Göteborgs universitets provgrupp för religionskunskap: information om provet och publicerat material.',
         lank='https://www.gu.se/didaktik-pedagogisk-profession/nationella-prov-i-religionskunskap'),

    dict(namn='gy1-matematik-np-prim-gruppen', arskurs='gy1', amne='Matematik',
         titel='Nationella proven i matematik (PRIM-gruppen)',
         beskrivning='Stockholms universitets provgrupp för matematik: information om proven och publicerat provmaterial.',
         lank='https://www.su.se/enheter/prim-gruppen/nationella-prov'),

    dict(namn='gy1-svenska-np-niva-1', arskurs='gy1', amne='Svenska',
         titel='Nationella provet i svenska nivå 1',
         beskrivning='Uppsala universitets provgrupp: provets delar, provdatum, exempelmaterial och bedömningsanvisningar.',
         lank='https://www.uu.se/nationella-prov/svenska-och-svenska-som-andrasprak/gymnasiet/gy1'),

    dict(namn='gy1-engelska-np-niva-1', arskurs='gy1', amne='Engelska',
         titel='Nationella provet i engelska nivå 1',
         beskrivning='Göteborgs universitets provgrupp: om provet i engelska nivå 1 och exempel på uppgifter.',
         lank='https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-pa-niva-1/nationellt-prov-i-engelska-pa-niva-1'),

    dict(namn='gy2-matematik-np-tidigare-givna-prov', arskurs='gy2', amne='Matematik',
         titel='Tidigare givna prov i matematik, gymnasiet (Umeå universitet)',
         beskrivning='Umeå universitets provgrupp, som gör proven i matematik på gymnasiet efter nivå 1, publicerar här tidigare prov.',
         lank='https://www.umu.se/en/department-of-applied-educational-science/national-test-and-test-bank/national-course-tests-in-mathematics/earlier-given-tests/'),

    dict(namn='gy2-engelska-np-niva-2', arskurs='gy2', amne='Engelska',
         titel='Nationella provet i engelska nivå 2',
         beskrivning='Göteborgs universitets provgrupp: om provet i engelska nivå 2 och exempel på uppgifter.',
         lank='https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-pa-niva-2/nationellt-prov-i-engelska-pa-niva-2'),

    dict(namn='gy3-svenska-np-niva-3', arskurs='gy3', amne='Svenska',
         titel='Nationella provet i svenska kurs 3 och nivå 3',
         beskrivning='Uppsala universitets provgrupp: provets delar, exempelmaterial och bedömningsanvisningar.',
         lank='https://www.uu.se/nationella-prov/svenska-och-svenska-som-andrasprak/gymnasiet/gy3'),
]
