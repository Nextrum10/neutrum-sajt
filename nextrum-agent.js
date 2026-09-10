/* ============================================================
   NEXTRUM — agenterna i gränssnittet

   Talar med edge-funktionerna juridik och ekonomi, och ritar upp det
   de svarar. Delad mellan de två panelerna i adminvyn eftersom de gör
   exakt samma sak med olika frågor.

   DEN REGEL SOM STYR HELA FILEN

   Agenten svarar med två listor: kallor (adresser den faktiskt
   hämtade och läste) och pahittade_adresser (adresser den skrev i sin
   text men aldrig öppnade). Den skillnaden görs på servern, i
   _delad/agent.ts, och den är hela poängen med bygget.

   Här nere får den en synlig följd: BARA adresser ur kallor blir
   klickbara. En påhittad adress ritas som överstruken text i en
   varningsruta.

   Det vore enkelt att linkifiera allt som ser ut som en adress med en
   regex, och det vore fel. En blå, understruken länk läser som en
   kontrollerad källa. Att göra en adress som modellen hittat på till
   en länk är att bygga in precis det fel som resten av systemet är
   byggt för att fånga.
   ============================================================ */

const NXAgent = (function () {
  'use strict';

  const { $, esc } = NX;

  /* Rubrikrader agenten själv sätter. Systemprompten ber om dem, så
     listan här måste följa med om prompten ändras. */
  const RUBRIKER = [
    'vad detta betyder för nextrum',
    'detta måste en jurist titta på',
    'detta ska en redovisningskonsult titta på',
    'källor',
  ];

  function ärRubrik(rad) {
    const r = rad.trim();
    if (!r || r.length > 70) return false;
    if (RUBRIKER.indexOf(r.toLowerCase().replace(/[:.]$/, '')) !== -1) return true;
    /* Versalrad, t.ex. "KÄLLOR". Kräver minst en bokstav, annars
       räknas en rad med bara siffror och paragraftecken som rubrik. */
    return /[A-ZÅÄÖ]/.test(r) && r === r.toUpperCase() && r.length > 2;
  }

  /* ---------- adresser till länkar, men bara de äkta ----------
     Texten escapas FÖRST, sedan byts de kontrollerade adresserna mot
     ankare. Ordningen spelar roll: escapar man efteråt förstörs
     taggarna man just skapat, och escapar man inte alls kan ett svar
     som råkar innehålla ett mindre-än-tecken bryta sidan. */
  function länka(text, kallor) {
    const ut = esc(text);
    const lista = (kallor || []).filter(Boolean);
    if (!lista.length) return ut;

    /* ETT enda svep, inte en ersättning per adress.
       Adress för adress i en slinga går sönder när den ena är början
       på den andra: efter att den långa bytts mot ett ankare ligger
       den korta kvar inuti href-attributet, och nästa varv byter den
       också. Resultatet blir länkar inuti länkar och trasig html.

       Längsta först i alternationen, så att regexmotorn väljer hela
       adressen och inte prefixet. Ersättningen är en funktion, vilket
       gör $& och andra dollarmönster i en adress ofarliga.

       Texten är redan escapad, så träffen är säker både i attributet
       och i länktexten. */
    const monster = lista
      .slice()
      .sort((a, b) => b.length - a.length)
      .map(u => esc(u).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    return ut.replace(new RegExp('(?:' + monster + ')', 'g'), träff =>
      '<a href="' + träff + '" target="_blank" rel="noopener noreferrer">' + träff + '</a>'
    );
  }

  /* ---------- svarstexten till html ----------
     Agenten skriver vanlig text, inte markdown. Fyra sorters rader:
     rubrik, punkt, citat och brödtext. Källdelen klipps bort här och
     ritas för sig, med kontrollen ovan. */
  function formatera(text, kallor) {
    const rader = String(text || '').split('\n');
    const ut = [];
    let iLista = false;
    let iKallor = false;

    function stängLista() { if (iLista) { ut.push('</ul>'); iLista = false; } }

    rader.forEach(function (rad) {
      const r = rad.trim();

      /* Allt efter KÄLLOR-rubriken hör till källistan och ritas av
         ritaKallor i stället. */
      if (/^källor:?$/i.test(r)) { iKallor = true; return; }
      if (iKallor) return;

      if (!r) { stängLista(); return; }

      if (ärRubrik(r)) {
        stängLista();
        ut.push('<h4>' + esc(r.replace(/:$/, '')) + '</h4>');
        return;
      }

      if (/^[·•\-*]\s+/.test(r)) {
        if (!iLista) { ut.push('<ul>'); iLista = true; }
        ut.push('<li>' + länka(r.replace(/^[·•\-*]\s+/, ''), kallor) + '</li>');
        return;
      }

      /* Ordagrant citat ur lagtexten: hela raden ligger inom
         citattecken. Det är så systemprompten ber den citera. */
      if (/^[”"„][\s\S]*[”"]$/.test(r) && r.length > 30) {
        stängLista();
        ut.push('<blockquote>' + länka(r.replace(/^[”"„]|[”"]$/g, ''), kallor) + '</blockquote>');
        return;
      }

      stängLista();
      ut.push('<p>' + länka(r, kallor) + '</p>');
    });

    stängLista();
    return ut.join('');
  }

  function ritaKallor(kallor, pahittade) {
    const bitar = [];

    if (kallor && kallor.length) {
      bitar.push('<div class="ag-kallor"><h5>Källor agenten läste (' + kallor.length + ')</h5>');
      kallor.forEach(function (u) {
        const e = esc(u);
        bitar.push('<a href="' + e + '" target="_blank" rel="noopener noreferrer">' + e + '</a>');
      });
      bitar.push('</div>');
    }

    if (pahittade && pahittade.length) {
      bitar.push('<div class="ag-pahittad"><b>Adresser agenten skrev men aldrig öppnade '
        + '(' + pahittade.length + ') — inte klickbara</b>');
      pahittade.forEach(function (u) { bitar.push('<span>' + esc(u) + '</span>'); });
      bitar.push('</div>');
    }

    return bitar.join('');
  }

  /* ---------- vägran ----------
     Tre lägen, och de betyder olika saker. Utanför området är
     normalt. Kastat svar betyder att modellen försökte svara utan
     källa och stoppades, och det ska läsas som en varning. */
  function ritaVagran(data, agent) {
    if (data.utanfor_omrade) {
      return '<div class="ag-vagran"><h4>Frågan ligger utanför agentens område</h4>'
        + '<p>' + esc(data.anledning || '') + '</p>'
        + '<p>Agenten svarar bara inom de områden den kan belägga. Det är avsiktligt: '
        + 'en assistent som kan allt kan inget ordentligt.</p>'
        + (data.omraden ? '<pre>' + esc(data.omraden) + '</pre>' : '')
        + '</div>';
    }

    const kastat = /kunde inte bel/i.test(data.error || '');
    return '<div class="ag-vagran' + (kastat ? ' allvar' : '') + '">'
      + '<h4>' + (kastat ? 'Svaret kastades' : 'Agenten kom inte fram') + '</h4>'
      + '<p>' + esc(data.error || 'Okänt fel.') + '</p>'
      + (kastat
          ? '<p>Det här är spärren som fungerar. Agenten formulerade ett svar men kunde inte '
            + 'peka på en källa den läst, och då lämnas det inte ut. Pröva en mer preciserad fråga.</p>'
          : '')
      + ritaKallor(null, data.pahittade_adresser)
      + '</div>';
  }

  /* ---------- ställ en fråga ----------
     Ett anrop kan ta över en minut: agenten söker, hämtar dokument
     och läser dem innan den svarar. Rutan säger det rakt ut och
     räknar sekunder, annars ser sidan hängd ut. */
  async function stall(opts) {
    const agent = opts.agent;
    const fraga = String(opts.fraga || '').trim();
    const ut = opts.ut;
    const knapp = opts.knapp;

    if (!fraga) return;
    if (!supa) { ut.innerHTML = '<div class="ag-vagran"><h4>Ingen databaskoppling</h4>'
      + '<p>Nycklarna i nextrum-config.js är inte ifyllda.</p></div>'; return; }

    const start = Date.now();
    ut.innerHTML = '<div class="ag-arbetar"><span class="ag-snurra"></span>'
      + '<span>Agenten söker och läser källor. Det tar normalt 30 till 90 sekunder. '
      + '<b id="ag-klocka">0 s</b></span></div>';

    const klocka = setInterval(function () {
      const el = $('#ag-klocka');
      if (el) el.textContent = Math.round((Date.now() - start) / 1000) + ' s';
    }, 1000);

    if (knapp) { knapp.disabled = true; knapp.setAttribute('aria-busy', 'true'); }

    try {
      const { data, error } = await supa.functions.invoke(agent, { body: { fraga } });

      /* invoke ger error på allt som inte är 2xx, men funktionen
         lägger sin förklaring i svarskroppen. Utan det här steget
         blir varje vägran "Edge Function returned a non-2xx status
         code", vilket inte hjälper någon. */
      let svar = data;
      if (error && error.context && typeof error.context.json === 'function') {
        try { svar = await error.context.json(); } catch (e) { /* behåll error */ }
      }
      if (!svar) throw error || new Error('Tomt svar från agenten.');

      const sek = Math.round((Date.now() - start) / 1000);

      if (svar.utanfor_omrade || svar.error) {
        ut.innerHTML = ritaVagran(svar, agent);
        return svar;
      }

      let html = '<div class="ag-svar">' + formatera(svar.svar, svar.kallor)
        + ritaKallor(svar.kallor, svar.pahittade_adresser);

      /* Ekonomiagenten får svara helt ur er egen databas. Uttalar den
         sig om en REGEL utan hämtad källa är det däremot samma fara
         som på juridiksidan, och det ska stå i klartext. */
      if (svar.utan_hamtad_regel) {
        html += '<div class="ag-pahittad"><b>Inget hämtat regelverk</b>'
          + '<span style="text-decoration:none">Svaret vilar bara på era egna siffror. '
          + 'Handlar frågan om moms, deklaration eller avdrag ska det läsas med misstro.</span></div>';
      }

      html += '<p class="xsmall" style="margin-top:20px;color:var(--bl-3)">'
        + esc(svar.pafyllnad || '') + ' · ' + svar.steg + ' steg · ' + sek + ' sekunder</p>'
        + '</div>';

      ut.innerHTML = html;
      return svar;
    } catch (fel) {
      ut.innerHTML = '<div class="ag-vagran allvar"><h4>Anropet gick inte fram</h4>'
        + '<p>' + esc(NX.felText(fel)) + '</p>'
        + '<p>Är funktionen deployad och är du inloggad som admin? Ett timeout betyder '
        + 'oftast att frågan var för bred.</p></div>';
    } finally {
      clearInterval(klocka);
      if (knapp) { knapp.disabled = false; knapp.removeAttribute('aria-busy'); }
    }
  }

  /* ---------- tidigare körningar ----------
     Loggen är hela anledningen till att agenterna skriver ner varje
     verktygsanrop. Utan ett ställe att läsa den på är den bortkastad. */
  async function laddaKorningar(agent, ut, antal) {
    if (!supa) return;
    ut.innerHTML = '<div class="loading">Hämtar</div>';

    const { data, error } = await supa
      .from('agent_korningar')
      .select('id, fraga, svar, status, anledning, kallor, steg_antal, in_tokens, ut_tokens, skapad')
      .eq('agent', agent)
      .order('skapad', { ascending: false })
      .limit(antal || 20);

    if (error) { ut.innerHTML = '<p class="xsmall">Kunde inte hämta loggen: ' + esc(error.message) + '</p>'; return; }
    if (!data || !data.length) {
      ut.innerHTML = '<p class="xsmall" style="color:var(--bl-3)">Inga körningar än.</p>';
      return;
    }

    ut.innerHTML = data.map(function (k) {
      const d = new Date(k.skapad);
      const nar = d.toLocaleDateString('sv-SE') + ' ' + d.toTimeString().slice(0, 5);
      return '<details class="ag-korning" data-korning="' + esc(k.id) + '">'
        + '<summary>'
        + '<span class="ag-status" data-s="' + esc(k.status) + '">' + esc(k.status.replace(/_/g, ' ')) + '</span>'
        + '<span class="ag-korning-fraga">' + esc(k.fraga) + '</span>'
        + '<span class="ag-korning-nar">' + nar + '</span>'
        + '</summary>'
        + '<div class="ag-korning-kropp"><div class="loading">Hämtar stegen</div></div>'
        + '</details>';
    }).join('');

    /* Stegen hämtas först när någon fäller ut raden. Tjugo körningar
       gånger sex steg är hundratjugo rader ingen bett om att se. */
    ut.querySelectorAll('.ag-korning').forEach(function (d) {
      d.addEventListener('toggle', async function () {
        if (!d.open || d.dataset.laddad) return;
        d.dataset.laddad = '1';
        const kropp = d.querySelector('.ag-korning-kropp');
        const rad = data.find(function (x) { return x.id === d.dataset.korning; });

        const { data: steg } = await supa
          .from('agent_steg')
          .select('steg, verktyg, argument, kalla, resultat_kort, fel')
          .eq('korning_id', d.dataset.korning)
          .order('steg');

        const bitar = [];

        if (rad && rad.svar) {
          bitar.push('<div class="ag-svar" style="border-top:0;padding-top:16px">'
            + formatera(rad.svar, rad.kallor) + ritaKallor(rad.kallor, null) + '</div>');
        } else if (rad && rad.anledning) {
          bitar.push('<p class="xsmall" style="margin-top:16px;color:var(--bl-2)">'
            + esc(rad.anledning) + '</p>');
        }

        if (steg && steg.length) {
          bitar.push('<ul class="ag-steg">');
          steg.forEach(function (s) {
            const arg = s.argument && s.argument.varfor ? s.argument.varfor
                      : s.argument && s.argument.fraga ? s.argument.fraga
                      : s.argument && s.argument.vag ? s.argument.vag : '';
            bitar.push('<li><code>' + esc(s.verktyg) + '</code> '
              + (arg ? esc(arg) : '')
              + (s.kalla ? '<br><span style="color:var(--bl-3);font-size:11px">' + esc(s.kalla) + '</span>' : '')
              + (s.fel ? '<br><span class="ag-steg-fel">' + esc(s.fel) + '</span>' : '')
              + '</li>');
          });
          bitar.push('</ul>');
        }

        if (rad) {
          bitar.push('<p class="xsmall" style="margin-top:14px;color:var(--bl-3)">'
            + (rad.steg_antal || 0) + ' steg · '
            + ((rad.in_tokens || 0) + (rad.ut_tokens || 0)).toLocaleString('sv-SE') + ' tokens</p>');
        }

        kropp.innerHTML = bitar.join('') || '<p class="xsmall">Inga steg loggade.</p>';
      });
    });
  }

  return { stall, laddaKorningar, formatera, ritaKallor };
})();
