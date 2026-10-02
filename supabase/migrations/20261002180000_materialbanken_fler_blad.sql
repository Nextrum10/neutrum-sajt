-- ============================================================
-- NEXTRUM — materialbanken får 68 blad till (Fas 15.6)
--
-- Leo 2026-10-02: "Material sidan har väldigt lite material. Utöka
-- materialbanken med mer material för varje årskurs."
--
-- Fas 15.5 la ett blad per årskurs (tolv). Nu har varje årskurs sex till
-- åtta: 80 sammanlagt. De är fortfarande VÅRA blad (inga skärmdumpar av
-- läromedel, se Fas 15.5), skrivna i verktyg/bladen/ och ritade till
-- bank/*.png av verktyg/bygg-banken.py. Alla sju ämnena i NX.AMNEN har
-- nu blad, också Moderna språk (tyska, spanska, franska) och
-- Programmering, som saknade helt.
--
-- Bladen är skrivna med AI och granskade av andra AI-granskare, inte
-- lästa av en lärare. Beskrivningen är en sammanfattning, aldrig ett
-- facit: vyn fyller läxans text med den, och läxtexten läser eleven.
--
-- Id:t är ett uuid5 ur filnamnet, så att migrationen kan köras om utan
-- dubbletter, och ett blad som rättas ritas om utan att få en ny rad.
--
-- ORDNINGEN: länkarna svarar 404 tills grenen med bank/ är driftsatt på
-- Vercel. Kör migrationen efter merge, inte före.
--
-- Raderna genereras med:
--   python3 verktyg/bygg-banken.py --sql <de nya bladens filnamn>
-- och  python3 verktyg/bygg-banken.py --kolla  visar vad som saknas.
-- ============================================================

insert into public.biblioteksmaterial (id, titel, beskrivning, amne, arskurs, lank) values
  ('bc3d02af-a21f-5a3f-ab56-9f1f1e66d942', 'Plus och minus upp till 20', 'Addition och subtraktion med tal upp till 20: åtta uppgifter att räkna och två textuppgifter.', 'Matematik', 'ak1', 'https://nextrum.se/bank/ak1-matematik-plus-och-minus-till-20.png'),
  ('50f7b564-d136-522a-b2f0-b69f5aaa722b', 'Större än, mindre än och talföljder', 'Jämföra tal med <, > och =, fortsätta talföljder och hitta talet före och efter.', 'Matematik', 'ak1', 'https://nextrum.se/bank/ak1-matematik-storre-an-mindre-an-och-talfoljder.png'),
  ('2cb07415-74cb-5e67-b0f9-0dee86e59b87', 'Rimord', 'Hitta och hitta på rimord: ringa in, skriva egna och rita två saker som rimmar.', 'Svenska', 'ak1', 'https://nextrum.se/bank/ak1-svenska-rimord.png'),
  ('93bed95f-92a9-51ef-80b7-e69a7aeebaaa', 'Läs och svara: Mias hund', 'Läsförståelse om Mia och hennes hund Pelle: fem frågor och en teckning.', 'Svenska', 'ak1', 'https://nextrum.se/bank/ak1-svenska-las-och-svara-mias-hund.png'),
  ('069b7862-2a99-5291-9882-e10edaf7a548', 'Årstiderna', 'Årstidernas namn och ordning, vad som händer i naturen och egna tankar om årstider.', 'NO / Fysik / Kemi / Biologi', 'ak1', 'https://nextrum.se/bank/ak1-no-arstiderna.png'),
  ('7f508140-8363-51ec-b754-7e13e8597685', 'Tiotal och ental', 'Tiotal och ental i tal upp till 100: uppdelning, tio mer och tio mindre, och storleksordning.', 'Matematik', 'ak2', 'https://nextrum.se/bank/ak2-matematik-tiotal-och-ental.png'),
  ('d07c1952-9824-5d98-a04d-6b6aeb8cc9b8', 'Klockan – hel och halv timme', 'Hel och halv timme på analog klocka: läsa av, rita visare och räkna en timme fram och tillbaka.', 'Matematik', 'ak2', 'https://nextrum.se/bank/ak2-matematik-klockan.png'),
  ('01150d8e-570b-5f4f-9aad-16254cd02766', 'Pengar – mynt och sedlar', 'Svenska mynt och sedlar: räkna ihop, betala och räkna ut växel.', 'Matematik', 'ak2', 'https://nextrum.se/bank/ak2-matematik-pengar.png'),
  ('363cbdea-ec4b-5a14-8499-c8b42a0cd086', 'Ord för saker och ord för det man gör', 'Skilja substantiv från verb: stryka under, ringa in, sortera och skriva egna meningar.', 'Svenska', 'ak2', 'https://nextrum.se/bank/ak2-svenska-substantiv-och-verb.png'),
  ('d8a746a2-0d56-5951-bbd5-67dbcd174f21', 'Växtens delar', 'Växtens delar och vad var och en gör, vad växter behöver och en teckning att namnge.', 'NO / Fysik / Kemi / Biologi', 'ak2', 'https://nextrum.se/bank/ak2-no-vaxtens-delar.png'),
  ('d3e7d241-f670-5a82-baa3-999f8011133c', 'Addition och subtraktion med växling', 'Skriftliga räknemetoder med växling i tal upp till 1 000: sex uppgifter och två textuppgifter.', 'Matematik', 'ak3', 'https://nextrum.se/bank/ak3-matematik-addition-och-subtraktion-med-vaxling.png'),
  ('076dfd3c-6187-5411-b2ea-c837ef6dea1b', 'Division – dela lika', 'Division som att dela lika, och sambandet med multiplikation: sex uppgifter, två textuppgifter och en egen berättelse.', 'Matematik', 'ak3', 'https://nextrum.se/bank/ak3-matematik-division-dela-lika.png'),
  ('de5ff3aa-5978-5ceb-b18d-ae38f01d1b39', 'Längd – cm, dm och m', 'Enheterna mm, cm, dm och m: växla mellan dem, uppskatta längder och räkna med dem.', 'Matematik', 'ak3', 'https://nextrum.se/bank/ak3-matematik-langd-och-mat.png'),
  ('c82acb0a-ad74-50b6-bd1d-fe365002fed8', 'Skriv en berättelse', 'Planera och skriva en berättelse med början, mitten och slut.', 'Svenska', 'ak3', 'https://nextrum.se/bank/ak3-svenska-skriv-en-berattelse.png'),
  ('b07217be-5010-5471-bc65-acb09825918e', 'Colours and numbers', 'Färger och siffror på engelska: översätta, skriva siffror med bokstäver och fylla i meningar.', 'Engelska', 'ak3', 'https://nextrum.se/bank/ak3-engelska-colours-and-numbers.png'),
  ('9d8bf639-153a-5b72-8f3a-92dcded6a306', 'Multiplikationstabellerna 3 till 9', 'Multiplikationstabellerna 3 till 9: räkna, hitta saknad faktor, dela och lösa två textuppgifter.', 'Matematik', 'ak4', 'https://nextrum.se/bank/ak4-matematik-multiplikationstabellerna.png'),
  ('2b3433c4-4c03-5bab-9972-4ad3b7bd0e2f', 'Tiondelar och decimaltal', 'Tiondelar och decimaltal: läsa på tallinje, jämföra, addera och subtrahera.', 'Matematik', 'ak4', 'https://nextrum.se/bank/ak4-matematik-tiondelar-och-decimaltal.png'),
  ('5265ea1c-7bca-5c76-bde4-67f5c61f9095', 'Synonymer och motsatser', 'Synonymer, motsatsord och sammansatta ord: hitta, sortera och bilda egna.', 'Svenska', 'ak4', 'https://nextrum.se/bank/ak4-svenska-synonymer-och-motsatser.png'),
  ('a5151a2a-f584-59e8-bb4b-53f71b1e2474', 'Describing people', 'Beskriva utseende på engelska med have/has och am/is/are, och skriva om en kompis.', 'Engelska', 'ak4', 'https://nextrum.se/bank/ak4-engelska-describing-people.png'),
  ('a6cb5a53-39c5-5344-a0cd-18b4ac53c7ec', 'Karta och väderstreck', 'Väderstreck och kartor: kompassen, väderstreck i Sverige, grannländer och en egen karta.', 'SO / Historia / Samhällskunskap', 'ak4', 'https://nextrum.se/bank/ak4-so-karta-och-vaderstreck.png'),
  ('7af8fac1-4b06-51a4-ac86-c77c63fbd37e', 'Area och omkrets', 'Omkrets och area av rektanglar och kvadrater: räkna, räkna baklänges och rita.', 'Matematik', 'ak5', 'https://nextrum.se/bank/ak5-matematik-area-och-omkrets.png'),
  ('0833ae03-ded6-5bed-a528-2c7f319d028f', 'Diagram och medelvärde', 'Läsa av ett stapeldiagram, räkna medelvärde, typvärde och median, och rita ett eget diagram.', 'Matematik', 'ak5', 'https://nextrum.se/bank/ak5-matematik-diagram-och-medelvarde.png'),
  ('c1405398-b469-58d3-b1a1-8813093fbce4', 'Skriva dialog med talstreck', 'Skriva dialog med talstreck och rätt skiljetecken, och ersätta ordet sa med mer talande verb.', 'Svenska', 'ak5', 'https://nextrum.se/bank/ak5-svenska-skriva-dialog.png'),
  ('c82b3fe1-1d96-513e-8c70-133308c76fb2', 'Present simple – every day', 'Present simple med -s och -es: fylla i rätt form, översätta och skriva om en vanlig dag.', 'Engelska', 'ak5', 'https://nextrum.se/bank/ak5-engelska-present-simple.png'),
  ('165f3dbb-79c4-5c14-83ce-6b61db8622b0', 'Vikingatiden', 'Läsförståelse om vikingatiden: tid, skepp, handel, gudar, tinget och runor.', 'SO / Historia / Samhällskunskap', 'ak5', 'https://nextrum.se/bank/ak5-so-vikingatiden.png'),
  ('a558b049-06dd-5270-89e7-95ea43bb0dd3', 'Negativa tal och koordinatsystem', 'Negativa tal på tallinje, i temperaturer och i uträkningar, och koordinater i ett koordinatsystem.', 'Matematik', 'ak6', 'https://nextrum.se/bank/ak6-matematik-negativa-tal-och-koordinatsystem.png'),
  ('ebd90c12-f24f-53af-9114-dc3e874adaa9', 'Enkla ekvationer', 'Enkla ekvationer med en obekant: lösa, kontrollera och ställa upp ur en text.', 'Matematik', 'ak6', 'https://nextrum.se/bank/ak6-matematik-enkla-ekvationer.png'),
  ('9b883f4a-249c-57f5-a1b2-12b61cf98024', 'Argumenterande text', 'Argumenterande text: tes, argument och motargument, bindeord och en egen kort text.', 'Svenska', 'ak6', 'https://nextrum.se/bank/ak6-svenska-argumenterande-text.png'),
  ('12cc4f6d-275d-58a6-8e1b-9930610dbed3', 'Past simple – regular verbs', 'Past simple med regelbundna verb: böja, fylla i, översätta och skriva om i går.', 'Engelska', 'ak6', 'https://nextrum.se/bank/ak6-engelska-past-simple.png'),
  ('0f50f629-8be2-5a91-affc-f635888313e3', 'Krafter i vardagen', 'Krafter i vardagen: gravitation, friktion och newton, med frågor och en teckning med kraftpilar.', 'NO / Fysik / Kemi / Biologi', 'ak6', 'https://nextrum.se/bank/ak6-no-krafter-i-vardagen.png'),
  ('9e607dcf-3144-5f0b-b202-4ef1d05a7e58', 'Uttryck och ekvationer', 'Värden av uttryck, förenkling, ekvationer med x på båda sidor och att ställa upp en ekvation ur en text.', 'Matematik', 'ak7', 'https://nextrum.se/bank/ak7-matematik-uttryck-och-ekvationer.png'),
  ('a321ad15-e2fe-5ade-9238-6b7a66332326', 'Vinklar och trianglar', 'Vinkelsumma, sidovinklar och area: beräkna okända vinklar i trianglar och fyrhörningar.', 'Matematik', 'ak7', 'https://nextrum.se/bank/ak7-matematik-vinklar-och-trianglar.png'),
  ('e4e5d668-0078-543c-9b21-ba3581396402', 'Ordklasser', 'Känna igen ordklasser i meningar: adverb, preposition, konjunktion, pronomen, adjektiv och räkneord.', 'Svenska', 'ak7', 'https://nextrum.se/bank/ak7-svenska-ordklasser.png'),
  ('edb51d90-36e1-57f1-a049-27936f748304', 'Reading: The school trip', 'Läsförståelse på engelska om en skolutflykt till en gård: sju frågor, en översättning och egen skrivuppgift.', 'Engelska', 'ak7', 'https://nextrum.se/bank/ak7-engelska-reading-the-school-trip.png'),
  ('d1a7c221-79a1-5cec-9532-ced6178a4a22', 'Cellen – livets minsta enhet', 'Cellens delar och deras uppgifter, skillnaden mellan växtceller och djurceller och fotosyntesen.', 'NO / Fysik / Kemi / Biologi', 'ak7', 'https://nextrum.se/bank/ak7-no-cellen.png'),
  ('f9e54e06-71bb-5db7-af16-7a51c762e890', 'Hur Sverige styrs', 'Demokrati och val i Sverige: riksdag, regering, kommun och yttrandefrihet.', 'SO / Historia / Samhällskunskap', 'ak7', 'https://nextrum.se/bank/ak7-so-hur-sverige-styrs.png'),
  ('69954105-6101-5afe-8331-de8d456acc34', 'Tyska: Hallo! Presentera dig', 'Nybörjartyska: presentera sig, verben sein och haben, siffror, familjeord och genus.', 'Moderna språk', 'ak7', 'https://nextrum.se/bank/ak7-tyska-hallo-och-verben-sein-haben.png'),
  ('94947dc4-8fd0-58ed-818d-9514c2ef9c1a', 'Pythagoras sats', 'Pythagoras sats: räkna ut hypotenusa och katet, diagonaler, stege mot vägg och avstånd mellan punkter.', 'Matematik', 'ak8', 'https://nextrum.se/bank/ak8-matematik-pythagoras-sats.png'),
  ('fe4054ab-dab4-52e3-a098-94434bb34bd4', 'Lägesmått och sannolikhet', 'Medelvärde, median, typvärde och variationsbredd samt enkel sannolikhet med kulor och tärning.', 'Matematik', 'ak8', 'https://nextrum.se/bank/ak8-matematik-statistik-och-sannolikhet.png'),
  ('1fe7d455-43d6-59fe-8c43-e4c113908e1d', 'Satsdelar: subjekt, predikat och objekt', 'Satsdelar: hitta subjekt, predikat, objekt och adverbial, rätta ordföljd och skilja huvudsats från bisats.', 'Svenska', 'ak8', 'https://nextrum.se/bank/ak8-svenska-satsdelar.png'),
  ('8c230d72-db20-5cae-bde2-49cbc78e2a31', 'Atomer och grundämnen', 'Atomens delar och laddningar, grundämnen och kemiska föreningar samt att läsa kemiska formler.', 'NO / Fysik / Kemi / Biologi', 'ak8', 'https://nextrum.se/bank/ak8-no-atomer-och-grundamnen.png'),
  ('a73f869f-1ef0-539b-8dce-e0be204705f1', 'Industrialiseringen i Sverige', 'Läsförståelse om industrialiseringen i Sverige: järnvägar, fabriker, urbanisering, fackföreningar och emigration.', 'SO / Historia / Samhällskunskap', 'ak8', 'https://nextrum.se/bank/ak8-so-industrialiseringen.png'),
  ('c462a6ec-2b83-5e56-9e74-d7b7137b50ff', 'Spanska: Presentera dig och din familj', 'Nybörjarspanska: presentera sig, verben ser och tener, siffror, familjeord och genus.', 'Moderna språk', 'ak8', 'https://nextrum.se/bank/ak8-spanska-presentarse.png'),
  ('ad25c3c1-68da-5a15-9dec-0ac8dbdd65c6', 'Ekvationssystem', 'Ekvationssystem med additions- och substitutionsmetoden, en textuppgift och en grafisk lösning.', 'Matematik', 'ak9', 'https://nextrum.se/bank/ak9-matematik-ekvationssystem.png'),
  ('e3d7a77d-2896-5b09-ae18-efcaf7498690', 'Förändringsfaktor och ränta på ränta', 'Förändringsfaktor, procentuell ökning och minskning, upprepad förändring och ränta på ränta.', 'Matematik', 'ak9', 'https://nextrum.se/bank/ak9-matematik-forandringsfaktor.png'),
  ('285a31aa-d7ec-58fc-b325-8dc3e9a3320d', 'Läsa och analysera en novell', 'Läsa en kort original-novell och analysera miljö, huvudperson, vändpunkt, berättarperspektiv, bildspråk och tema.', 'Svenska', 'ak9', 'https://nextrum.se/bank/ak9-svenska-noveller-och-analys.png'),
  ('00e86421-6200-52f3-96ce-1393c71b5f97', 'Present perfect eller past simple?', 'Present perfect jämfört med past simple: participformer, signalord, fylla i och översätta.', 'Engelska', 'ak9', 'https://nextrum.se/bank/ak9-engelska-present-perfect.png'),
  ('dd785a87-4357-50c4-8640-676539e9fbaa', 'Python: variabler, villkor och loopar', 'Läsa och skriva enkel Python: variabler, villkor, for-loopar och felsökning.', 'Programmering', 'ak9', 'https://nextrum.se/bank/ak9-programmering-python-grunder.png'),
  ('1f75722b-6744-56c9-bd6c-e90a5e139bff', 'Franska: être och avoir', 'Nybörjarfranska: presentera sig, verben être och avoir, siffror, familjeord och genus.', 'Moderna språk', 'ak9', 'https://nextrum.se/bank/ak9-franska-etre-et-avoir.png'),
  ('07da2011-6c6a-5782-b739-518bcb5dbcea', 'Andra världskriget', 'Läsförståelse om andra världskriget: början och slut, de båda sidorna, Förintelsen och Sveriges neutralitet.', 'SO / Historia / Samhällskunskap', 'ak9', 'https://nextrum.se/bank/ak9-so-andra-varldskriget.png'),
  ('82c10b56-d50e-564e-b3e3-af0778f9e20d', 'Volym, skala och likformighet', 'Volym av cylinder, kon och klot, skala på karta och likformighet med längd-, area- och volymskala.', 'Matematik', 'gy1', 'https://nextrum.se/bank/gy1-matematik-volym-skala-och-likformighet.png'),
  ('c0a27554-0610-5736-8d91-abf543f9173d', 'Linjära modeller – jämför tre avtal', 'Linjära modeller för tre abonnemang: formler, skärningspunkt, olikhet, tolkning av k och m och en graf.', 'Matematik', 'gy1', 'https://nextrum.se/bank/gy1-matematik-linjara-modeller.png'),
  ('1abefb60-ef46-596c-94e4-7920ecf1a848', 'Retorik – ethos, pathos och logos', 'Analysera ett påhittat tal med retorikens begrepp ethos, pathos och logos, mottagare, syfte och svagheter.', 'Svenska', 'gy1', 'https://nextrum.se/bank/gy1-svenska-retorik.png'),
  ('86ff4d87-257b-5fa8-8df4-aa5ac6ac4124', 'Writing a formal email', 'Formella mejl på engelska: formulera om, välja avslutning och skriva ett eget mejl till en språkskola.', 'Engelska', 'gy1', 'https://nextrum.se/bank/gy1-engelska-formal-email.png'),
  ('95a97198-f0db-500f-89e9-f667704ad0b9', 'Mol och substansmängd', 'Mol, molmassa och koncentration: räkna med substansmängd, antal partiklar och reaktionsformler.', 'NO / Fysik / Kemi / Biologi', 'gy1', 'https://nextrum.se/bank/gy1-no-kemi-mol-och-substansmangd.png'),
  ('0724a9ef-d7a9-5e45-af4c-84dcf04b4338', 'Python: listor, funktioner och loopar', 'Läsa och skriva Python med listor, funktioner, while- och for-loopar samt heltalsdivision och rest.', 'Programmering', 'gy1', 'https://nextrum.se/bank/gy1-programmering-listor-och-funktioner.png'),
  ('1e5756dc-93c3-545e-b28a-cf10003f6311', 'Exponentialfunktioner och logaritmer', 'Exponentialfunktioner, tillväxtfaktor och logaritmer: lösa exponentialekvationer och tolka tillväxt och avtagande.', 'Matematik', 'gy2', 'https://nextrum.se/bank/gy2-matematik-exponentialfunktioner.png'),
  ('2d42f2b2-99f2-5483-a2fd-bf24086d4bcf', 'Trigonometri – räta och allmänna trianglar', 'Sinus, cosinus och tangens i räta trianglar samt sinussatsen, cosinussatsen och areaformeln.', 'Matematik', 'gy2', 'https://nextrum.se/bank/gy2-matematik-trigonometri.png'),
  ('30bdc1c4-4602-540e-9bd0-a725590a8446', 'Sannolikhet och kombinatorik', 'Träddiagram med och utan återläggning, tärningskast, permutationer, kombinationer och komplementhändelse.', 'Matematik', 'gy2', 'https://nextrum.se/bank/gy2-matematik-sannolikhet-och-kombinatorik.png'),
  ('5f99f95e-621e-5c91-8aab-d3dbd5a60699', 'Källkritik', 'Källkritiska kriterier och begrepp: äkthet, beroende, samtidighet, tendens, primär- och sekundärkälla.', 'Svenska', 'gy2', 'https://nextrum.se/bank/gy2-svenska-kallkritik.png'),
  ('87bf8db1-a3ad-55a4-ab08-4f3e35f68dd4', 'Analysing a short text', 'Analysera en kort original-text på engelska: miljö, berättare, stämning, symbolik och eget fortsatt skrivande.', 'Engelska', 'gy2', 'https://nextrum.se/bank/gy2-engelska-analysing-a-short-text.png'),
  ('fe2bbad6-efc3-58fa-81b2-88b32d7e8d67', 'Rörelse och Newtons lagar', 'Hastighet, acceleration, Newtons lagar och fritt fall: räkna med v, s, a, F och tyngd.', 'NO / Fysik / Kemi / Biologi', 'gy2', 'https://nextrum.se/bank/gy2-fysik-rorelse-och-newtons-lagar.png'),
  ('702b2875-761b-559d-900e-c599b6a75dde', 'Integraler – primitiva funktioner och area', 'Primitiva funktioner, bestämda integraler och area mellan kurvor.', 'Matematik', 'gy3', 'https://nextrum.se/bank/gy3-matematik-integraler.png'),
  ('2d20b630-f291-5d33-9726-28e96a5a702b', 'Radianer och trigonometriska ekvationer', 'Radianer och enhetscirkeln, lösa trigonometriska ekvationer och läsa av amplitud och period.', 'Matematik', 'gy3', 'https://nextrum.se/bank/gy3-matematik-trigonometriska-ekvationer.png'),
  ('1c081a52-501b-5a28-bb0f-05c3a0d9c2d5', 'Referera, parafrasera och sammanfatta', 'Referera, parafrasera och sammanfatta en saklig text om sömn och minne, och formulera en forskningsfråga.', 'Svenska', 'gy3', 'https://nextrum.se/bank/gy3-svenska-referat-och-sammanfattning.png'),
  ('d724a785-1c84-5ab6-a371-f9c69eca9d1e', 'Writing an argumentative essay', 'Skriva en argumenterande text på engelska: tes, bindeord, ämnesmening, motargument med bemötande och avslutning.', 'Engelska', 'gy3', 'https://nextrum.se/bank/gy3-engelska-argumentative-essay.png'),
  ('43a595c9-b1ad-51aa-a6a0-dbc3812956a9', 'Ekonomi: BNP, inflation och Riksbanken', 'BNP, inflation, reallön, styrränta, konjunktur och statens budget: begrepp och enkla uträkningar.', 'SO / Historia / Samhällskunskap', 'gy3', 'https://nextrum.se/bank/gy3-so-ekonomi-bnp-inflation-och-riksbanken.png'),
  ('42ad6b5f-e765-5058-977c-f10dd9da0f2d', 'Från DNA till protein', 'DNA, basparning, transkription, translation och mutationer: räkna med baser och kodon och förklara genuttryck.', 'NO / Fysik / Kemi / Biologi', 'gy3', 'https://nextrum.se/bank/gy3-biologi-fran-dna-till-protein.png')
on conflict (id) do nothing;
