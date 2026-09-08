# -*- coding: utf-8 -*-
"""Bygger nextrum-maskot-svar.js ur faq.html och en/faq.html.

   Kör om den när FAQ:n ändras:

       python3 verktyg/bygg-maskotsvar.py

   Maskoten svarar med Nextrums egen text, ordagrant. Den formulerar
   ingenting själv och kan därför inte hitta på ett pris eller ett
   villkor — vilket är hela poängen med att inte ha en språkmodell
   bakom en publik chatt.
"""
import io, re, html, json, os, sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def plocka(p):
    """Q&A-paren ur en FAQ-sida, grupperade under sin rubrik."""
    s = io.open(os.path.join(ROT, p), encoding='utf-8').read()
    ut = []
    for grupp in re.split(r'<h2 class="d3"[^>]*>', s)[1:]:
        rub = html.unescape(re.sub(r'<[^>]+>', '', grupp.split('</h2>')[0])).strip()
        for m in re.finditer(r'<button class="faq-q"[^>]*>(.*?)<span class="pm">.*?'
                             r'<div class="faq-a">(.*?)</div>', grupp, re.S):
            f = html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
            sv = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', m.group(2)))).strip()
            ut.append({"g": rub, "f": f, "s": sv})
    return ut


# Vägarna är det maskoten LOTSAR till. En fråga kan besvaras med text
# ur FAQ:n, men den som vill anmäla sig ska få en knapp, inte ett svar.
VAGAR = {
 'sv': [
  {"n": "anmalan",
   "o": ["intresseanmälan", "anmäla", "anmälan", "komma igång", "börja", "hjälp med läxor",
         "läxhjälp", "boka", "skaffa", "ansöka om hjälp", "elev", "barn"],
   "t": "Skicka en intresseanmälan", "h": "intresseanmalan.html",
   "b": "Två minuter. Kostar ingenting och binder er inte vid något."},
  {"n": "jobb",
   "o": ["jobba", "jobb", "bli studiehjälpare", "studiehjälpare", "anställning", "söka jobb",
         "ansökan", "extrajobb", "tjäna"],
   "t": "Bli studiehjälpare", "h": "bli-studiehjalpare.html",
   "b": "Ansökan tar några minuter. Du behöver inget CV."},
  {"n": "pris",
   "o": ["pris", "kostar", "kostnad", "betala", "avgift", "timpris", "dyrt", "billigt", "faktura"],
   "t": "Se priser", "h": "priser.html",
   "b": "Ett timpris oavsett ämne. Inga dolda avgifter."},
  {"n": "kontakt",
   "o": ["kontakt", "kontakta", "mejl", "mejla", "ringa", "prata", "fråga er", "nå er", "support"],
   "t": "Kontakta oss", "h": "faq.html#kontakt",
   "b": "Skriv till oss så svarar vi på mejlen du anger."},
  {"n": "logga",
   "o": ["logga in", "inloggning", "mitt konto", "studievy", "studiehjälparvy", "konto"],
   "t": "Logga in", "h": "foralder.html",
   "b": "Studievyn för elever och föräldrar, studiehjälparvyn för dig som hjälper."},
  {"n": "integritet",
   "o": ["gdpr", "personuppgifter", "integritet", "cookies", "lagring", "villkor", "uppgifter"],
   "t": "Integritetspolicy", "h": "integritetspolicy.html",
   "b": "Vad vi sparar, varför, och hur länge."},
 ],
 'en': [
  {"n": "anmalan",
   "o": ["get started", "enquiry", "sign up", "apply for help", "tutoring", "homework help",
         "book", "student", "child", "begin"],
   "t": "Send an enquiry", "h": "intresseanmalan.html",
   "b": "Two minutes. It is free and commits you to nothing."},
  {"n": "jobb",
   "o": ["job", "work", "become a tutor", "tutor", "apply", "application", "part time", "earn"],
   "t": "Become a tutor", "h": "bli-studiehjalpare.html",
   "b": "The application takes a few minutes. No CV needed."},
  {"n": "pris",
   "o": ["price", "cost", "pay", "fee", "hourly", "expensive", "cheap", "invoice"],
   "t": "See pricing", "h": "priser.html",
   "b": "One hourly price whatever the subject. No hidden fees."},
  {"n": "kontakt",
   "o": ["contact", "email", "reach you", "get in touch", "support", "ask you"],
   "t": "Contact us", "h": "faq.html#kontakt",
   "b": "Write to us and we reply to the address you give."},
  {"n": "logga",
   "o": ["log in", "login", "my account", "student view", "tutor view", "account"],
   "t": "Log in", "h": "foralder.html",
   "b": "The student view for families, the tutor view if you teach."},
  {"n": "integritet",
   "o": ["gdpr", "personal data", "privacy", "cookies", "storage", "terms"],
   "t": "Privacy policy", "h": "integritetspolicy.html",
   "b": "What we store, why, and for how long."},
 ]}

# Ord som finns i nästan varje fråga skiljer dem inte åt — de skapar
# bara brus i poängsättningen och lyfter fel svar till toppen.
STOPP = {
 'sv': ("och att det en ett som är för på med av vi ni du jag den de har kan om inte men eller "
        "till i så vad hur när var vem vilka man sig kunna ska skulle vara finns går gör här där "
        "mycket").split(),
 'en': ("and that a an the is are for on with of we you i it as to in so what how when where who "
        "which can could will would be have has do does there here much your our").split(),
}


def plocka_lead(p, rubrik):
    """De tre svaren bredvid intresseanmälan. De står inte i FAQ:n men
       är precis de frågor folk ställer innan de vågar skicka in —
       "hur snabbt hör ni av er" föll tidigare tillbaka på
       kontaktformuläret fastän svaret fanns skrivet."""
    s = io.open(os.path.join(ROT, p), encoding='utf-8').read()
    blad = re.search(r'<div class="nx-lead-svar"[^>]*>(.*?)\n        </div>', s, re.S)
    if not blad:
        return []
    ut = []
    for m in re.finditer(r'<b>(.*?)</b>\s*<p>(.*?)</p>', blad.group(1), re.S):
        f = html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
        sv = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', m.group(2)))).strip()
        ut.append({"g": rubrik, "f": f, "s": sv})
    return ut


def bygg():
    data = {}
    LEAD = {'sv': ('intresseanmalan.html', 'Innan ni skickar in'),
            'en': ('en/intresseanmalan.html', 'Before you send')}
    for kod, faqfil in (('sv', 'faq.html'), ('en', 'en/faq.html')):
        faq = plocka(faqfil) + plocka_lead(*LEAD[kod])
        if len(faq) < 5:
            sys.exit('Bara %d frågor ur %s — har markupen ändrats?' % (len(faq), faqfil))
        data[kod] = {"faq": faq, "vagar": VAGAR[kod], "stopp": STOPP[kod]}

    js = ("/* GENERERAD FIL — ändra inte för hand.\n"
          "   Byggd ur faq.html och en/faq.html. Maskoten svarar med\n"
          "   Nextrums egen text, ordagrant, i stället för att formulera\n"
          "   något eget. Ändras FAQ:n ska den här byggas om.\n"
          "   Se verktyg/bygg-maskotsvar.py */\n"
          "window.NEXTRUM_MASKOT = "
          + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ";\n")
    ut = os.path.join(ROT, 'nextrum-maskot-svar.js')
    io.open(ut, 'w', encoding='utf-8').write(js)
    print('nextrum-maskot-svar.js  %.1f kB  (%d + %d frågor)'
          % (len(js) / 1024, len(data['sv']['faq']), len(data['en']['faq'])))


if __name__ == '__main__':
    bygg()
