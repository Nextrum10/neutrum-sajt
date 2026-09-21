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

  const { LEAD_LAGE, S, SH_LAGE, barnFel, punkt, delaÄmnen, elevHjälpare, funktionsFel, hämtaAllt,
          hämtaMatchunderlag, kontaktaRuta, kopplaBarn, kortDatum, läsBarn, matchar,
          mejlHref, namnFör, pill, skapaBarn, tabell, telHref, tomtText, uppräkning,
          väljare, öppnaRuta } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaMatchning = (...a) => NXAdmin.rita.ritaMatchning(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const öppnaDetalj = (...a) => NXAdmin.rita.öppnaDetalj(...a);

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

  /* Hur det står till med familjens barn, räknat ur barnen själva.
     Filtret frågade förut profiles.match_status, som är en härledd
     kopia och betyder "minst ett barn matchat": en familj med ett
     matchat och ett väntande barn hamnade under Matchade, och det
     väntande barnet syntes inte i filtret alls. Ett pausat barn väntar
     inte, och räknas därför varken som väntande eller matchat. */
  function barnläge(p) {
    const barn = S.elever[p.id] || [];
    const matchad = e => !!(e.matched_tutor_id && e.match_status === 'matched');
    return {
      antal: barn.length,
      matchade: barn.filter(matchad).length,
      väntar: barn.filter(e => !matchad(e) && e.match_status !== 'paused').length
    };
  }

  function ritaFamiljer() {
    const sök = $('#fam-sok').value.trim();
    const st = $('#fam-status').value;
    const alla = Object.values(S.personer).filter(p => p.role === 'parent')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const rader = alla
      .filter(p => {
        if (!st) return true;
        const l = barnläge(p);
        if (st === 'vantar') return l.väntar > 0;
        if (st === 'matchade') return l.antal > 0 && l.matchade === l.antal;
        if (st === 'inga') return l.antal === 0;
        return true;
      })
      .filter(p => matchar(p, ['full_name', 'email', 'phone'], sök));

    /* Adressen och numret är länkar, ritade här och inte i sidan:
       NX.initHeader() skriver om varje mailto: som finns när sidan
       laddas till Nextrums egen adress. */
    const kontakt = p => {
      const tel = p.phone ? telHref(p.phone) : null;
      return [
        p.email ? '<a href="' + esc(mejlHref(p.email)) + '">' + esc(p.email) + '</a>' : '',
        p.phone ? (tel ? '<a href="' + esc(tel) + '">' + esc(p.phone) + '</a>' : esc(p.phone)) : ''
      ].filter(Boolean).join(' · ');
    };

    $('#fam-antal').textContent = rader.length + ' av ' + alla.length;
    $('#fam-tabell').innerHTML = tabell([
      { namn: 'Familj', rita: p => '<b>' + esc(p.full_name || '(namn saknas)') + '</b>'
        + '<span class="adm-und">' + kontakt(p) + '</span>' },
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

  /* Inbjuden härifrån, och fortfarande i väntläget. Byggs på
     anteckningen som Lägg till studiehjälpare skriver (INBJUDAN_NOT),
     inte på en gissning. Förut räknades "väntar, ingen ansökan och
     aldrig inloggad" som inbjuden, men last_seen_at skrivs aldrig för
     studiehjälpare, så varje väntande som registrerat sig själv på
     /larare fick pillen, också den som använt sin vy i veckor.
     Pillen säger bara att inbjudan kom härifrån, aldrig att hen
     tackat ja. */
  function ärInbjuden(t) {
    return t.status === 'pending' && S.inbjudna.has(t.id);
  }

  const SAKNAS = text => '<span style="color:var(--bl-3)">' + esc(text) + '</span>';

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

    $('#sh-antal').textContent = rader.length + ' av ' + alla.length;
    $('#sh-tabell').innerHTML = tabell([
      { namn: 'Namn', rita: t => '<b>' + esc(t.namn) + '</b>'
        + (ärInbjuden(t) ? ' ' + pill('Inbjuden', 'ar-vantar') : '')
        + '<span class="adm-und">' + esc(t.epost) + (t.age ? ' · ' + t.age + ' år' : '') + '</span>' },
      /* Ett tomt fält skrivs ut i ord, inte som ett tankstreck:
         ordet säger att uppgiften saknas, strecket kan läsas som noll
         eller som ett tecken som inte laddat. */
      { namn: 'Ort & skola', rita: t => (t.city ? esc(t.city) : SAKNAS('Ingen ort angiven'))
        + (t.school ? '<span class="adm-und">' + esc(t.school) + '</span>' : '') },
      { namn: 'Ämnen', rita: t => (t.subjects || []).length
        ? esc(t.subjects.join(', ')) : SAKNAS('Inga ämnen angivna') },
      /* Två tal i en kolumn. Var två, och tabellen sköt då ut sista
         kolumnen ur rutan på en vanlig skärm. "Elever" och "genomförda
         pass" läses ändå alltid tillsammans.

         Eleverna räknas per elev, som detaljpanelen gör. Förut räknades
         familjer via profiles.matched_tutor_id, som bara pekar på det
         äldsta matchade barnets studiehjälpare: den som hade ett yngre
         syskon fick noll, och listan och panelen visade olika tal för
         samma person. */
      { namn: 'Elever / pass', rita: t => {
        const elever = S.elevlista.filter(e => e.matched_tutor_id === t.id && e.match_status === 'matched').length;
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
        ? SAKNAS('Dold, ej godkänd')
        : '<button class="btn btn-ghost btn-sm" data-sh-publik="' + esc(t.id) + '">'
          + (t.visa_publikt ? 'Syns' : 'Dold') + '</button>' },
      { namn: 'Läge', höger: true, rita: t => väljare('sh', SH_LAGE, t.status, 'data-sh="' + t.id + '"')
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
      + 'ett förslag. Ni bläddrar alltså inte i en katalog. Vi gör matchningen '
      + 'åt er, för fel match är värre än ingen match.\n\n'
      + 'Hälsningar,\nNextrum';
  }

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
      /* Listan ritas om när stämpeln satts, och knappen man kom ifrån
         finns då inte längre. Fokus tillbaka till samma rads knapp. */
      återFokus: () => document.querySelector('[data-lead-kontakt="' + l.id + '"]'),
      /* Svaret läses. Förut stämplades raden i minnet oavsett, och en
         anmälan som aldrig blev stämplad i databasen såg kontaktad ut
         tills någon laddade om sidan. */
      efterat: async () => {
        const nu = new Date().toISOString();
        const { data, error } = await supa.from('leads')
          .update({ kontaktad_at: nu, status: l.status === 'new' ? 'contacted' : l.status })
          .eq('id', l.id).select('id');
        if (error) return felText(error);
        if (!(data || []).length) return 'anmälan hittades inte.';
        l.kontaktad_at = nu;
        if (l.status === 'new') l.status = 'contacted';
        ritaLeads();
        return null;
      }
    });
  });

  /* ============================================================
     FRÅN ANMÄLAN TILL ELEV

     Matchningskön arbetar på rader i `students`. En intresseanmälan
     är en rad i `leads` och blir aldrig en elev av sig själv, så
     tratten tog slut mellan de två: familjen hörde av sig, hamnade
     i en lista, och kunde sedan inte matchas med någon.

     VARFÖR FAMILJEN MÅSTE FINNAS FÖRST

     En elev hänger på ett parent_id, och ett parent_id är en rad i
     profiles, som i sin tur skapas av triggern handle_new_user när
     ett konto skapas. Adminvyn kan alltså inte trolla fram en familj:
     kontot måste finnas.

     Har familjen inget konto kan den bjudas in härifrån (Fas 2.8).
     Triggern körs när kontot SKAPAS, alltså när inbjudan skickas,
     inte när familjen väljer lösenord. bjud-in svarar med kontots id,
     och eleven kan därför skapas direkt i samma ruta. Förut sa rutan
     "öppna rutan igen när de valt lösenord", och ingen elev blev
     skapad förrän familjen råkade göra det.
     ============================================================ */
  function familjeVal(valt, extra) {
    const familjer = Object.values(S.personer)
      .filter(p => p.role === 'parent')
      .sort((a, b) => String(a.full_name || a.email || '')
        .localeCompare(String(b.full_name || b.email || ''), 'sv'));
    /* Ett konto som just bjudits in men ännu inte hunnit komma med i
       hämtningen. Utan det här gick det inte att välja. */
    if (extra && !familjer.some(f => f.id === extra.id)) familjer.unshift(extra);

    return '<select class="sel" id="le-familj">'
      + '<option value="">Välj familj</option>'
      + familjer.map(f => '<option value="' + esc(f.id) + '"'
          + (f.id === valt ? ' selected' : '') + '>'
          + esc(f.full_name || f.email || f.id) + (f.email ? ' · ' + esc(f.email) : '')
          + '</option>').join('')
      + '</select>';
  }

  /* Telefonnumret ur anmälan. leads har ingen egen kolumn för det:
     formuläret lägger "Telefon: …" som en märkt rad sist i message
     (intresseanmalan.html). Den SISTA träffen, eftersom de märkta
     raderna står efter familjens egen text, och den texten kan
     innehålla samma ord. */
  function telefonUrAnmälan(l) {
    const rader = String(l.message || '').match(/^Telefon: *.+$/gm);
    if (!rader) return '';
    return rader[rader.length - 1].replace(/^Telefon: */, '').trim().slice(0, 40);
  }

  /* Sätter telefonnumret på ett konto och läser svaret. .select() för
     att en uppdatering som inte träffar någon rad annars ser ut som en
     som lyckades. Svarar null när det gick, annars vad som gick fel. */
  async function sparaTelefon(id, tel) {
    const { data, error } = await supa.from('profiles').update({ phone: tel }).eq('id', id).select('id');
    if (error) return 'telefonnumret kunde inte sparas: ' + felText(error);
    if (!(data || []).length) return 'telefonnumret kunde inte sparas: kontot hittades inte.';
    return null;
  }

  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-lead-elev]');
    if (!knapp) return;

    const leadId = knapp.dataset.leadElev;
    let lead = S.leads.find(l => l.id === leadId);
    if (!lead) return;

    /* Har familjen redan ett konto med samma adress är det nästan
       säkert deras. Förvalt, inte automatiskt: två familjer kan
       dela en adress, och ett barn på fel förälder är svårt att
       upptäcka i efterhand. */
    const trolig = Object.values(S.personer).find(p =>
      p.role === 'parent' && p.email
      && String(p.email).toLowerCase() === String(lead.email || '').toLowerCase());
    /* Ett konto med adressen som inte är en familj (en studiehjälpare
       eller en admin) kan varken väljas här eller bjudas in: bjud-in
       svarar 409. Då ska rutan säga det, inte erbjuda en knapp som
       bara kan misslyckas. */
    const annatKonto = !trolig && Object.values(S.personer).find(p =>
      p.email && String(p.email).toLowerCase() === String(lead.email || '').toLowerCase());
    const kanBjuda = !trolig && !annatKonto && NX.epostOk(lead.email || '');

    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box nx-fraga-bred" role="dialog" aria-modal="true" aria-labelledby="le-t">'
      + '<h3 id="le-t">Skapa elev ur anmälan</h3>'
      + '<p>Eleven hamnar i matchningskön så fort den finns. '
      + 'Familjen behöver ett konto. Har de inget kan du bjuda in dem härifrån.</p>'
      + '<div class="fgroup" style="margin-top:14px"><label for="le-familj">Familj</label>'
      + '<span id="le-familj-val">' + familjeVal(trolig && trolig.id) + '</span></div>'
      + (annatKonto
        ? '<p class="xsmall" style="margin:0 0 12px;line-height:1.6">Adressen <b>' + esc(lead.email)
          + '</b> hör till ett konto som inte är en familj, så familjen kan inte bjudas in med den. '
          + 'Välj en familj i listan, eller kontakta familjen om en annan adress.</p>'
        : '')
      + (kanBjuda
        ? '<div id="le-bjud-ruta" style="margin:0 0 4px;padding:12px 14px;border:1px dashed var(--line);border-radius:10px">'
          + '<p class="xsmall" style="margin:0 0 10px;line-height:1.6">Inget konto har adressen <b>'
          + esc(lead.email) + '</b>. Bjud in familjen, så får de ett mejl där de väljer lösenord. '
          + 'Kontot finns så fort inbjudan är skickad, så eleven kan skapas här direkt efteråt.</p>'
          + '<div class="fgroup"><label for="le-tel">Telefon, sparas på familjens konto (valfritt)</label>'
          + '<input class="inp" id="le-tel" type="tel" maxlength="40" autocomplete="off" value="'
          + esc(telefonUrAnmälan(lead)) + '"></div>'
          + '<button type="button" class="btn btn-ghost" id="le-bjud">Bjud in familjen</button></div>'
        : '')
      + '<div class="ag-faltrad" style="margin-top:12px">'
      + '<div class="fgroup"><label for="le-namn">Elevens namn</label>'
      + '<input class="inp" id="le-namn" value="' + esc(lead.child_name || '') + '"></div>'
      + '<div class="fgroup"><label for="le-arskurs">Årskurs</label>'
      + '<input class="inp" id="le-arskurs" value="' + esc(lead.grade || '') + '"></div>'
      + '<div class="fgroup"><label for="le-amnen">Ämnen, med komma emellan</label>'
      + '<input class="inp" id="le-amnen" value="' + esc(lead.subject || '') + '"></div>'
      + '</div>'
      + '<p class="ok-msg" id="le-msg" role="status"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-le-stang data-ruta-avbryt>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="le-skapa">Skapa elev</button>'
      + '<button type="button" class="btn btn-primary" id="le-vidare" hidden>Till matchningen</button>'
      + '</div></div>';

    const stäng = öppnaRuta(ruta, {
      återFokus: () => document.querySelector('[data-lead-elev="' + leadId + '"]')
    });
    ruta.addEventListener('click', ev => {
      if (ev.target.closest('[data-le-stang]')) stäng();
    });
    $('#le-vidare', ruta).addEventListener('click', () => {
      stäng();
      location.hash = '#matchning';
    });

    /* Rutan har två handlingar som båda arbetar mot databasen. Den
       ena får inte startas medan den andra pågår: en elev som skapas
       under inbjudan hamnar på den familj som råkar vara vald, inte
       på den som just bjuds in. */
    const upptagen = () => !!ruta.querySelector('[aria-busy="true"]');

    const bjud = $('#le-bjud', ruta);
    if (bjud) bjud.addEventListener('click', async () => {
      const msg = $('#le-msg', ruta);
      if (bjud.disabled || upptagen()) return;
      rensa(msg);
      const ja = await bekräfta({
        titel: 'Bjud in ' + lead.email + '?',
        text: 'Ett riktigt mejl med en inbjudan skickas till ' + lead.email + '. '
          + 'I det väljer familjen sitt lösenord.',
        knapp: 'Skicka inbjudan'
      });
      if (!ja) return;
      bjud.disabled = true;

      /* Allt efter bekräftelsen sker under medan(), inte bara själva
         anropet. Så länge knappen är upptagen går rutan inte att
         stänga (se öppnaRuta), och kopplingen, telefonen och
         omhämtningen hör till samma arbete som inbjudan: stängdes
         rutan mitt i skrevs deras fel i en ruta som inte fanns. */
      await medan(bjud, 'Skickar…', async () => {
        const res = await supa.functions.invoke('bjud-in', {
          body: { epost: lead.email, namn: lead.parent_name || '', roll: 'parent', lead_id: lead.id }
        });
        const fel = res.error || (res.data && res.data.error);
        if (fel) {
          bjud.disabled = false;
          säg(msg, 'Inbjudan skickades inte: ' + await funktionsFel(fel), false);
          return;
        }

        const id = res.data && res.data.id;
        const till = (res.data && res.data.till) || lead.email;
        const problem = [];
        $('#le-bjud-ruta', ruta).hidden = true;

        if (!id) {
          säg(msg, 'Inbjudan skickades till ' + till + ', men svaret saknade kontots id. '
            + 'Ladda om sidan, så finns familjen i listan.', false);
          return;
        }

        /* Kontot som just skapades ÄR kunden anmälan blev. Kopplingen
           skrivs nu, för efteråt finns ingenting som säger vilken
           anmälan kontot kom ifrån, och det är den frågan
           kundtidslinjen ska kunna svara på. bjud-in sätter status och
           kontaktad_at själv, med service_role. */
        const k = await supa.from('leads').update({ kund_id: id }).eq('id', lead.id).select('id');
        if (k.error) problem.push('anmälan kunde inte kopplas till kontot: ' + punkt(felText(k.error)));
        else if (!(k.data || []).length) problem.push('anmälan kunde inte kopplas till kontot: anmälan hittades inte.');

        const tel = ($('#le-tel', ruta).value || '').trim();
        if (tel) {
          const telfel = await sparaTelefon(id, tel);
          if (telfel) problem.push(punkt(telfel));
        }

        /* Hämtas om så att kontot finns i listorna, och i S.leads med
           den status bjud-in satte. Raden i S.leads är ett nytt objekt
           efteråt, så lead pekas om. */
        try {
          await hämtaAllt();
        } catch (e2) {
          problem.push('listorna kunde inte hämtas om: ' + punkt(felText(e2)));
        }
        lead = S.leads.find(l => l.id === leadId) || lead;
        ritaLeads();
        ritaFamiljer();

        $('#le-familj-val', ruta).innerHTML = familjeVal(id, {
          id: id, role: 'parent', full_name: lead.parent_name || '', email: till
        });

        if (problem.length) {
          säg(msg, 'Inbjudan skickades till ' + till + ', men ' + problem.join(' '), false);
        } else {
          säg(msg, 'Inbjudan skickades till ' + till + '. Familjen är vald ovan, '
            + 'så eleven kan skapas nu.', true);
        }
        $('#le-namn', ruta).focus();
      });
    });

    const skapa = $('#le-skapa', ruta);
    skapa.addEventListener('click', async () => {
      const msg = $('#le-msg', ruta);
      if (upptagen()) return;
      rensa(msg);
      const parent = $('#le-familj', ruta).value;
      const namn = $('#le-namn', ruta).value.trim();
      if (!parent) { säg(msg, 'Välj vilken familj eleven hör till.', false); $('#le-familj', ruta).focus(); return; }
      if (!namn) { säg(msg, 'Eleven behöver ett namn.', false); $('#le-namn', ruta).focus(); return; }

      await medan(skapa, 'Skapar…', async () => {
        const { data: ny, error } = await supa.from('students').insert({
          parent_id: parent,
          name: namn,
          grade: $('#le-arskurs', ruta).value.trim() || null,
          subjects: delaÄmnen($('#le-amnen', ruta).value)
        }).select('id, uppdrag_id').single();
        if (error) { säg(msg, 'Kunde inte skapa eleven: ' + felText(error), false); return; }

        /* Från och med nu finns eleven. Allt som går fel efter det här
           är en varning om något som INTE blev gjort, och rutan får
           inte stängas förrän någon läst den. Förut stängdes den
           direkt, och felet om uppdragets tjänst syntes aldrig. */
        const varningar = [];

        /* Uppdraget skapas av triggern elevens_uppdrag, som sätter
           standardtjänsten: den tittar aldrig på anmälan. Anmälan vet
           däremot vad familjen faktiskt bad om, så tjänsten skrivs om
           här. I dag är båda läxhjälp; skillnaden uppstår den dag en
           andra tjänst öppnas.

           Bara en aktiv och kundvänd tjänst skrivs. Anmälan kommer
           från ett öppet formulär, och en tjänst som ännu inte är
           lanserad ska inte kunna hamna på ett uppdrag den vägen.
           Databasen skriver om sådana anmälningar till
           standardtjänsten, och det här är samma regel i vyn. */
        const öppen = (S.tjanster || []).some(t =>
          t.kod === lead.tjanst && t.aktiv && t.for_kund);
        if (ny && ny.uppdrag_id && lead.tjanst && öppen) {
          const u = await supa.from('uppdrag').update({ tjanst: lead.tjanst })
            .eq('id', ny.uppdrag_id).select('id');
          if (u.error) varningar.push('uppdragets tjänst kunde inte sättas: ' + punkt(felText(u.error)));
          else if (!(u.data || []).length) varningar.push('uppdragets tjänst kunde inte sättas: uppdraget hittades inte.');
        }

        /* Anmälan är avklarad när den blivit en elev. Står den kvar
           som "ny" ligger den i arbetskön för alltid.

           Samtidigt skrivs kopplingen: vilken familj och vilket
           uppdrag anmälan blev. Det är den enda tidpunkt någon
           faktiskt VET det. Efteråt går det bara att gissa på
           e-postadress och tidsordning, och gissningen blir fel
           precis när den spelar roll. Svaret läses: förut märktes
           anmälan som klar i minnet också när databasen sagt nej. */
        const lu = await supa.from('leads').update({
          status: 'matched',
          kund_id: parent,
          uppdrag_id: (ny && ny.uppdrag_id) || null
        }).eq('id', lead.id).select('id');
        if (lu.error) {
          varningar.push('anmälan kunde inte markeras som klar: ' + punkt(felText(lu.error)));
        } else if (!(lu.data || []).length) {
          varningar.push('anmälan kunde inte markeras som klar: anmälan hittades inte.');
        } else {
          lead.status = 'matched';
          lead.kund_id = parent;
          if (ny) lead.uppdrag_id = ny.uppdrag_id || null;
        }

        try {
          await hämtaAllt();
        } catch (e2) {
          varningar.push('listorna kunde inte hämtas om: ' + punkt(felText(e2)) + ' Ladda om sidan.');
        }
        ritaLeads();
        ritaFamiljer();
        ritaElever();
        await hämtaMatchunderlag();

        /* Rakt in i matchningen med den nya eleven vald. Att skapa
           en elev och sedan lämna någon på anmälningslistan är att
           be dem leta rätt på namnet de nyss skrev in, och
           matchningen är hela skälet till att eleven skapades. */
        if (ny && ny.id) S.valdElev = ny.id;
        ritaMatchning();
        await ritaÖversikt();

        if (!varningar.length) {
          stäng();
          location.hash = '#matchning';
          return;
        }
        säg(msg, namn + ' är skapad, men ' + varningar.join(' '), false);
        skapa.hidden = true;
        $('#le-vidare', ruta).hidden = false;
        ruta.querySelector('[data-le-stang]').textContent = 'Stäng';
        $('#le-vidare', ruta).focus();
      });
    });
  });

  /* ============================================================
     NY FAMILJ

     En familj som ringt, eller som ni träffat, hade ingen väg in utan
     en intresseanmälan: "Skapa elev" satt på anmälningsraden och
     ingen annanstans. Nu går det från Familjer.

     Ordningen är tvungen. Kontot först, eftersom profilen, och därmed
     parent_id, bara skapas när ett konto skapas. Sedan telefonen på
     profilen, sedan barnen. Varje steg läser sitt svar, och ett steg
     som går fel stoppar inte de andra: inbjudan går inte att ta
     tillbaka, så det rutan måste säga är exakt vad som blev gjort och
     vad som inte blev det.
     ============================================================ */
  function nyFamilj() {
    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box nx-fraga-bred" role="dialog" aria-modal="true" aria-labelledby="nf-t">'
      + '<h3 id="nf-t">Ny familj</h3>'
      + '<p>Familjen får ett konto och ett mejl med en inbjudan, där de väljer lösenord. '
      + 'Kontot finns direkt, så barnen läggs in samtidigt och hamnar i matchningskön.</p>'
      + '<div class="ag-faltrad" style="margin-top:14px">'
      + '<div class="fgroup"><label for="nf-namn">Förälderns namn</label>'
      + '<input class="inp" id="nf-namn" maxlength="120" autocomplete="off"></div>'
      + '<div class="fgroup"><label for="nf-epost">E-post</label>'
      + '<input class="inp" id="nf-epost" type="email" maxlength="200" autocomplete="off"></div>'
      + '<div class="fgroup"><label for="nf-tel">Telefon (valfritt)</label>'
      + '<input class="inp" id="nf-tel" type="tel" maxlength="40" autocomplete="off"></div>'
      + '</div>'
      + '<div id="nf-barn"></div>'
      + '<button type="button" class="btn btn-ghost" data-barn-ny style="margin-top:12px">'
      + 'Lägg till ett barn till</button>'
      + '<p class="ok-msg" id="nf-msg" role="status"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-nf-stang data-ruta-avbryt>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="nf-skapa">Bjud in och spara</button>'
      + '<button type="button" class="btn btn-primary" id="nf-oppna" hidden>Öppna familjen</button>'
      + '</div></div>';

    /* Vad som ska hända när rutan stängs. Sätts först när familjen
       finns: då öppnas dess detaljpanel, också om något steg gick fel,
       för det är där det som saknas läggs till. */
    let efteråt = null;
    kopplaBarn(ruta, $('#nf-barn', ruta));
    const stäng = öppnaRuta(ruta, { vidStängning: () => { if (efteråt) efteråt(); } });

    ruta.addEventListener('click', ev => {
      if (ev.target.closest('[data-nf-stang]')) stäng();
    });
    $('#nf-oppna', ruta).addEventListener('click', () => stäng());

    let skickad = false;
    const skapa = $('#nf-skapa', ruta);
    skapa.addEventListener('click', async () => {
      if (skickad || skapa.getAttribute('aria-busy') === 'true') return;
      const msg = $('#nf-msg', ruta);
      rensa(msg);

      const namn = $('#nf-namn', ruta).value.replace(/\s+/g, ' ').trim();
      const epost = $('#nf-epost', ruta).value.trim().toLowerCase();
      const tel = $('#nf-tel', ruta).value.trim();
      if (!namn) { säg(msg, 'Skriv förälderns namn.', false); $('#nf-namn', ruta).focus(); return; }
      if (!NX.epostOk(epost)) {
        säg(msg, 'Skriv en e-postadress som går att skicka till.', false);
        $('#nf-epost', ruta).focus();
        return;
      }
      /* Samma kontroll som bjud-in gör, men innan mejlet: ett konto
         som redan finns ska användas, inte bjudas in igen. */
      const finns = Object.values(S.personer).find(p => String(p.email || '').toLowerCase() === epost);
      if (finns) {
        säg(msg, finns.role === 'parent'
          ? 'Det finns redan en familj med adressen: ' + (finns.full_name || finns.email)
            + '. Öppna den under Familjer och lägg till barnen där.'
          : 'Det finns redan ett konto med adressen, och det är inte en familj.', false);
        $('#nf-epost', ruta).focus();
        return;
      }
      const lästa = läsBarn($('#nf-barn', ruta));
      if (lästa.fel) { säg(msg, lästa.fel, false); if (lästa.fält) lästa.fält.focus(); return; }
      if (!lästa.barn.length) {
        säg(msg, 'Lägg in minst ett barn. Utan barn finns ingen att matcha.', false);
        const första = ruta.querySelector('[data-barn-falt="namn"]');
        if (första) första.focus();
        return;
      }

      const ja = await bekräfta({
        titel: 'Skicka inbjudan?',
        text: 'Ett riktigt mejl med en inbjudan skickas till ' + epost + '.',
        knapp: 'Skicka inbjudan'
      });
      if (!ja) return;

      await medan(skapa, 'Skickar…', async () => {
        const res = await supa.functions.invoke('bjud-in', {
          body: { epost: epost, namn: namn, roll: 'parent' }
        });
        const fel = res.error || (res.data && res.data.error);
        if (fel) { säg(msg, 'Inbjudan skickades inte: ' + await funktionsFel(fel), false); return; }

        /* Mejlet har gått. Rutan får inte kunna skicka det igen. */
        skickad = true;
        ruta.querySelectorAll('input, select, [data-barn-ny], [data-barn-bort]')
          .forEach(el => { el.disabled = true; });
        const till = (res.data && res.data.till) || epost;
        const id = res.data && res.data.id;

        if (!id) {
          säg(msg, 'Inbjudan skickades till ' + till + ', men svaret saknade kontots id, '
            + 'så varken telefon eller barn kunde sparas. Ladda om sidan och lägg till barnen '
            + 'från familjens panel.', false);
          skapa.hidden = true;
          ruta.querySelector('[data-nf-stang]').textContent = 'Stäng';
          return;
        }

        const problem = [];
        if (tel) {
          const telfel = await sparaTelefon(id, tel);
          if (telfel) problem.push(punkt(telfel));
        }
        const barn = await skapaBarn(id, lästa.barn);
        if (barn.misslyckade.length) problem.push(barnFel(barn));

        try {
          await hämtaAllt();
        } catch (e2) {
          problem.push('listorna kunde inte hämtas om: ' + punkt(felText(e2)) + ' Ladda om sidan.');
        }
        ritaFamiljer();
        ritaElever();
        await hämtaMatchunderlag();
        ritaMatchning();
        await ritaÖversikt();

        efteråt = () => öppnaDetalj('familj', id);
        if (!problem.length) { stäng(); return; }

        const namnen = barn.skapade.map(b => b.namn);
        säg(msg, 'Inbjudan skickades till ' + till
          + (namnen.length
            ? ' och ' + uppräkning(namnen) + (namnen.length === 1 ? ' är inlagd' : ' är inlagda')
            : '')
          + ', men ' + problem.join(' '), false);
        skapa.hidden = true;
        $('#nf-oppna', ruta).hidden = false;
        ruta.querySelector('[data-nf-stang]').textContent = 'Stäng';
        $('#nf-oppna', ruta).focus();
      });
    });
  }

  const nyFamiljKnapp = $('#fam-ny');
  if (nyFamiljKnapp) nyFamiljKnapp.addEventListener('click', nyFamilj);

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
          + 'Fråga personen först, särskilt om hen är under arton.',
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
