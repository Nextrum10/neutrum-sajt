-- ============================================================
-- NEXTRUM — materialbanken får NP-träning och länkar till proven (Fas 15.7)
--
-- Leo 2026-10-02: "ladda ner alla nationella prov du kan från årskurs 6
-- till gy åk 3. Använd de som materialbank och guide till hur du ska ha
-- innehållet ... hitta offentliga skolböcker såsom tex Liber och ladda
-- ner allt sånt där."
--
-- PROVEN KOPIERAS INTE IN, DE LÄNKAS. De nationella proven och deras
-- texter är upphovsrättsskyddade, och en kopia på nextrum.se är spridning
-- i en kommersiell tjänst. Läromedel från förlag som Liber är inte gratis
-- att ladda ner. Det som är fritt är att länka till sidan där
-- provgruppen själv publicerar materialet. Det gör de fjorton länkraderna
-- (verktyg/bladen/lankar.py), en eller två per årskurs och ämne med prov.
-- Adresserna kommer ur webbsökningar 2026-10-02 och är inte klickprovade,
-- eftersom miljön inte nådde sidorna: provklicka dem efter migrationen
-- och stäng av en som inte fungerar.
--
-- PROVEN ÄR GUIDEN. De 25 bladen "NP-träning" är Nextrums egna uppgifter
-- i samma stil som proven (delar med och utan räknare, nivåmärkena E, C
-- och A, läs- och skrivdelar med underlag), aldrig provens egna, och
-- säger det på första raden i sin instruktion. Prov finns i åk 6 (Ma,
-- Sv, En), åk 9 (Ma, Sv, En, NO, SO) och med Gy25 i matematik nivå 1–2,
-- svenska nivå 1 och 3 och engelska nivå 1–2.
--
-- Bladen är skrivna med AI och granskade av andra AI-granskare, inte
-- lästa av en lärare. Beskrivningen är aldrig ett facit.
--
-- ORDNINGEN: bladens länkar svarar 404 tills grenen med bank/ är
-- driftsatt på Vercel. Kör migrationen efter merge, inte före, och efter
-- 20261002180000_materialbanken_fler_blad.
--
-- Raderna genereras med:  python3 verktyg/bygg-banken.py --sql -np-
-- ============================================================

