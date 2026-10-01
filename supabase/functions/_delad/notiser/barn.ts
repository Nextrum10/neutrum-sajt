// ============================================================
// NEXTRUM — mejlen till ett barn (barnets_epost)
//
// Ett barn med en egen, bekräftad adress kan få tre sorters mejl, om
// föräldern slagit på det och barnet inte stängt av sorten: ett bokat
// pass, ett avbokat pass och en påminnelse före ett pass. Den fjärde är
// bekräftelsen av adressen, som går när föräldern lagt till den.
//
// SAMMA RAM SOM ALLT ANNAT VI SKICKAR (rendera.ts): papperet, loggan,
// knappen, textversionen och foten. Det som skiljer är innehållet:
//
//   · Inga priser, ingen betalning, inget om faktura eller timmar. Det
//     är familjens sak, och barnets vy visar det inte heller.
//   · Inget skäl till en avbokning: koderna ("Familjen avslutar") är
//     skrivna till föräldern.
//   · Knappen går till barnets vy, nextrum.se/barn, och "Ändra dina val"
//     till barnets inställningar där.
//   · Bekräftelsen hälsar inte med namn och nämner inget om barnet.
//     Adressen är inte bekräftad än och kan vara felskriven; då ska den
//     som fick mejlet inte få veta något om ett barn hos Nextrum.
//
// Mallarna ser bara RenData (typer.ts), som alla andra.
// ============================================================

import { avregistreringsAdress, renderaRam, SAJT, type ProvLage, type Renderat } from './rendera.ts';
import type { Innehall } from './mallar.ts';
import { narText, paminnelseNar } from './tid.ts';
import { arBarnMejltyp, BARN_BEKRAFTA, fornamn, renData, type BarnMejltyp, type RenData } from './typer.ts';

export const BARN_VY = `${SAJT}/barn`;

/** Till foten: "… och mejl om {kategori} är påslaget." */
export const BARN_KATEGORI: Record<BarnMejltyp, string> = {
  barn_pass_bokat: 'bokade pass',
  barn_pass_avbokat: 'avbokade pass',
  barn_paminnelse: 'påminnelser före pass',
};

export type BarnMejlIn = {
  typ: string;
  /** Barnets förnamn. Null för bekräftelsen, och går genom förnamnsregeln här också. */
  fornamn: string | null;
  data: unknown;
  /** Barnets avanmälningstoken, eller null (sandlådan och bekräftelsen). */
  token: string | null;
  prov: ProvLage;
  nu: Date;
};

type BarnMallIn = { d: RenData; nu: Date };

/** Faktarutan. Studiehjälparens förnamn står i barnets vy också. */
function fakta(d: RenData, nar: string | null): [string, string][] {
  const f: [string, string][] = [];
  if (nar) f.push(['När', nar]);
  if (d.amne) f.push(['Ämne', d.amne]);
  if (d.studiehjalpare) f.push(['Studiehjälpare', d.studiehjalpare]);
  return f;
}

function med(d: RenData): string {
  return d.studiehjalpare ? ` med ${d.studiehjalpare}` : '';
}

/* mal används inte här: knappen går alltid till barnets vy (knappAdress
   nedan). 'sajten' står för att typen kräver något. */
export const BARN_MALLAR: Record<BarnMejltyp, (m: BarnMallIn) => Innehall> = {
  barn_pass_bokat(m) {
    const nar = narText(m.d.datum, m.d.tid);
    return {
      amne: nar ? `Ditt pass är bokat: ${nar}` : 'Ditt pass är bokat',
      rubrik: 'Ditt pass är bokat',
      mening: `Du har ett pass${med(m.d)}. Det står också i din vy på Nextrum.`,
      knapp: 'Öppna din vy',
      mal: 'sajten',
      fakta: fakta(m.d, nar),
    };
  },

  barn_pass_avbokat(m) {
    const nar = narText(m.d.datum, m.d.tid);
    return {
      amne: nar ? `Passet ${nar} är avbokat` : 'Ett pass är avbokat',
      rubrik: 'Passet är avbokat',
      mening: `Passet${med(m.d)} blir inte av. Undrar du något om en ny tid, fråga din förälder.`,
      knapp: 'Öppna din vy',
      mal: 'sajten',
      fakta: fakta(m.d, nar),
    };
  },

  barn_paminnelse(m) {
    const nar = paminnelseNar(m.d, m.nu);
    return {
      amne: nar ? `Påminnelse: pass ${nar}` : 'Påminnelse om ditt pass',
      rubrik: nar ? `Pass ${nar}` : 'Påminnelse om ditt pass',
      mening: `En påminnelse om ditt pass${med(m.d)}.`,
      knapp: 'Öppna din vy',
      mal: 'sajten',
      fakta: fakta(m.d, narText(m.d.datum, m.d.tid)),
    };
  },
};

