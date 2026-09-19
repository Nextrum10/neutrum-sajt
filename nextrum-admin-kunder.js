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
          pill, tabell, tomtText, väljare } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaMatchning = (...a) => NXAdmin.rita.ritaMatchning(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);

  /* ============================================================
     INTRESSEANMÄLNINGAR
     ============================================================ */

  function ritaLeads() {
    const sök = $('#leads-sok').value.trim();
    const st = $('#leads-status').value;
    const rader = S.leads
      .filter(l => !st || l.status === st)
      .filter(l => matchar(l, ['parent_name', 'email', 'child_name', 'subject', 'grade', 'message'], sök));

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
  function familjeVal(valt) {
    const familjer = Object.values(S.personer)
      .filter(p => p.role === 'parent')
      .sort((a, b) => String(a.full_name || a.email || '')
        .localeCompare(String(b.full_name || b.email || ''), 'sv'));

    return '<select class="inp" id="le-familj">'
      + '<option value="">Välj familj…</option>'
      + familjer.map(f => '<option value="' + esc(f.id) + '"'
          + (f.id === valt ? ' selected' : '') + '>'
          + esc(f.full_name || f.email || f.id) + (f.email ? ' · ' + esc(f.email) : '')
          + '</option>').join('')
      + '</select>';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-lead-elev]');
    if (!knapp) return;

    const lead = S.leads.find(l => l.id === knapp.dataset.leadElev);
    if (!lead) return;

    /* Har familjen redan ett konto med samma adress är det nästan
       säkert deras. Förvalt, inte automatiskt — två familjer kan
       dela en adress, och ett barn på fel förälder är svårt att
       upptäcka i efterhand. */
    const trolig = Object.values(S.personer).find(p =>
      p.role === 'parent' && p.email
      && String(p.email).toLowerCase() === String(lead.email || '').toLowerCase());

    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="le-t">'
      + '<h3 id="le-t">Skapa elev ur anmälan</h3>'
      + '<p>Eleven hamnar i matchningskön så fort den finns. '
      + 'Familjen måste ha ett konto. Har de inget kan du bjuda in dem härifrån.</p>'
      + '<div class="fgroup"><label for="le-familj">Familj</label>' + familjeVal(trolig && trolig.id) + '</div>'
      + (!trolig && NX.epostOk(lead.email || '')
        ? '<div style="margin:10px 0 4px;padding:12px 14px;border:1px dashed var(--line);border-radius:10px">'
          + '<p class="xsmall" style="margin:0 0 8px;line-height:1.6">Inget konto har adressen <b>'
          + esc(lead.email) + '</b>. Bjud in familjen, så får de ett mejl där de väljer lösenord. '
          + 'När de gjort det finns kontot i listan ovan.</p>'
          + '<button type="button" class="btn btn-ghost btn-sm" id="le-bjud">Bjud in familjen</button></div>'
        : '')
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
      + '<button type="button" class="btn btn-primary" id="le-skapa">Skapa elev</button>'
      + '</div></div>';

    document.body.appendChild(ruta);
    document.body.style.overflow = 'hidden';
    const stäng = () => { ruta.remove(); document.body.style.overflow = ''; };
    ruta.addEventListener('click', ev => {
      if (ev.target === ruta || ev.target.closest('[data-le-stang]')) stäng();
    });

    const bjud = $('#le-bjud', ruta);
    if (bjud) bjud.addEventListener('click', async () => {
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
      bjud.disabled = true;
      säg(msg, '✓ Inbjudan skickad till ' + res.data.till + '. När familjen valt lösenord '
        + 'finns kontot i listan — öppna rutan igen då.', true);
      ritaLeads();
    });

    $('#le-skapa', ruta).addEventListener('click', async () => {
      const msg = $('#le-msg', ruta);
      rensa(msg);
      const parent = $('#le-familj', ruta).value;
      const namn = $('#le-namn', ruta).value.trim();
      if (!parent) { säg(msg, 'Välj vilken familj eleven hör till.', false); return; }
      if (!namn) { säg(msg, 'Eleven behöver ett namn.', false); return; }

      await medan($('#le-skapa', ruta), 'Skapar…', async () => {
        const { data: ny, error } = await supa.from('students').insert({
          parent_id: parent,
          name: namn,
          grade: $('#le-arskurs', ruta).value.trim() || null,
          subjects: $('#le-amnen', ruta).value.trim() || null
        }).select('id').single();
        if (error) { säg(msg, 'Kunde inte skapa: ' + felText(error), false); return; }

        /* Anmälan är avklarad när den blivit en elev. Står den kvar
           som "ny" ligger den i arbetskön för alltid. */
        await supa.from('leads').update({ status: 'matched' }).eq('id', lead.id);
        lead.status = 'matched';

        stäng();
        await hämtaAllt();
        ritaLeads();
        ritaElever();
        await hämtaMatchunderlag();

        /* Rakt in i matchningen med den nya eleven vald. Att skapa
           en elev och sedan lämna någon på anmälningslistan är att
           be dem leta rätt på namnet de nyss skrev in — och
           matchningen är hela skälet till att eleven skapades. */
        if (ny && ny.id) S.valdElev = ny.id;
        ritaMatchning();
        await ritaÖversikt();
        location.hash = '#matchning';
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
