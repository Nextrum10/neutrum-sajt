/* ============================================================
   NEXTRUM — tjänstekatalogen i gränssnittet

   Läser tabellen `tjanster` (schema-v18.sql, utökad i Fas 5.1) och
   gör den tillgänglig för alla vyer. Laddas efter nextrum-app.js,
   före sidans egen kod.

   Det här är det ENDA stället i gränssnittet där läxhjälp står
   utskrivet som tjänst: i reservkatalogen och som sista utväg i
   standard()/standardJobb(). Allt annat frågar katalogen (Fas 5.4).

   DEN REGEL SOM STYR HELA FILEN

   `aktiv` avgör vad som SYNS. Ingenting annat.

   Tjänster som inte är lanserade ligger som aktiv = false, och
   databasen lämnar inte ens ut dem till webbläsaren. En väljare som
   visar dem hade varit ett löfte vi inte kan hålla, och en prissida
   som listar dem utan pris hade varit sämre än att inte nämna dem.

   Följden är att väljaren nedan RITAR INGEN VÄLJARE när det bara
   finns ett aktivt val — den skriver en rad som säger vad det gäller
   och lämnar ett dolt fält med värdet. Den dagen någon sätter ett
   pris på en ny tjänst och slår på den i adminvyn dyker valen upp av sig
   själva, i varje formulär, utan att en rad kod ändras.

   Det är hela poängen med att katalogen ligger i databasen och inte
   i markupen.
   ============================================================ */
