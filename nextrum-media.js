/* ============================================================
   NEXTRUM — bilder och filer
   Profilbilder, beskärning, materialfiler och de signerade
   länkarna som krävs för att hinkarna ska kunna vara privata.

   Kräver nextrum-app.js (NX) och den globala supa-klienten.
   Hinkarna och deras regler ligger i schema-v6.sql.
   ============================================================ */
window.NXMedia = (function () {
  'use strict';

  var esc = NX.esc;

  var MAX_AVATAR = 5 * 1024 * 1024;      // 5 MB
  var MAX_FIL = 10 * 1024 * 1024;        // 10 MB
  var AVATAR_PX = 512;

  var FILTYPER = {
    'application/pdf': 'PDF',
    'image/jpeg': 'Bild', 'image/png': 'Bild', 'image/webp': 'Bild', 'image/heic': 'Bild',
    'application/msword': 'Word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'text/plain': 'Text'
  };

  function filstorlek(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' kB';
    return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB';
  }

  /* ============================================================
     SIGNERADE LÄNKAR
     Hinkarna är privata, så varje fil behöver en egen tidsbegränsad
     adress. De cachas medan sidan är öppen — annars signeras samma
     avatar om och om igen för varje lista den syns i.
     ============================================================ */
  var cache = new Map();

  async function signera(hink, sökväg, sekunder) {
    if (!sökväg || !supa) return null;
    var nyckel = hink + '/' + sökväg;
    var nu = Date.now();
    var träff = cache.get(nyckel);
    if (träff && träff.giltigTill > nu) return träff.url;

    var sek = sekunder || 3600;
    var res = await supa.storage.from(hink).createSignedUrl(sökväg, sek);
    if (res.error || !res.data) return null;

    cache.set(nyckel, { url: res.data.signedUrl, giltigTill: nu + (sek - 60) * 1000 });
    return res.data.signedUrl;
  }

  function glömSignerad(hink, sökväg) { cache.delete(hink + '/' + sökväg); }

  /* ============================================================
     PROFILBILDEN
     Utan bild visas initialerna. Aldrig en tom cirkel — den ser ut
     som att något gått sönder.
     ============================================================ */
  function initialer(namn) {
    var delar = String(namn || '').trim().split(/\s+/).filter(Boolean);
    if (!delar.length) return '?';
    if (delar.length === 1) return delar[0][0].toUpperCase();
    return (delar[0][0] + delar[delar.length - 1][0]).toUpperCase();
  }

  /* Returnerar markup direkt. url får vara null — då initialer. */
  function avatar(namn, url, opts) {
    var o = opts || {};
    var klass = 'nx-avatar' + (o.stor ? ' stor' : '') + (o.liten ? ' liten' : '');
    if (url) {
      return '<span class="' + klass + '"><img src="' + esc(url) + '" alt="' + esc(namn || '') + '" loading="lazy"></span>';
    }
    return '<span class="' + klass + '" aria-hidden="true">' + esc(initialer(namn)) + '</span>';
  }

  /* Hämtar och signerar flera profilbilder på en gång. Returnerar
     en karta från användar-id till färdig adress. */
  async function avatarKarta(idn) {
    var ut = {};
    var unika = Array.from(new Set((idn || []).filter(Boolean)));
    if (!unika.length || !supa) return ut;

    var res = await supa.from('profiles').select('id, avatar_url').in('id', unika);
    if (res.error) return ut;

    await Promise.all((res.data || []).map(async function (p) {
      if (!p.avatar_url) return;
      var url = await signera('avatarer', p.avatar_url);
      if (url) ut[p.id] = url;
    }));
    return ut;
  }

  /* ============================================================
     VÄLJ OCH BESKÄR
     Ingen färdig beskärare — en canvas, dra för att flytta, dra i
     reglaget för att zooma. Det som syns i rutan är exakt det som
     sparas, så ingen behöver gissa hur bilden hamnar.
     ============================================================ */
  function granska(fil) {
    if (!fil) return 'Ingen fil vald.';
    if (!/^image\/(jpeg|png|webp)$/.test(fil.type)) {
      return 'Bilden måste vara JPG, PNG eller WEBP.';
    }
    if (fil.size > MAX_AVATAR) {
      return 'Bilden är för stor (' + filstorlek(fil.size) + '). Välj en bild under 5 MB.';
    }
    return null;
  }

  function beskär(fil) {
    return new Promise(function (klar) {
      var fel = granska(fil);
      if (fel) { alert(fel); return klar(null); }

      var url = URL.createObjectURL(fil);
      var bild = new Image();

      bild.onerror = function () {
        URL.revokeObjectURL(url);
        alert('Bilden kunde inte läsas. Prova en annan fil.');
        klar(null);
      };

      bild.onload = function () {
        var RUTA = 320;
        var ruta = document.createElement('div');
        ruta.className = 'nx-fraga';
        ruta.innerHTML =
          '<div class="nx-fraga-box nx-bildbox" role="dialog" aria-modal="true" aria-labelledby="besk-t">'
          + '<h3 id="besk-t">Beskär bilden</h3>'
          + '<p>Dra för att flytta, använd reglaget för att zooma.</p>'
          + '<div class="nx-besk"><canvas width="' + RUTA + '" height="' + RUTA + '"></canvas></div>'
          + '<label class="nx-besk-zoom"><span>Zoom</span>'
          + '<input type="range" min="100" max="300" value="100" aria-label="Zooma bilden"></label>'
          + '<div class="nx-fraga-knappar">'
          + '<button type="button" class="btn btn-ghost" data-besk="nej">Avbryt</button>'
          + '<button type="button" class="btn btn-primary" data-besk="ja">Använd bilden</button>'
          + '</div></div>';

        var canvas = ruta.querySelector('canvas');
        var ctx = canvas.getContext('2d');
        var reglage = ruta.querySelector('input[type=range]');

        /* Utgångsläget: bilden täcker rutan precis, centrerad. */
        var bas = Math.max(RUTA / bild.width, RUTA / bild.height);
        var läge = { zoom: 1, x: 0, y: 0 };

        function rita() {
            var s = bas * läge.zoom;
            var bredd = bild.width * s, höjd = bild.height * s;
            /* håll bilden innanför rutan — inga vita kanter */
            var maxX = Math.max(0, (bredd - RUTA) / 2);
            var maxY = Math.max(0, (höjd - RUTA) / 2);
            läge.x = Math.max(-maxX, Math.min(maxX, läge.x));
            läge.y = Math.max(-maxY, Math.min(maxY, läge.y));

            ctx.clearRect(0, 0, RUTA, RUTA);
            ctx.drawImage(bild, (RUTA - bredd) / 2 + läge.x, (RUTA - höjd) / 2 + läge.y, bredd, höjd);
        }

        var drar = false, sistX = 0, sistY = 0;
        canvas.addEventListener('pointerdown', function (e) {
          drar = true; sistX = e.clientX; sistY = e.clientY;
          canvas.setPointerCapture(e.pointerId);
        });
        canvas.addEventListener('pointermove', function (e) {
          if (!drar) return;
          läge.x += e.clientX - sistX; läge.y += e.clientY - sistY;
          sistX = e.clientX; sistY = e.clientY;
          rita();
        });
        canvas.addEventListener('pointerup', function () { drar = false; });
        canvas.addEventListener('pointercancel', function () { drar = false; });
        reglage.addEventListener('input', function () {
          läge.zoom = Number(reglage.value) / 100;
          rita();
        });

        function stäng(blob) {
          ruta.remove();
          document.body.style.overflow = '';
          URL.revokeObjectURL(url);
          klar(blob);
        }

        ruta.addEventListener('click', function (e) {
          if (e.target === ruta) return stäng(null);
          var k = e.target.closest('[data-besk]');
          if (!k) return;
          if (k.dataset.besk === 'nej') return stäng(null);

          /* Rita om i full upplösning med exakt samma uträkning, så
             att resultatet är det man såg. */
          var ut = document.createElement('canvas');
          ut.width = ut.height = AVATAR_PX;
          var f = AVATAR_PX / RUTA;
          var uctx = ut.getContext('2d');
          var s = bas * läge.zoom * f;
          var bredd = bild.width * s, höjd = bild.height * s;
          uctx.drawImage(bild,
            (AVATAR_PX - bredd) / 2 + läge.x * f,
            (AVATAR_PX - höjd) / 2 + läge.y * f,
            bredd, höjd);

          ut.toBlob(function (blob) { stäng(blob); }, 'image/webp', 0.9);
        });

        document.addEventListener('keydown', function esc2(e) {
          if (e.key === 'Escape' && document.body.contains(ruta)) {
            document.removeEventListener('keydown', esc2);
            stäng(null);
          }
        });

        document.body.appendChild(ruta);
        document.body.style.overflow = 'hidden';
        void ruta.offsetWidth;
        ruta.classList.add('open');
        rita();
      };

      bild.src = url;
    });
  }

  /* ============================================================
     LADDA UPP
     ============================================================ */
  async function sparaAvatar(userId, blob) {
    var sökväg = userId + '/' + Date.now() + '.webp';

    var upp = await supa.storage.from('avatarer').upload(sökväg, blob, {
      contentType: 'image/webp', upsert: false
    });
    if (upp.error) return { fel: upp.error.message };

    /* Den gamla bilden städas bort efteråt. Går det inte är det inte
       värt att avbryta för — den nya är redan uppe och kopplad. */
    var gammal = await supa.from('profiles').select('avatar_url').eq('id', userId).maybeSingle();
    var res = await supa.from('profiles').update({ avatar_url: sökväg }).eq('id', userId);
    if (res.error) return { fel: res.error.message };

    if (gammal.data && gammal.data.avatar_url) {
      supa.storage.from('avatarer').remove([gammal.data.avatar_url]);
      glömSignerad('avatarer', gammal.data.avatar_url);
    }

    return { sökväg: sökväg, url: await signera('avatarer', sökväg) };
  }

  async function taBortAvatar(userId) {
    var gammal = await supa.from('profiles').select('avatar_url').eq('id', userId).maybeSingle();
    var res = await supa.from('profiles').update({ avatar_url: null }).eq('id', userId);
    if (res.error) return { fel: res.error.message };
    if (gammal.data && gammal.data.avatar_url) {
      await supa.storage.from('avatarer').remove([gammal.data.avatar_url]);
      glömSignerad('avatarer', gammal.data.avatar_url);
    }
    return {};
  }

  /* ---------- materialfiler ---------- */
  function granskaFil(fil) {
    if (!fil) return 'Ingen fil vald.';
    if (fil.size > MAX_FIL) {
      return 'Filen är för stor (' + filstorlek(fil.size) + '). Välj en fil under 10 MB.';
    }
    if (!FILTYPER[fil.type]) {
      return 'Den filtypen går inte att ladda upp. Använd PDF, Word, text eller en bild.';
    }
    return null;
  }

  function filEtikett(mime) { return FILTYPER[mime] || 'Fil'; }

  /* ============================================================
     ÖPPNA EN PRIVAT FIL (2026-09-29)

     Dokumenten under System → Dokument, och sedan samma dag deras
     kopia hos familjen och studiehjälparen (Profil & inställningar →
     Dokument). En knapp, två vägar:

     En PDF eller en bild visas i en ny flik som öppnas I SAMMA TRYCK,
     innan länken finns. Ett fönster som öppnas efter en väntan på
     nätet räknas inte längre som användarens i Safari och stoppas
     tyst: knappen hade sett ut att inte göra någonting, och det är på
     en iPhone familjen öppnar sitt avtal. Samma fälla som CV:t under
     Ansökningar (nextrum-admin-rekrytering.js).

     Allt annat, Word och text, hämtas hit och sparas med sitt namn. I
     en ny flik hade filen laddats ned och lämnat en tom flik efter sig.
     En PDF kan inte gå den vägen: en blob-adress ärver vyns CSP, och
     object-src 'none' stoppar webbläsarens PDF-visare.

     Länken gäller fem minuter. Den står i adressfältet, och den som
     har den öppnar filen utan inloggning så länge den gäller; ett
     avtal kan bära ett personnummer.

     Anropas direkt från klicket, utan await före: window.open måste
     ske innan funktionen väntar på något. Svarar med null när det
     gick, annars med en text att visa.
     ============================================================ */
  var VISAS_I_FLIK = /^(application\/pdf|image\/(jpeg|png|webp))$/;
  var VISAS_I_FLIK_NAMN = /\.(pdf|jpe?g|png|webp)$/i;

  async function öppnaFil(hink, sökväg, o) {
    var opt = o || {};
    if (!sökväg || !supa) return 'Filen finns inte.';
    var namn = opt.namn || String(sökväg).split('/').pop();

    if (VISAS_I_FLIK.test(opt.mimetyp || '') || (!opt.mimetyp && VISAS_I_FLIK_NAMN.test(sökväg))) {
      var flik = window.open('', '_blank');
      if (!flik) return 'Webbläsaren stoppade fliken. Tillåt popupfönster för nextrum.se och tryck igen.';
      flik.opener = null;
      var url = await signera(hink, sökväg, 300);
      if (!url) {
        flik.close();
        return 'Filen gick inte att öppna. Den kan ha tagits bort.';
      }
      flik.location.replace(url);
      return null;
    }

    var svar = await supa.storage.from(hink).download(sökväg);
    if (svar.error || !svar.data) return 'Filen gick inte att hämta. Försök igen om en stund.';
    laddaNed(svar.data, namn);
    return null;
  }

  function laddaNed(data, namn) {
    var blob = URL.createObjectURL(data);
    var länk = document.createElement('a');
    länk.href = blob;
    länk.download = namn;
    document.body.appendChild(länk);
    länk.click();
    länk.remove();
    setTimeout(function () { URL.revokeObjectURL(blob); }, 60000);
  }

  /* Ett avtal som klistrats in som text (avtal_som_text, 2026-10-05)
     sparas som en textfil med avtalets namn. Det är motpartens egen
     kopia, utanför vår inloggning. BOM:en först, så att ett äldre
     Windowsprogram läser å, ä och ö som UTF-8. Ett namn får inte bära
     tecken som Windows inte tillåter i ett filnamn. */
  function sparaText(text, titel) {
    var namn = String(titel || 'Avtal').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim().slice(0, 100) || 'Avtal';
    laddaNed(new Blob(['﻿' + String(text || '')], { type: 'text/plain;charset=utf-8' }), namn + '.txt');
  }

  /* ============================================================
     KONTOBILDEN (Fas 3)

     Här låg fram till Fas 13.3 också materialRad(), laddaMaterial()
     och sparaMaterialfil() — hela listan för tabellen materials,
     delad mellan studievyn och studiehjälparvyn. Båda anroparna är
     borta: föräldravyns materialflik i 13.2, studiehjälparens i 13.3
     när den flyttade till biblioteksmaterial. Koden är därför borta
     och inte bara oanvänd, för en delad hjälpare som ingen anropar
     är en hjälpare nästa person bygger vidare på.

     Hinken `material` och tabellen finns kvar: gamla rader ska gå
     att läsa och städa från adminvyn.
     ============================================================ */

  /* Den stora profilbilden under Profil & inställningar. */
  function kontoAvatar(S) {
    var namn = (S.profil && S.profil.full_name) || S.user.email;
    NX.$('#konto-avatar').innerHTML = avatar(namn, S.minAvatar, { stor: true });
    NX.$('#av-bort').hidden = !S.minAvatar;
  }

  return {
    kontoAvatar: kontoAvatar,
    filstorlek: filstorlek, filEtikett: filEtikett,
    signera: signera, glömSignerad: glömSignerad, öppnaFil: öppnaFil, sparaText: sparaText,
    avatar: avatar, avatarKarta: avatarKarta, initialer: initialer,
    beskär: beskär, granska: granska, granskaFil: granskaFil,
    sparaAvatar: sparaAvatar, taBortAvatar: taBortAvatar
  };
})();