function bekraftelse(d: RenData, prov: ProvLage): Renderat {
  // Utan en giltig kod finns ingen knapp att trycka på. Hellre ett fel
  // i kön än ett mejl som ber om något som inte går.
  if (!d.kod) throw new Error('Bekräftelsen saknar sin kod.');
  const innehall: Innehall = {
    amne: 'Bekräfta din e-post hos Nextrum',
    rubrik: 'Bekräfta din e-post',
    mening: 'Din förälder har lagt till den här adressen för ditt konto hos Nextrum. Tryck på knappen för att '
      + 'bekräfta att den är din. Sedan kan du logga in med den på nextrum.se/barn, och få mejl om dina pass '
      + 'om din förälder slår på det.',
    knapp: 'Bekräfta adressen',
    mal: 'sajten',
    fakta: [],
  };
  if (prov !== 'nej') innehall.amne = `[Prov till barn] ${innehall.amne}`;
  return renderaRam({
    roll: 'parent',
    halsning: 'Hej!',
    innehall,
    knappAdress: `${BARN_VY}?bekrafta=${encodeURIComponent(d.kod)}`,
    varfor: 'Du får det här för att någon har lagt till den här adressen för ett barnkonto hos Nextrum.',
    // Ett svar på något föräldern just gjort, inte en prenumeration.
    avregistrera: null,
    val: null,
    provrad: prov === 'nej' ? null
      : 'Det här är ett prov av bekräftelsemejlet till ett barn. Knappen bekräftar barnets adress på riktigt.',
    avslutning: 'Känner du inte igen det här? Då kan du strunta i mejlet. Adressen används inte förrän någon '
      + 'trycker på knappen, och länken slutar gälla efter sju dagar.',
  });
}

/** Ämne, text och HTML för en rad till ett barn. Kastar för en sort som inte är barnets. */
export function renderaBarnMejl(rad: BarnMejlIn): Renderat {
  const d = renData(rad.data);
  if (rad.typ === BARN_BEKRAFTA) return bekraftelse(d, rad.prov);
  if (!arBarnMejltyp(rad.typ)) throw new Error(`Ingen mejlmall till barn för typen ${String(rad.typ).slice(0, 40)}.`);

  const innehall = BARN_MALLAR[rad.typ]({ d, nu: rad.nu });
  if (rad.prov !== 'nej') innehall.amne = `[Prov till barn] ${innehall.amne}`;
  const namn = fornamn(rad.fornamn);
  return renderaRam({
    roll: 'parent',
    halsning: namn ? `Hej ${namn}!` : 'Hej!',
    innehall,
    knappAdress: BARN_VY,
    varfor: `Du får det här för att din förälder har slagit på mejl till dig från Nextrum, och mejl om `
      + `${BARN_KATEGORI[rad.typ]} är påslaget.`,
    avregistrera: avregistreringsAdress(rad.prov === 'sandlada' ? null : rad.token),
    val: `${BARN_VY}#installningar`,
    provrad: rad.prov === 'nej' ? null
      : rad.prov === 'sandlada'
        ? 'Det här är ett prov av mejlet till ett barn. Länken för att sluta få mejl är avstängd i provet.'
        : 'Det här är ett prov av mejlet till ett barn.',
  });
}
