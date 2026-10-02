-- ============================================================
-- NEXTRUM — materialbanken får NP-omgång 2: fler NP-blad och genomgångar (Fas 15.8)
--
-- Leo 2026-10-02: "fixa många fler blad av riktig np, np matte svenska
-- engelska för de årskurser som jag angett, fixa no so för åk 9 också.
-- Hitta material som besvarar frågorna från riktiga svenska böcker också,
-- sedan lägger du in det i materialbanken."
--
-- Fortfarande inga riktiga provuppgifter och ingen text ur läroböcker (se
-- Fas 15.7): bladen är Nextrums egna uppgifter i provens stil. Det som
-- "besvarar frågorna" är genomgångarna, egna faktablad med lösta exempel
-- inför proven. Äldre svensk litteratur (fri att använda) hade passat i
-- läsdelarna, men molnmiljön nådde inte runeberg.org, litteraturbanken.se
-- eller Wikisource, och klassiker citeras inte ur minnet.
--
-- 53 blad: åk 6 (matte, svenska, engelska), åk 9 (matte, svenska,
-- engelska, och ett NP-blad och en genomgång per NO- och SO-ämne),
-- gymnasiet (matematik nivå 1–2, svenska nivå 1 och 3, engelska nivå
-- 1–2) och provträning i Matematik 3c och 4 för de äldre kurserna.
--
-- Bladen är skrivna med AI och granskade av andra AI-granskare, inte
-- lästa av en lärare. Beskrivningen är aldrig ett facit.
--
-- ORDNINGEN: bladens länkar svarar 404 tills grenen med bank/ är
-- driftsatt på Vercel. Kör migrationen efter merge, inte före, och efter
-- 20261002190000_materialbanken_np_traning.
--
-- Raderna genereras med:  python3 verktyg/bygg-banken.py --sql <filnamnen>
-- och  python3 verktyg/bygg-banken.py --kolla  visar vad som saknas.
-- ============================================================

