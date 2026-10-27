# -*- coding: utf-8 -*-
"""Faktabladen till fortsättningen i engelska för gymnasiet (2026-10-27).

Ett blad per område i verktyg/uppgiftsbanken/fortsattning_engelska_gy.py,
skrivet efter vad nivåerna faktiskt övar. Exemplen är inga frågor ur
banken. Nextrums egen text, skriven med AI och inte läst av en lärare.
"""
from fakta import blad

EN = 'Engelska'

FAKTABLAD = [
    # ---------------------------------------------------------------- gy1
    blad(EN, 'gy1', 'Relativsatser',
         mal=['Välja mellan who, which, that, whose, where och what i en relativsats.',
              'Avgöra när en relativsats ska stå mellan kommatecken och när den inte ska det.',
              'Skriva formella relativsatser med preposition före whom och which, som most of whom och in which.'],
         fakta=['Who används om personer och which om saker och djur. That går om båda, men bara i satser utan '
                'kommatecken.',
                'En sats utan kommatecken pekar ut vem eller vad det gäller: the bus that goes to the airport. En sats '
                'mellan kommatecken ger bara extra information: My mother, who is a nurse, …',
                'Är relativpronomenet objekt i en sats utan kommatecken kan det strykas: the film (that) we saw.',
                'Which efter kommatecken kan syfta på hela satsen före: He missed the bus, which made him late.',
                'Efter en preposition heter det whom och which: the person to whom I wrote, ten books, most of which …'],
         exempel=[('Behövs kommatecken? Lisbon which is the capital of Portugal is built on hills.',
                   'Ja. Det finns bara ett Lisbon, så satsen ger extra information: Lisbon, which is the capital of '
                   'Portugal, is built on hills. Då måste det också vara which, inte that.')],
         ord=[('defining clause', 'relativsats som pekar ut vem eller vad det gäller, utan kommatecken'),
              ('non-defining clause', 'relativsats som ger extra information, mellan kommatecken'),
              ('whom', 'vem eller vilka efter en preposition, i formell engelska'),
              ('whose', 'vars, om både personer och saker')],
         tips='Fråga dig: vet läsaren vem eller vad det gäller också utan satsen? Då är den extra information och ska '
              'stå mellan kommatecken.'),

    blad(EN, 'gy1', 'Artiklar och substantiv',
         mal=['Veta när engelskan inte har the fast svenskan har bestämd form, som i society och life.',
              'Använda a och an före yrken och i uttryck som three times a week.',
              'Känna igen oräknebara ord som advice, research och furniture, och ord som news och police.'],
         fakta=['Talar du allmänt om något abstrakt står det utan the: Society is changing. Life is short. Nature '
                'needs protection.',
                'Plural i allmänhet står också utan the: Dogs are loyal. The dogs betyder vissa hundar som redan nämnts.',
                'Yrken får a eller an: She is a doctor, he works as an engineer. De flesta heter most people.',
                'Advice, information, research, evidence, furniture, luggage och progress får inget -s. De flesta '
                'räknas med a piece of: two pieces of advice.',
                'News och ämnen på -ics, som mathematics, är singular: The news is good. Police och people är plural: '
                'The police are here.'],
         exempel=[('Rätta meningen: The knowledge is power, and the informations are everywhere.',
                   'Knowledge is power, and information is everywhere. Knowledge står allmänt utan the, och information '
                   'har ingen plural.')],
         ord=[('uncountable noun', 'oräknebart substantiv, utan plural och utan a'),
              ('a piece of', 'ett sätt att räkna oräknebara ord: a piece of advice'),
              ('the rich', 'de rika, en grupp, med verbet i plural'),
              ('progress', 'framsteg, oräknebart på engelska')],
         tips='Är det svenska ordet i bestämd form för att det handlar om allt i allmänhet? Då stryker du oftast the '
              'på engelska.'),

    blad(EN, 'gy1', 'Källkritik',
         mal=['Skilja mellan fakta som går att kontrollera och åsikter.',
              'Känna igen när en källa har ett eget intresse eller är partisk.',
              'Granska en engelsk text: vem som står bakom, vilka belägg som finns och vad som saknas.'],
         fakta=['Ett faktapåstående går att kontrollera, till exempel ett årtal eller en siffra. En åsikt är en '
                'värdering, som best, terrible eller should.',
                'Fråga vem som står bakom texten och vad avsändaren vinner på den. Ett företag som skriver om sin egen '
                'produkt är inte oberoende.',
                'Sponsored, ad och paid partnership betyder att någon har betalat. Det är reklam, även när det ser ut '
                'som en artikel.',
                'En liten studie utan jämförelsegrupp, eller som ingen annan forskare har granskat, säger mindre än '
                'rubriken antyder.',
                'En personlig berättelse kan vara sann för den som berättar, men den visar inte vad som gäller för de '
                'flesta.'],
         exempel=[('En rubrik lyder: Scientists say chocolate makes you thinner. Vad bör du kontrollera först?',
                   'Vem som gjorde studien och vem som betalade den, hur många som deltog, om det fanns en '
                   'jämförelsegrupp och om studien har publicerats så att andra forskare har kunnat granska den.')],
         ord=[('reliable', 'tillförlitlig'),
              ('biased', 'partisk, drar åt ett håll'),
              ('evidence', 'belägg, bevis'),
              ('source', 'källa'),
              ('peer review', 'granskning av andra forskare innan en studie publiceras'),
              ('control group', 'jämförelsegrupp som inte får det som prövas')],
         tips='Ju mer en rubrik lovar, desto viktigare är det att ta reda på vad studien faktiskt visade.'),

    # ---------------------------------------------------------------- gy2
    blad(EN, 'gy2', 'Betoning och inversion',
         mal=['Betona en del av meningen med It was … who/that och What … is.',
              'Använda betonande do, does och did för att säga emot eller understryka.',
              'Använda omvänd ordföljd efter nekande uttryck som never, not only, hardly och no sooner.'],
         fakta=['It was plus det som ska betonas plus who eller that: It was the coach who decided.',
                'En mening som börjar med What … lägger det viktiga sist: What we need is more time.',
                'Do, does och did plus grundform betonar: I did call you. She does care.',
                'Står ett nekande eller begränsande uttryck först byter hjälpverb och subjekt plats: Never have I …, '
                'Not only was she …, Only then did we …',
                'Fasta par: Hardly … when och No sooner … than. Inversion är formell eller dramatisk och hör mest till '
                'skrift och tal inför publik.'],
         exempel=[('Skriv om med inversion: I have seldom heard such a good speech.',
                   'Seldom have I heard such a good speech. Seldom står först, och hjälpverbet have kommer före '
                   'subjektet I.')],
         ord=[('cleft sentence', 'kluven mening, som It was … who'),
              ('emphasis', 'betoning, eftertryck'),
              ('inversion', 'omvänd ordföljd: hjälpverbet före subjektet'),
              ('auxiliary verb', 'hjälpverb, som have, be, do och de modala verben')],
         tips='Finns inget hjälpverb i meningen? Lägg till do, does eller did: She rarely smiles blir Rarely does she '
              'smile.'),

    blad(EN, 'gy2', 'Villkor och konjunktiv',
         mal=['Bygga blandade villkorssatser där villkoret och följden hör till olika tider.',
              'Använda formella villkor utan if: Had I known, Should you need och Were it not for.',
              'Använda konjunktiv och dåtid efter till exempel It is essential that, It’s time och I’d rather.'],
         fakta=['Förfluten orsak, följd nu: If I had saved money, I would be rich now.',
                'Orsak nu eller alltid, följd i det förflutna: If I were braver, I would have said something.',
                'I formell engelska kan if strykas och verbet flyttas först: Had we known …, Should you need …, Were it '
                'not for …',
                'Efter recommend, suggest, insist och essential that kan verbet stå i grundform, konjunktiv: It is '
                'vital that she be informed. Det går också att skriva should: that she should be informed.',
                'Efter It’s time, It’s high time och I’d rather plus en person står dåtid fast det gäller nu: It’s '
                'time we left.'],
         exempel=[('Fyll i: If I ___ (not/break) my leg last month, I would be playing in the final today.',
                   'hadn’t broken. Benbrottet hände förra månaden, så villkoret står i past perfect. Följden gäller i '
                   'dag: would be playing.')],
         ord=[('mixed conditional', 'blandad villkorssats, där delarna hör till olika tider'),
              ('subjunctive', 'konjunktiv: verbets grundform efter till exempel insist that'),
              ('should you need', 'om du skulle behöva'),
              ('were it not for', 'om det inte vore för')],
         tips='Ta en del i taget och fråga: gäller den här delen då eller nu? Det avgör verbformen.'),

    blad(EN, 'gy2', 'Syfte och mottagare',
         mal=['Avgöra om en text vill informera, övertyga, instruera eller underhålla.',
              'Se vem en text vänder sig till och hur språket anpassas efter mottagaren.',
              'Jämföra två texter om samma sak: syfte, stilnivå och ton.'],
         fakta=['Syftet är vad texten vill att läsaren ska göra: veta något, tycka något, kunna något eller ha roligt. '
                'En text kan ha flera syften, men oftast ett huvudsyfte.',
                'Formellt språk: hela ord, passiv form och fasta fraser som We would be grateful if. Informellt: '
                'förkortningar, frågor till läsaren och vardagsord.',
                'Instruktioner har imperativ och steg i ordning. Rapporter och broschyrer har rubriker och punktlistor. '
                'Debattexter har en tes och en uppmaning.',
                'Ton är skribentens attityd: neutral, ironisk, arg, entusiastisk. Leta efter ordval, frågor och humor.'],
         exempel=[('Vem vänder sig texten till? Dear residents, from Monday the car park on Hill Road will be closed '
                   'for six weeks.',
                   'Till dem som bor i området. Dear residents, exakta uppgifter om när och hur länge och en saklig ton '
                   'visar att det är ett formellt meddelande som ska informera.')],
         ord=[('purpose', 'syfte'),
              ('audience', 'mottagare, publik'),
              ('register', 'stilnivå, hur formellt språket är'),
              ('tone', 'ton, skribentens attityd'),
              ('call to action', 'uppmaning till läsaren att göra något')],
         tips='Fråga dig efter varje text: vem skrev den, till vem, och vad vill avsändaren att läsaren ska göra?'),

    # ---------------------------------------------------------------- gy3
    blad(EN, 'gy3', 'Litterära begrepp',
         mal=['Känna igen hur en berättelse är byggd: förebådande, tillbakablick, in medias res och handlingens '
              'delar.',
              'Beskriva berättaren: första person, allvetande eller opålitlig.',
              'Skilja mellan tre sorters ironi och förklara satir, allegori, parodi, motiv och tema.'],
         fakta=['Foreshadowing antyder vad som kommer. Flashback visar något som har hänt tidigare. In medias res '
                'börjar mitt i handlingen.',
                'En allvetande berättare vet vad alla tänker. En opålitlig berättare går inte helt att lita på, för '
                'att hen ljuger, minns fel eller inte förstår.',
                'Verbal irony: man säger motsatsen till det man menar. Situational irony: motsatsen till det väntade '
                'händer. Dramatic irony: publiken vet mer än personen.',
                'Satir kritiserar med humor. En allegori är en berättelse där allt står för något annat. En parodi '
                'härmar och överdriver för att roa.',
                'Ett motiv är något konkret som återkommer. Temat är den stora frågan texten handlar om.'],
         exempel=[('En flicka berättar en novell i jagform. Hon säger att hon aldrig är rädd, men berättar också att '
                   'hon sover med lampan tänd varje natt. Vad säger det om henne som berättare?',
                   'Hon är en opålitlig berättare. Det hon påstår stämmer inte med det hon gör, och läsaren förstår '
                   'mer än hon säger.')],
         ord=[('protagonist', 'huvudperson'),
              ('antagonist', 'motståndare, den eller det som står emot huvudpersonen'),
              ('epiphany', 'plötslig insikt, ofta en vändpunkt'),
              ('climax', 'höjdpunkten i handlingen'),
              ('motif', 'något konkret som återkommer i en text'),
              ('theme', 'det en text handlar om på djupet')],
         tips='Stöd alltid ett begrepp med ett kort citat: säg inte bara att det är ironi, visa var och förklara '
              'varför.'),

    blad(EN, 'gy3', 'Akademisk stil',
         mal=['Välja referatverb som visar hur du och källan ser på ett påstående.',
              'Skilja mellan citat och referat, och ange källan i båda fallen.',
              'Skriva kompakt och sakligt med nominaliseringar, opersonliga formuleringar och participfraser som '
              'syftar rätt.'],
         fakta=['Referatverb har olika klang: show och demonstrate säger att något är visat, claim håller ofta avstånd, '
                'suggest är försiktigt, admit och concede medger.',
                'Ett citat är källans exakta ord inom citattecken. Ett referat är idén med dina egna ord. Båda behöver '
                'en hänvisning, annars är det plagiat.',
                'Nominalisering gör verb till substantiv: decide blir decision, fail blir failure. Det ger täta och '
                'sakliga meningar, men för många blir tunga.',
                'Opersonliga formuleringar som It can be argued that och The results suggest gör texten saklig utan I.',
                'En participfras först i meningen syftar på subjektet: Having read the report, the committee changed '
                'its mind.'],
         exempel=[('Gör om till en akademisk mening: People started using phones more, so they read fewer newspapers.',
                   'Till exempel: The increase in phone use led to a decline in newspaper reading. Verben blir '
                   'substantiv, increase och decline, och led to visar orsaken.')],
         ord=[('reporting verb', 'referatverb, som argue, claim och suggest'),
              ('paraphrase', 'referat: källans idé med egna ord'),
              ('quotation', 'citat: källans exakta ord'),
              ('plagiarism', 'plagiat: att ge ut någon annans text eller idé som sin egen'),
              ('et al.', 'och andra, när en källa har flera författare'),
              ('nominalisation', 'att göra ett verb eller adjektiv till ett substantiv')],
         tips='Läs din participfras och fråga: vem gör det här? Svaret ska vara meningens subjekt.'),

    blad(EN, 'gy3', 'Granska argument',
         mal=['Känna igen vanliga argumentationsfel och kunna deras engelska namn.',
              'Skilja mellan samband och orsak, och mellan en anekdot och belägg.',
              'Granska en debattext: tes, belägg, medgivanden och svagheter i resonemanget.'],
         fakta=['Ad hominem angriper personen. Straw man förvränger motståndarens åsikt. False dilemma låtsas att det '
                'bara finns två val.',
                'Slippery slope påstår att ett litet steg leder till en kedja av katastrofer. Hasty generalisation '
                'drar en stor slutsats ur få fall.',
                'Att två saker hänger ihop betyder inte att den ena orsakar den andra. Leta efter en tredje förklaring.',
                'En anekdot fångar intresset men bevisar lite. Starka belägg är undersökningar som är tillräckligt '
                'stora och har granskats.',
                'Ett medgivande, To be fair …, gör en text trovärdigare. Ett argument med fel kan ändå ha en sann '
                'slutsats.'],
         exempel=[('Vilket fel? Everyone I know loves the new timetable, so all pupils must love it.',
                   'Hasty generalisation. Skribentens vänner är för få och inget representativt urval av alla elever.')],
         ord=[('fallacy', 'argumentationsfel'),
              ('correlation', 'samband'),
              ('causation', 'orsakssamband'),
              ('anecdote', 'kort berättelse om ett enskilt fall'),
              ('concession', 'medgivande'),
              ('claim', 'påstående')],
         tips='Fråga vid varje påstående: hur vet skribenten det? Är svaret en enda historia eller ett starkt ord som '
              'clearly, granska extra noga.'),
]
