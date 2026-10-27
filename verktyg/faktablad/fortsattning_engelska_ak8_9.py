# -*- coding: utf-8 -*-
"""Faktabladen till fortsättningen i engelska för åk 8 och 9 (2026-10-27),
ett per område i verktyg/uppgiftsbanken/fortsattning_engelska_ak8_9.py.
Skrivna efter vad nivåerna övar, med exempel som inte är någon av frågorna.

Skrivna med AI och inte lästa av en lärare."""
from fakta import blad

FAKTABLAD = [
    blad('Engelska', 'ak8', 'Gerund och infinitiv',
         mal=['Välja mellan -ing och to efter verb som enjoy, finish, want och decide.',
              'Använda -ing efter en preposition, som good at och afraid of.',
              'Förstå skillnaden mellan stop doing och stop to do, och mellan remember doing och '
              'remember to do.',
              'Använda -ing när ett verb är subjekt först i meningen.'],
         fakta=['Efter enjoy, finish, mind och avoid står nästa verb med -ing: I enjoy reading.',
                'Efter want, decide, hope, plan och promise står to och grundformen: We plan to leave '
                'early.',
                'Efter en preposition (at, in, of, for, about) står verbet alltid med -ing: She is good '
                'at drawing.',
                'Stop doing är att sluta göra något, stop to do att stanna för att göra något. Remember '
                'to do är att komma ihåg att göra något, remember doing att minnas något du har gjort.',
                'Ett verb som är subjekt först i meningen får oftast -ing: Reading is fun.'],
         exempel=[('Vilket är rätt: "I hope seeing you soon" eller "I hope to see you soon"?',
                   'Efter hope står to och grundformen, så det blir I hope to see you soon.'),
                  ('Vad betyder "We stopped to buy ice cream"?',
                   'Stop + to är att stanna för att göra något: vi stannade för att köpa glass.')],
         ord=[('gerund', 'verbets -ing-form när den används som ett substantiv: swimming, reading'),
              ('infinitiv', 'verbets grundform, ofta med to: to swim, to read'),
              ('preposition', 'ett litet ord som at, in, of och for'),
              ('grundform', 'verbet utan ändelse, som det står i ordboken: go, play')],
         tips='Står det en preposition före verbet på engelska, som good at eller tired of, blir '
              'verbet alltid -ing, aldrig to: good at drawing, tired of waiting.'),

    blad('Engelska', 'ak8', 'Frågetaggar',
         mal=['Bygga en frågesvans, som isn’t it och don’t you, av hjälpverbet i meningen.',
              'Veta när svansen ska vara jakande och när den ska vara nekande.',
              'Klara de knepiga svansarna: aren’t I, shall we, will you, there is och nobody.'],
         fakta=['En frågesvans är som eller hur på svenska: It’s late, isn’t it?',
                'Svansen tar hjälpverbet ur meningen (is, can, will, have). Har meningen inget hjälpverb '
                'används do, does eller did.',
                'En jakande mening får en nekande svans, och en nekande mening får en jakande: She’s '
                'ready, isn’t she? She isn’t ready, is she?',
                'Svansen har ett pronomen, aldrig ett namn: Omar can drive, can’t he?',
                'Ord som never, nobody och nothing gör meningen nekande, så svansen blir jakande: '
                'Nothing happened, did it?'],
         exempel=[('Vilken svans passar? "He bought a new bike, ___?"',
                   'Bought är dåtid utan hjälpverb, så svansen får did. Meningen är jakande, så svansen '
                   'blir nekande: didn’t he?')],
         ord=[('question tag', 'frågesvans, som eller hur på svenska'),
              ('hjälpverb', 'verb som is, are, can, will, have och do, som hjälper huvudverbet'),
              ('jakande', 'utan not: She is here.'),
              ('nekande', 'med not eller ett ord som never: She isn’t here.')],
         tips='Efter I am blir svansen aren’t I, och efter let’s blir den shall we. De två får du bara '
              'lära dig.'),

    blad('Engelska', 'ak8', 'Formella och informella mejl',
         mal=['Börja och avsluta ett mejl till en kompis och till någon du inte känner.',
              'Byta ut vardagliga fraser mot artigare och mer formella.',
              'Känna igen om en text är formell eller informell, och förklara varför.'],
         fakta=['Formellt: Dear Sir or Madam (du vet inte namnet) eller Dear Ms Berg (du vet namnet). '
                'Informellt: Hi Sam eller Hello!',
                'I brittisk engelska avslutar du Dear Sir or Madam med Yours faithfully och Dear Ms Berg '
                'med Yours sincerely. Kind regards och Best wishes är vänliga men artiga.',
                'Börja ett formellt mejl med varför du skriver: I am writing to ask about … Avsluta med '
                'I look forward to hearing from you.',
                'I ett formellt mejl skriver du ut orden (I am, do not) och ber artigt: Could you please '
                '…? I would be grateful if …',
                'Ett informellt mejl får ha kortformer, utrop och vardagliga ord: Guess what? Thanks a '
                'lot! Write back soon!'],
         exempel=[('Gör meningen mer formell: "Can you send me the prices?"',
                   'Could you please send me the prices? Eller: I would be grateful if you could send '
                   'me the prices.')],
         ord=[('formal', 'formell, som till ett företag, en skola eller någon du inte känner'),
              ('informal', 'vardaglig, som till en kompis'),
              ('subject line', 'ämnesraden, som säger kort vad mejlet handlar om'),
              ('on behalf of', 'för någon annans räkning: on behalf of my class')],
         tips='Fråga dig vem som ska läsa. Känner du inte personen, skriv som du skulle prata med en '
              'rektor, inte som med en kompis.'),

    blad('Engelska', 'ak9', 'Ordbildning',
         mal=['Bilda motsatser med un-, in-, im-, il-, ir- och dis-.',
              'Förstå vad re- och mis- gör med ett ord.',
              'Göra om ett ord till substantiv, adjektiv eller adverb med -ness, -ment, -tion, -ful, '
              '-less, -ous och -ly.'],
         fakta=['Un-, in- och dis- ger motsatsen: unkind, invisible, disobey. Före p, b och m blir in- '
                'oftast im-, före l il- och före r ir-: impolite, illogical, irrelevant.',
                'Re- betyder igen (reread, replay), och mis- betyder fel (misspell, misread).',
                'Substantiv bildas ofta med -ness (darkness), -ment (agreement) och -tion eller -sion '
                '(information, discussion).',
                'Adjektiv bildas med -ful (full av), -less (utan) och -ous: hopeful, hopeless, famous.',
                'Adverb bildas oftast med -ly: quick – quickly. Men lovely och lonely är adjektiv.'],
         exempel=[('Vilket ord passar? "She spoke ___ (polite) to the old man."',
                   'Ordet säger hur hon talade, så det behövs ett adverb: politely.')],
         ord=[('prefix', 'förstavelse, som un- och re-'),
              ('suffix', 'ändelse, som -ness och -ful'),
              ('ordklass', 'om ordet är ett substantiv, adjektiv, verb eller adverb'),
              ('word family', 'ord som hör ihop: act, action, active, actively')],
         tips='Ser du ett okänt ord, leta efter ett ord du känner inuti det: unbelievable är un + '
              'believe + able, alltså otrolig.'),

    blad('Engelska', 'ak9', 'Modala verb i perfekt',
         mal=['Bygga should have, could have, would have, must have, might have och can’t have med '
              'particip.',
              'Tala om sådant som borde ha hänt eller kunde ha hänt, men inte gjorde det.',
              'Dra slutsatser om vad som har hänt: nästan säkert, kanske eller omöjligt.'],
         fakta=['Formen är modalt verb + have + particip: should have gone, could have won, must have '
                'seen.',
                'Should have = borde ha, om något du ångrar eller kritiserar. Could have = kunde ha, det '
                'var möjligt men hände inte. Would have = skulle ha.',
                'Must have = nästan säkert. Might have, may have eller could have = kanske. Can’t have = '
                'omöjligt.',
                'I tal låter should’ve som "should of", men det skrivs should have eller should’ve.'],
         exempel=[('Hennes skor är blöta. Passar "She must have walked in the rain" eller "She can’t '
                   'have walked in the rain"?',
                   'Blöta skor tyder starkt på regn, så du är nästan säker: She must have walked in the '
                   'rain.')],
         ord=[('particip', 'verbets tredje form: go – went – gone, see – saw – seen'),
              ('modalt verb', 'hjälpverb som can, could, must, might, should och would'),
              ('slutsats', 'det du tror har hänt utifrån det du ser'),
              ('should’ve', 'kortform av should have')],
         tips='Fråga dig hur säker du är. Nästan säker: must have. Kanske: might have. Omöjligt: can’t '
              'have.'),

    blad('Engelska', 'ak9', 'Engelska i världen',
         mal=['Känna igen vanliga skillnader mellan brittisk och amerikansk engelska, i ord och i '
              'stavning.',
              'Läsa ett datum skrivet på brittiskt och på amerikanskt sätt.',
              'Förklara varför engelska talas på så många platser och i så många varianter.'],
         fakta=['Samma sak kan heta olika: biscuit – cookie, queue – line, petrol – gas. Båda är rätt, '
                'och de flesta förstår båda.',
                'Brittisk stavning har ofta -our och -re där amerikansk har -or och -er: colour – color, '
                'theatre – theater.',
                'I Storbritannien kommer dagen före månaden (3/5 är 3 May), i USA månaden före dagen '
                '(3/5 är March 5).',
                'Engelskan spreds med det brittiska imperiet från 1600-talet, och senare med USA:s '
                'filmer, musik och internet.',
                'I dag används engelska ofta som lingua franca, ett gemensamt språk för människor med '
                'olika förstaspråk.'],
         exempel=[('Hur stavar en amerikan theatre och centre?',
                   'Med -er: theater och center. Brittisk -re blir ofta -er i amerikansk engelska.')],
         ord=[('British English', 'brittisk engelska'),
              ('American English', 'amerikansk engelska'),
              ('variety', 'en variant av ett språk, som australisk engelska'),
              ('official language', 'officiellt språk, som används i lagar, domstolar och skolor'),
              ('lingua franca', 'ett gemensamt språk för människor med olika förstaspråk')],
         tips='Välj brittisk eller amerikansk stavning och håll dig till den i hela texten. Båda är '
              'rätt, men en blandning ser slarvig ut.'),
]