insert into public.biblioteksmaterial (id, titel, beskrivning, amne, arskurs, lank) values
  ('eafcfc1d-00de-582c-bd73-d2e49c2b31d5', 'NP-träning: tal och räkning', 'Träning inför nationella provet i matematik åk 6: positionssystemet, avrundning, bråk och decimaltal, negativa tal och smarta räknesätt.', 'Matematik', 'ak6', 'https://nextrum.se/bank/ak6-np-matematik-tal-och-rakning.png'),
  ('cec3fb2d-1627-56a3-aae0-1b79c6940541', 'NP-träning: geometri och mätning', 'Träning inför nationella provet i matematik åk 6: omkrets och area, volym och liter, vinklar, skala och en rektangel att konstruera.', 'Matematik', 'ak6', 'https://nextrum.se/bank/ak6-np-matematik-geometri-och-matning.png'),
  ('575ae5e6-0e68-5460-8fcb-87f077ddb659', 'NP-träning: statistik, chans och mönster', 'Träning inför nationella provet i matematik åk 6: läsa diagram, andel, median, chans och talföljder.', 'Matematik', 'ak6', 'https://nextrum.se/bank/ak6-np-matematik-statistik-och-monster.png'),
  ('5bc7d170-0864-557f-b9bb-0c9c60b92f20', 'Genomgång: bråk, decimaltal och procent', 'Faktablad med lösta exempel om bråk, decimaltal och procent, och fyra uppgifter att pröva själv.', 'Matematik', 'ak6', 'https://nextrum.se/bank/ak6-genomgang-brak-decimaltal-och-procent.png'),
  ('147271cb-68e5-52f5-882d-90c64c0ec527', 'Genomgång: omkrets, area, volym och enheter', 'Faktablad med lösta exempel om omkrets, area, volym, enheter och skala, och fyra uppgifter att pröva själv.', 'Matematik', 'ak6', 'https://nextrum.se/bank/ak6-genomgang-omkrets-area-och-volym.png'),
  ('02824fe4-d82d-5d1b-9086-7f9445362745', 'NP-träning: läsa en berättelse', 'Träning inför nationella provets läsdel i svenska åk 6: en berättelse med frågor om händelser, känslor och personer.', 'Svenska', 'ak6', 'https://nextrum.se/bank/ak6-np-svenska-lasa-berattelse.png'),
  ('b7d27f32-f99c-523f-bf61-3e3c9ef4fba6', 'NP-träning: skriva en faktatext', 'Träning inför nationella provets skrivdel i svenska åk 6: välja ämne, planera och skriva en faktatext med stycken.', 'Svenska', 'ak6', 'https://nextrum.se/bank/ak6-np-svenska-skriva-faktatext.png'),
  ('6c7f1209-ad08-5206-9b8d-f038fd16b7f5', 'Genomgång: berättelse och faktatext', 'Faktablad om berättande text, faktatext och skrivregler, och tre uppgifter att pröva själv.', 'Svenska', 'ak6', 'https://nextrum.se/bank/ak6-genomgang-berattelse-och-faktatext.png'),
  ('4124782e-efe0-5ed4-bc3f-cdc62fb77f7f', 'NP-träning: korta texter på engelska', 'Träning inför nationella provets läsdel i engelska åk 6: tre korta vardagstexter med frågor av olika slag.', 'Engelska', 'ak6', 'https://nextrum.se/bank/ak6-np-engelska-lasa-korta-texter.png'),
  ('a59d6939-6b55-51d9-8ebd-1515f23d8664', 'Genomgång: engelsk grammatik i åk 6', 'Faktablad om present simple, present continuous, past simple och frågeord på engelska, med fyra uppgifter.', 'Engelska', 'ak6', 'https://nextrum.se/bank/ak6-genomgang-engelsk-grammatik.png'),
  ('564ddc42-3f08-570f-be18-33e71c51e2a1', 'NP-träning: algebra och funktioner', 'Träning inför nationella provet i matematik åk 9: förenkla, lösa ekvationer, tolka och bestämma räta linjens ekvation.', 'Matematik', 'ak9', 'https://nextrum.se/bank/ak9-np-matematik-algebra-och-funktioner.png'),
  ('7cd3b436-aeae-568b-bb77-7f7acb92bc0a', 'NP-träning: geometri', 'Träning inför nationella provet i matematik åk 9: area och omkrets, cirkel, klot, Pythagoras sats, likformighet och vinklar.', 'Matematik', 'ak9', 'https://nextrum.se/bank/ak9-np-matematik-geometri.png'),
  ('e42488a8-2a78-5ff2-b79e-328fd1b0209d', 'NP-träning: statistik och sannolikhet', 'Träning inför nationella provet i matematik åk 9: typvärde, medelvärde och median, procent, sannolikhet och att granska en undersökning.', 'Matematik', 'ak9', 'https://nextrum.se/bank/ak9-np-matematik-statistik-och-sannolikhet.png'),
  ('65ce46ee-00b3-5015-ae7a-911c1e87dee2', 'Genomgång: ekvationer och funktioner', 'Faktablad med lösta exempel om ekvationer, räta linjens ekvation och proportionalitet, och tre uppgifter att pröva själv.', 'Matematik', 'ak9', 'https://nextrum.se/bank/ak9-genomgang-ekvationer-och-funktioner.png'),
  ('a95728b7-0265-57d5-aacf-f501b9594ad5', 'Genomgång: geometrins formler', 'Faktablad med formler för area, omkrets och volym, Pythagoras sats, likformighet och skala, och tre uppgifter.', 'Matematik', 'ak9', 'https://nextrum.se/bank/ak9-genomgang-geometrins-formler.png'),
  ('f298128b-71aa-591d-aa25-29b26cbdbf5c', 'NP-träning: läsa en novell', 'Träning inför nationella provets läsdel i svenska åk 9: en novell om sorg och minnen med frågor om handling, tolkning och tema.', 'Svenska', 'ak9', 'https://nextrum.se/bank/ak9-np-svenska-lasa-novell.png'),
  ('c54ac338-93cc-57ab-9b42-37e2ecd07f76', 'NP-träning: läsa en faktatext med diagram', 'Träning inför nationella provets läsdel i svenska åk 9: sakprosa med ett diagram, och frågor om innehåll och slutsatser.', 'Svenska', 'ak9', 'https://nextrum.se/bank/ak9-np-svenska-lasa-faktatext.png'),
  ('cd6c4fa7-de51-5d12-9f98-2f54dc21e556', 'NP-träning: skriva utifrån ett tema', 'Träning inför nationella provets skrivdel i svenska åk 9: välja mellan krönika och novell kring ett tema, planera och skriva.', 'Svenska', 'ak9', 'https://nextrum.se/bank/ak9-np-svenska-skriva-tema.png'),
  ('4bf35c28-ab1c-5b7f-b92a-880329f9f361', 'Genomgång: argumenterande, utredande och berättande text', 'Faktablad om argumenterande, utredande och berättande text och om källhänvisning, med tre uppgifter.', 'Svenska', 'ak9', 'https://nextrum.se/bank/ak9-genomgang-texttyper.png'),
  ('468a800f-b278-5f3c-8479-2f216c74137b', 'NP-träning: en kort berättelse på engelska', 'Träning inför nationella provets läsdel i engelska åk 9: en kort berättelse om en fotbollsmatch, med frågor om personer och budskap.', 'Engelska', 'ak9', 'https://nextrum.se/bank/ak9-np-engelska-lasa-short-story.png'),
  ('180f313a-8d2a-5b45-8841-32f2abf13263', 'NP-träning: åsikter i ett forum på engelska', 'Träning inför nationella provets läsdel i engelska åk 9: tre forumsinlägg om djurparker, fakta och åsikter, och ett eget inlägg.', 'Engelska', 'ak9', 'https://nextrum.se/bank/ak9-np-engelska-lasa-forum.png'),
  ('9c9f9da0-3642-51da-9ad8-f53d3696744f', 'Genomgång: skriva en bra text på engelska', 'Faktablad om struktur, bindeord, tempus och vanliga fel i engelska texter, och fyra uppgifter att pröva själv.', 'Engelska', 'ak9', 'https://nextrum.se/bank/ak9-genomgang-skriva-pa-engelska.png'),
  ('9bacbd93-a428-520c-8eb0-c1b84aca3269', 'NP-träning: biologi', 'Träning inför nationella provet i biologi åk 9: fotosyntes, ekosystem, kroppen, antibiotika och att ta ställning.', 'NO / Fysik / Kemi / Biologi', 'ak9', 'https://nextrum.se/bank/ak9-np-biologi.png'),
  ('b3aa2b01-a3aa-5169-a424-be1f58a36c8f', 'NP-träning: fysik', 'Träning inför nationella provet i fysik åk 9: massa och tyngd, energi och effekt, hastighet, energikällor och tröghet.', 'NO / Fysik / Kemi / Biologi', 'ak9', 'https://nextrum.se/bank/ak9-np-fysik.png'),
  ('f76cb512-6ede-52ac-a93d-0cd9a1e269f6', 'NP-träning: kemi', 'Träning inför nationella provet i kemi åk 9: grundämnen och föreningar, partiklar, syror och baser, förbränning och klimat.', 'NO / Fysik / Kemi / Biologi', 'ak9', 'https://nextrum.se/bank/ak9-np-kemi.png'),
  ('35b1e834-2b43-5668-ba1e-72c63e9df60c', 'Genomgång: biologi inför provet', 'Faktablad om celler, fotosyntes och cellandning, ekosystem, kroppen och arv, med tre uppgifter.', 'NO / Fysik / Kemi / Biologi', 'ak9', 'https://nextrum.se/bank/ak9-genomgang-biologi.png'),
  ('8bc00f12-4c19-517f-a5b1-50fe56bb5968', 'Genomgång: fysik inför provet', 'Faktablad om krafter och rörelse, energi, elektricitet, ljud och ljus, med tre uppgifter.', 'NO / Fysik / Kemi / Biologi', 'ak9', 'https://nextrum.se/bank/ak9-genomgang-fysik.png'),
  ('44d54dbe-6861-5962-9541-7f437bb7adf9', 'Genomgång: kemi inför provet', 'Faktablad om atomer, grundämnen och föreningar, kemiska reaktioner och pH, med tre uppgifter.', 'NO / Fysik / Kemi / Biologi', 'ak9', 'https://nextrum.se/bank/ak9-genomgang-kemi.png'),
  ('4f237eb9-2c33-5911-8fd0-8e99ca1b2034', 'NP-träning: geografi', 'Träning inför nationella provet i geografi åk 9: väder och klimat, urbanisering, befolkning, klimatförändringar och hållbarhet.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://nextrum.se/bank/ak9-np-geografi.png'),
  ('0ec3a954-7a80-5762-b56c-d3334034d62d', 'NP-träning: historia', 'Träning inför nationella provet i historia åk 9: kronologi, orsaker till första världskriget, kalla kriget, källkritik och industrialiseringen.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://nextrum.se/bank/ak9-np-historia.png'),
  ('46e5e828-977a-5c8c-a588-025640da433b', 'NP-träning: religionskunskap', 'Träning inför nationella provet i religionskunskap åk 9: heliga skrifter, likheter mellan religioner, karma, religionsfrihet och etik.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://nextrum.se/bank/ak9-np-religionskunskap.png'),
  ('03ac9bed-dd40-5ef8-910d-8f0869038dc3', 'NP-träning: samhällskunskap', 'Träning inför nationella provet i samhällskunskap åk 9: riksdag, regering och kommun, rättsstaten, ekonomi, medier och demokrati.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://nextrum.se/bank/ak9-np-samhallskunskap.png'),
  ('c62c4532-641d-57f4-8733-c73cc209d907', 'Genomgång: 1900-talet i korthet', 'Faktablad med en tidslinje över 1900-talet, orsakerna till första världskriget och kalla kriget, med tre uppgifter.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://nextrum.se/bank/ak9-genomgang-historia-1900-talet.png'),
  ('18d4f773-dd42-58b2-a00c-05a412147f83', 'Genomgång: världsreligionerna och etik', 'Faktablad om judendom, kristendom, islam, hinduism och buddhism och om tre etiska modeller, med tre uppgifter.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://nextrum.se/bank/ak9-genomgang-religioner-och-etik.png'),
  ('1091d276-e41c-5336-bb2d-c949e46d7a98', 'Genomgång: demokrati, rättsstat och ekonomi', 'Faktablad om riksdag, regering, kommuner och regioner, grundlagarna, rättsstaten och marknadsekonomi, med tre uppgifter.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://nextrum.se/bank/ak9-genomgang-demokrati-och-ekonomi.png'),
  ('980128c3-984d-5ef1-afd3-c744b3fb6eaf', 'Genomgång: klimat, befolkning och hållbarhet', 'Faktablad om väder och klimat, växthuseffekten, befolkningspyramider, urbanisering och hållbar utveckling, med tre uppgifter.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://nextrum.se/bank/ak9-genomgang-klimat-befolkning-och-hallbarhet.png'),
  ('2f607d9d-e7cc-5c06-a82c-38f356c6ab5d', 'NP-träning: matematik 1, funktioner', 'Träning inför nationella provet i matematik nivå 1: räta linjens ekvation, funktionsvärden, linjära och exponentiella modeller.', 'Matematik', 'gy1', 'https://nextrum.se/bank/gy1-np-matematik-1-funktioner.png'),
  ('7b94347e-e89a-5018-8512-178ffaa33fa5', 'NP-träning: matematik 1, geometri', 'Träning inför nationella provet i matematik nivå 1: trigonometri, volym, likformighet och sannolikhet i flera steg.', 'Matematik', 'gy1', 'https://nextrum.se/bank/gy1-np-matematik-1-geometri-och-sannolikhet.png'),
  ('eb53f24e-5193-54d7-a844-ef7b5710a100', 'Genomgång: matematik 1', 'Faktablad om förändringsfaktor, potenser, funktioner, trigonometri och sannolikhet, med tre uppgifter.', 'Matematik', 'gy1', 'https://nextrum.se/bank/gy1-genomgang-matematik-1.png'),
  ('de243167-beb8-530b-941b-d9f035598b8a', 'NP-träning: skönlitteratur, svenska 1', 'Träning inför nationella provets läsdel i svenska nivå 1: en kort berättelse med frågor om miljö, berättarperspektiv, symbolik och tema.', 'Svenska', 'gy1', 'https://nextrum.se/bank/gy1-np-svenska-1-skonlitteratur.png'),
  ('f357d564-a044-55d2-bc44-04b156cf25d3', 'NP-träning: referera, svenska 1', 'Träning inför nationella provets skrivdel i svenska nivå 1: referat, citat och referatmarkörer utifrån en påhittad artikel.', 'Svenska', 'gy1', 'https://nextrum.se/bank/gy1-np-svenska-1-referera.png'),
  ('d26ebac9-0796-5b00-8c5f-fd3db2ce6f75', 'Genomgång: argumentation och källor', 'Faktablad om tes, argument och belägg, ethos, pathos och logos, referat och källhänvisning, med tre uppgifter.', 'Svenska', 'gy1', 'https://nextrum.se/bank/gy1-genomgang-argumentation-och-kallor.png'),
  ('f4e58b30-af56-51f1-92ef-5d8162bccc06', 'NP-träning: short story, engelska 1', 'Träning inför nationella provets läsdel i engelska nivå 1: en kort berättelse om en anställningsintervju, med frågor om personer, detaljer och tema.', 'Engelska', 'gy1', 'https://nextrum.se/bank/gy1-np-engelska-1-short-story.png'),
  ('ea6c0094-f128-5635-8584-f0b88387fbbc', 'Genomgång: writing, engelska 1', 'Faktablad om formell och informell stil, stycken, bindeord och vanliga fel på engelska, med tre uppgifter.', 'Engelska', 'gy1', 'https://nextrum.se/bank/gy1-genomgang-writing-engelska-1.png'),
  ('94184907-88ef-57c6-8629-16d1c658d0c2', 'NP-träning: andragradsfunktioner', 'Träning inför nationella provet i matematik nivå 2: andragradsekvationer, nollställen, symmetrilinje, kvadreringsregler och att bestämma en funktion.', 'Matematik', 'gy2', 'https://nextrum.se/bank/gy2-np-matematik-2-andragradsfunktioner.png'),
  ('8e680837-48d8-532a-9583-57e4e463e2f4', 'NP-träning: matematik 2, blandat', 'Träning inför nationella provet i matematik nivå 2: logaritmer, exponentialekvationer, ekvationssystem, standardavvikelse och korrelation.', 'Matematik', 'gy2', 'https://nextrum.se/bank/gy2-np-matematik-2-blandat.png'),
  ('120f9a02-9a12-51c9-84fe-977edd5eb62c', 'Genomgång: matematik 2', 'Faktablad om pq-formeln, kvadreringsreglerna, andragradsfunktioner, logaritmer och standardavvikelse, med tre uppgifter.', 'Matematik', 'gy2', 'https://nextrum.se/bank/gy2-genomgang-matematik-2.png'),
  ('1f49735e-c52b-5ce5-a968-56d96a578c42', 'NP-träning: opinion piece, engelska 2', 'Träning inför nationella provets läsdel i engelska nivå 2: en åsiktstext om stegräknare, med frågor om argument, ton och ordval.', 'Engelska', 'gy2', 'https://nextrum.se/bank/gy2-np-engelska-2-opinion-piece.png'),
  ('15b17973-8e8d-5894-903c-26283d0a6ca4', 'Genomgång: argumentation, engelska 2', 'Faktablad om tes och ämnesmeningar, hedging, motargument, sammanhang och formellt ordförråd på engelska, med tre uppgifter.', 'Engelska', 'gy2', 'https://nextrum.se/bank/gy2-genomgang-argumentation-engelska-2.png'),
  ('ebb5399d-8310-5be7-a86e-830f000217d5', 'NP-träning: jämföra texter, svenska 3', 'Träning inför nationella provet i svenska nivå 3: jämföra två påhittade texter om AI i skolan och skriva ett stycke som sammanför dem.', 'Svenska', 'gy3', 'https://nextrum.se/bank/gy3-np-svenska-3-jamfora-texter.png'),
  ('7f66c550-88a0-5ca2-b4a5-c3059a7d597d', 'Genomgång: utredande text, svenska 3', 'Faktablad om den utredande textens uppbyggnad, saklighet, källhänvisning och stil, med tre uppgifter.', 'Svenska', 'gy3', 'https://nextrum.se/bank/gy3-genomgang-utredande-text.png'),
  ('81e70c20-0f0d-53fb-b40e-d35c88442db5', 'Provträning: matematik 3c', 'Provträning i matematik 3c: derivator, primitiva funktioner, rationella uttryck, extrempunkter, integraler, cosinussatsen och optimering.', 'Matematik', 'gy3', 'https://nextrum.se/bank/gy3-provtraning-matematik-3c.png'),
  ('227e35ba-b488-5c78-bd55-751b4728b2a6', 'Provträning: matematik 4', 'Provträning i matematik 4: komplexa tal, derivator av trigonometriska och sammansatta funktioner, trigonometriska ekvationer och extremvärden.', 'Matematik', 'gy3', 'https://nextrum.se/bank/gy3-provtraning-matematik-4.png')
on conflict (id) do nothing;
