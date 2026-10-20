/* ============================================================
   NEXTRUM — utbildningsprovet i studiehjälparvyn (2026-10-21)

   Leo: provet görs vid första inloggningen, innan studiehjälparvyn
   öppnas. Mer än gränsen rätt (50 % som förval) är godkänt, provet görs
   en gång, och den som inte klarar det gör om det efter ett dygn.

   ALLT AVGÖRS I DATABASEN. mitt_utbildningsprov() säger om provet krävs
   nu och lämnar frågorna utan facit; lamna_in_utbildningsprov() rättar
   och svarar bara med poängen och godkänt eller inte. Spärren ligger i
   databasen (intern.provet_sparrar och restriktiva policyer): den som
   inte gjort provet får inga elever, pass eller meddelanden, vad vyn än
   gör. Rutan här är vägen in, inte skyddet.

   Rutan är samma som lösenordets och villkorens (.nx-fraga) och går
   inte att stänga: utan provet finns inget att visa. Logga ut står kvar.
   Svarar databasen inte, eller saknas funktionen (en databas före
   migrationen), visas ingen ruta, som för villkoren.

   Bara studiehjälparvyn laddar filen.
   ============================================================ */
window.NXProvet = (function () {
  'use strict';

  const { esc, säg, rensa, felText } = NX;

  function klockslag(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'long', day: 'numeric',
      month: 'long', hour: '2-digit', minute: '2-digit' });
  }

  function procent(v) {
    const n = Number(v);
    return Number.isFinite(n) ? String(Math.round(n * 100) / 100).replace('.', ',') : '50';
  }

  async function läge(supa) {
    try {
      const svar = await supa.rpc('mitt_utbildningsprov');
      if (svar.error || !svar.data) return null;
      return svar.data;
    } catch (e) { return null; }
  }

  /* Svarar när provet inte krävs, eller är godkänt. Annars står rutan kvar. */
  async function förstGörs(supa) {
    const l = await läge(supa);
    if (!l || !l.kravs) return;
    await ruta(supa, l);
  }

  function ruta(supa, l) {
    return new Promise(klar => {
      const el = document.createElement('div');
      el.className = 'nx-fraga nx-prov';
      el.innerHTML = '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="prov-t"></div>';
      const box = el.querySelector('.nx-fraga-box');

      function tangent(e) {
        if (e.key !== 'Tab') return;
        const kan = box.querySelectorAll('a[href], input, button');
        if (!kan.length) return;
        const f = kan[0], s = kan[kan.length - 1];
        if (e.shiftKey && document.activeElement === f) { e.preventDefault(); s.focus(); }
        else if (!e.shiftKey && document.activeElement === s) { e.preventDefault(); f.focus(); }
      }
      function stäng() {
        el.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', tangent);
        klar(true);
      }
      const utKnapp = '<button type="button" class="btn btn-ghost" data-prov-ut>Logga ut</button>';

      /* Underkänt nyss, eller förra gången: när det går att göra om. */
      function väntar(senaste, från) {
        box.innerHTML = '<h3 id="prov-t">Du kan göra om provet senare</h3>'
          + (senaste
            ? '<p>Förra gången fick du ' + esc(senaste.ratt) + ' av ' + esc(senaste.antal) + ' rätt, och det '
              + 'räcker inte för att bli godkänd.</p>'
            : '')
          + '<p>Du kan göra om provet från ' + esc(klockslag(från)) + '. Läs igenom det vi gick igenom på '
          + 'utbildningen till dess. Undrar du något, hör av dig till oss.</p>'
          + '<div class="nx-fraga-knappar">' + utKnapp + '</div>';
        const k = box.querySelector('[data-prov-ut]');
        if (k) k.focus();
      }

      function godkänt(svar) {
        box.innerHTML = '<h3 id="prov-t">Du klarade provet</h3>'
          + '<p>Du fick ' + esc(svar.ratt) + ' av ' + esc(svar.antal) + ' rätt. Välkommen in i studiehjälparvyn.</p>'
          + '<div class="nx-fraga-knappar"><button type="button" class="btn btn-primary" data-prov-in>Fortsätt</button></div>';
        box.querySelector('[data-prov-in]').focus();
      }

      function provet() {
        const frågor = Array.isArray(l.fragor) ? l.fragor : [];
        box.innerHTML = '<h3 id="prov-t">Utbildningsprovet</h3>'
          + '<p>Innan du kommer in i studiehjälparvyn svarar du på ' + frågor.length + ' frågor om hur arbetet går '
          + 'till. Mer än ' + esc(procent(l.grans_procent)) + ' procent rätt är godkänt. Du gör provet en gång; '
          + 'klarar du det inte kan du göra om det efter ett dygn.</p>'
          + '<form data-prov novalidate>'
          + frågor.map((f, i) => '<fieldset class="nx-prov-fraga">'
            + '<legend><span class="nx-prov-nr">' + (i + 1) + '.</span> ' + esc(f.fraga) + '</legend>'
            + (Array.isArray(f.alternativ) ? f.alternativ : []).map((a, j) =>
              '<label class="nx-prov-alt"><input type="radio" name="prov-' + esc(f.id) + '" value="' + j + '"'
              + ' data-fraga="' + esc(f.id) + '"><span>' + esc(a) + '</span></label>').join('')
            + '</fieldset>').join('')
          + '<p class="ok-msg" id="prov-msg" role="alert"></p>'
          + '<div class="nx-fraga-knappar">' + utKnapp
          + '<button type="submit" class="btn btn-primary">Lämna in</button></div>'
          + '</form>';

        const form = box.querySelector('form');
        const msg = box.querySelector('#prov-msg');
        form.addEventListener('submit', async e => {
          e.preventDefault();
          rensa(msg);
          const svar = {};
          let saknas = null;
          frågor.forEach(f => {
            const vald = form.querySelector('input[data-fraga="' + CSS.escape(String(f.id)) + '"]:checked');
            if (vald) svar[f.id] = Number(vald.value);
            else if (!saknas) saknas = f;
          });
          if (saknas) {
            säg(msg, 'Svara på alla frågor innan du lämnar in.', false);
            const första = form.querySelector('input[data-fraga="' + CSS.escape(String(saknas.id)) + '"]');
            if (första) första.focus();
            return;
          }
          await NXStudie.medan(form.querySelector('[type="submit"]'), 'Rättar…', async () => {
            let r;
            try { r = await supa.rpc('lamna_in_utbildningsprov', { p_svar: svar }); } catch (err) { r = { error: err }; }
            if (r.error || !r.data) { säg(msg, felText(r.error || 'Provet gick inte att lämna in.'), false); return; }
            if (r.data.godkand) { godkänt(r.data); return; }
            const nu = await läge(supa);
            väntar(r.data, nu && nu.kan_gora_om_fran
              ? nu.kan_gora_om_fran : new Date(Date.now() + 24 * 3600 * 1000).toISOString());
          });
        });
        const första = form.querySelector('input');
        if (första) första.focus();
      }

      el.addEventListener('click', e => {
        if (e.target.closest('[data-prov-ut]')) NXStudie.loggaUt(supa);
        if (e.target.closest('[data-prov-in]')) stäng();
      });
      document.addEventListener('keydown', tangent);
      document.body.appendChild(el);
      document.body.style.overflow = 'hidden';

      if (l.kan_gora_om_fran) väntar(l.senaste, l.kan_gora_om_fran);
      else provet();

      void el.offsetWidth;
      el.classList.add('open');
    });
  }

  return { förstGörs };
})();
