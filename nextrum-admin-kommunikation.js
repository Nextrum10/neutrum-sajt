/* ============================================================
   NEXTRUM — adminvyn, Kommunikation: inkorgen och chattarna

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

  const { S, kortDatum, matchar, namnFör, pill, tabell, tomtText } = NXAdmin;

  /* ============================================================
     FRÅGOR
     Heter så i vyn sedan omdöpningen. Tabellen är fortfarande
     contact_messages och sektionens id fortfarande "meddelanden" —
     bara det användaren läser bytte namn.
     ============================================================ */

  function ritaKontakt() {
    const sök = $('#msg-sok').value.trim();
    const bara = $('#msg-ohanterade').checked;
    const rader = S.kontakt
      .filter(m => !bara || !m.hanterad_at)
      .filter(m => matchar(m, ['name', 'email', 'role', 'message'], sök));

    $('#msg-antal').textContent = rader.length + ' av ' + S.kontakt.length;
    $('#msg-tabell').innerHTML = tabell([
      { namn: 'Från', rita: m => '<b>' + esc(m.name) + '</b>'
        + '<span class="adm-und">' + esc(m.email) + (m.role ? ' · ' + esc(m.role) : '') + '</span>' },
      { namn: 'Frågan', rita: m => esc(m.message) },
      { namn: 'Inkom', rita: m => '<span class="adm-tal">' + esc(kortDatum(m.created_at)) + '</span>' },
      { namn: '', höger: true, rita: m => (m.hanterad_at
        ? pill('Hanterad ' + kortDatum(m.hanterad_at), 'ar-klar')
        : '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(m.email)
          + '" data-mailtext="keep" style="margin-right:7px">Svara</a>'
          + '<button class="btn btn-primary btn-sm" data-hanterad="' + m.id + '">Klart</button>')
        /* 2026-09-28: en fråga bär ett namn, en adress och fritext, och
           tas bort ur våra system på samma väg som en person
           (nextrum-admin-radera.js). Rutan säger vad som följer med. */
        + '<button class="btn btn-ghost btn-sm" type="button" style="margin-left:7px" data-radera="kontakt:'
        + esc(m.id) + '">Ta bort</button>' }
    ], rader, bara ? 'Inget ohanterat kvar' : tomtText(sök, 'Ingen fråga matchar filtret', 'Inga frågor än'));
  }

  /* En rad per tråd, den senaste raden. Öppna chatt (2026-09-29) visar
     hela tråden i panelen, genom chatt_las(), som skriver öppningen i
     auditloggen och inte rör read_at: familjen och studiehjälparen ser
     inte att vi läser (nextrum-admin-detalj.js, CHATTEN). */
  function ritaChattar() {
    $('#chatt-lista').innerHTML = !S.chattar.length
      ? tomt('Inga chattar än', 'Trådarna dyker upp när en matchad familj skriver.')
      : S.chattar.slice(0, 40).map(m => '<div class="mat" style="grid-template-columns:minmax(0,1fr) auto">'
        + '<span class="mat-vad"><b>' + esc(namnFör(m.parent_id) + ' ↔ ' + namnFör(m.tutor_id)) + '</b>'
        + '<span>' + esc((m.sender_id === m.parent_id ? 'Familjen: ' : 'Studiehjälparen: ')
          + m.body.slice(0, 120)) + '</span></span>'
        + '<span class="mat-atg" style="align-items:center">'
        + '<span class="xsmall" style="color:var(--bl-3);white-space:nowrap">' + esc(kortDatum(m.created_at)) + '</span>'
        + '<button class="btn btn-ghost btn-sm" type="button" data-dp="chatt:'
        + esc(m.parent_id + '|' + m.tutor_id) + '">Öppna chatt</button></span>'
        + '</div>').join('');
  }


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaChattar, ritaKontakt
  });
})();
