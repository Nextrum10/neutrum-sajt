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

  const { S, kortDatum, matchar, namnFör, pill, rad, tabell, tomtText } = NXAdmin;

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
      { namn: '', höger: true, rita: m => m.hanterad_at
        ? pill('Hanterad ' + kortDatum(m.hanterad_at), 'ar-klar')
        : '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(m.email)
          + '" data-mailtext="keep" style="margin-right:7px">Svara</a>'
          + '<button class="btn btn-primary btn-sm" data-hanterad="' + m.id + '">Klart</button>' }
    ], rader, bara ? 'Inget ohanterat kvar' : tomtText(sök, 'Ingen fråga matchar filtret', 'Inga frågor än'));
  }

  function ritaChattar() {
    $('#chatt-lista').innerHTML = !S.chattar.length
      ? tomt('Inga chattar än', 'Trådarna dyker upp när en matchad familj skriver.')
      : S.chattar.slice(0, 40).map(m => rad(
        namnFör(m.parent_id) + ' ↔ ' + namnFör(m.tutor_id),
        (m.sender_id === m.parent_id ? 'Familjen: ' : 'Studiehjälparen: ') + m.body.slice(0, 120),
        kortDatum(m.created_at))).join('');
  }


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaChattar, ritaKontakt
  });
})();
