/* ============================================================
   NEXTRUM — agentfliken i adminvyn

   Laddas bara av admin.html, efter nextrum-agent.js och före
   nextrum-admin.js. Kräver NX, NXStudie, NXAgent och supa.

   Den här filen är allt som hör till sektionen Agenter och
   ingenting annat. Skälet att den inte ligger i nextrum-admin.js
   är att den inte delar något med resten av vyn: inga kartor,
   ingen S, inga tabeller. Den läser fyra egna bord och två edge-
   funktioner. Att lägga den i en fil på 3 000 rader hade gjort den
   svårare att hitta utan att göra något enklare.

   nextrum-admin.js ropar på start() när den vet att den inloggade
   är admin. Innan dess ska ingenting här ha hänt — sektionen finns
   i markupen även för den som inte får se den, och det är RLS som
   avgör vad som kommer tillbaka, inte att vi låtit bli att fråga.
   ============================================================ */
const NXAdminAgenter = (function () {
  'use strict';

  const { $, esc, säg, rensa, felText } = NX;
  const { medan } = NXStudie;

  /* ------------------------------------------------------------
     AGENTPANELERNA

     Två identiska paneler med olika agent bakom. Kopplas med samma
     funktion, för det ENDA som skiljer dem är namnet på funktionen
     som anropas.
     ------------------------------------------------------------ */
  function kopplaAgent(agent, prefix) {
    const ruta = $('#' + prefix + '-fraga');
    const ut = $('#' + prefix + '-ut');
    const knapp = $('#' + prefix + '-skicka');
    const logg = $('#' + prefix + '-logg');
    if (!ruta) return function () {};

    $('#' + prefix + '-exempel').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      ruta.value = b.textContent.trim();
      ruta.focus();
    });

    $('#' + prefix + '-rensa').addEventListener('click', () => {
      ruta.value = '';
      ut.innerHTML = '';
      ruta.focus();
    });

    async function skicka() {
      if (!ruta.value.trim()) { ruta.focus(); return; }
      await NXAgent.stall({ agent, fraga: ruta.value, ut, knapp });
      /* Loggen ritas om efteråt oavsett utfall. En kastad körning är
         också en körning och ska synas i historiken. */
      await NXAgent.laddaKorningar(agent, logg, 20);
      await ritaLäget();
    }

    knapp.addEventListener('click', skicka);

    /* Ctrl+Enter skickar. En textarea där Enter skickar går inte att
       skriva en flerradig fråga i. */
    ruta.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') skicka();
    });

    return () => NXAgent.laddaKorningar(agent, logg, 20);
  }

  /* ------------------------------------------------------------
     SJÄLVTESTET
     ------------------------------------------------------------ */
  function kopplaSjälvtest() {
    const knapp = $('#sjalvtest-knapp');
    if (!knapp) return;

    knapp.addEventListener('click', async e => {
      const ut = $('#sjalvtest-ut');
      await medan(e.target, 'Kör', async () => {
        ut.innerHTML = '<div class="loading">Kör</div>';
        const rader = [];

        for (const namn of ['juridik', 'ekonomi']) {
          try {
            const { data, error } = await supa.functions.invoke(namn, { body: { sjalvtest: true } });

            /* Samma räddning som nextrum-agent.js gör: invoke ger
               error på allt som inte är 2xx, men funktionen lägger
               sin förklaring i svarskroppen. Utan det här står det
               "non-2xx status code" i rutan, vilket är det enda
               självtestet aldrig får säga — det är ju till för att
               tala om VAD som saknas. */
            let svar = data;
            if (error && error.context && typeof error.context.json === 'function') {
              try { svar = await error.context.json(); } catch (e) { /* behåll felet */ }
            }
            if (svar && svar.error) throw new Error(svar.error);
            if (!svar) throw error || new Error('Tomt svar');
            rader.push('<b style="display:block;margin:14px 0 6px;font-size:12px">' + namn + '</b>');

            if (namn === 'juridik') {
              rader.push(prick(svar.hamtning_fungerar, 'Når rättskällorna'));
              /* Den här raden är viktigare än den ovanför. Den visar att
                 agenten INTE kan hämta vad som helst från nätet. */
              rader.push(prick(svar.domanspärr_stoppade_example_com, 'Domänspärren stoppar allt annat'));
              /* Vilken adress texten faktiskt kom ifrån. En källa kan
                 skicka vidare, och sedan Fas 8 följs hoppen för hand
                 med spärren prövad vid varje steg — då är det den
                 sista adressen som är källan. */
              if (svar.hamtad_adress) {
                rader.push('<span class="xsmall" style="display:block;margin:2px 0 0 22px;color:var(--bl-3)">'
                  + 'Hämtad från ' + esc(svar.hamtad_adress) + '</span>');
              }
            } else {
              rader.push(prick(svar.bolagsfakta_ifylld, 'Bolagsfakta ifylld'));
              rader.push(prick(svar.studiehjalpare_form !== 'oklart',
                'Studiehjälparnas form angiven (' + esc(svar.studiehjalpare_form || '?') + ')'));
              rader.push(prick(svar.fortnox === 'kopplat', 'Fortnox kopplat', true));
            }
          } catch (fel) {
            rader.push('<b style="display:block;margin:14px 0 6px;font-size:12px">' + namn + '</b>'
              + prick(false, esc(felText(fel))));
          }
        }
        ut.innerHTML = rader.join('');
      });
    });
  }

  /* valfri: en bock som inte är ett fel om den saknas, bara en upplysning */
  function prick(ok, text, valfri) {
    const färg = ok ? 'var(--mossa)' : (valfri ? 'var(--bl-3)' : 'var(--acc-lugn)');
    const tecken = ok ? '✓' : (valfri ? '–' : '✗');
    return '<div style="display:flex;gap:9px;align-items:baseline;font-size:12px;line-height:1.6;color:var(--bl-2);padding:3px 0">'
      + '<span style="color:' + färg + ';font-weight:600">' + tecken + '</span>'
      + '<span>' + text + '</span></div>';
  }

  /* ------------------------------------------------------------
     BOLAGSFAKTA
     ------------------------------------------------------------ */
  async function laddaBolagsfakta() {
    const { data } = await supa.from('foretagsfakta').select('*').eq('id', 1).maybeSingle();
    const f = data || {};
    $('#bf-orgnr').value = f.organisationsnummer || '';
    $('#bf-bolagsform').value = f.bolagsform || '';
    $('#bf-rakenskapsar').value = f.rakenskapsar_slut || '';
    $('#bf-momsperiod').value = f.momsperiod || '';
    $('#bf-system').value = f.bokforingssystem || '';
    $('#bf-konsult').value = f.redovisningskonsult || '';
    $('#bf-form').value = f.studiehjalpare_form || 'oklart';
    $('#bf-moms').checked = !!f.momsregistrerad;
    $('#bf-fskatt').checked = !!f.f_skatt;
    $('#bf-arbetsgivare').checked = !!f.arbetsgivarregistrerad;
    $('#bf-anteckningar').value = f.anteckningar || '';
    märkLarm();
  }

  /* Larmrutan lugnar ner sig när fältet är ifyllt. En permanent röd
     ruta slutar man se efter tredje besöket. */
  function märkLarm() {
    $('#form-larm').classList.toggle('ifylld', $('#bf-form').value !== 'oklart');
  }

  function kopplaBolagsfakta() {
    if (!$('#bf-form')) return;
    $('#bf-form').addEventListener('change', märkLarm);

    $('#bf-spara').addEventListener('click', async e => {
      const msg = $('#bf-msg');
      rensa(msg);
      await medan(e.target, 'Sparar', async () => {
        const { error } = await supa.from('foretagsfakta').update({
          organisationsnummer: $('#bf-orgnr').value.trim() || null,
          bolagsform: $('#bf-bolagsform').value.trim() || null,
          rakenskapsar_slut: $('#bf-rakenskapsar').value.trim() || null,
          momsperiod: $('#bf-momsperiod').value || null,
          bokforingssystem: $('#bf-system').value.trim() || null,
          redovisningskonsult: $('#bf-konsult').value.trim() || null,
          studiehjalpare_form: $('#bf-form').value,
          momsregistrerad: $('#bf-moms').checked,
          f_skatt: $('#bf-fskatt').checked,
          arbetsgivarregistrerad: $('#bf-arbetsgivare').checked,
          anteckningar: $('#bf-anteckningar').value.trim() || null,
          uppdaterad: new Date().toISOString()
        }).eq('id', 1);

        if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
        säg(msg, 'Sparat. Ekonomiagenten läser det här vid nästa fråga.', true);
        märkLarm();
      });
    });
  }

  /* ------------------------------------------------------------
     ÅTERKOPPLING

     Studiehjälparen skriver normalt sin egen återkoppling i
     larare.html. Listan här är de rapporter där det inte blivit
     gjort, och knappen anropar samma edge-funktion.
     ------------------------------------------------------------ */
  async function laddaAterkoppling() {
    const ut = $('#ak-lista');
    const { data, error } = await supa
      .from('lesson_reports')
      .select('id, raw_notes, ai_feedback, created_at, students(name)')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) { ut.innerHTML = '<p class="xsmall">Kunde inte hämta: ' + esc(felText(error)) + '</p>'; return; }
    if (!data || !data.length) { ut.innerHTML = '<p class="xsmall" style="color:var(--bl-3)">Inga rapporter än.</p>'; return; }

    ut.innerHTML = data.map(r => {
      const namn = (r.students && r.students.name) || 'eleven';
      const nar = new Date(r.created_at).toLocaleDateString('sv-SE');
      return '<details class="ag-korning" data-rapport="' + esc(r.id) + '">'
        + '<summary>'
        + '<span class="ag-status" data-s="' + (r.ai_feedback ? 'klar' : 'pagar') + '">'
        + (r.ai_feedback ? 'klar' : 'väntar') + '</span>'
        + '<span class="ag-korning-fraga">' + esc(namn) + ' — ' + esc((r.raw_notes || '').slice(0, 90)) + '</span>'
        + '<span class="ag-korning-nar">' + nar + '</span>'
        + '</summary>'
        + '<div class="ag-korning-kropp">'
        + '<p class="xsmall" style="margin-top:16px;color:var(--bl-3)">Studiehjälparens anteckningar</p>'
        + '<p class="xsmall" style="color:var(--bl-2);line-height:1.7">' + esc(r.raw_notes || '') + '</p>'
        + '<div class="ak-resultat" style="margin-top:16px">'
        + (r.ai_feedback
            ? '<p class="xsmall" style="color:var(--bl-3)">Återkoppling till föräldern</p>'
              + '<p class="xsmall" style="color:var(--bl-2);line-height:1.7">' + esc(r.ai_feedback) + '</p>'
            : '<button class="btn btn-primary btn-sm" data-generera="' + esc(r.id) + '">Skriv återkoppling</button>')
        + '</div></div></details>';
    }).join('');
  }

  function kopplaAterkoppling() {
    const lista = $('#ak-lista');
    if (!lista) return;

    lista.addEventListener('click', async e => {
      const knapp = e.target.closest('[data-generera]');
      if (!knapp) return;
      const rutan = knapp.closest('.ak-resultat');

      await medan(knapp, 'Skriver', async () => {
        const { data, error } = await supa.functions.invoke('generate-feedback', {
          body: { report_id: knapp.dataset.generera }
        });
        if (error || !data || !data.ai_feedback) {
          rutan.innerHTML = '<p class="xsmall" style="color:var(--acc-lugn)">Gick inte: '
            + esc(felText(error) || (data && data.error) || 'okänt fel') + '</p>';
          return;
        }
        rutan.innerHTML = '<p class="xsmall" style="color:var(--bl-3)">Återkoppling till föräldern</p>'
          + '<p class="xsmall" style="color:var(--bl-2);line-height:1.7">' + esc(data.ai_feedback) + '</p>';
        const märke = rutan.closest('details').querySelector('.ag-status');
        märke.dataset.s = 'klar';
        märke.textContent = 'klar';
      });
    });
  }

  /* ------------------------------------------------------------
     LÄGET
     ------------------------------------------------------------ */
  async function ritaLäget() {
    const { data } = await supa
      .from('agent_korningar')
      .select('status, in_tokens, ut_tokens, cache_las_tokens, cache_skriv_tokens');

    const rader = data || [];
    $('#kpi-korningar').textContent = rader.length;
    $('#kpi-kastade').textContent = rader.filter(r => r.status === 'ingen_kalla').length;
    /* Alla fyra posterna. in_tokens utesluter det som lästes ur
       cachen, så utan cachekolumnerna underskattar nyckeltalet
       förbrukningen — och underskattar den MER ju bättre cachen
       fungerar, vilket är precis fel håll. */
    $('#kpi-tokens').textContent = rader
      .reduce((s, r) => s + (r.in_tokens || 0) + (r.ut_tokens || 0)
        + (r.cache_las_tokens || 0) + (r.cache_skriv_tokens || 0), 0)
      .toLocaleString('sv-SE');

    const senaste = $('#ov-korningar');
    const { data: sen } = await supa
      .from('agent_korningar')
      .select('agent, fraga, status, skapad')
      .order('skapad', { ascending: false })
      .limit(5);

    if (!sen || !sen.length) {
      senaste.innerHTML = '<p class="xsmall" style="color:var(--bl-3)">Inga körningar än. Ställ din första fråga.</p>';
      return;
    }
    /* Märket bär STATUS, aldrig agentnamnet. Färgen på märket betyder
       något: rött är ett kastat svar. Sätter man agentnamnet i ett
       rött märke läser raden som att juridikagenten är trasig, inte
       som att ett svar stoppades. Agenten står som text bredvid.

       Adressen är #agenter/<agent>, inte #<agent>: agenterna är
       flikar i en sektion nu, och #ekonomi är adminvyns betalningar. */
    senaste.innerHTML = sen.map(k =>
      '<a href="#agenter/' + esc(k.agent) + '" style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--ln);text-decoration:none">'
      + '<span class="ag-status" data-s="' + esc(k.status) + '">' + esc(k.status.replace(/_/g, ' ')) + '</span>'
      + '<span style="flex:1;min-width:0;font-size:12px;color:var(--bl-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
      + '<b style="color:var(--bl-3);font-weight:500">' + esc(k.agent) + '</b> · ' + esc(k.fraga) + '</span></a>'
    ).join('');
  }

  /* ------------------------------------------------------------
     START

     Kastar aldrig vidare. Agenterna är en flik bland många, och ett
     fel här ska inte ta ner resten av adminvyn — det ska synas i
     fliken och stanna där.
     ------------------------------------------------------------ */
  async function start() {
    if (!$('section[data-sek="agenter"]')) return;
    try {
      kopplaSjälvtest();
      kopplaBolagsfakta();
      kopplaAterkoppling();

      const laddaJur = kopplaAgent('juridik', 'jur');
      const laddaEko = kopplaAgent('ekonomi', 'eko');

      await Promise.all([
        ritaLäget(),
        laddaJur(),
        laddaEko(),
        laddaBolagsfakta(),
        laddaAterkoppling()
      ]);
    } catch (fel) {
      const ut = $('#ov-korningar');
      if (ut) {
        ut.innerHTML = '<p class="xsmall" style="color:var(--acc-lugn)">Agentvyn kunde inte laddas: '
          + esc(felText(fel)) + '</p>';
      }
    }
  }

  return { start };
})();