insert into public.biblioteksmaterial (id, titel, beskrivning, amne, arskurs, lank) values
  ('1aa41a4e-a46f-5ee9-8f7a-64e128ad55ea', 'NP-träning: matematik utan miniräknare', 'Träning inför nationella provet i matematik åk 6, utan miniräknare: räkning, tal i olika former, mönster och problem på nivåerna E, C och A.', 'Matematik', 'ak6', 'https://nextrum.se/bank/ak6-np-matematik-utan-miniraknare.png'),
  ('eef0d4ac-13d3-5fdb-a40a-c82fdbd942bc', 'NP-träning: problemlösning i matematik', 'Träning inför nationella provet i matematik åk 6 med miniräknare: problemlösning, medelvärde, procent och resonemang på nivåerna E, C och A.', 'Matematik', 'ak6', 'https://nextrum.se/bank/ak6-np-matematik-problemlosning.png'),
  ('19b7be4b-a109-5032-b9b4-747955957945', 'NP-träning: läsa och förstå en faktatext', 'Träning inför nationella provets läsdel i svenska åk 6: en faktatext om ladusvalan med frågor på olika nivåer.', 'Svenska', 'ak6', 'https://nextrum.se/bank/ak6-np-svenska-lasa.png'),
  ('5fbfc26f-6036-5e77-8f24-152027ba52b0', 'NP-träning: skriva en berättelse', 'Träning inför nationella provets skrivdel i svenska åk 6: planera, skriva och läsa igenom en berättelse.', 'Svenska', 'ak6', 'https://nextrum.se/bank/ak6-np-svenska-skriva.png'),
  ('505b0828-2a6d-5c60-af3b-ecad04997131', 'NP-träning: läsa på engelska', 'Träning inför nationella provets läsdel i engelska åk 6: ett brev med frågor av olika slag.', 'Engelska', 'ak6', 'https://nextrum.se/bank/ak6-np-engelska-lasa.png'),
  ('acc4fbe2-e395-5575-ac05-b65071ef5c63', 'NP-träning: skriva på engelska', 'Träning inför nationella provets skrivdel i engelska åk 6: planera och skriva ett mejl till en brevvän.', 'Engelska', 'ak6', 'https://nextrum.se/bank/ak6-np-engelska-skriva.png'),
  ('e4f68fef-fd49-5cbb-bfcb-4c5c479e33dc', 'NP-träning: matematik utan miniräknare', 'Träning inför nationella provet i matematik åk 9, utan miniräknare: räkning, algebra, funktioner och bevis på nivåerna E, C och A.', 'Matematik', 'ak9', 'https://nextrum.se/bank/ak9-np-matematik-utan-miniraknare.png'),
  ('13f6cdeb-2198-5a20-930d-ba1f7885898f', 'NP-träning: matematik med miniräknare', 'Träning inför nationella provet i matematik åk 9 med miniräknare: procent, proportionalitet, Pythagoras sats, sannolikhet och problemlösning.', 'Matematik', 'ak9', 'https://nextrum.se/bank/ak9-np-matematik-med-miniraknare.png'),
  ('6c370124-dba9-5fd0-8de9-134a9031460f', 'NP-träning: läsa en krönika', 'Träning inför nationella provets läsdel i svenska åk 9: en krönika med frågor om tes, exempel, stilmedel och syfte.', 'Svenska', 'ak9', 'https://nextrum.se/bank/ak9-np-svenska-lasa.png'),
  ('9b15a1d8-c28c-5a63-b27c-4a0e99c62be7', 'NP-träning: argumenterande text', 'Träning inför nationella provets skrivdel i svenska åk 9: argumenterande text med underlag och källhänvisning.', 'Svenska', 'ak9', 'https://nextrum.se/bank/ak9-np-svenska-skriva.png'),
  ('07c5f0c0-ae86-59eb-963c-3405bdbf9451', 'NP-träning: läsa på engelska', 'Träning inför nationella provets läsdel i engelska åk 9: en artikel om att låna saker i stället för att köpa.', 'Engelska', 'ak9', 'https://nextrum.se/bank/ak9-np-engelska-lasa.png'),
  ('723a9914-b670-5227-8855-56a9d62d8725', 'NP-träning: skriva på engelska', 'Träning inför nationella provets skrivdel i engelska åk 9: välja ämne, planera och skriva en sammanhängande text.', 'Engelska', 'ak9', 'https://nextrum.se/bank/ak9-np-engelska-skriva.png'),
  ('abc7155a-8b62-5d0d-97b8-f59a34f39040', 'NP-träning: NO – undersöka och förklara', 'Träning inför nationella proven i NO åk 9: planera och värdera en undersökning, förklara med partikelmodellen och ta ställning i en miljöfråga.', 'NO / Fysik / Kemi / Biologi', 'ak9', 'https://nextrum.se/bank/ak9-np-no-undersoka-och-forklara.png'),
  ('c2df7b72-cced-5e6a-b408-e5631f38c9fc', 'NP-träning: SO – källor och samband', 'Träning inför nationella proven i SO åk 9: källkritik med en påhittad källa, orsaker och konsekvenser, rättsstaten och religion i vardagen.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://nextrum.se/bank/ak9-np-so-kallor-och-samband.png'),
  ('6e87c7a7-1c72-535f-b816-d386c9033371', 'NP-träning: matematik 1 utan räknare', 'Träning inför nationella provet i matematik nivå 1 utan digitala verktyg: räkning, algebra, funktioner och procent på nivåerna E, C och A.', 'Matematik', 'gy1', 'https://nextrum.se/bank/gy1-np-matematik-niva-1-utan-digitala-verktyg.png'),
  ('e32f146b-79b9-5b6b-9ba3-3c23404211ab', 'NP-träning: matematik 1 med räknare', 'Träning inför nationella provet i matematik nivå 1 med digitala verktyg: förändringsfaktor, volym, procentenheter, proportionalitet och modellering.', 'Matematik', 'gy1', 'https://nextrum.se/bank/gy1-np-matematik-niva-1-med-digitala-verktyg.png'),
  ('6eafc1f6-281a-5b02-b8b8-5c2d9769ada7', 'NP-träning: läsförståelse, svenska 1', 'Träning inför nationella provets läsdel i svenska nivå 1: en sakprosatext om lånord med frågor om innehåll, syfte och perspektiv.', 'Svenska', 'gy1', 'https://nextrum.se/bank/gy1-np-svenska-niva-1-lasforstaelse.png'),
  ('0eceb724-2265-56a5-957d-78b43a569bb1', 'NP-träning: argumentera, svenska 1', 'Träning inför nationella provets skrivdel i svenska nivå 1: argumenterande text utifrån två källor, med källhänvisning.', 'Svenska', 'gy1', 'https://nextrum.se/bank/gy1-np-svenska-niva-1-skriva.png'),
  ('4209f452-3237-531e-9b00-bc4e9524372f', 'NP-träning: reading, engelska nivå 1', 'Träning inför nationella provets läsdel i engelska nivå 1: en artikel om medborgarforskning med frågor om huvudtanke, detaljer och attityd.', 'Engelska', 'gy1', 'https://nextrum.se/bank/gy1-np-engelska-niva-1-reading.png'),
  ('66c147d5-0745-521b-ab90-43e88478d515', 'NP-träning: writing, engelska nivå 1', 'Träning inför nationella provets skrivdel i engelska nivå 1: planera och skriva en argumenterande text om volontärarbete.', 'Engelska', 'gy1', 'https://nextrum.se/bank/gy1-np-engelska-niva-1-writing.png'),
  ('27f6caa7-040b-5de0-a171-e21ecf10fccb', 'NP-träning: matematik 2 utan räknare', 'Träning inför nationella provet i matematik nivå 2 utan digitala verktyg: andragradsekvationer, kvadreringsregler, logaritmer, ekvationssystem och bevis.', 'Matematik', 'gy2', 'https://nextrum.se/bank/gy2-np-matematik-niva-2-utan-digitala-verktyg.png'),
  ('02736ad4-0de6-5c2d-8bc1-6cd376478a27', 'NP-träning: matematik 2 med räknare', 'Träning inför nationella provet i matematik nivå 2 med digitala verktyg: andragradsfunktioner, exponentialekvationer, statistik och optimering.', 'Matematik', 'gy2', 'https://nextrum.se/bank/gy2-np-matematik-niva-2-med-digitala-verktyg.png'),
  ('16259abc-8104-5172-8283-99927069dc95', 'NP-träning: reading, engelska nivå 2', 'Träning inför nationella provets läsdel i engelska nivå 2: en essä om att skjuta upp saker, med frågor om innehåll, ton och struktur.', 'Engelska', 'gy2', 'https://nextrum.se/bank/gy2-np-engelska-niva-2-reading.png'),
  ('7be78c02-03ea-55f6-a2b3-a6c04574bcd5', 'NP-träning: writing, engelska nivå 2', 'Träning inför nationella provets skrivdel i engelska nivå 2: en diskuterande text om ett kontantlöst samhälle.', 'Engelska', 'gy2', 'https://nextrum.se/bank/gy2-np-engelska-niva-2-writing.png'),
  ('37c33cdb-be56-5074-b080-6c17dc93a341', 'NP-träning: utredande text, svenska 3', 'Träning inför nationella provets skrivdel i svenska nivå 3: utredande text utifrån två källor, med frågeställning, källhänvisning och slutsats.', 'Svenska', 'gy3', 'https://nextrum.se/bank/gy3-np-svenska-niva-3-utredande-text.png'),
  ('9736a41f-e625-5917-9b85-bc232f9fc62e', 'Nationella proven i matematik (PRIM-gruppen)', 'Stockholms universitets provgrupp, som gör proven i matematik för åk 6 och åk 9. Information om proven och publicerat provmaterial.', 'Matematik', 'ak6', 'https://www.su.se/enheter/prim-gruppen'),
  ('c7f51886-380f-5555-8280-b9c89fbeb90d', 'Exempel på uppgifter i nationella provet i engelska, åk 6', 'Göteborgs universitets provgrupp visar vilka sorters uppgifter som finns i provet: tala, läsa, lyssna och skriva.', 'Engelska', 'ak6', 'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-arskurs-1-6/exempel-pa-uppgiftstyper-for-engelska-for-arskurs-6'),
  ('5f3c82a6-293d-50c2-b8ac-9a807c77e898', 'Tidigare nationella prov i matematik, åk 9 (PRIM-gruppen)', 'Stockholms universitets provgrupp publicerar här prov som inte längre är hemliga, med bedömningsanvisningar.', 'Matematik', 'ak9', 'https://www.su.se/enheter/prim-gruppen/nationella-prov/arskurs-9'),
  ('a6e5d782-bb24-553a-a117-e4ae8352f1b4', 'Nationella provet i engelska, åk 9', 'Göteborgs universitets provgrupp beskriver provets tre delar och visar exempel på uppgifter.', 'Engelska', 'ak9', 'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-arskurs-7-9/nationella-prov-i-engelska-for-arskurs-9'),
  ('529ff6d6-5737-50e7-a25a-a9774c321821', 'Nationella provet i svenska, åk 9: upplägg och bedömning', 'Uppsala universitets provgrupp förklarar provets delar (tala, läsa, skriva) och hur de bedöms.', 'Svenska', 'ak9', 'https://www.uu.se/nationella-prov/svenska-och-svenska-som-andrasprak/grundskolan/ak9/upplagg'),
  ('57dd8a20-5375-5ad4-8971-565b76f2433d', 'Förberedelsematerial för nationella proven i NO, åk 9', 'Umeå universitets provgrupp, som gör proven i biologi, fysik och kemi, har tagit fram materialet för att förbereda inför proven.', 'NO / Fysik / Kemi / Biologi', 'ak9', 'https://arkiv.edusci.umu.se/npno9/webbmaterial/F%C3%B6rberedelsematerial%20f%C3%B6r%20nationella%20prov%20i%20NO%C3%A4mnen%20%C3%A5k%209.pdf'),
  ('ee7f7561-d7e7-5cdc-9ebc-5e39beaeb77e', 'Nationella provet i geografi, åk 9', 'Uppsala universitets provgrupp för geografi: information om provet och publicerat material.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://www.uu.se/nationella-prov/geografi/'),
  ('af49b059-35a1-5f95-a8c4-a6237205e72b', 'Nationella provet i religionskunskap, åk 9', 'Göteborgs universitets provgrupp för religionskunskap: information om provet och publicerat material.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://www.gu.se/didaktik-pedagogisk-profession/nationella-prov-i-religionskunskap'),
  ('b65d73c5-ccce-5fb2-8881-5f8e67b1829b', 'Nationella proven i matematik (PRIM-gruppen)', 'Stockholms universitets provgrupp för matematik: information om proven och publicerat provmaterial.', 'Matematik', 'gy1', 'https://www.su.se/enheter/prim-gruppen'),
  ('0363fdc2-7351-5448-8ad1-82191d83901a', 'Nationella provet i svenska nivå 1', 'Uppsala universitets provgrupp: provets delar, provdatum, exempelmaterial och bedömningsanvisningar.', 'Svenska', 'gy1', 'https://www.uu.se/nationella-prov/svenska-och-svenska-som-andrasprak/gymnasiet/gy1'),
  ('a3a024b9-55c2-5a8a-a3cc-a252ead8f48d', 'Nationella provet i engelska nivå 1', 'Göteborgs universitets provgrupp: om provet i engelska nivå 1 och exempel på uppgifter.', 'Engelska', 'gy1', 'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-pa-niva-1/nationella-prov-i-engelska-pa-niva-1'),
  ('efffb51c-d232-5ac9-96b1-552aa5f4eee6', 'Tidigare givna prov i matematik, gymnasiet (Umeå universitet)', 'Umeå universitets provgrupp, som gör proven i matematik på gymnasiet efter nivå 1, publicerar här tidigare prov.', 'Matematik', 'gy2', 'https://www.umu.se/npma/tidigare-givna-prov/'),
  ('c5e4fcd4-cce1-51ca-bb38-d97ad94b835a', 'Nationella provet i engelska nivå 2', 'Göteborgs universitets provgrupp: om provet i engelska nivå 2 och exempel på uppgifter.', 'Engelska', 'gy2', 'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-pa-niva-2-gymnasiet/nationellt-prov-i-engelska-pa-niva-2'),
  ('fe493ab3-8b76-5759-a1a4-403176f266f7', 'Nationella provet i svenska kurs 3 och nivå 3', 'Uppsala universitets provgrupp: provets delar, exempelmaterial och bedömningsanvisningar.', 'Svenska', 'gy3', 'https://www.uu.se/nationella-prov/svenska-och-svenska-som-andrasprak/gymnasiet/gy3')
on conflict (id) do nothing;
