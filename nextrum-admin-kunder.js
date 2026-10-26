/* ============================================================
   NEXTRUM — adminvyn, Kunder: intresseanmälningar, familjer, elever, studiehjälpare

   En del av nextrum-admin.js, utflyttad i Fas 6 utan att någon
   funktion skrivits om. Kärnan (nextrum-admin-karna.js) laddas
   först och delar tillståndet S och hjälparna; varje område
   registrerar de funktioner andra områden anropar i
   NXAdmin.rita. Skalet (nextrum-admin.js) laddas sist och
   startar vyn. Ordningen står i admin.html.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, esc, säg, rensa, felText, datumText, isoFor } = NX;
  const { bekräfta, medan, tomt, laddar } = NXStudie;
  const kronor = NXBetalning.kronor;
  const M = NXMedia;

  const { LEAD_LAGE, S, SH_LAGE, elevHjälpare, funktionsFel, hämtaAllt,
          hämtaMatchunderlag, kontaktaRuta, kortDatum, läge, matchar, namnFör,
          namnlista, närText, pill, ritaPanelen, tabell, tomtText, visaRuta, ärNyNu, ärRaderad } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaMatchning = (...a) => NXAdmin.rita.ritaMatchning(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);

  /* ============================================================
     INTRESSEANMÄLNINGAR
     ============================================================ */

  /* Källan stod fram till Fas 9.5 som fritext sist i "message" och
     syntes därför i kolumnen "Vad de skrev". Nu är den egna kolumner,
     och därför en egen kolumn här.

     Tomt betyder OKÄNT, inte "direkt": anmälningar från före 9.5 har
     aldrig haft fälten, och de bakfylldes med flit inte. En etikett
     som säger "direkt" på dem hade gjort en lucka till ett svar. */
  function källText(l) {
    if (!l.kalla) return null;
    return l.kalla + (l.medium ? ' / ' + l.medium : '');
  }

  function källTitel(l) {
    const d = [];
    if (l.kampanj)       d.push('Kampanj: ' + l.kampanj);
    if (l.annonsvariant) d.push('Annonsvariant: ' + l.annonsvariant);
    if (l.sokord)        d.push('Sökord: ' + l.sokord);
    if (l.hanvisare)     d.push('Hänvisad från: ' + l.hanvisare);
    if (l.landningssida) d.push('Landningssida: ' + l.landningssida);
    return d.join('\n');
  }

  /* Namnen, med läget. Allt annat, med knapparna Kontakta och Skapa
     elev, står i panelen (dpAnmalan i nextrum-admin-detalj.js). Söket
     går fortfarande mot allt de skrev. */
  function ritaLeads() {
    const sök = $('#leads-sok').value.trim();
    const st = $('#leads-status').value;
    /* En avidentifierad anmälan är ingen person längre, bara en rad som
       statistiken räknar. Den står inte i listan, men antalet sägs. */
    const alla = S.leads.filter(l => !ärRaderad(l));
    const gallrade = S.leads.length - alla.length;
    const rader = alla
      .filter(l => !st || l.status === st)
      .filter(l => matchar(l, ['parent_name', 'email', 'child_name', 'subject', 'grade',
                               'message', 'kalla', 'kampanj', 'kod'], sök));

    $('#leads-antal').textContent = rader.length + ' av ' + alla.length;
    $('#leads-tabell').innerHTML = namnlista(rader, {
      typ: 'anmalan', id: l => l.id,
      namn: l => l.parent_name || l.email,
      läge: l => läge(LEAD_LAGE, l.status),
      /* Den som kom in sedan du tittade senast (2026-10-05, ärNyNu). */
      nytt: l => ärNyNu('leads', l),
      under: l => (ärNyNu('leads', l) ? 'Ny sedan du tittade senast · ' + närText(l.created_at) : ''),
      tomt: tomtText(sök || st, 'Ingen intresseanmälan matchar filtret', 'Inga intresseanmälningar än')
    }) + (gallrade
      ? '<p class="xsmall" style="color:var(--bl-3);margin:12px 0 0">'
        + gallrade + (gallrade === 1 ? ' anmälan är avidentifierad' : ' anmälningar är avidentifierade')
        + ' och räknas bara i statistiken.</p>'
      : '');
    ritaPanelen();
  }

  /* ============================================================
     TIPS OCH KAMPANJER (2026-09-30)

     Står under Tjänster & priser sedan 2026-10-06 (låg under
     Intresseanmälningar), och ritas med rabattkoderna i start().

     Koderna i intresseanmälan: familjernas och studiehjälparnas egna,
     och en per affisch. Talen räknas i databasen (tipskoder_lage) med
     samma regler som timmen på köpet: en kund är en familj vars FÖRSTA
     anmälan med en kod bar den här, och som inte hade haft pass förut.
     Två timmar är de av dem som haft två timmar läxhjälp i genomförda pass
     med rapport (sedan 2026-10-09; förut det första passet): det är då en
     familjs kod ger en timme på köpet.

     Personkoderna står sedan 2026-10-13 under Koder
     (nextrum-admin-koder.js), med vad var och en gett. Här står bara
     affischernas kampanjkoder.

     En kod tas aldrig bort, den stängs av: anmälningarna pekar på den,
     och en borttagen kod hade tagit kopplingen med sig.
     ============================================================ */
  const KOD_SORT = { familj: 'Familj', studiehjalpare: 'Studiehjälpare', kampanj: 'Kampanj' };

  function ritaKoder() {
    const host = $('#koder-tabell');
    if (!host) return;
    if (S.tipskoderFel === 'saknas') {
      host.innerHTML = tomt('Koderna finns inte i databasen än', 'Migrationen tipskoder_och_kampanjkoder är inte körd.');
      return;
    }
    if (S.tipskoderFel) {
      host.innerHTML = tomt('Koderna gick inte att läsa', S.tipskoderFel);
      return;
    }
    const rader = (S.tipskoder || []).filter(k => k.sort === 'kampanj');
    const tim = S.tipsFlagga;
    $('#koder-antal').textContent = rader.length ? rader.length + ' st' : '';
    host.innerHTML = (tim && !tim.aktiv
        ? '<p class="xsmall" style="margin:0 0 12px;color:var(--bl-3)">Timmen i timbanken för ett tips är avstängd, '
          + 'under Koder. Koderna räknas som förut, och timmar som tjänats in innan ges ändå.</p>'
        : '')
      + tabell([
        { namn: 'Kod', rita: k => '<b style="font-family:var(--f-mono);letter-spacing:.06em">' + esc(k.kod) + '</b>'
            + '<span class="adm-und">' + esc(k.sort === 'kampanj' ? (k.namn || '') : namnFör(k.person_id)) + '</span>' },
        { namn: 'Sort', rita: k => esc(KOD_SORT[k.sort] || k.sort) },
        { namn: 'Anmälda', rita: k => '<span class="adm-tal">' + (k.anmalda || 0) + '</span>' },
        { namn: 'Kunder', rita: k => '<span class="adm-tal">' + (k.kunder || 0) + '</span>' },
        { namn: 'Två timmar', rita: k => '<span class="adm-tal">' + (k.forsta_pass || 0) + '</span>'
            + (k.sort === 'familj' && k.forsta_pass
              ? '<span class="adm-und">' + (k.timmar_anvanda || 0) + ' av ' + k.forsta_pass + ' timmar på köpet använda</span>'
              : '') },
        { namn: 'Läge', rita: k => k.aktiv ? pill('Aktiv', 'ar-klar') : pill('Avstängd', '') },
        { namn: '', höger: true, rita: k => (k.sort === 'kampanj'
            ? '<a class="btn btn-ghost btn-sm" href="/affisch?kod=' + encodeURIComponent(k.kod)
              + '" target="_blank" rel="noopener">Affisch</a> '
            : '')
            + '<button class="btn btn-ghost btn-sm" type="button" data-kod-vaxla="' + esc(k.kod) + '">'
            + (k.aktiv ? 'Stäng av' : 'Slå på') + '</button>' }
      ], rader, 'Inga kampanjkoder än. Skapa en för en affisch nedan.');
  }

  async function hämtaKoder() {
    const { data, error } = await supa.rpc('tipskoder_lage');
    if (error) {
      S.tipskoderFel = error.code === 'PGRST202' || error.code === '42883' ? 'saknas' : felText(error);
      return;
    }
    S.tipskoderFel = null;
    S.tipskoder = data || [];
    S.tipskod = {};
    S.tipskoder.forEach(k => { S.tipskod[k.kod] = k; });
  }

  (function kopplaKoder() {
    const form = $('#koder-form');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('#koder-msg');
      rensa(msg);
      /* Samma form som tipskoder_kod_form i databasen. Å, ä och ö blir
         a och o: koden ska gå att skriva av på vilket tangentbord som
         helst. Det här är ett besked, inte skyddet. */
      const kod = String($('#koder-kod').value || '').trim().toUpperCase()
        .replace(/[ÅÄ]/g, 'A').replace(/Ö/g, 'O').replace(/\s+/g, '-');
      const namn = String($('#koder-namn').value || '').trim();
      if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(kod)) {
        säg(msg, 'Koden får bara innehålla A–Z, 0–9 och bindestreck, 3–24 tecken.', false); return;
      }
      if (!namn) { säg(msg, 'Skriv var koden sitter, till exempel "Affisch Farsta bibliotek".', false); return; }
      await medan($('#koder-spara'), 'Skapar…', async () => {
        const { error } = await supa.from('tipskoder').insert({ kod, sort: 'kampanj', namn: namn.slice(0, 80) });
        if (error) {
          säg(msg, error.code === '23505' ? 'Det finns redan en kod som heter ' + kod + '.'
            : 'Kunde inte skapa: ' + felText(error), false);
          return;
        }
        await hämtaKoder();
        ritaKoder();
        form.reset();
        säg(msg, '✓ ' + kod + ' är skapad. Affischen står på raden.', true);
      });
    });
  })();

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-kod-vaxla]');
    if (!knapp) return;
    const k = (S.tipskod || {})[knapp.dataset.kodVaxla];
    if (!k) return;
    if (k.aktiv) {
      const ja = await bekräfta({
        titel: 'Stänga av ' + k.kod + '?',
        text: 'En anmälan med koden går fortfarande in, men utan koden. Det som redan kommit in med den står kvar.'
          + (k.sort === 'familj' ? ' Timmar på köpet som redan tjänats in står kvar.' : ''),
        knapp: 'Stäng av'
      });
      if (!ja) return;
    }
    await medan(knapp, '…', async () => {
      const { error } = await supa.from('tipskoder').update({ aktiv: !k.aktiv }).eq('kod', k.kod);
      if (error) { alert('Kunde inte ändra: ' + felText(error)); return; }
      await hämtaKoder();
      ritaKoder();
    });
  });

  /* ============================================================
     FAMILJER

     Ingen matchning här längre. Den flyttade till sin egen
     sektion när den blev en elevfråga — se kommentaren vid
     kolumnen Studiehjälpare nedan.
     ============================================================ */

  /* Familjen är intagen; matchad är barnet (2026-10-21, Leo: "'Matchad'
     ska visas på barnet och inte på föräldern"). Här satt förr en
     rullgardin som skrev profiles.matched_tutor_id, och den är borta
     med flit: sedan schema-v14 äger ELEVEN sin matchning, och
     profiles-kolumnen skrivs av en trigger som räknar om den ur barnen.
     Två skrivvägar till samma sanning är en bugg som väntar. Matchningen
     görs under Matchning och står på varje barn, under Elever och i
     familjens panel. Ett konto skapar bara vi (Ta in familjen), så varje
     familj här är intagen; datumet står när anmälan flyttats hit. */
  function familjLäge(p) {
    const intagen = (S.intagenFör || {})[p.id];
    return pill(intagen ? 'Intagen ' + kortDatum(intagen.intagen_at) : 'Intagen', 'ar-klar');
  }

  /* Har familjen ett barn som väntar på en studiehjälpare? Filtret
     läser barnen, inte profiles.match_status, som bara speglar det
     första matchade barnet. */
  const barnUtanHjälpare = p => (S.elever[p.id] || []).some(e => !(e.matched_tutor_id && e.match_status === 'matched'));

  function ritaFamiljer() {
    const sök = $('#fam-sok').value.trim();
    const st = $('#fam-status').value;
    const alla = Object.values(S.personer).filter(p => p.role === 'parent' && !ärRaderad(p))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const rader = alla
      .filter(p => !st || (st === 'matched'
        ? (S.elever[p.id] || []).length && !barnUtanHjälpare(p)
        : barnUtanHjälpare(p) || !(S.elever[p.id] || []).length))
      .filter(p => matchar(p, ['full_name', 'email', 'phone'], sök));

    $('#fam-antal').textContent = rader.length + ' av ' + alla.length;
    $('#fam-tabell').innerHTML = namnlista(rader, {
      typ: 'familj', id: p => p.id,
      namn: p => p.full_name || p.email,
      läge: familjLäge,
      tomt: tomtText(sök || st, 'Ingen familj matchar filtret', 'Inga familjer registrerade än')
    });
    ritaPanelen();
  }


  /* ============================================================
     ANMÄLAN FLYTTAS TILL FAMILJEN (2026-10-21)

     Leo: "när en intresseanmälan blir en familj ska ... (c) radera
     lead-raden så den inte tar plats i listan." intag_lead flyttar
     källan, koden och det familjen skrev till intagna_anmalningar och
     tar bort anmälan; tipstimmen, Koder och statistiken läser båda.
     Svarar true, null när funktionen saknas (migrationen inte körd),
     eller felet som text.
     ============================================================ */
  async function flyttaAnmälan(leadId, familj) {
    const { error } = await supa.rpc('intag_lead', { p_lead: leadId, p_familj: familj || null });
    if (!error) {
      S.leads = S.leads.filter(l => l.id !== leadId);
      return true;
    }
    if (error.code === 'PGRST202' || error.code === '42883') return null;
    return felText(error);
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-lead-intag]');
    if (!knapp) return;
    const lead = S.leads.find(l => l.id === knapp.dataset.leadIntag);
    if (!lead) return;
    const familj = anmälansFamilj(lead);
    if (!familj) return;
    const ja = await bekräfta({
      titel: 'Flytta anmälan till familjen?',
      text: 'Källan, koden och det ' + (lead.parent_name || 'familjen') + ' skrev flyttas till '
        + (familj.full_name || familj.email || 'familjen') + ' och står i familjens panel. '
        + 'Telefonnumret sparas på familjen om det saknas där, och anmälan står inte längre i listan.',
      knapp: 'Flytta'
    });
    if (!ja) return;
    await medan(knapp, '…', async () => {
      const svar = await flyttaAnmälan(lead.id, familj.id);
      if (svar === null) {
        alert('Databasen kan inte flytta anmälningar än (migrationen anmalan_flyttas_till_familjen).');
        return;
      }
      if (svar !== true) { alert('Kunde inte flytta: ' + svar); return; }
      await hämtaAllt();
      ritaLeads();
      ritaFamiljer();
      if (NXAdmin.rita.öppnaDetalj) NXAdmin.rita.öppnaDetalj('familj', familj.id);
    });
  });


  /* ============================================================
     ELEVER

     Eleven är den enhet allt annat hänger på: läxor, material,
     studieplan, rapporter och utveckling bär ett student_id, och
     ett pass bokas åt en elev.

     Sedan schema-v14 gäller det matchningen också: en elev har en
     egen studiehjälpare, och syskon kan ha var sin. Själva
     matchandet sker under Matchning — här visas bara resultatet,
     med en väg dit för den som saknar.
     ============================================================ */

  function fyllÅrskurser() {
    const sel = $('#elev-ak');
    if (!sel || sel.dataset.fylld) return;
    const åk = [];
    S.elevlista.forEach(e => { if (e.grade && åk.indexOf(e.grade) === -1) åk.push(e.grade); });
    åk.sort();
    sel.insertAdjacentHTML('beforeend',
      åk.map(a => '<option value="' + esc(a) + '">' + esc(a) + '</option>').join(''));
    sel.dataset.fylld = '1';
  }

  function ritaElever() {
    fyllÅrskurser();
    const sök = $('#elev-sok').value.trim();
    const åk = $('#elev-ak').value;
    const m = $('#elev-match').value;

    const alla = S.elevlista.slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const rader = alla
      .filter(e => !åk || e.grade === åk)
      .filter(e => !m || (m === 'ja' ? !!elevHjälpare(e) : !elevHjälpare(e)))
      .filter(e => {
        if (!sök) return true;
        const f = S.personer[e.parent_id];
        const text = [e.name, e.grade, e.school, (e.subjects || []).join(' '),
          f && f.full_name, f && f.email].filter(Boolean).join(' ');
        return text.toLowerCase().indexOf(sök.toLowerCase()) !== -1;
      });

    $('#elev-antal').textContent = rader.length + ' av ' + alla.length;
    $('#elev-tabell').innerHTML = namnlista(rader, {
      typ: 'elev', id: e => e.id,
      namn: e => e.name,
      läge: e => elevHjälpare(e) ? pill('Matchad', 'ar-klar') : pill('Ingen studiehjälpare', 'ar-ny'),
      tomt: tomtText(sök || åk || m, 'Ingen elev matchar filtret', 'Inga elever inlagda än')
    });
    ritaPanelen();
  }

  /* Från elevens panel rakt in i matchningen med rätt elev vald.
     Utan det får man leta upp samma elev en gång till i en annan
     lista, vilket är precis det som gör ett system tröttsamt. */
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-mt-hoppa]');
    if (!k) return;
    S.valdElev = k.dataset.mtHoppa;
    ritaMatchning();
  });

  ['#elev-sok', '#elev-ak', '#elev-match'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', ritaElever);
  });


  /* ============================================================
     STUDIEHJÄLPARE
     ============================================================ */

  /* ============ poolen i fyra tal ============

     "Hur många studiehjälpare har vi?" hade förut inget svar i vyn —
     bara en tabell man fick räkna rader i, och raderna är blandade
     lägen. De fyra talen svarar på de fyra frågor som faktiskt
     ställs, och det tredje och fjärde är de som kostar pengar:

     · utan timpenning hoppar faktureringen över personen helt när
       ersättningar räknas ut. Hen håller pass och får inget betalt.
     · godkänd utan elev är kapacitet som står still.

     Talen räknas på HELA poolen, aldrig på filtret ovanför. */
  function ritaPoolsammanfattning(alla) {
    const host = $('#sh-sammanfattning');
    if (!host) return;

    const godkända = alla.filter(t => t.status === 'approved');
    const väntar = alla.filter(t => t.status === 'pending').length;
    const utanTimpenning = godkända.filter(t => !t.hourly_rate).length;
    const elevAntal = id => Object.values(S.personer).filter(p => p.matched_tutor_id === id).length;
    const utanElev = godkända.filter(t => !elevAntal(t.id)).length;

    const kort = (tal, etikett, under, larm) =>
      '<div class="adm-kpi' + (larm ? ' ar-larm' : '') + '"><b>' + esc(String(tal)) + '</b>'
      + '<span>' + esc(etikett) + '</span>'
      + '<span class="adm-kpi-diff">' + esc(under) + '</span></div>';

    host.innerHTML =
      kort(godkända.length, 'I poolen', 'godkända och matchningsbara')
      + kort(väntar, 'Väntar på beslut', väntar ? 'ansökt, inte avgjort' : 'inget i kö', väntar > 0)
      + kort(utanTimpenning, 'Utan timpenning',
          utanTimpenning ? 'får ingen utbetalning' : 'alla har ett tal', utanTimpenning > 0)
      + kort(utanElev, 'Utan elev', utanElev ? 'ledig kapacitet' : 'alla har minst en');
  }

  /* Läget och om hen syns på startsidan. Publiceringen är ett EGET
     beslut, inte en följd av att vara godkänd (schema-v23), och står
     därför som ett eget märke. Knapparna står i panelen. */
  function ritaStudiehjalpare() {
    const sök = $('#sh-sok').value.trim();
    const st = $('#sh-status').value;
    const alla = Object.values(S.tutorProfiler)
      .filter(t => !ärRaderad(S.personer[t.id]))
      .map(t => ({ ...t, namn: namnFör(t.id), epost: (S.personer[t.id] || {}).email || '' }))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const rader = alla
      .filter(t => !st || t.status === st)
      .filter(t => matchar({ ...t, amnen: (t.subjects || []).join(' ') },
        ['namn', 'epost', 'city', 'school', 'amnen'], sök));

    ritaPoolsammanfattning(alla);
    $('#sh-antal').textContent = rader.length + ' av ' + alla.length;
    $('#sh-tabell').innerHTML = namnlista(rader, {
      typ: 'studiehjalpare', id: t => t.id,
      namn: t => t.namn,
      läge: t => läge(SH_LAGE, t.status)
        + (t.status === 'approved' && t.visa_publikt ? ' ' + pill('På startsidan', '') : ''),
      tomt: tomtText(sök || st, 'Ingen studiehjälpare matchar filtret', 'Inga studiehjälpare registrerade än')
    });
    ritaPanelen();
  }

  function mallLead(l) {
    return 'Hej ' + (String(l.parent_name || '').split(' ')[0] || '') + ',\n\n'
      + 'Tack för er intresseanmälan. '
      + (l.child_name ? 'Vi har läst vad ni skrev om ' + l.child_name + ' och ' : 'Vi har läst den och ')
      + 'vill gärna veta lite mer innan vi väljer studiehjälpare.\n\n'
      + 'Två frågor:\n'
      + '  · Vad går trögast just nu?\n'
      + '  · Vilka tider i veckan brukar fungera?\n\n'
      + 'När vi vet det väljer vi ut en person som passar, och återkommer med '
      + 'ett förslag. Ni bläddrar alltså inte i en katalog — vi gör matchningen '
      + 'åt er, för fel match är värre än ingen match.\n\n'
      + 'Hälsningar,\nNextrum';
  }

  /* Mall till en godkänd studiehjälpare.

     Medvetet tunn. En familj som skickat en intresseanmälan har alltid
     samma ärende, så mallLead kan säga något konkret. En studiehjälpare
     kontaktas av vilket skäl som helst — en ny elev, en tid som inte
     går ihop, en rapport som saknas — och en mall som gissar ärendet
     blir något admin måste radera först. Hälsningen och avslutet är
     det som sparar tid; mitten skriver människan. */
  function mallStudiehjalpare(t) {
    return 'Hej ' + (String(t.namn || '').split(' ')[0] || '') + ',\n\n'
      + '\n\n'
      + 'Hälsningar,\nNextrum';
  }

  /* ---- kontakta en godkänd studiehjälpare ----

     Ingen stämpel efteråt, till skillnad från leads och ansökningar.
     De två har kontaktad_at i databasen; tutor_profiles har det inte,
     och en kolumn ska inte läggas till för att en knapp ska kännas
     färdig. Kontakten syns under Skickat i Gmail, där den
     hör hemma. */
  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-sh-kontakt]');
    if (!knapp) return;
    const id = knapp.dataset.shKontakt;
    const t = S.tutorProfiler[id];
    if (!t) return;
    const namn = namnFör(id);
    const till = (S.personer[id] || {}).email || '';
    if (!till) return;

    kontaktaRuta({
      titel: 'Skriv till ' + (namn || till),
      namn: namn, till: till,
      amne: 'Från Nextrum',
      text: mallStudiehjalpare({ namn: namn })
    });
  });

  /* ---- kontakta en familj som skickat intresseanmälan ---- */
  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-lead-kontakt]');
    if (!knapp) return;
    const l = S.leads.find(x => x.id === knapp.dataset.leadKontakt);
    if (!l) return;

    kontaktaRuta({
      titel: 'Svara ' + (l.parent_name || l.email || ''),
      namn: l.parent_name, till: l.email,
      amne: 'Er intresseanmälan till Nextrum',
      text: mallLead(l),
      efterat: async () => {
        const nu = new Date().toISOString();
        await supa.from('leads')
          .update({ kontaktad_at: nu, status: l.status === 'new' ? 'contacted' : l.status })
          .eq('id', l.id);
        l.kontaktad_at = nu;
        if (l.status === 'new') l.status = 'contacted';
        ritaLeads();
      }
    });
  });

  /* ============================================================
     FRÅN ANMÄLAN TILL ELEV

     Matchningskön arbetar på rader i `students`. En intresseanmälan
     är en rad i `leads` och blir aldrig en elev av sig själv, så
     tratten tog slut mellan de två — familjen hörde av sig, hamnade
     i en lista, och kunde sedan inte matchas med någon.

     VARFÖR FAMILJEN MÅSTE FINNAS FÖRST

     En elev hänger på ett parent_id, och ett parent_id är en rad i
     profiles, som i sin tur skapas av triggern handle_new_user när
     någon registrerar ett konto. Adminvyn kan alltså inte trolla
     fram en familj — kontot måste finnas.

     Har familjen inget konto skapas det härifrån (Fas 2.8, och sedan
     2026-10-06 i samma tryck som eleven: Ta in familjen).
     Edge-funktionen bjud-in skapar kontot och länken med service_role
     (generateLink); kontot finns direkt, och familjen får ett mejl från
     oss med en länk där de väljer sitt lösenord.
     ============================================================ */
  /* FAMILJEN ÄR DEN SOM SKICKADE ANMÄLAN

     Leo 2026-09-24: eleven står redan i anmälan, och familjen är
     uppenbarligen den som skickade den — att välja familj i en
     rullgardin var ett val som bara kunde bli fel.

     Förut förvaldes en familj med samma e-postadress, men gick att
     byta, med motiveringen att två familjer kan dela en adress. Det
     kan de inte: Supabase Auth tillåter ett konto per adress, så det
     finns som mest EN träff. Ordningen är:

       1. leads.kund_id — kopplingen som skrivs när familjen bjuds in
          härifrån, eller när en elev redan skapats ur anmälan
       2. kontot med anmälans adress
       3. inget konto än — då bjuds familjen in först, och kontot
          som skapas ÄR familjen

     Skrev familjen en annan adress i anmälan än den de sedan
     registrerade sig med hittas ingen träff, och då blir det en
     inbjudan till anmälans adress. Det är ett fall för SQL, inte
     för en rullgardin som gör fel enkelt. */
  function anmälansFamilj(lead) {
    if (lead.kund_id && S.personer[lead.kund_id]) return S.personer[lead.kund_id];
    const epost = String(lead.email || '').toLowerCase();
    if (!epost) return null;
    return Object.values(S.personer).find(p =>
      p.role === 'parent' && p.email && String(p.email).toLowerCase() === epost) || null;
  }

  function familjRad(f, lead) {
    if (f) {
      return '<div class="le-familj">'
        + '<span class="le-familj-et">Familj, ur anmälan</span>'
        + '<b>' + esc(f.full_name || lead.parent_name || f.email) + '</b>'
        + '<span>' + esc(f.email || '') + '</span></div>';
    }
    return '<div class="le-familj le-familj-saknas">'
      + '<span class="le-familj-et">Familj, ur anmälan</span>'
      + '<b>' + esc(lead.parent_name || lead.email || 'Okänd') + '</b>'
      + (NX.epostOk(lead.email || '')
        ? '<span>Inget konto har adressen ' + esc(lead.email) + ' än. Det skapas när du tar in familjen, '
          + 'och de får ett mejl från Nextrum med en länk där de väljer sitt lösenord.</span>'
        : '<span class="xsmall" style="color:var(--acc-text)">Adressen i anmälan går inte att skicka till. '
          + 'Rätta den först.</span>')
      + '</div>';
  }

  /* Kvittot på gratistimmarna, ur svaret från ge_gratistimmar. */
  function gratisText(svar) {
    const t = Number(svar.timmar) || 0;
    return (t === 1 ? '1 gratistimme' : t + ' gratistimmar') + ' står i familjens timbank'
      + (svar.giltigt_till ? ', till och med ' + datumText(svar.giltigt_till) : '') + '.'
      + (Number(svar.betalda_pass) > 0
        ? ' De har redan betalat ' + (Number(svar.betalda_pass) === 1 ? '1 pass' : svar.betalda_pass + ' pass') + '.'
        : '');
  }

  /* TA IN FAMILJEN (2026-10-06)

     Leo: "när vi tar in ... familjen till plattformen används deras
     mail", utan att familjen själv skapar ett konto. Förut stod
     inbjudan som en egen knapp mitt i rutan, Skapa elev var låst tills
     den tryckts, och rutan sa åt admin att vänta. Nu är det ett tryck:
     kontot skapas (bjud-in, som mejlar länken), anmälan kopplas till
     det, och eleven skapas ur anmälan. Har familjen redan ett konto är
     rutan som förut, Skapa elev.

     Mejlet är riktigt, och rutan säger det innan knappen trycks: det är
     frågan. Går eleven inte att skapa efter att kontot skapats står
     familjen kvar i rutan, och knappen blir Skapa elev. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-lead-elev]');
    if (!knapp) return;

    const lead = S.leads.find(l => l.id === knapp.dataset.leadElev);
    if (!lead) return;

    let familj = anmälansFamilj(lead);
    let inbjuden = false;
    let gratisVal = null;   // gratistimmarna: svaret från ge_gratistimmar, eller felet
    let flyttad = null;     // anmälan flyttad till familjen: true, felet, eller null utan funktionen
    let rabattVal = null;   // familjerabatten: koden som sattes, eller { fel }
    const kanBjuda = NX.epostOk(lead.email || '');
    /* Familjerabatterna (2026-10-15) som går att ge, bara för en superadmin
       och bara när det finns någon. */
    const rabatter = (!S.behorighet || S.behorighet.superadmin) && !S.familjerabatterFel
      ? (S.familjerabatter || []).filter(k => k.aktiv) : [];

    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="le-t">'
      + '<h3 id="le-t">' + (familj ? 'Skapa elev ur anmälan' : 'Ta in familjen') + '</h3>'
      + '<p>' + (familj
        ? 'Eleven hamnar under Elever och i matchningskön så fort den finns.'
        : 'Familjen får ett konto med adressen i anmälan, och eleven hamnar under Elever och i '
          + 'matchningskön. Allt i ett tryck.') + '</p>'
      + '<div id="le-familj-rad">' + familjRad(familj, lead) + '</div>'
      + '<div class="ag-faltrad" style="margin-top:12px">'
      + '<div class="fgroup"><label for="le-namn">Elevens namn</label>'
      + '<input class="inp" id="le-namn" value="' + esc(lead.child_name || '') + '"></div>'
      + '<div class="fgroup"><label for="le-arskurs">Årskurs</label>'
      + '<input class="inp" id="le-arskurs" value="' + esc(lead.grade || '') + '"></div>'
      + '<div class="fgroup"><label for="le-amnen">Ämnen</label>'
      + '<input class="inp" id="le-amnen" value="' + esc(lead.subject || '') + '"></div>'
      /* Elevens kön (kon_i_matchningen, 2026-10-26), om ni pratat om det:
         en studiehjälpare som bara vill hjälpa elever av samma kön visas
         inte i matchningen för en elev utan angivet kön. Anmälan frågar
         inte; föräldern kan ange och ändra det i studievyn. */
      + '<div class="fgroup"><label for="le-kon">Kön</label>'
      + '<select class="sel" id="le-kon"><option value="">Inte angivet</option>'
      + NX.KON_ELEV.map(k => '<option value="' + esc(k.kod) + '">' + esc(k.text) + '</option>').join('')
      + '</select></div>'
      + '</div>'
      /* Gratistimmar (2026-10-13, Leo: "när vi tar in en familj ska vi
         kunna fylla deras timbank med önskade timmar som vi klickar in,
         inte de"). Gratis också här, och samma regler som i familjens
         panel (ge_gratistimmar). Noll eller tomt: inga. Bara när kontot
         skapas här; en familj som redan finns får dem i sin panel. Rutan
         för första timmen pass för pass stod här till 2026-10-15 (Leo:
         "det ska bara finnas ge gratis timmar till timbanken"). */
      + (familj ? '' : '<div class="le-gratis"><label for="le-gratis">Gratistimmar i timbanken</label>'
        + '<input class="inp" id="le-gratis" type="number" min="0" max="40" step="1" inputmode="numeric" value="0">'
        + '<span>Från oss, utan kostnad. De gäller i 60 dagar och betalar familjens pass före köpta timmar. '
        + 'Det som blir över av en timme sparas inte, och de betalas aldrig ut.</span>'
        /* Orsaken (timmar_med_orsak, 2026-10-21): krävs när timmarna är fler
           än noll, och sparas med insättningen. Timmarna avser den här
           månaden; en annan månad väljs i familjens panel. */
        + '<div class="le-gratis-orsak" hidden><label for="le-gratis-orsak">Orsak</label>'
        + '<input class="inp" id="le-gratis-orsak" maxlength="500" autocomplete="off"'
        + ' placeholder="Till exempel: välkomsttimmar vid intaget">'
        + '<span>Sparas med insättningen och ändras aldrig. Skriv varför, utan namn.</span></div></div>')
      /* Familjerabatt (2026-10-15, Leo: "precis som när vi ger ut gratis
         timmar"): en av våra koder, till exempel för familjer som kommer
         genom en samarbetspartner. Samma regler som i familjens panel
         (satt_familjerabatt). Bara när kontot skapas här, som gratistimmarna. */
      + (familj || !rabatter.length ? '' : '<div class="le-gratis le-rabatt"><label for="le-rabatt">Familjerabatt</label>'
        + '<select class="sel" id="le-rabatt"><option value="">Ingen</option>'
        + rabatter.map(k => '<option value="' + esc(k.kod) + '">' + esc(k.kod + ', '
          + kronor(k.ore_per_timme) + ' av per timme') + '</option>').join('')
        + '</select>'
        + '<span>Bara vi ser koden. Familjen betalar så många kronor mindre för varje timme, tills ni tar bort den i '
        + 'familjens panel, och ser bara det lägre priset.</span></div>')
      + '<p class="ok-msg" id="le-msg"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-le-stang>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="le-skapa"' + (familj || kanBjuda ? '' : ' disabled') + '>'
      + (familj ? 'Skapa elev' : 'Ta in familjen') + '</button>'
      + '</div></div>';

    visaRuta(ruta);
    const stäng = () => { ruta.remove(); document.body.style.overflow = ''; };
    ruta.addEventListener('click', ev => {
      if (ev.target === ruta || ev.target.closest('[data-le-stang]')) { stäng(); return; }
      if (ev.target.closest('[data-le-match]')) { stäng(); location.hash = '#matchning'; }
    });
    // Orsaken fälls ut när timmarna är fler än noll.
    ruta.addEventListener('input', ev => {
      if (ev.target.id !== 'le-gratis') return;
      const rad = $('.le-gratis-orsak', ruta);
      if (rad) rad.hidden = !(Number(ev.target.value) > 0);
    });

    /* Kontot först, när familjen inte har något. Svarar false när
       inbjudan inte gick, och har då sagt varför. */
    async function bjudIn(msg) {
      const res = await supa.functions.invoke('bjud-in', {
        body: { epost: lead.email, namn: lead.parent_name || '', lead_id: lead.id }
      });
      const fel = res.error || (res.data && res.data.error);
      if (fel) { säg(msg, await funktionsFel(fel), false); return false; }
      if (lead.status === 'new') lead.status = 'contacted';
      inbjuden = true;

      /* Kontot som just skapades ÄR kunden anmälan blev. Kopplingen
         skrivs nu, för när familjen väl valt lösenord finns det
         ingenting som säger vilken anmälan de kom ifrån — och det är
         den frågan kundtidslinjen ska kunna svara på. bjud-in sätter
         status och kontaktad_at själv, med service_role. */
      if (res.data.id) {
        const k = await supa.from('leads').update({ kund_id: res.data.id }).eq('id', lead.id);
        if (!k.error) lead.kund_id = res.data.id;
      }

      /* HÄMTA OM. Familjens profilrad finns REDAN när inbjudan gått
         iväg: triggern handle_new_user är AFTER INSERT on auth.users,
         inte "efter att lösenordet valts". hämtaAllt() fyller bara S,
         den ritar ingenting, så rutan överlever anropet. */
      await hämtaAllt();
      familj = (res.data.id && S.personer[res.data.id]) || anmälansFamilj(lead);
      $('#le-familj-rad', ruta).innerHTML = familjRad(familj, lead);
      $('#le-t', ruta).textContent = 'Skapa elev ur anmälan';
      ritaLeads();
      /* Profilen skapas av handle_new_user i samma stund som kontot, så
         den ska finnas. Gör den inte det ska inget tryck skicka en
         inbjudan till: kontot finns redan (knappen stängs nedan). */
      if (!familj) {
        säg(msg, 'Kontot är skapat och mejlet skickat, men det syns inte här än. Ladda om sidan och '
          + 'öppna anmälan igen för att skapa eleven.', false);
      }
      return !!familj;
    }

    $('#le-skapa', ruta).addEventListener('click', async () => {
      const msg = $('#le-msg', ruta);
      rensa(msg);
      const namn = $('#le-namn', ruta).value.trim();
      if (!namn) { säg(msg, 'Eleven behöver ett namn.', false); return; }
      /* Antalet prövas innan kontot skapas: ett felskrivet tal ska inte
         lämna en familj intagen utan de timmar som var tänkta. */
      const gratisFält = $('#le-gratis', ruta);
      const gratis = gratisFält && !gratisFält.closest('.le-gratis').hidden
        ? Number(String(gratisFält.value).trim() || 0) : 0;
      if (!Number.isInteger(gratis) || gratis < 0 || gratis > 40) {
        säg(msg, 'Gratistimmarna är ett helt antal timmar, mellan 0 och 40.', false);
        return;
      }
      /* Orsaken prövas också före kontot (timmar_med_orsak): databasen
         sätter inte in timmar utan den. */
      const orsakFält = $('#le-gratis-orsak', ruta);
      const gratisOrsak = orsakFält ? String(orsakFält.value || '').trim() : '';
      if (gratis > 0 && gratisOrsak.length < 3) {
        säg(msg, 'Skriv varför familjen får gratistimmarna, minst tre tecken.', false);
        if (orsakFält) { orsakFält.closest('.le-gratis-orsak').hidden = false; orsakFält.focus(); }
        return;
      }

      await medan($('#le-skapa', ruta), familj ? 'Skapar…' : 'Tar in…', async () => {
        if (!familj && !(await bjudIn(msg))) return;
        const parent = familj.id;
        /* Gratistimmarna, en gång, när kontot finns. Familjen har inte
           godkänt villkoren än, och behöver inte: en gåva är inget köp. */
        if (gratis > 0 && inbjuden && gratisVal === null) {
          const v = await supa.rpc('ge_gratistimmar', { p_familj: parent, p_timmar: gratis, p_orsak: gratisOrsak, p_manad: null });
          gratisVal = v.error
            ? (v.error.code === 'PGRST202' ? 'migrationen timmar_med_orsak är inte körd' : felText(v.error))
            : (v.data || {});
          gratisFält.closest('.le-gratis').hidden = true;
        }
        /* Familjerabatten, en gång, när kontot finns. */
        const rabattFält = $('#le-rabatt', ruta);
        if (rabattFält && rabattFält.value && inbjuden && rabattVal === null) {
          const v = await supa.rpc('satt_familjerabatt', { p_familj: parent, p_kod: rabattFält.value });
          rabattVal = v.error ? { fel: felText(v.error) } : rabattFält.value;
          rabattFält.closest('.le-rabatt').hidden = true;
        }

        /* Ämnena är en text[] som inte får vara null (förvalet är en
           tom array). Fritexten ur anmälan delas på komma, tomma bitar
           bort — samma regel som när en ansökan tas in i poolen. Förut
           skickades strängen rakt av, och då svarade databasen 22P02
           på "matte, svenska" och 23502 på ett tomt fält: knappen
           "Skapa elev" hade aldrig kunnat fungera. */
        const ämnen = String($('#le-amnen', ruta).value || '')
          .split(',').map(x => x.trim()).filter(Boolean);

        const elevRad = {
          parent_id: parent,
          name: namn,
          grade: $('#le-arskurs', ruta).value.trim() || null,
          subjects: ämnen,
          /* Behoven och upplägget ur anmälan (behov_i_matchningen,
             2026-10-21) följer med till eleven: det är dem matchningen
             räknar på. Före migrationen saknas de på anmälan, och då
             blir det samma tomma förval som förut. */
          behov: Array.isArray(lead.behov) ? lead.behov.filter(k => NX.BEHOV.some(x => x.kod === k)) : [],
          format_onskemal: NX.FORMAT_ONSKEMAL.some(x => x.kod === lead.format_onskemal) ? lead.format_onskemal : null
        };
        const kon = $('#le-kon', ruta).value || null;
        if (kon) elevRad.kon = kon;
        let svar = await supa.from('students').insert(elevRad).select('id, uppdrag_id').single();
        /* Utan migrationen kon_i_matchningen finns inte kolumnen: eleven
           skapas ändå, utan könet, och kvittot säger det. */
        let konSaknas = false;
        if (svar.error && kon && /kon/.test(String(svar.error.message || ''))) {
          delete elevRad.kon;
          konSaknas = true;
          svar = await supa.from('students').insert(elevRad).select('id, uppdrag_id').single();
        }
        const { data: ny, error } = svar;
        if (error) {
          säg(msg, (inbjuden ? 'Familjen har fått sitt konto och mejlet, men eleven kunde inte skapas: '
            : 'Kunde inte skapa: ') + felText(error), false);
          return;
        }

        /* Uppdraget skapas av triggern elevens_uppdrag, som sätter
           standardtjänsten — den tittar aldrig på anmälan. Anmälan
           vet däremot vad familjen faktiskt bad om, så tjänsten
           skrivs om här. I dag är båda läxhjälp; skillnaden uppstår
           den dag en andra tjänst öppnas.

           Bara en aktiv och kundvänd tjänst skrivs. Anmälan kommer
           från ett öppet formulär, och en tjänst som ännu inte är
           lanserad ska inte kunna hamna på ett uppdrag den vägen —
           databasen skriver om sådana anmälningar till
           standardtjänsten, och det här är samma regel i vyn. */
        const öppen = (S.tjanster || []).some(t =>
          t.kod === lead.tjanst && t.aktiv && t.for_kund);
        if (ny && ny.uppdrag_id && lead.tjanst && öppen) {
          const u = await supa.from('uppdrag').update({ tjanst: lead.tjanst }).eq('id', ny.uppdrag_id);
          if (u.error) { säg(msg, 'Eleven skapades, men uppdragets tjänst kunde inte sättas: '
            + felText(u.error), false); }
        }

        /* Anmälan är avklarad när den blivit en elev. Står den kvar
           som "ny" ligger den i arbetskön för alltid.

           Samtidigt skrivs kopplingen: vilken familj och vilket
           uppdrag anmälan blev. Det är den enda tidpunkt någon
           faktiskt VET det — efteråt går det bara att gissa på
           e-postadress och tidsordning, och gissningen blir fel
           precis när den spelar roll. */
        await supa.from('leads').update({
          status: 'matched',
          kund_id: parent,
          uppdrag_id: (ny && ny.uppdrag_id) || null
        }).eq('id', lead.id);
        lead.status = 'matched';
        lead.kund_id = parent;
        if (ny) lead.uppdrag_id = ny.uppdrag_id || null;

        /* Anmälan flyttas till familjen (2026-10-21): källan, koden och
           meddelandet följer med, och raden försvinner ur listan. Sist,
           när eleven finns: gick något fel före står anmälan kvar, och
           Skapa elev går att trycka igen. Saknas funktionen (migrationen
           anmalan_flyttas_till_familjen är inte körd) står den kvar som
           intagen, som förut. */
        flyttad = await flyttaAnmälan(lead.id, parent);

        await hämtaAllt();
        ritaLeads();
        ritaElever();
        await hämtaMatchunderlag();
        if (ny && ny.id) S.valdElev = ny.id;
        ritaMatchning();
        await ritaÖversikt();

        /* KVITTOT, INTE ETT HOPP

           Förut stängdes rutan och vyn bytte till matchningen i samma
           ögonblick. Två saker hände samtidigt och ingen av dem
           förklarades: rutan försvann och sidan såg annorlunda ut.
           Den som klickat "Skapa elev" fick aldrig veta OM eleven
           skapades — bara att något hände — och gick tillbaka till
           anmälningslistan för att kontrollera.

           Nu står det i rutan vad som gjordes och var eleven finns.
           Vidare till matchningen är ett val, inte en följd. */
        ruta.querySelector('.nx-fraga-box').innerHTML =
          '<h3>' + (inbjuden ? 'Familjen är intagen' : esc(namn) + ' är skapad') + '</h3>'
          + (inbjuden
            ? '<p>' + esc(lead.parent_name || 'Familjen') + ' har fått ett mejl till <b>' + esc(lead.email)
              + '</b> med en länk där de väljer sitt lösenord. Efter lösenordet går de igenom introduktionen, '
              + 'och tills du valt studiehjälpare ser de att ni matchar dem.</p>'
            : '')
          + (gratisVal && typeof gratisVal === 'object'
            ? '<p style="margin-top:10px">' + esc(gratisText(gratisVal)) + '</p>'
            : gratisVal
              ? '<p style="margin-top:10px;color:var(--acc-text)">Gratistimmarna kunde inte sättas in (' + esc(gratisVal)
                + '). Sätt in dem i familjens panel, under Ekonomi.</p>'
              : '')
          + (typeof rabattVal === 'string'
            ? '<p style="margin-top:10px">' + esc('Familjerabatten ' + rabattVal + ' gäller familjen. Bara ni ser koden.') + '</p>'
            : rabattVal
              ? '<p style="margin-top:10px;color:var(--acc-text)">Familjerabatten kunde inte sättas (' + esc(rabattVal.fel)
                + '). Ge den i familjens panel, under Ekonomi.</p>'
              : '')
          + '<p' + (inbjuden ? ' style="margin-top:10px"' : '') + '><b>' + esc(namn) + '</b> ligger nu under <b>Elever</b> och i matchningskön. '
          + 'Anmälan från ' + esc(lead.parent_name || lead.email || 'familjen')
          + (flyttad === true
            ? ' är flyttad till familjen: källan och det de skrev står i familjens panel, och anmälan står inte längre i listan.</p>'
            : flyttad
              ? ' är intagen men kunde inte flyttas (' + esc(flyttad) + '). Tryck Flytta till familjen på anmälan.</p>'
              : ' är markerad som intagen.</p>')
          + (konSaknas
            ? '<p style="margin-top:10px;color:var(--acc-text)">Könet sparades inte: migrationen kon_i_matchningen är '
              + 'inte körd.</p>'
            : '')
          + '<div class="nx-fraga-knappar">'
          + '<button type="button" class="btn btn-ghost" data-le-stang>Stäng</button>'
          + '<button type="button" class="btn btn-primary" data-le-match>Välj studiehjälpare</button>'
          + '</div>';
      });

      /* medan() ställer tillbaka knappens text och läge när den är klar.
         Gick inbjudan men inte eleven heter knappen nu Skapa elev, och
         utan familjen går den inte att trycka (då hade den bjudit in en
         gång till). Efter kvittot finns ingen knapp. */
      const kvar = $('#le-skapa', ruta);
      if (kvar && inbjuden) {
        kvar.textContent = 'Skapa elev';
        kvar.disabled = !familj;
      }
    });
  });

  /* ============ publicering på startsidan ============
     Frågan bekräftas när den slås PÅ, inte när den slås av. Att
     publicera en ung persons förnamn, ålder och text på en
     marknadssida är ett beslut med en annan tyngd än att ta bort
     den igen. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-sh-publik]');
    if (!knapp) return;

    const id = knapp.dataset.shPublik;
    const t = S.tutorProfiler[id];
    if (!t) return;

    if (!t.visa_publikt) {
      const ja = await bekräfta({
        titel: 'Visa ' + namnFör(id) + ' på startsidan?',
        text: 'Förnamn, ålder, ort, ämnen och den personliga texten blir synliga för alla '
          + 'besökare på nextrum.se. E-post, telefon och skola visas aldrig. '
          + 'Fråga personen först — särskilt om hen är under arton.',
        knapp: 'Visa på startsidan'
      });
      if (!ja) return;
    }

    await medan(knapp, '…', async () => {
      const { error } = await supa.from('tutor_profiles')
        .update({ visa_publikt: !t.visa_publikt }).eq('id', id);
      if (error) { alert('Kunde inte ändra: ' + felText(error)); return; }
      t.visa_publikt = !t.visa_publikt;
      ritaStudiehjalpare();
    });
  });


  /* Det andra områden anropar. källText, källTitel och anmälansFamilj
     läser anmälans panel. */
  Object.assign(NXAdmin.rita, {
    anmälansFamilj, källText, källTitel, ritaElever, ritaFamiljer, ritaKoder, ritaLeads, ritaStudiehjalpare
  });
})();
