/* ============================================================
   PROVBÄNKEN FÖR ADMINVYN — en falsk supabase-js

   Ersätter bibliotek/supabase-js på provsidorna. Definierar
   window.supabase.createClient(), och klienten den lämnar ut svarar
   ur window.__PROV_DATA (_prov-admin-data.js) i stället för ur
   databasen. Ingen nätverkstrafik, ingen inloggning, ingenting skrivs.

   VAD DEN GÖR
     · from(tabell) — en kedjebar, "thenable" fråga som filtrerar,
       sorterar och projicerar fixturraderna på riktigt (eq, in, is,
       gt, order, limit, range, maybeSingle, inbäddade relationer…).
       Som riktiga supabase-js körs frågan först när någon väntar på
       den: en fråga ingen awaitar körs aldrig, och loggas inte.
     · skrivningar (insert, update, upsert, delete) ändrar ALDRIG
       fixturerna. De svarar som om de gått igenom, och loggas.
     · rpc, functions.invoke, storage, channel — ofarliga svar.
     · auth — en inloggad admin, alltid.

   VAD DEN FÅNGAR (från första raden, därför laddas filen före all
   riktig kod)
     · window.__provFel       fel: oväntade undantag, avvisade löften
                              utan hanterare, console.error, resurser
                              som inte laddade
     · window.__provVarningar console.warn, och stubbens egna
                              varningar (t.ex. en kolumn som saknas
                              i fixturerna)
     · window.__provAnrop     varje fråga som faktiskt kördes, i ordning

   VAD DEN LÅSER, för att två körningar ska bli lika
     · document.hidden är alltid false. Annars beror bevakningens
       pollning i nextrum-admin.js på om förhandsrutan råkar synas.
       visibilitychange-händelser stoppas av samma skäl.
     · localStorage är ett tomt lager i minnet för den här sidan.
       Adminvyn sparar vilka notiser som är lästa och om menyn är
       hopfälld; det får inte följa med från en tidigare körning, och
       provbänken ska inte skriva i den riktiga webbläsarens lager.
     · Realtidskanalen svarar SUBSCRIBED först när sidan laddat klart
       (load), aldrig mitt i uppstarten. En riktig websocket hinner
       aldrig före; och görs filerna om kan skriptens ordning annars
       ändra när bevakningen räknar första gången.
   ============================================================ */
