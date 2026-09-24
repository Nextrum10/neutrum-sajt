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
          hämtaMatchunderlag, kontaktaRuta, kortDatum, matchar, namnFör,
          pill, tabell, tomtText, visaRuta, väljare } = NXAdmin;
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

  function ritaLeads() {
    const sök = $('#leads-sok').value.trim();
    const st = $('#leads-status').value;
    const rader = S.leads
      .filter(l => !st || l.status === st)
      .filter(l => matchar(l, ['parent_name', 'email', 'child_name', 'subject', 'grade',
                               'message', 'kalla', 'kampanj'], sök));

    $('#leads-antal').textContent = rader.length + ' av ' + S.leads.length;
    $('#leads-tabell').innerHTML = tabell([
      { namn: 'Familj', rita: l => '<b>' + esc(l.parent_name) + '</b>'
        + '<span class="adm-und">' + esc(l.email) + '</span>' },
      { namn: 'Barn', rita: l => esc(l.child_name || '—')
        + (l.grade ? '<span class="adm-und">' + esc(l.grade) + '</span>' : '') },
      { namn: 'Ämne', rita: l => esc(l.subject || '—') },
      { namn: 'Vad de skrev', rita: l => l.message
        ? '<span title="' + esc(l.message) + '">' + esc(l.message.slice(0, 90))
          + (l.message.length > 90 ? '…' : '') + '</span>'
        : '<span style="color:var(--bl-3)">—</span>' },
      { namn: 'Källa', rita: l => källText(l)
        ? '<span title="' + esc(källTitel(l)) + '">' + esc(källText(l)) + '</span>'
        : '<span style="color:var(--bl-3)" title="Anmälan kom in innan källan '
          + 'mättes i egna kolumner. Okänd, inte direkt.">—</span>' },
      { namn: 'Inkom', rita: l => '<span class="adm-tal">' + esc(kortDatum(l.created_at)) + '</span>' },
      { namn: 'Läge', höger: true, rita: l => väljare('lead', LEAD_LAGE, l.status, 'data-lead="' + l.id + '"')
        /* Vägen vidare. En anmälan som inte kan bli en elev fastnar
           här: matchningskön arbetar på elever, inte på anmälningar,
           så utan det här steget når ingen familj någonsin fram. */
        + ' <button class="btn btn-ghost btn-sm" data-lead-kontakt="' + l.id + '">'
        + (l.kontaktad_at ? 'Skriv igen' : 'Kontakta') + '</button>'
        + ' <button class="btn btn-ghost btn-sm" data-lead-elev="' + l.id + '">Skapa elev</button>' }
    ], rader, tomtText(sök || st, 'Ingen intresseanmälan matchar filtret', 'Inga intresseanmälningar än'));
  }

  /* ============================================================
     FAMILJER

     Ingen matchning här längre. Den flyttade till sin egen
     sektion när den blev en elevfråga — se kommentaren vid
     kolumnen Studiehjälpare nedan.
     ============================================================ */

  function ritaFamiljer() {
    const sök = $('#fam-sok').value.trim();
    const st = $('#fam-status').value;
    const alla = Object.values(S.personer).filter(p => p.role === 'parent')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const rader = alla
      .filter(p => !st || (st === 'matched' ? p.match_status === 'matched' : p.match_status !== 'matched'))
      .filter(p => matchar(p, ['full_name', 'email', 'phone'], sök));

    $('#fam-antal').textContent = rader.length + ' av ' + alla.length;
    $('#fam-tabell').innerHTML = tabell([
      { namn: 'Familj', rita: p => '<b>' + esc(p.full_name || '(namn saknas)') + '</b>'
        + '<span class="adm-und">' + esc(p.email || '') + (p.phone ? ' · ' + esc(p.phone) : '') + '</span>' },
      { namn: 'Barn', rita: p => {
        const b = S.elever[p.id] || [];
        return b.length
          ? b.map(e => esc(e.name) + (e.grade ? ' <span style="color:var(--bl-3)">(' + esc(e.grade) + ')</span>' : '')).join('<br>')
          : '<span style="color:var(--bl-3)">Inga inlagda</span>';
      } },
      { namn: 'Pass', rita: p => {
        const n = S.bokningar.filter(b => b.parent_id === p.id && b.status === 'completed').length;
        return '<span class="adm-tal">' + n + '</span>';
      } },
      { namn: 'Studiehjälpare', höger: true, rita: p => {
        /* Här satt förr en rullgardin som skrev
           profiles.matched_tutor_id. Den är borttagen med flit.

           Sedan schema-v14 äger ELEVEN sin matchning, och
           profiles-kolumnen skrivs av en trigger som räknar om
           den ur barnen. En rullgardin här hade alltså varit en
           andra väg att skriva samma sak, som inte höll ihop med
           den första: familjen hade fått en studiehjälpare som
           inget av barnen var kopplat till.

           Två skrivvägar till samma sanning är inte en bekvämlighet,
           det är en bugg som väntar. Här står resultatet, och
           knappen leder dit arbetet faktiskt görs. */
        const barn = S.elever[p.id] || [];
        const matchade = barn.filter(e => e.matched_tutor_id && e.match_status === 'matched');
        const namn = [];
        matchade.forEach(e => {
          const t = S.personer[e.matched_tutor_id];
          const n = t ? (t.full_name || t.email) : null;
          if (n && namn.indexOf(n) === -1) namn.push(n);
        });

        let text;
        if (!barn.length) text = '<span style="color:var(--bl-2)">Inga barn inlagda</span>';
        else if (!matchade.length) text = pill('Ingen matchad', 'ar-ny');
        else if (matchade.length < barn.length) {
          text = esc(namn.join(', ')) + '<span class="adm-und">'
            + matchade.length + ' av ' + barn.length + ' barn matchade</span>';
        } else {
          text = esc(namn.join(', '))
            + (namn.length > 1 ? '<span class="adm-und">olika per barn</span>' : '');
        }

        return text
          + '<span style="display:inline-flex;gap:6px;margin-left:10px;vertical-align:middle">'
          + (matchade.length < barn.length
            ? '<a class="btn btn-ghost btn-sm" href="#matchning">Matcha</a>' : '')
          /* Anteckningsknappen är borta. Anteckningarna är en flik i
             detaljpanelen nu, tillsammans med allt annat om samma
             person — två knappar som öppnade två olika paneler om
             samma familj var en uppdelning utan skäl. */
          + '<button class="btn btn-ghost btn-sm" data-dp="familj:' + esc(p.id) + '">Öppna</button>'
          + '</span>';
      } }
    ], rader, tomtText(sök || st, 'Ingen familj matchar filtret', 'Inga familjer registrerade än'));
  }


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

  function nästaPassFör(elevId) {
    const idag = isoFor(new Date());
    return S.bokningar
      .filter(b => b.student_id === elevId && b.wanted_date >= idag && b.status !== 'cancelled')
      .sort((a, b) => (a.wanted_date + (a.wanted_time || ''))
        .localeCompare(b.wanted_date + (b.wanted_time || '')))[0] || null;
  }

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
    $('#elev-tabell').innerHTML = tabell([
      { namn: 'Elev', rita: e => '<b>' + esc(e.name || '(namn saknas)') + '</b>'
        + '<span class="adm-und">' + esc([e.grade, e.school].filter(Boolean).join(' · ') || 'Årskurs saknas') + '</span>' },
      { namn: 'Familj', rita: e => {
        const f = S.personer[e.parent_id];
        if (!f) return '<span style="color:var(--bl-2)">Okänd</span>';
        return esc(f.full_name || f.email || '—')
          + '<span class="adm-und">' + esc(f.email || '') + '</span>';
      } },
      { namn: 'Ämnen', rita: e => (e.subjects && e.subjects.length)
        ? esc(e.subjects.join(', '))
        : '<span style="color:var(--bl-2)">Inga angivna</span>' },
      { namn: 'Studiehjälpare', rita: e => {
        const t = elevHjälpare(e);
        if (t) return esc(t.full_name || t.email || '—');
        /* Ett larm som inte går att trycka på är en påminnelse om
           arbete någon annanstans. Den här tar dig dit. */
        return '<a href="#matchning" data-mt-hoppa="' + esc(e.id) + '">'
          + pill('Matcha', 'ar-ny') + '</a>';
      } },
      { namn: 'Nästa pass', rita: e => {
        const b = nästaPassFör(e.id);
        if (!b) return '<span style="color:var(--bl-2)">—</span>';
        return '<span class="adm-tal">' + esc(kortDatum(b.wanted_date)
          + (b.wanted_time ? ' ' + String(b.wanted_time).slice(0, 5) : '')) + '</span>'
          + '<span class="adm-und">' + esc(b.subject || '') + '</span>';
      } },
      { namn: 'Pass', rita: e => {
        const n = S.bokningar.filter(b => b.student_id === e.id && b.status === 'completed').length;
        return '<span class="adm-tal">' + n + '</span>';
      } },
      { namn: '', höger: true, rita: e =>
        '<button class="btn btn-ghost btn-sm" data-dp="elev:' + esc(e.id) + '">Öppna</button>' }
    ], rader, tomtText(sök || åk || m, 'Ingen elev matchar filtret', 'Inga elever inlagda än'));
  }

  /* Från elevlistan rakt in i matchningen med rätt elev vald.
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

  function ritaStudiehjalpare() {
    const sök = $('#sh-sok').value.trim();
    const st = $('#sh-status').value;
    const alla = Object.values(S.tutorProfiler)
      .map(t => ({ ...t, namn: namnFör(t.id), epost: (S.personer[t.id] || {}).email || '' }))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const rader = alla
      .filter(t => !st || t.status === st)
      .filter(t => matchar({ ...t, amnen: (t.subjects || []).join(' ') },
        ['namn', 'epost', 'city', 'school', 'amnen'], sök));

    ritaPoolsammanfattning(alla);
    $('#sh-antal').textContent = rader.length + ' av ' + alla.length;
    $('#sh-tabell').innerHTML = tabell([
      { namn: 'Namn', rita: t => '<b>' + esc(t.namn) + '</b>'
        + '<span class="adm-und">' + esc(t.epost) + (t.age ? ' · ' + t.age + ' år' : '') + '</span>' },
      { namn: 'Ort & skola', rita: t => esc(t.city || '—')
        + (t.school ? '<span class="adm-und">' + esc(t.school) + '</span>' : '') },
      { namn: 'Ämnen', rita: t => esc((t.subjects || []).join(', ') || '—') },
      /* Två tal i en kolumn. Var två, och tabellen sköt då ut sista
         kolumnen ur rutan på en vanlig skärm — och "elever" och
         "genomförda pass" läses ändå alltid tillsammans. */
      { namn: 'Elever / pass', rita: t => {
        const elever = Object.values(S.personer).filter(p => p.matched_tutor_id === t.id).length;
        const pass = S.bokningar.filter(b => b.tutor_id === t.id && b.status === 'completed').length;
        return '<span class="adm-tal">' + elever + ' / ' + pass + '</span>';
      } },
      { namn: 'Timpenning', rita: t => t.hourly_rate
        ? '<span class="adm-tal">' + esc(NX.kr(t.hourly_rate)) + '</span>'
        : '<span style="color:var(--bl-3)">Ej satt</span>' },
      /* Publicering är ett EGET beslut, inte en följd av att vara
         godkänd — se schema-v23. Kolumnen står bredvid läget just
         för att de två inte ska förväxlas. */
      { namn: 'På startsidan', rita: t => t.status !== 'approved'
        ? '<span style="color:var(--bl-3)">—</span>'
        : '<button class="btn btn-ghost btn-sm" data-sh-publik="' + esc(t.id) + '">'
          + (t.visa_publikt ? 'Syns' : 'Dold') + '</button>' },
      { namn: 'Läge', höger: true, rita: t => väljare('sh', SH_LAGE, t.status, 'data-sh="' + t.id + '"')
        /* Kontakt bara när adressen finns. En knapp som öppnar ett
           mejlutkast utan mottagare ser ut att fungera och gör det
           inte — värre än ingen knapp. */
        + (t.epost
            ? '<button class="btn btn-ghost btn-sm" style="margin-left:6px" data-sh-kontakt="'
              + esc(t.id) + '">Kontakta</button>'
            : '')
        + '<button class="btn btn-ghost btn-sm" style="margin-left:6px" data-dp="studiehjalpare:'
        + esc(t.id) + '">Öppna</button>' }
    ], rader, tomtText(sök || st, 'Ingen studiehjälpare matchar filtret', 'Inga studiehjälpare registrerade än'));
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
     färdig. Kontakten syns i mejlprogrammets skickat-mapp, där den
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

     Har familjen inget konto kan den bjudas in härifrån (Fas 2.8).
     Edge-funktionen bjud-in kör auth.admin.inviteUserByEmail med
     service_role; familjen får ett mejl, väljer lösenord, och då
     finns kontot. Eleven skapas efter det, i samma ruta.
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
      + '<span>Inget konto har adressen ' + esc(lead.email || '—') + ' än. '
      + 'Bjud in familjen, så skapas kontot och eleven kan läggas till direkt.</span>'
      + (NX.epostOk(lead.email || '')
        ? '<button type="button" class="btn btn-ghost btn-sm" id="le-bjud">Bjud in familjen</button>'
        : '<span class="xsmall" style="color:var(--acc-text)">Adressen i anmälan går inte att skicka till. Rätta den först.</span>')
      + '</div>';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-lead-elev]');
    if (!knapp) return;

    const lead = S.leads.find(l => l.id === knapp.dataset.leadElev);
    if (!lead) return;

    let familj = anmälansFamilj(lead);

    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="le-t">'
      + '<h3 id="le-t">Skapa elev ur anmälan</h3>'
      + '<p>Eleven hamnar under Elever och i matchningskön så fort den finns.</p>'
      + '<div id="le-familj-rad">' + familjRad(familj, lead) + '</div>'
      + '<div class="ag-faltrad" style="margin-top:12px">'
      + '<div class="fgroup"><label for="le-namn">Elevens namn</label>'
      + '<input class="inp" id="le-namn" value="' + esc(lead.child_name || '') + '"></div>'
      + '<div class="fgroup"><label for="le-arskurs">Årskurs</label>'
      + '<input class="inp" id="le-arskurs" value="' + esc(lead.grade || '') + '"></div>'
      + '<div class="fgroup"><label for="le-amnen">Ämnen</label>'
      + '<input class="inp" id="le-amnen" value="' + esc(lead.subject || '') + '"></div>'
      + '</div>'
      + '<p class="ok-msg" id="le-msg"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-le-stang>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="le-skapa"' + (familj ? '' : ' disabled') + '>Skapa elev</button>'
      + '</div></div>';

    visaRuta(ruta);
    const stäng = () => { ruta.remove(); document.body.style.overflow = ''; };
    ruta.addEventListener('click', ev => {
      if (ev.target === ruta || ev.target.closest('[data-le-stang]')) { stäng(); return; }
      if (ev.target.closest('[data-le-match]')) { stäng(); location.hash = '#matchning'; }
    });

    /* Delegerat: knappen ritas om när familjen hittats. */
    ruta.addEventListener('click', async ev => {
      const bjud = ev.target.closest('#le-bjud');
      if (!bjud) return;
      const msg = $('#le-msg', ruta);
      rensa(msg);
      const ja = await bekräfta({
        titel: 'Bjud in ' + lead.email + '?',
        text: 'Ett mejl från Nextrum går till adressen, med en länk där familjen väljer lösenord.',
        knapp: 'Skicka inbjudan'
      });
      if (!ja) return;
      const res = await medan(bjud, 'Skickar…', () => supa.functions.invoke('bjud-in', {
        body: { epost: lead.email, namn: lead.parent_name || '', lead_id: lead.id }
      }));
      const fel = res.error || (res.data && res.data.error);
      if (fel) { säg(msg, await funktionsFel(fel), false); return; }
      if (lead.status === 'new') lead.status = 'contacted';

      /* Kontot som just skapades ÄR kunden anmälan blev. Kopplingen
         skrivs nu, för när familjen väl valt lösenord finns det
         ingenting som säger vilken anmälan de kom ifrån — och det är
         den frågan kundtidslinjen ska kunna svara på. bjud-in sätter
         status och kontaktad_at själv, med service_role. */
      if (res.data.id) {
        const k = await supa.from('leads').update({ kund_id: res.data.id }).eq('id', lead.id);
        if (!k.error) lead.kund_id = res.data.id;
      }

      /* HÄMTA OM, OCH BYGG OM RULLGARDINEN.

         Familjens profilrad finns REDAN när inbjudan gått iväg:
         triggern handle_new_user är AFTER INSERT on auth.users, inte
         "efter att lösenordet valts". Förut sa rutan åt admin att
         vänta på något som redan hänt, och eftersom S.personer inte
         hämtades om stod familjen ändå inte i rullgardinen — så den
         som följde instruktionen och öppnade rutan igen såg samma
         tomma lista. Det var därför Skapa elev såg trasig ut.

         hämtaAllt() fyller bara S, den ritar ingenting, så rutan
         överlever anropet. */
      await hämtaAllt();
      familj = (res.data.id && S.personer[res.data.id]) || anmälansFamilj(lead);
      $('#le-familj-rad', ruta).innerHTML = familjRad(familj, lead);
      $('#le-skapa', ruta).disabled = !familj;

      säg(msg, '✓ Inbjudan skickad till ' + res.data.till
        + '. Du kan skapa eleven nu — lösenordet väljer familjen själv via mejlet.', true);
      ritaLeads();
    });

    $('#le-skapa', ruta).addEventListener('click', async () => {
      const msg = $('#le-msg', ruta);
      rensa(msg);
      const parent = familj && familj.id;
      const namn = $('#le-namn', ruta).value.trim();
      if (!parent) { säg(msg, 'Familjen har inget konto än. Bjud in dem först.', false); return; }
      if (!namn) { säg(msg, 'Eleven behöver ett namn.', false); return; }

      await medan($('#le-skapa', ruta), 'Skapar…', async () => {
        /* Ämnena är en text[] som inte får vara null (förvalet är en
           tom array). Fritexten ur anmälan delas på komma, tomma bitar
           bort — samma regel som när en ansökan tas in i poolen. Förut
           skickades strängen rakt av, och då svarade databasen 22P02
           på "matte, svenska" och 23502 på ett tomt fält: knappen
           "Skapa elev" hade aldrig kunnat fungera. */
        const ämnen = String($('#le-amnen', ruta).value || '')
          .split(',').map(x => x.trim()).filter(Boolean);

        const { data: ny, error } = await supa.from('students').insert({
          parent_id: parent,
          name: namn,
          grade: $('#le-arskurs', ruta).value.trim() || null,
          subjects: ämnen
        }).select('id, uppdrag_id').single();
        if (error) { säg(msg, 'Kunde inte skapa: ' + felText(error), false); return; }

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
          '<h3>' + esc(namn) + ' är skapad</h3>'
          + '<p><b>' + esc(namn) + '</b> ligger nu under <b>Elever</b> och i matchningskön. '
          + 'Anmälan från ' + esc(lead.parent_name || lead.email || 'familjen')
          + ' är markerad som klar.</p>'
          + '<div class="nx-fraga-knappar">'
          + '<button type="button" class="btn btn-ghost" data-le-stang>Stäng</button>'
          + '<button type="button" class="btn btn-primary" data-le-match>Välj studiehjälpare</button>'
          + '</div>';
      });
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


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaElever, ritaFamiljer, ritaLeads, ritaStudiehjalpare
  });
})();
