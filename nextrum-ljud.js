/* ============================================================
   NEXTRUM — ljudet och vibrationen i NexLäx (2026-10-06)

   Leo 2026-10-06: "ha ljud animation när man får rätt. När man klarar
   en nivå. När man klarar ett segment. Och när man får fel. Ha också
   haptic feedback när man trycker på nexläx steg osv som på duolingo."

   LJUDEN RÄKNAS FRAM, de laddas inte. Varje ljud är några toner ur
   Web Audio: ingen fil att hämta, inget att vänta på, ingen ny källa i
   CSP:n (media-src gäller ljudfiler, inte toner) och inget som kostar
   data på en telefon. Ett AudioContext skapas först vid första trycket:
   Safari och Chrome tystar ljud som inte startats av en människa, och
   ett context som skapas för tidigt står kvar i läget suspended.

   VIBRATIONEN går genom navigator.vibrate där den finns (Android).
   Safari på iPhone har ingen vibrate, men sedan iOS 18 ger en
   switch-ruta (<input type="checkbox" switch>) systemets eget lilla
   tick när den slås om, och ett klick på dess etikett räcker. Det är
   samma knep som biblioteket ios-haptics använder. Klicket stannar i
   etiketten: det får aldrig nå sidans egna lyssnare.

   AV OCH PÅ sparas i webbläsaren (localStorage, nx.nexlax.ljud och
   nx.nexlax.vibration), som ett hopfällt kort: ett val man själv gjort,
   som inte skickas någonstans (lagring.html). Förval är på, som i
   Duolingo, och knappen sitter i spelaren. En telefon i ljudlöst läge
   är tyst ändå: Safari spelar inte Web Audio när ringknappen är av,
   och det ska den inte heller göra här.

   Inget här ritar något. NXUppgifter säger vad som hände, och den här
   filen låter och vibrerar.
   ============================================================ */