(function () {
  'use strict';

  var FEL = window.__provFel = [];
  var VARN = window.__provVarningar = [];
  var ANROP = window.__provAnrop = [];

  /* ---------- text av vad som helst ---------- */
  function text(x) {
    if (x instanceof Error) return (x.name || 'Error') + ': ' + x.message;
    if (x && typeof x === 'object') {
      try { return JSON.stringify(x); } catch (e) { return String(x); }
    }
    return String(x);
  }
  function stack(x) {
    return (x && typeof x === 'object' && typeof x.stack === 'string') ? x.stack : null;
  }

  /* ---------- fel och varningar ---------- */
  window.addEventListener('error', function (e) {
    if (e && e.message) {
      FEL.push({
        typ: 'undantag',
        text: e.message,
        kalla: String(e.filename || '').replace(location.origin, '') + ':' + e.lineno + ':' + e.colno,
        stack: stack(e.error)
      });
      return;
    }
    /* Resursfel bubblar inte, men syns i fångstfasen på window. */
    var t = e && e.target;
    if (t && t !== window) {
      FEL.push({
        typ: 'resurs',
        text: 'Kunde inte ladda ' + (t.tagName || '?').toLowerCase() + ' '
          + String(t.src || t.href || t.currentSrc || '').replace(location.origin, ''),
        kalla: null, stack: null
      });
    }
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    FEL.push({ typ: 'avvisat-lofte', text: text(r), kalla: null, stack: stack(r) });
  });

  var ursprungligtFel = console.error;
  console.error = function () {
    var a = Array.prototype.slice.call(arguments);
    FEL.push({ typ: 'console.error', text: a.map(text).join(' '), kalla: null,
      stack: stack(a.filter(function (x) { return x instanceof Error; })[0]) });
    return ursprungligtFel.apply(console, arguments);
  };

  var ursprungligVarning = console.warn;
  console.warn = function () {
    var a = Array.prototype.slice.call(arguments);
    VARN.push({ typ: 'console.warn', text: a.map(text).join(' ') });
    return ursprungligVarning.apply(console, arguments);
  };

  function varna(t) {
    VARN.push({ typ: 'stubbe', text: t });
  }

  /* ---------- låsningarna ---------- */
  try {
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: function () { return false; } });
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: function () { return 'visible'; } });
  } catch (e) { varna('Kunde inte låsa document.hidden: ' + e.message); }
  window.addEventListener('visibilitychange', function (e) { e.stopImmediatePropagation(); }, true);

  function minneslager() {
    var m = new Map();
    return {
      getItem: function (k) { k = String(k); return m.has(k) ? m.get(k) : null; },
      setItem: function (k, v) { m.set(String(k), String(v)); },
      removeItem: function (k) { m.delete(String(k)); },
      clear: function () { m.clear(); },
      key: function (i) { return Array.from(m.keys())[i] || null; },
      get length() { return m.size; }
    };
  }
  try {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: minneslager() });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: minneslager() });
  } catch (e) { varna('Kunde inte byta ut localStorage: ' + e.message); }

  /* ---------- data ---------- */
  var DATA = window.__PROV_DATA;
  if (!DATA) {
    FEL.push({ typ: 'provbank', text: '_prov-admin-data.js laddades inte — __PROV_DATA saknas', kalla: null, stack: null });
    DATA = { tabeller: {}, rpc: {}, anvandare: { id: 'saknas', email: 'saknas' } };
  }
  var TAB = DATA.tabeller;
  var ANV_ID = (DATA.anvandare || {}).id || null;

  function kopia(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

  var nyttId = 0;
  function genereraId() {
    nyttId++;
    return 'prov0000-0000-4000-8000-' + String(nyttId).padStart(12, '0');
  }

  /* ---------- nya rader ----------
     Ett insert svarar med en hel rad, som databasen hade gjort: alla
     kolumner tabellen har i fixturen (null om inget värde gavs),
     tidsstämplar satta till den frysta klockan, kolumnernas
     standardvärden och ett id — ett löpnummer för tabeller med
     heltals-id, annars ett UUID-format. Tabeller utan id-kolumn
     (rut_tak, rabattkoder, tjanster) får inget. uppgifter får dessutom
     vad triggern uppgift_stampel gör. Fixturerna ändras fortfarande
     aldrig: nästa läsning ser inte raden. */
  var STANDARDVÄRDEN = {
    uppgifter: { typ: 'ovrigt', status: 'oppen', skapad_av_typ: 'manniska' },
    uppdrag: { typ: 'lopande', status: 'aktivt' },
    rabattkoder: { typ: 'procent', antal_anvandningar: 0, aktiv: true },
    admin_noteringar: {},
    materials: { kind: 'lank' }
  };
  var TIDSKOLUMNER = ['created_at', 'uppdaterad', 'updated_at', 'tid', 'skapad'];
  var löpnummer = {};

  function nästaTal(tabell) {
    if (löpnummer[tabell] === undefined) {
      löpnummer[tabell] = (TAB[tabell] || []).reduce(function (m, r) {
        return typeof r.id === 'number' && r.id > m ? r.id : m;
      }, 0);
    }
    return ++löpnummer[tabell];
  }

  function nuIso() { return new Date().toISOString(); }

  function nyRad(tabell, v) {
    var förebild = (TAB[tabell] || [])[0];
    var rad = {};
    if (förebild) Object.keys(förebild).forEach(function (k) { rad[k] = null; });
    TIDSKOLUMNER.forEach(function (k) { if (k in rad) rad[k] = nuIso(); });
    Object.assign(rad, kopia(STANDARDVÄRDEN[tabell] || {}), kopia(v));
    if (!förebild || 'id' in förebild) {
      if (rad.id == null) {
        rad.id = (förebild && typeof förebild.id === 'number') ? nästaTal(tabell) : genereraId();
      }
    }
    if (tabell === 'uppgifter') {
      rad.skapad_av = ANV_ID;
      rad.skapad_av_typ = 'manniska';
      rad.created_at = nuIso();
      rad.uppdaterad = nuIso();
      rad.klar_at = rad.status === 'klar' ? nuIso() : null;
    }
    /* Triggern elevens_uppdrag skapar ett uppdrag åt varje nytt barn
       och skriver tillbaka id:t. Utan den svarar students-insert med
       uppdrag_id null, och adminvyns gren som skriver om uppdragets
       tjänst hade aldrig prövats. */
    if (tabell === 'students' && rad.uppdrag_id == null) {
      rad.uppdrag_id = genereraId();
    }
    return rad;
  }

  function uppdateradRad(tabell, gammal, ändring) {
    var rad = Object.assign(kopia(gammal), kopia(ändring));
    if (tabell === 'uppgifter') {
      rad.id = gammal.id;
      rad.skapad_av = gammal.skapad_av;
      rad.skapad_av_typ = gammal.skapad_av_typ;
      rad.created_at = gammal.created_at;
      rad.uppdaterad = nuIso();
      if (rad.status === 'klar' && gammal.status !== 'klar') rad.klar_at = nuIso();
      else if (rad.status !== 'klar') rad.klar_at = null;
    } else if ('uppdaterad' in gammal && !('uppdaterad' in (ändring || {}))) {
      rad.uppdaterad = nuIso();
    }
    return rad;
  }

  /* ---------- jämförelser ---------- */
  function lika(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    return String(a) === String(b);
  }
  function jämför(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : (a ? 1 : -1);
    a = String(a); b = String(b);
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function tillMönster(p) {
    var s = String(p).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
    return s;
  }
  function tolkaLista(v) {
    if (Array.isArray(v)) return v;
    /* "(a,b,c)" som i PostgREST:s not.in.(...) */
    return String(v).replace(/^\(|\)$/g, '').split(',').map(function (x) {
      return x.trim().replace(/^"|"$/g, '');
    });
  }

  function villkor(op, kol, v) {
    switch (op) {
      case 'eq': return function (r) { return lika(r[kol], v); };
      case 'neq': return function (r) { return !lika(r[kol], v); };
      case 'gt': return function (r) { return r[kol] != null && jämför(r[kol], v) > 0; };
      case 'gte': return function (r) { return r[kol] != null && jämför(r[kol], v) >= 0; };
      case 'lt': return function (r) { return r[kol] != null && jämför(r[kol], v) < 0; };
      case 'lte': return function (r) { return r[kol] != null && jämför(r[kol], v) <= 0; };
      case 'in': {
        var lista = tolkaLista(v);
        return function (r) { return lista.some(function (x) { return lika(r[kol], x); }); };
      }
      case 'is':
        if (v === null || v === 'null') return function (r) { return r[kol] == null; };
        if (v === true || v === 'true') return function (r) { return r[kol] === true; };
        if (v === false || v === 'false') return function (r) { return r[kol] === false; };
        return function (r) { return lika(r[kol], v); };
      case 'like': {
        var re = new RegExp('^' + tillMönster(v) + '$');
        return function (r) { return r[kol] != null && re.test(String(r[kol])); };
      }
      case 'ilike': {
        var rei = new RegExp('^' + tillMönster(v) + '$', 'i');
        return function (r) { return r[kol] != null && rei.test(String(r[kol])); };
      }
      case 'contains': {
        var krav = Array.isArray(v) ? v : [v];
        return function (r) {
          var x = r[kol];
          return Array.isArray(x) && krav.every(function (k) { return x.some(function (y) { return lika(y, k); }); });
        };
      }
      case 'overlaps': {
        var någon = Array.isArray(v) ? v : [v];
        return function (r) {
          var x = r[kol];
          return Array.isArray(x) && någon.some(function (k) { return x.some(function (y) { return lika(y, k); }); });
        };
      }
      default:
        varna('Okänt filter ' + op + ' på ' + kol + ' — ignoreras');
        return function () { return true; };
    }
  }

  /* ---------- projektionen ---------- */
  function delaUpp(s) {
    var ut = [], djup = 0, bit = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '(') djup++;
      if (c === ')') djup--;
      if (c === ',' && djup === 0) { if (bit.trim()) ut.push(bit.trim()); bit = ''; }
      else bit += c;
    }
    if (bit.trim()) ut.push(bit.trim());
    return ut;
  }

  function ental(t) { return String(t).replace(/ies$/, 'y').replace(/s$/, ''); }

  function projicera(tabell, rad, urval) {
    var sel = String(urval == null ? '*' : urval).trim();
    if (sel === '' || sel === '*') return kopia(rad);
    var ut = {};
    delaUpp(sel).forEach(function (tok) {
      tok = tok.replace(/\s+/g, '');
      var inb = tok.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?\((.*)\)$/);
      if (inb) {
        var alias = inb[1] || inb[2], rel = inb[2], ledtråd = inb[3], inre = inb[4];
        var relRader = TAB[rel];
        if (!relRader) {
          varna('Inbäddning av okänd tabell ' + rel + ' i ' + tabell + ' — blir null');
          ut[alias] = null;
          return;
        }
        var fk = (ledtråd && ledtråd in rad) ? ledtråd : ental(rel) + '_id';
        if (fk in rad) {
          var mål = relRader.filter(function (x) { return lika(x.id, rad[fk]); })[0];
          ut[alias] = mål ? projicera(rel, mål, inre) : null;
        } else {
          var bak = ental(tabell) + '_id';
          ut[alias] = relRader.filter(function (x) { return lika(x[bak], rad.id); })
            .map(function (x) { return projicera(rel, x, inre); });
        }
        return;
      }
      if (tok === '*') { Object.assign(ut, kopia(rad)); return; }
      var k = tok.match(/^(?:(\w+):)?(\w+)(?:::\w+)?$/);
      if (!k) { varna('Kunde inte tolka kolumnen "' + tok + '" i ' + tabell); return; }
      var namn = k[1] || k[2], kol = k[2];
      if (!(kol in rad)) {
        varna('Kolumnen ' + tabell + '.' + kol + ' saknas i fixturen — blir null');
        ut[namn] = null;
      } else {
        ut[namn] = kopia(rad[kol]);
      }
    });
    return ut;
  }

  /* ---------- frågan ---------- */
  function Fraga(tabell, källa, typ) {
    this.tabell = tabell;
    this.källa = källa;          // funktion som ger raderna
    this.typ = typ || 'tabell';  // 'tabell' | 'rpc'
    this.op = 'select';
    this.urval = '*';
    this.harUrval = false;
    this.filtren = [];
    this.filterText = [];
    this.ordning = [];
    this.gräns = null;
    this.intervall = null;
    this.räkna = null;
    this.huvud = false;
    this.enkel = null;           // 'single' | 'maybe'
    this.värden = null;
    this.extra = {};
  }

  var P = Fraga.prototype;

  P.select = function (urval, opts) {
    if (this.op === 'select') {
      this.urval = urval == null ? '*' : urval;
      if (opts && opts.count) this.räkna = opts.count;
      if (opts && opts.head) this.huvud = true;
    } else {
      /* .insert(...).select('id') — skrivningen ska svara med rader */
      this.harUrval = true;
      this.urval = urval == null ? '*' : urval;
    }
    return this;
  };

  function lägg(op) {
    return function (kol, v) {
      this.filtren.push(villkor(op, kol, v));
      this.filterText.push(kol + '.' + op + '.' + text(v));
      return this;
    };
  }
  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'like', 'ilike', 'contains', 'overlaps']
    .forEach(function (op) { P[op] = lägg(op); });
  P.containedBy = function (kol, v) { this.filterText.push(kol + '.containedBy.' + text(v) + ' (ignorerat)'); return this; };
  P.textSearch = function (kol, v) { this.filterText.push(kol + '.fts.' + text(v) + ' (ignorerat)'); return this; };
  P.match = function (obj) {
    var self = this;
    Object.keys(obj || {}).forEach(function (k) { self.eq(k, obj[k]); });
    return this;
  };
  P.not = function (kol, op, v) {
    var f = villkor(op, kol, op === 'in' ? tolkaLista(v) : v);
    this.filtren.push(function (r) { return !f(r); });
    this.filterText.push(kol + '.not.' + op + '.' + text(v));
    return this;
  };
  P.filter = function (kol, op, v) {
    var o = String(op);
    if (o.indexOf('not.') === 0) return this.not(kol, o.slice(4), v);
    return lägg(o).call(this, kol, v);
  };
  P.or = function (uttryck) {
    this.filterText.push('or(' + uttryck + ') (ignorerat)');
    return this;
  };
  P.order = function (kol, opts) {
    var o = opts || {};
    if (o.foreignTable || o.referencedTable) {
      this.filterText.push('order ' + kol + ' på inbäddad tabell (ignorerat)');
      return this;
    }
    this.ordning.push({ kol: kol, stigande: o.ascending !== false,
      nullFörst: o.nullsFirst === undefined ? (o.ascending === false) : !!o.nullsFirst });
    return this;
  };
  P.limit = function (n) { this.gräns = n; return this; };
  P.range = function (från, till) { this.intervall = [från, till]; return this; };
  P.single = function () { this.enkel = 'single'; return this; };
  P.maybeSingle = function () { this.enkel = 'maybe'; return this; };
  P.abortSignal = function () { return this; };
  P.returns = function () { return this; };
  P.throwOnError = function () { return this; };
  P.csv = function () { this.extra.csv = true; return this; };

  P.insert = function (v, opts) { this.op = 'insert'; this.värden = v; this.extra.opts = opts || null; return this; };
  P.upsert = function (v, opts) { this.op = 'upsert'; this.värden = v; this.extra.opts = opts || null; return this; };
  P.update = function (v) { this.op = 'update'; this.värden = v; return this; };
  P.delete = function () { this.op = 'delete'; return this; };

  P._matchade = function () {
    var rader = this.källa() || [];
    if (!Array.isArray(rader)) return rader;
    var f = this.filtren;
    return rader.filter(function (r) { return f.every(function (g) { return g(r); }); });
  };

  P._sortera = function (rader) {
    var ord = this.ordning;
    if (!ord.length) return rader;
    return rader.slice().sort(function (a, b) {
      for (var i = 0; i < ord.length; i++) {
        var o = ord[i], x = a[o.kol], y = b[o.kol];
        if (x == null && y == null) continue;
        if (x == null) return o.nullFörst ? -1 : 1;
        if (y == null) return o.nullFörst ? 1 : -1;
        var c = jämför(x, y);
        if (c) return o.stigande ? c : -c;
      }
      return 0;
    });
  };

  P._logga = function (antal) {
    var post = {
      typ: this.typ, tabell: this.tabell, op: this.op,
      urval: this.op === 'select' || this.harUrval ? String(this.urval).replace(/\s+/g, ' ').trim() : null,
      filter: this.filterText.slice(),
      ordning: this.ordning.map(function (o) { return o.kol + (o.stigande ? ' asc' : ' desc'); }),
      grans: this.gräns, intervall: this.intervall, enkel: this.enkel,
      rakna: this.räkna, huvud: this.huvud,
      varden: this.värden === null ? null : kopia(this.värden),
      svar: antal
    };
    if (this.extra.args !== undefined) post.args = kopia(this.extra.args);
    ANROP.push(post);
  };

  P._kör = function () {
    var self = this;

    /* En rpc som fixturen säger ska misslyckas. Svaret ser ut som
       PostgREST:s: data null, error med message och code. */
    if (this.extra.fel) {
      this._logga('fel');
      return { data: null, error: kopia(this.extra.fel), count: null,
        status: 404, statusText: 'Not Found' };
    }

    var tabellFinns = this.typ === 'rpc' || Object.prototype.hasOwnProperty.call(TAB, this.tabell);

    if (this.op === 'select') {
      if (!tabellFinns) varna('Okänd tabell ' + this.tabell + ' — svarar med []');
      var källrader = this._matchade();

      /* rpc som ger ett skalärt värde. En fixturfunktion som svarar
         { __fel: … } blir ett fel, som när funktionen kastar i
         databasen — annars kunde bara statiska fixturer misslyckas. */
      if (!Array.isArray(källrader)) {
        if (källrader && typeof källrader === 'object' && källrader.__fel) {
          this._logga('fel');
          return { data: null, error: kopia(källrader.__fel), count: null,
            status: 400, statusText: 'Bad Request' };
        }
        this._logga('skalär');
        return { data: kopia(källrader), error: null, count: null, status: 200, statusText: 'OK' };
      }

      var sorterade = this._sortera(källrader);
      var antal = sorterade.length;
      if (this.intervall) sorterade = sorterade.slice(this.intervall[0], this.intervall[1] + 1);
      if (this.gräns != null) sorterade = sorterade.slice(0, this.gräns);
      var data = sorterade.map(function (r) { return projicera(self.tabell, r, self.urval); });
      var count = this.räkna ? antal : null;

      if (this.huvud) {
        this._logga({ count: count });
        return { data: null, error: null, count: count, status: 200, statusText: 'OK' };
      }
      if (this.enkel) {
        this._logga(data.length);
        if (this.enkel === 'single' && data.length !== 1) {
          return { data: null, count: null, status: 406, statusText: 'Not Acceptable',
            error: { message: 'JSON object requested, multiple (or no) rows returned',
              details: 'The result contains ' + data.length + ' rows', hint: null, code: 'PGRST116' } };
        }
        if (this.enkel === 'maybe' && data.length > 1) {
          return { data: null, count: null, status: 406, statusText: 'Not Acceptable',
            error: { message: 'JSON object requested, multiple (or no) rows returned',
              details: 'Results contain ' + data.length + ' rows, application/vnd.pgrst.object+json requires 1 row',
              hint: null, code: 'PGRST116' } };
        }
        return { data: data[0] || null, error: null, count: count, status: 200, statusText: 'OK' };
      }
      this._logga(data.length);
      return { data: data, error: null, count: count, status: 200, statusText: 'OK' };
    }

    /* ---------- skrivningar: fixturerna rörs aldrig ---------- */
    if (!tabellFinns) varna('Skrivning mot okänd tabell ' + this.tabell);
    var svarsrader;
    if (this.op === 'insert' || this.op === 'upsert') {
      var nya = Array.isArray(this.värden) ? this.värden : [this.värden];
      svarsrader = nya.map(function (v) { return nyRad(self.tabell, v); });
    } else if (this.op === 'update') {
      var ändring = this.värden;
      svarsrader = this._matchade().map(function (r) { return uppdateradRad(self.tabell, r, ändring); });
    } else {
      svarsrader = this._matchade().map(kopia);
    }
    this._logga(svarsrader.length);

    var status = this.op === 'insert' ? 201 : (this.harUrval ? 200 : 204);
    if (!this.harUrval) return { data: null, error: null, count: null, status: status, statusText: 'OK' };
    var ut = svarsrader.map(function (r) { return projicera(self.tabell, r, self.urval); });
    if (this.enkel) {
      if (this.enkel === 'single' && ut.length !== 1) {
        return { data: null, count: null, status: 406, statusText: 'Not Acceptable',
          error: { message: 'JSON object requested, multiple (or no) rows returned',
            details: null, hint: null, code: 'PGRST116' } };
      }
      return { data: ut[0] || null, error: null, count: null, status: status, statusText: 'OK' };
    }
    return { data: ut, error: null, count: null, status: status, statusText: 'OK' };
  };

  /* Som riktiga supabase-js: frågan körs när någon väntar på den. */
  P.then = function (klar, fel) {
    var self = this;
    return Promise.resolve().then(function () { return self._kör(); }).then(klar, fel);
  };
  P.catch = function (fel) { return this.then(null, fel); };
  P.finally = function (f) { return this.then().finally(f); };

  function från(tabell) {
    return new Fraga(tabell, function () {
      return Object.prototype.hasOwnProperty.call(TAB, tabell) ? TAB[tabell] : [];
    }, 'tabell');
  }

  function rpc(namn, args) {
    var q = new Fraga(namn, function () {
      if (!Object.prototype.hasOwnProperty.call(DATA.rpc || {}, namn)) {
        varna('Okänd rpc ' + namn + ' — svarar med []');
        return [];
      }
      var v = DATA.rpc[namn];
      /* Är fixturen en funktion körs den. Undantaget från regeln att
         stubben aldrig ändrar fixturerna: en serverfunktion som
         SKAPAR rader kan bara prövas genom att den får göra det.
         Bara rpc, aldrig from(). */
      return typeof v === 'function' ? v(args) : v;
    }, 'rpc');
    /* { __fel: {...} } i fixturen betyder att anropet ska svara med
       ett fel i stället för data — en funktion som inte finns, en
       vakt som nekar. */
    var svar = (DATA.rpc || {})[namn];
    if (svar && typeof svar === 'object' && !Array.isArray(svar) && svar.__fel) {
      q.extra.fel = svar.__fel;
    }
    q.extra.args = args === undefined ? null : args;
    return q;
  }

  /* ---------- auth ---------- */
  var ANV = kopia(DATA.anvandare);
  var SESSION = {
    access_token: 'provbank-token', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'provbank-refresh',
    user: ANV
  };
  function loggaAnnat(typ, namn, args) {
    ANROP.push({ typ: typ, tabell: namn, op: typ, urval: null, filter: [], ordning: [],
      grans: null, intervall: null, enkel: null, rakna: null, huvud: false,
      varden: args === undefined ? null : kopia(args), svar: null });
  }

  var auth = {
    getSession: function () {
      loggaAnnat('auth', 'getSession');
      return Promise.resolve({ data: { session: kopia(SESSION) }, error: null });
    },
    getUser: function () {
      loggaAnnat('auth', 'getUser');
      return Promise.resolve({ data: { user: kopia(ANV) }, error: null });
    },
    onAuthStateChange: function (cb) {
      loggaAnnat('auth', 'onAuthStateChange');
      if (typeof cb === 'function') {
        Promise.resolve().then(function () { cb('INITIAL_SESSION', kopia(SESSION)); });
      }
      return { data: { subscription: { id: 'provbank', unsubscribe: function () {} } } };
    },
    signOut: function () {
      loggaAnnat('auth', 'signOut');
      return Promise.resolve({ error: null });
    },
    signInWithPassword: function (o) {
      loggaAnnat('auth', 'signInWithPassword', { email: o && o.email });
      return Promise.resolve({ data: { user: kopia(ANV), session: kopia(SESSION) }, error: null });
    },
    signUp: function () {
      loggaAnnat('auth', 'signUp');
      return Promise.resolve({ data: { user: null, session: null }, error: null });
    },
    resetPasswordForEmail: function () {
      loggaAnnat('auth', 'resetPasswordForEmail');
      return Promise.resolve({ data: {}, error: null });
    },
    updateUser: function () {
      loggaAnnat('auth', 'updateUser');
      return Promise.resolve({ data: { user: kopia(ANV) }, error: null });
    },
    refreshSession: function () {
      return Promise.resolve({ data: { session: kopia(SESSION), user: kopia(ANV) }, error: null });
    }
  };

  /* ---------- edge-funktioner ----------
     DATA.funktioner[namn] svarar om den finns: ett värde, eller en
     funktion av kroppen när svaret beror på vad man frågade om.
     Saknas den blir svaret {} som förut, så att en vy som bara
     anropar en funktion utan att läsa svaret inte behöver fixtur. */
  var functions = {
    invoke: function (namn, opts) {
      var kropp = opts && opts.body;
      loggaAnnat('functions', namn, kropp);
      var f = (DATA.funktioner || {})[namn];
      if (f === undefined) return Promise.resolve({ data: {}, error: null });
      var svar = typeof f === 'function' ? f(kropp) : kopia(f);
      /* { __fel: {...} } ger samma form som supabase-js: ett
         FunctionsHttpError med kroppen läsbar via context.json(). */
      if (svar && svar.__fel) {
        var kroppssvar = svar.__kropp;
        return Promise.resolve({
          data: null,
          error: {
            name: 'FunctionsHttpError',
            message: svar.__fel,
            context: { status: svar.__status || 500,
              json: function () { return Promise.resolve(kopia(kroppssvar)); } }
          }
        });
      }
      return Promise.resolve({ data: svar, error: null });
    }
  };

  /* ---------- lagring ---------- */
  var storage = {
    from: function (hink) {
      return {
        createSignedUrl: function (väg) {
          loggaAnnat('storage', hink + '.createSignedUrl', väg);
          return Promise.resolve({ data: { signedUrl: 'favicon.svg#prov-' + encodeURIComponent(väg) }, error: null });
        },
        createSignedUrls: function (vägar) {
          loggaAnnat('storage', hink + '.createSignedUrls', vägar);
          return Promise.resolve({ data: (vägar || []).map(function (v) {
            return { path: v, signedUrl: 'favicon.svg#prov-' + encodeURIComponent(v), error: null };
          }), error: null });
        },
        getPublicUrl: function (väg) {
          return { data: { publicUrl: 'favicon.svg#prov-' + encodeURIComponent(väg) } };
        },
        list: function (väg) {
          loggaAnnat('storage', hink + '.list', väg);
          return Promise.resolve({ data: [], error: null });
        },
        upload: function (väg) {
          loggaAnnat('storage', hink + '.upload', väg);
          return Promise.resolve({ data: { path: väg, id: genereraId() }, error: null });
        },
        remove: function (vägar) {
          loggaAnnat('storage', hink + '.remove', vägar);
          return Promise.resolve({ data: [], error: null });
        },
        download: function (väg) {
          loggaAnnat('storage', hink + '.download', väg);
          return Promise.resolve({ data: new Blob(['']), error: null });
        }
      };
    }
  };

  /* ---------- realtid ---------- */
  var sidanLaddad = document.readyState === 'complete';
  var väntande = [];
  window.__provKanal = { prenumerationer: 0, besked: 0 };

  function nästaUppgift(f) {
    /* MessageChannel och inte setTimeout: en dold förhandsruta
       stryper timers, meddelanden stryps inte. */
    var k = new MessageChannel();
    k.port1.onmessage = function () { k.port1.close(); f(); };
    k.port2.postMessage(0);
  }
  function sägTill(cb) {
    nästaUppgift(function () {
      window.__provKanal.besked++;
      try { cb('SUBSCRIBED', null); }
      catch (e) { FEL.push({ typ: 'undantag', text: text(e), kalla: 'realtidsbesked', stack: stack(e) }); }
    });
  }
  window.addEventListener('load', function () {
    sidanLaddad = true;
    var lista = väntande; väntande = [];
    lista.forEach(sägTill);
  });

  function kanal(namn) {
    loggaAnnat('realtime', 'channel:' + namn);
    var k = {
      topic: 'realtime:' + namn,
      state: 'closed',
      on: function () { return k; },
      subscribe: function (cb) {
        window.__provKanal.prenumerationer++;
        k.state = 'joined';
        if (typeof cb === 'function') {
          if (sidanLaddad) sägTill(cb); else väntande.push(cb);
        }
        return k;
      },
      unsubscribe: function () { k.state = 'closed'; return Promise.resolve('ok'); },
      send: function () { return Promise.resolve('ok'); },
      track: function () { return Promise.resolve('ok'); },
      untrack: function () { return Promise.resolve('ok'); },
      presenceState: function () { return {}; }
    };
    return k;
  }

  /* ---------- klienten ---------- */
  var klient = null;
  function skapaKlient() {
    if (klient) return klient;
    var kanaler = [];
    klient = {
      __provbank: true,
      auth: auth,
      from: från,
      rpc: rpc,
      schema: function () { return klient; },
      functions: functions,
      storage: storage,
      channel: function (namn) { var k = kanal(namn); kanaler.push(k); return k; },
      removeChannel: function (k) {
        kanaler = kanaler.filter(function (x) { return x !== k; });
        return Promise.resolve('ok');
      },
      removeAllChannels: function () { kanaler = []; return Promise.resolve([]); },
      getChannels: function () { return kanaler.slice(); }
    };
    return klient;
  }

  window.supabase = {
    createClient: function () { return skapaKlient(); }
  };
})();
