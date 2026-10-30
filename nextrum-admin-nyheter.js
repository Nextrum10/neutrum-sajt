/* ============================================================
   NEXTRUM — adminvyn, Nyheter (2026-10-30)

   Leo: "bygg en sida för nyhetsbrev, nyheter och när vi postar de får
   medlemmar automatiskt mejl om de nyheterna".

   Här skrivs nyheterna som står på /nyheter. En nyhet är ett utkast tills
   den publiceras, med eller utan mejl till nyhetsbrevet; rutan före
   säger till hur många. Mejlet skickar databasen och edge-funktionen
   nyheter-utskick, inte vyn: vyn ser bara hur långt det kommit
   (mejl_antal) och om något gavs upp.

   Bara en superadmin (nyheter_admin och nyhet_* släpper bara fram
   is_admin()). Ingen nyhet tas bort: den döljs. En publicerad nyhet går
   att rätta, men ett mejl som gått ut är ute, och rutan säger det.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, felText } = NX;
  const { bekräfta, medan, tomt } = NXStudie;
  const { kortDatum, pill, ärSuperadmin } = NXAdmin;

  const N = { rader: [], antal: null, fel: null, saknas: false, redigerar: null };

  async function hämta() {
    const [r, a] = await Promise.all([supa.rpc('nyheter_admin'), supa.rpc('nyhetsbrev_antal')]);
    const fel = [r, a].find(x => x.error);
    N.saknas = !!(fel && (fel.error.code === 'PGRST202' || fel.error.code === 'PGRST205' || fel.error.code === '42P01'));
    N.fel = fel && !N.saknas ? felText(fel.error) : null;
    N.rader = r.data || [];
    N.antal = a.data || null;
  }

  async function ritaNyheter() {
    if (!ärSuperadmin() || !$('#nyh-admin')) return;
    await hämta();
    rita();
  }

  function rita() {
    const host = $('#nyh-admin');
    if (N.saknas) {
      host.innerHTML = tomt('Nyheterna finns inte i databasen än',
        'Migrationerna nyhetsbrev och nyheter är inte körda. Sidan /nyheter visar då inga nyheter.');
      $('#nyh-antal').textContent = '';
      return;
    }
    if (N.fel) { host.innerHTML = tomt('Kunde inte hämta nyheterna', N.fel); return; }

    const b = N.antal ? N.antal.bekraftade : 0;
    $('#nyh-antal').textContent = b + (b === 1 ? ' bekräftad adress' : ' bekräftade adresser')
      + (N.antal && N.antal.vantar ? ' · ' + N.antal.vantar + ' väntar på att bekräfta' : '');

    host.innerHTML = '<details class="eko-mer prov-ny"' + (N.redigerar === 'ny' ? ' open' : '') + '>'
      + '<summary>Ny nyhet</summary>' + formulär(null) + '</details>'
      + (N.rader.length
        ? '<ol class="prov-lista">' + N.rader.map(rad).join('') + '</ol>'
        : tomt('Inga nyheter än', 'Skriv den första under Ny nyhet. Den är ett utkast tills du publicerar den.'));
  }

  function läge(n) {
    if (!n.publicerad_at) return pill('Utkast', '');
    if (n.dold_at) return pill('Dold', '');
    return pill('Publicerad ' + kortDatum(n.publicerad_at), 'ar-klar');
  }

  function mejlrad(n) {
    if (!n.publicerad_at) return '';
    if (!n.mejlas) return 'Inte mejlad.';
    const upp = n.mejl_uppgivna ? ' ' + n.mejl_uppgivna + ' gick inte att mejla.' : '';
    if (n.mejlad_at) return 'Mejlad till ' + n.mejl_antal + (n.mejl_antal === 1 ? ' adress' : ' adresser')
      + ' ' + kortDatum(n.mejlad_at) + '.' + upp;
    if (n.dold_at) return 'Utskicket stannade när nyheten doldes, efter ' + n.mejl_antal + '.' + upp;
    return 'Mejlas nu: ' + n.mejl_antal + ' hittills.' + upp;
  }

  function rad(n) {
    if (N.redigerar === n.id) return '<li class="prov-fraga">' + formulär(n) + '</li>';
    const länk = n.publicerad_at && !n.dold_at
      ? '<a class="btn btn-ghost btn-sm" href="/nyheter?n=' + encodeURIComponent(n.slug) + '" target="_blank" rel="noopener">Visa</a>'
      : '';
    return '<li class="prov-fraga' + (n.dold_at ? ' ar-av' : '') + '">'
      + '<div class="prov-fraga-topp"><b>' + esc(n.rubrik) + '</b> ' + läge(n) + '</div>'
      + (n.ingress ? '<p class="xsmall" style="margin:6px 0 0;color:var(--bl-2)">' + esc(n.ingress) + '</p>' : '')
      + (mejlrad(n) ? '<p class="xsmall" style="margin:6px 0 0;color:var(--bl-3)">' + esc(mejlrad(n)) + '</p>' : '')
      + '<div class="adm-verktyg" style="margin-top:10px">'
      + '<button type="button" class="btn btn-ghost btn-sm" data-nyh-andra="' + esc(n.id) + '">Ändra</button>'
      + (!n.publicerad_at
        ? '<button type="button" class="btn btn-primary btn-sm" data-nyh-publicera="' + esc(n.id) + '" data-mejla="1">Publicera och mejla</button>'
          + '<button type="button" class="btn btn-ghost btn-sm" data-nyh-publicera="' + esc(n.id) + '">Publicera utan mejl</button>'
        : '')
      + länk
      + '<button type="button" class="btn btn-ghost btn-sm" data-nyh-dolj="' + esc(n.id) + '">'
      + (n.dold_at ? 'Visa igen' : 'Dölj') + '</button>'
      + '</div></li>';
  }

  function formulär(n) {
    const id = n ? n.id : 'ny';
    const fid = 'nyh-f-' + id;
    return '<form class="prov-form" data-nyh-form="' + esc(id) + '" novalidate>'
      + '<div class="fgroup"><label for="' + esc(fid) + '-r">Rubrik</label>'
      + '<input class="inp" id="' + esc(fid) + '-r" name="rubrik" maxlength="140" required value="' + esc(n ? n.rubrik : '') + '"></div>'
      + '<div class="fgroup"><label for="' + esc(fid) + '-i">Ingress <span class="xsmall">(frivillig, en eller två meningar)</span></label>'
      + '<textarea class="inp" id="' + esc(fid) + '-i" name="ingress" rows="2" maxlength="400">' + esc(n && n.ingress ? n.ingress : '') + '</textarea></div>'
      + '<div class="fgroup"><label for="' + esc(fid) + '-t">Text</label>'
      + '<textarea class="inp" id="' + esc(fid) + '-t" name="text" rows="10" maxlength="20000" required>' + esc(n ? n.text : '') + '</textarea>'
      + '<p class="xsmall" style="margin:6px 0 0;color:var(--bl-3)">En tom rad blir ett nytt stycke. En adress som börjar med https:// blir en länk.</p></div>'
      + (n && n.publicerad_at && n.mejlas
        ? '<p class="xsmall" style="color:var(--bl-3)">Ändringen syns på sidan. Mejlet som redan gått ut ändras inte.</p>' : '')
      + '<p class="small" data-nyh-msg role="status"></p>'
      + '<div class="adm-verktyg">'
      + '<button class="btn btn-primary btn-sm" type="submit">' + (n ? 'Spara' : 'Spara utkast') + '</button>'
      + (n ? '<button class="btn btn-ghost btn-sm" type="button" data-nyh-avbryt>Avbryt</button>' : '')
      + '</div></form>';
  }

  document.addEventListener('click', async e => {
    const ändra = e.target.closest('[data-nyh-andra]');
    if (ändra) { N.redigerar = ändra.dataset.nyhAndra; rita(); return; }
    if (e.target.closest('[data-nyh-avbryt]')) { N.redigerar = null; rita(); return; }

    const pub = e.target.closest('[data-nyh-publicera]');
    if (pub) {
      const n = N.rader.find(x => x.id === pub.dataset.nyhPublicera);
      if (!n) return;
      const mejla = pub.dataset.mejla === '1';
      const b = N.antal ? N.antal.bekraftade : 0;
      if (!(await bekräfta(mejla ? {
        titel: 'Publicera och mejla "' + n.rubrik + '"?',
        text: 'Nyheten syns på nextrum.se/nyheter direkt, och mejlas till ' + b + (b === 1 ? ' adress' : ' adresser')
          + ' i nyhetsbrevet inom någon minut. Ett mejl går inte att ta tillbaka.',
        knapp: 'Publicera och mejla', avbryt: 'Avbryt'
      } : {
        titel: 'Publicera "' + n.rubrik + '" utan mejl?',
        text: 'Nyheten syns på nextrum.se/nyheter direkt, men ingen får ett mejl om den, och den går inte att mejla senare.',
        knapp: 'Publicera', avbryt: 'Avbryt'
      }))) return;
      await medan(pub, 'Publicerar…', async () => {
        const { error } = await supa.rpc('nyhet_publicera', { p_id: n.id, p_mejla: mejla });
        if (error) { alert('Kunde inte publicera: ' + felText(error)); return; }
        await ritaNyheter();
      });
      return;
    }

    const dölj = e.target.closest('[data-nyh-dolj]');
    if (dölj) {
      const n = N.rader.find(x => x.id === dölj.dataset.nyhDolj);
      if (!n) return;
      const dold = !n.dold_at;
      if (dold && n.publicerad_at && !(await bekräfta({
        titel: 'Dölja "' + n.rubrik + '"?',
        text: 'Nyheten försvinner från sidan, och länken i mejlet visar att den inte finns. Ett utskick som inte är klart stannar.',
        knapp: 'Dölj', avbryt: 'Avbryt'
      }))) return;
      await medan(dölj, '…', async () => {
        const { error } = await supa.rpc('nyhet_dolj', { p_id: n.id, p_dold: dold });
        if (error) { alert('Kunde inte spara: ' + felText(error)); return; }
        await ritaNyheter();
      });
    }
  });

  document.addEventListener('submit', async e => {
    const form = e.target.closest('form[data-nyh-form]');
    if (!form) return;
    e.preventDefault();
    const msg = form.querySelector('[data-nyh-msg]');
    NX.rensa(msg);
    const id = form.dataset.nyhForm === 'ny' ? null : form.dataset.nyhForm;
    const rubrik = form.rubrik.value.trim();
    const text = form.text.value.trim();
    if (rubrik.length < 3) { NX.säg(msg, 'Skriv en rubrik, minst tre tecken.', false); return; }
    if (!text) { NX.säg(msg, 'Skriv texten.', false); return; }
    await medan(form.querySelector('[type="submit"]'), 'Sparar…', async () => {
      const { error } = await supa.rpc('nyhet_spara', {
        p_id: id, p_rubrik: rubrik, p_ingress: form.ingress.value.trim(), p_text: text });
      if (error) { NX.säg(msg, felText(error), false); return; }
      N.redigerar = null;
      await ritaNyheter();
    });
  });

  Object.assign(NXAdmin.rita, { ritaNyheter });
})();
