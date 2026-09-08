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
    """Alla fråga/svar-par på en sida, oavsett vilken rubrikklass som
       omger dem.

       Första versionen delade på <h2 class="d3"> och hittade därför
       bara FAQ-sidan. priser.html och bli-studiehjalpare.html
       använder d2, och deras tio frågor blev osynliga för maskoten
       fastän de stod skrivna. Nu letas paren upp där de står, och
       gruppen härleds ur närmaste rubrik före dem.
    """
    s = io.open(os.path.join(ROT, p), encoding='utf-8').read()
    rubriker = [(m.start(), html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip())
                for m in re.finditer(r'<h2[^>]*>(.*?)</h2>', s, re.S)]

    def grupp_för(pos):
        namn = ''
        for start, txt in rubriker:
            if start < pos and txt:
                namn = txt
            else:
                break
        return namn

    ut = []
    for m in re.finditer(r'<button class="faq-q"[^>]*>(.*?)<span class="pm">.*?'
                         r'<div class="faq-a">(.*?)</div>', s, re.S):
        f = html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
        sv = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', m.group(2)))).strip()
        if f and sv:
            ut.append({"g": grupp_för(m.start()), "f": f, "s": sv})
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
    # Alla sidor som har skrivna svar, inte bara FAQ:n.
    KÄLLOR = {'sv': ['faq.html', 'priser.html', 'bli-studiehjalpare.html'],
              'en': ['en/faq.html', 'en/priser.html', 'en/bli-studiehjalpare.html']}
    for kod in ('sv', 'en'):
        faq = []
        for fil in KÄLLOR[kod]:
            faq += plocka(fil)
        faq += plocka_lead(*LEAD[kod])
        # Samma fråga kan stå på två sidor - behall den forsta.
        sedda, unika = set(), []
        for x in faq:
            n = x['f'].lower()
            if n not in sedda:
                sedda.add(n); unika.append(x)
        faq = unika
        if len(faq) < 15:
            sys.exit('Bara %d frågor för %s — har markupen ändrats?' % (len(faq), kod))
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