const NXTjanster = (function () {
  'use strict';

  const { $, esc } = NX;

  /* Samma test som nextrum-app.js gör. Modulen kan inte använda
     NX.t(), för den ordlistan är sluten och det här är fyra strängar
     — men språkvalet måste göras på exakt samma villkor, annars kan
     en sida hamna i olika språk i olika moduler. */
  const EN = /^en/i.test(document.documentElement.getAttribute('lang') || 'sv');

  /* Etiketterna ligger HÄR och inte hos anroparen. /en/-generatorn
     maskerar <script>-block och översätter dem alltså inte (se
     project-nextrum-engelska, fälla 4), så en etikett skriven i
     sidans eget skript hade blivit svensk på den engelska sidan och
     ingen strukturkontroll hade sett det. Ligger den i modulen är
     sidornas skript dessutom teckenidentiska, vilket är vad
     verktyg/jamfor-sprak.py kontrollerar. */
  const ORD = {
    galler:      ['Gäller {t}.',                'Applies to {t}.'],
    etikettKund: ['Vad behöver ni hjälp med?',  'What do you need help with?'],
    etikettJobb: ['Vilka uppdrag vill du ta?',  'Which jobs do you want?'],
    timme:       ['/tim',                       '/hr']
  };
  function ord(nyckel, vars) {
    let ut = (ORD[nyckel] || [nyckel, nyckel])[EN ? 1 : 0];
    if (vars) for (const k in vars) ut = ut.replace('{' + k + '}', vars[k]);
    return ut;
  }

  /* Katalogen hämtas en gång per sidladdning. Den ändras ungefär
     aldrig, och fyra rader är inte värda ett anrop per formulär. */
  let cache = null;
  let pagar = null;

  async function ladda() {
    if (cache) return cache;
    if (pagar) return pagar;

    pagar = (async () => {
      /* Utan databas, eller om anropet fallerar: läxhjälp ensamt.
         Det är vad sajten erbjöd innan katalogen fanns, så en trasig
         hämtning gör formuläret till vad det var förut i stället för
         att göra det oanvändbart. */
      const reserv = [{
        kod: 'laxhjalp', namn: 'Läxhjälp', namn_en: 'Tutoring',
        kort: null, kort_en: null,
        for_kund: true, for_jobb: true, aktiv: true, ordning: 10,
        pris_per_timme_ore: null,
        extra_personer_ore: null, extra_personer_max: 1,
        bokningstyp: 'pass', rapportkrav: true,
        rut_berattigad: false, rut_procent: 0,
        kundtyp: 'privat', jobbtyp: 'studiehjalpare', min_alder: null
      }];

      if (typeof supa === 'undefined' || !supa) { cache = reserv; return cache; }

      const { data, error } = await supa
        .from('tjanster')
        /* Det gränssnittet behöver för att beskriva och boka en
           tjänst. Ersättningen, kraven och matchningsreglerna hör till
           admin och servern och hämtas inte här. */
        .select('kod, namn, namn_en, kort, kort_en, for_kund, for_jobb, aktiv, ordning, pris_per_timme_ore, extra_personer_ore, extra_personer_max, bokningstyp, rapportkrav, rut_berattigad, rut_procent, kundtyp, jobbtyp, min_alder')
        .order('ordning');

      cache = (error || !data || !data.length) ? reserv : data;
      return cache;
    })();

    return pagar;
  }

  /* Den laddade katalogen, synkront. Ger tom lista innan ladda()
     hunnit klart — anropa den först. */
  function alla() { return cache || []; }

  function forKund() { return alla().filter(t => t.aktiv && t.for_kund); }
  function forJobb() { return alla().filter(t => t.aktiv && t.for_jobb); }

  function hitta(kod) { return alla().find(t => t.kod === kod) || null; }

  /* Faller tillbaka på svenskan när den engelska saknas. Ett
     svenskt ord på en engelsk sida pekar ut vad som inte är ifyllt;
     ett tomt kort hade sett ut som en bugg i koden. */
  function namn(kod) {
    const t = hitta(kod);
    if (!t) return kod;
    return (EN && t.namn_en) || t.namn;
  }

  function kort(kod) {
    const t = hitta(kod);
    if (!t) return '';
    return ((EN && t.kort_en) || t.kort) || '';
  }

  /* Vad en bokning ska få när ingen valt något. Första aktiva
     kundtjänsten, annars läxhjälp — aldrig undefined, för kolumnen
     är not null. */
  function standard() {
    const f = forKund();
    return f.length ? f[0].kod : 'laxhjalp';
  }

  /* Samma sak för den som söker jobb: den första aktiva tjänsten man
     kan arbeta med. Skiljer sig från standard() den dag en tjänst
     bara finns på ena sidan (försäljning är for_jobb men inte for_kund). */
  function standardJobb() {
    const f = forJobb();
    return f.length ? f[0].kod : 'laxhjalp';
  }

  function kronor(ore) {
    if (ore === null || ore === undefined) return null;
    return Math.round(ore / 100).toLocaleString(EN ? 'en-GB' : 'sv-SE')
      + (EN ? ' SEK' : ' kr');
  }

  /* ------------------------------------------------------------
     VÄLJAREN

     o.host      elementet den ritas i
     o.falt      name-attributet på inmatningen
     o.typ       'kund' | 'jobb'
     o.flera     true = kryssrutor (en person kan ta flera uppdrag),
                 false = radioknappar (en bokning är en tjänst)
     o.valt      förvalt, eller lista vid flera
     o.etikett   rubriken över valen

     Returnerar { varde() } som ger koden respektive listan.
     ------------------------------------------------------------ */
  function valjare(o) {
    const host = o.host;
    if (!host) return { varde: () => (o.flera ? [] : standard()) };

    const lista = o.typ === 'jobb' ? forJobb() : forKund();
    const flera = !!o.flera;
    const falt = o.falt || 'tjanst';

    /* Ett val är inget val. Då blir det en upplysning plus ett dolt
       fält, så att den som skickar formuläret ändå skickar rätt kod
       och inserten inte behöver veta något om det här. */
    if (lista.length <= 1) {
      const kod = lista.length ? lista[0].kod : standard();
      host.innerHTML =
        '<input type="hidden" name="' + esc(falt) + '" value="' + esc(kod) + '">'
        + '<p class="xsmall" style="margin:0;color:var(--muted-2)">'
        + esc(ord('galler', { t: namn(kod).toLowerCase() })) + '</p>';
      return { varde: () => (flera ? [kod] : kod) };
    }

    const valt = flera
      ? (Array.isArray(o.valt) ? o.valt : [])
      : (o.valt || standard());

    const rader = lista.map(t => {
      const ikryssad = flera ? valt.indexOf(t.kod) !== -1 : t.kod === valt;
      const pris = kronor(t.pris_per_timme_ore);
      return '<label class="nx-tjval">'
        + '<input type="' + (flera ? 'checkbox' : 'radio') + '" name="' + esc(falt) + '"'
        + ' value="' + esc(t.kod) + '"' + (ikryssad ? ' checked' : '') + '>'
        + '<span>'
        + '<b>' + esc(namn(t.kod))
        + (pris ? ' <em>' + esc(pris + ord('timme')) + '</em>' : '') + '</b>'
        + (kort(t.kod) ? '<span>' + esc(kort(t.kod)) + '</span>' : '')
        + '</span></label>';
    }).join('');

    /* Etiketten kommer från modulen om anroparen inte satt en, just
       för att sidornas egna skript ska kunna vara identiska på båda
       språken. Sätt o.etikett bara när en sida behöver säga något
       annat än standardfrågan. */
    const etikett = o.etikett || ord(o.typ === 'jobb' ? 'etikettJobb' : 'etikettKund');

    host.innerHTML =
      (etikett ? '<span class="nx-tjval-et">' + esc(etikett) + '</span>' : '')
      + '<div class="nx-tjval-rad">' + rader + '</div>';

    return {
      varde: () => {
        const valda = Array.prototype.slice
          .call(host.querySelectorAll('input[name="' + falt + '"]:checked'))
          .map(i => i.value);
        return flera ? valda : (valda[0] || standard());
      }
    };
  }

  /* Ett litet märke att sätta på en bokningsrad när det finns mer än
     en tjänst. Med bara läxhjälp aktiv vore det brus på varje rad, så
     då ritas ingenting. */
  function marke(kod) {
    if (forKund().length <= 1) return '';
    return '<span class="nx-tjmarke">' + esc(namn(kod)) + '</span>';
  }

  return { ladda, alla, forKund, forJobb, hitta, namn, kort, standard, standardJobb, kronor, valjare, marke };
})();