window.NXLjud = (function () {
  'use strict';

  const NYCKEL = { ljud: 'nx.nexlax.ljud', vibration: 'nx.nexlax.vibration' };

  /* localStorage kastar i privat läge i vissa webbläsare: då gäller
     förvalet, och valet minns bara till sidan laddas om. */
  const minne = {};
  function läs(vad) {
    if (vad in minne) return minne[vad];
    try {
      const v = window.localStorage.getItem(NYCKEL[vad]);
      if (v === 'av' || v === 'pa') return (minne[vad] = v === 'pa');
    } catch (e) { /* privat läge */ }
    return true;
  }
  function skriv(vad, på) {
    minne[vad] = !!på;
    try { window.localStorage.setItem(NYCKEL[vad], på ? 'pa' : 'av'); } catch (e) { /* privat läge */ }
  }

  /* ============================================================
     LJUDET
     ============================================================ */
  let ac = null;
  let huvud = null;

  /* Skapas eller väcks i ett tryck. Anropas av spelaren på pointerdown,
     så att ljudet redan är igång när svaret kommer tillbaka. */
  function väck() {
    if (!läs('ljud')) return null;
    try {
      if (!ac) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ac = new C();
        huvud = ac.createGain();
        huvud.gain.value = 0.55;
        huvud.connect(ac.destination);
      }
      if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
    } catch (e) { ac = null; }
    return ac;
  }

  /* En ton: en oscillator med en kort attack och ett exponentiellt
     avklingande, så att den aldrig klickar i början eller slutet. */
  function ton(frek, start, längd, o) {
    const x = o || {};
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = x.typ || 'triangle';
    osc.frequency.setValueAtTime(frek, start);
    if (x.glid) osc.frequency.exponentialRampToValueAtTime(x.glid, start + längd);
    const vol = x.vol == null ? 0.18 : x.vol;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + (x.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, start + längd);
    let ut = g;
    if (x.lågpass) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = x.lågpass;
      g.connect(f);
      ut = f;
    }
    osc.connect(g);
    ut.connect(huvud);
    osc.start(start);
    osc.stop(start + längd + 0.03);
  }

  /* Tonerna i hertz, så att melodierna går att läsa. */
  const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77,
              C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760, C7: 2093 };
  const halvton = (f, n) => f * Math.pow(2, n / 12);

  const LJUD = {
    /* Ett steg på vägen, en knapp: ett kort tick. */
    tryck(t) { ton(1250, t, 0.04, { typ: 'sine', vol: 0.05, glid: 800 }); },
    /* Ett alternativ, en bricka, ett par. */
    val(t) { ton(N.E5, t, 0.07, { vol: 0.07, glid: N.A5 }); },
    /* Rätt: två ljusa toner uppåt. Med opts.rad stiger de en halvton för
       varje svar i rad, högst en oktav. */
    ratt(t, o) {
      const steg = Math.min(12, Math.max(0, ((o && o.rad) || 1) - 1));
      ton(halvton(N.A5, steg), t, 0.13, { vol: 0.16 });
      ton(halvton(N.E6, steg), t + 0.085, 0.22, { vol: 0.17 });
      ton(halvton(N.A5, steg) / 2, t + 0.085, 0.2, { typ: 'sine', vol: 0.08 });
    },
    /* Fel: två mjuka toner nedåt, filtrerade så att de inte skär. */
    fel(t) {
      ton(311.13, t, 0.14, { typ: 'square', vol: 0.07, lågpass: 900 });
      ton(233.08, t + 0.13, 0.22, { typ: 'square', vol: 0.07, lågpass: 700 });
    },
    /* En stjärna i resultatet: i = 1, 2, 3 går uppåt. */
    stjarna(t, o) {
      const i = Math.max(1, Math.min(3, (o && o.i) || 1));
      const f = [N.E6, N.G6, N.C7][i - 1];
      ton(f, t, 0.35, { typ: 'sine', vol: 0.13 });
      ton(f * 2, t, 0.18, { typ: 'sine', vol: 0.04 });
    },
    /* Nivån klar: ett arpeggio och ett ackord. */
    niva(t) {
      [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => ton(f, t + i * 0.09, 0.18, { vol: 0.14 }));
      [N.C5, N.E5, N.G5].forEach(f => ton(f, t + 0.4, 0.6, { typ: 'sine', vol: 0.07 }));
      ton(N.C6, t + 0.4, 0.7, { vol: 0.12 });
    },
    /* Ett helt område: längre, högre, och ett glitter sist. */
    omrade(t) {
      [N.G5, N.C6, N.E6, N.G6].forEach((f, i) => ton(f, t + i * 0.1, 0.2, { vol: 0.13 }));
      [N.C5, N.E5, N.G5, N.C6].forEach(f => ton(f, t + 0.45, 0.9, { typ: 'sine', vol: 0.06 }));
      ton(N.E6, t + 0.45, 0.9, { vol: 0.1 });
      [N.C7, N.G6, N.E6 * 2, N.A6].forEach((f, i) => ton(f, t + 0.6 + i * 0.07, 0.12, { typ: 'sine', vol: 0.04 }));
    },
    /* Hela banan: området, en gång till en oktav upp. */
    bana(t) {
      LJUD.omrade(t);
      [N.C6, N.E6, N.G6, N.C7].forEach((f, i) => ton(f, t + 1.0 + i * 0.08, 0.25, { vol: 0.1 }));
    },
    /* Ett uppdrag klart: ett mynt. */
    uppdrag(t) {
      ton(N.B5, t, 0.07, { typ: 'square', vol: 0.05, lågpass: 3000 });
      ton(N.E6, t + 0.07, 0.3, { typ: 'square', vol: 0.05, lågpass: 3000 });
    },
    /* Dagens kista öppnas: ett glid uppåt och glitter. */
    kista(t) {
      ton(392, t, 0.45, { typ: 'sine', vol: 0.09, glid: 1568 });
      [N.C7, N.A6, N.E6 * 2, N.G6].forEach((f, i) => ton(f, t + 0.35 + i * 0.06, 0.14, { typ: 'sine', vol: 0.05 }));
    },
    /* Ett nytt märke. */
    marke(t) {
      [N.E6, N.G6, N.C7].forEach((f, i) => ton(f, t + i * 0.07, 0.22, { typ: 'sine', vol: 0.08 }));
    },
    /* En nivå som öppnas på vägen. */
    upplast(t) {
      ton(N.D6, t, 0.1, { typ: 'sine', vol: 0.08 });
      ton(N.A6, t + 0.08, 0.25, { typ: 'sine', vol: 0.09 });
    }
  };

  function spela(namn, opts) {
    const f = LJUD[namn];
    if (!f || !läs('ljud')) return;
    const c = väck();
    if (!c) return;
    try { f(c.currentTime + 0.01, opts); } catch (e) { /* en webbläsare utan något av det här */ }
  }

  /* ============================================================
     VIBRATIONEN
     ============================================================ */
  /* Mönstren i millisekunder (vibrera, vila, vibrera …) för
     navigator.vibrate, och antalet tick för iPhone, där ett tick är det
     enda systemet ger. */
  const MÖNSTER = {
    tryck: [8], val: [10], ratt: [14, 50, 22], fel: [45, 70, 45],
    niva: [20, 60, 20, 60, 70], omrade: [30, 50, 30, 50, 30, 50, 140], bana: [40, 50, 40, 50, 40, 50, 200],
    uppdrag: [15, 40, 15], kista: [20, 40, 40], marke: [15, 40, 15], upplast: [12, 40, 12], stjarna: [12]
  };
  const TICK = { tryck: 1, val: 1, ratt: 1, fel: 2, niva: 3, omrade: 4, bana: 5, uppdrag: 2, kista: 2, marke: 2, upplast: 1, stjarna: 1 };

  const harVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  const finger = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  let etikett = null;

  function iosTick() {
    try {
      if (!etikett) {
        etikett = document.createElement('label');
        etikett.setAttribute('aria-hidden', 'true');
        etikett.className = 'nx-tick';
        etikett.style.display = 'none';
        const ruta = document.createElement('input');
        ruta.type = 'checkbox';
        ruta.setAttribute('switch', '');
        ruta.tabIndex = -1;
        etikett.appendChild(ruta);
        /* Klicket på etiketten, och det klick den ger rutan, stannar
           här: sidans lyssnare på document ska aldrig se dem. */
        etikett.addEventListener('click', e => e.stopPropagation());
        /* I head, inte i body: spelaren gör bodys barn inert medan
           den är öppen, och ett inert element tar inget klick. */
        document.head.appendChild(etikett);
      }
      etikett.click();
    } catch (e) { /* ingen switch: inget tick */ }
  }

  function vibrera(namn) {
    if (!läs('vibration') || !finger) return;
    const m = MÖNSTER[namn];
    if (!m) return;
    if (harVibrate) {
      try { navigator.vibrate(m); } catch (e) { /* nekad utan ett tryck först */ }
      return;
    }
    const n = TICK[namn] || 1;
    iosTick();
    for (let i = 1; i < n; i++) setTimeout(iosTick, i * 110);
  }

  /* Ljud och vibration för samma händelse. */
  function känn(namn, opts) {
    spela(namn, opts);
    vibrera(namn);
  }

  return {
    känn, spela, vibrera, väck,
    ljudPå: () => läs('ljud'),
    vibrationPå: () => läs('vibration'),
    sättLjud: på => { skriv('ljud', på); if (på) väck(); },
    sättVibration: på => skriv('vibration', på),
    /* Om det alls går att vibrera här. Bara med ett finger som pekare:
       Chrome på en dator har navigator.vibrate men ingenting som
       vibrerar, och där visas inget val för vibrationen. */
    kanVibrera: () => finger
  };
})();
