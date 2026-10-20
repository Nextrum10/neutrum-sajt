// ============================================================
// NEXTRUM — mejlet till den som går vidare till intervju (2026-10-21)
//
// När admin skickar en ansökan vidare till intervju köar databasen ett
// mejl till den som sökt, en gång per ansökan
// (applications.intervju_mejl_skickat_at, intern.ansokan_intervjumejl).
// Det går genom notiskön, inte genom ansokan-notis: kön följer
// sandlådan och strömbrytaren notiser_mejl (notis_utskick_ta), och det
// mejlet skulle göra det. Raden har ansokan_id i stället för en
// mottagare med konto, och kön lämnar ut den med rollen 'sokande'.
//
// TEXTEN ÄR LEOS. Inget läggs till: ingen rubrik, ingen knapp, ingen
// fot och ingen avregistrering. Det är ett besked om en ansökan
// mottagaren själv skickat, som kvittot och de andra mejlen till den
// som söker (ansokan.ts), och det kommer från info@, där svar läses.
// Samma text står i adminvyn, som visar mejlet innan steget sätts
// (INTERVJU_MEJLET i nextrum-admin-rekrytering.js;
// verktyg/kolla-mejltexter.py håller dem lika).
//
// BOKNINGSLÄNKEN (2026-10-20, Leo: "lägg in bokningslänken i det
// automatiska meddelandet"): mejlet är kallelsen, och hen bokar en tid
// själv på bokningssidan i Google Kalender, som mejlar tiden och
// Meet-länken. Förut sa det andra stycket att inbjudan kom senare.
// Länken är en vanlig länk, ingen knapp, och adressen är
// INTERVJU_BOKNING_URL i nextrum-config.js: funktionen läser inte
// configen, så kolla-mejltexter.py håller de tre lika. Byts
// bokningssidan byts adressen på alla tre ställena.
// ============================================================

import { esc } from '../http.ts';
import { FARG, KONTAKT, SANS, skal, type ProvLage, type Renderat } from './rendera.ts';
import { fornamn } from './typer.ts';

/** Avsändaren: info@, där svaren läses, som för de andra mejlen till den som söker. */
export const INTERVJU_FRAN = `Nextrum <${KONTAKT}>`;

/** Notistypen i kön. Bara den här typen går till en ansökan. */
export const INTERVJU_TYP = 'ansokan_intervju';

/** Rollen notis_utskick_ta lämnar ut för en rad med ansokan_id. */
export const SOKANDE = 'sokande';

export const INTERVJU = {
  amne: 'Du går vidare till intervju',
  forsta: 'Tack för din ansökan till Nextrum. Vi har läst den och du går vidare till intervjufasen.',
  boka: 'Boka en tid för intervjun som passar dig här:',
  lank: 'https://calendar.app.google/rRiTTLP5ymKQunSv7',
  andra: 'Intervjun hålls i Google Meet, och länken till mötet kommer i bekräftelsen när du har bokat. '
    + 'Du behöver inget Google-konto. Passar ingen av tiderna får du gärna mejla oss på info@nextrum.se.',
  halsning: 'Hälsningar',
  signatur: 'Leo och Alex, Nextrum',
};

export type IntervjuIn = {
  /** Förnamnet ur ansökan. Går genom förnamnsregeln här också. */
  fornamn: string | null;
  prov: ProvLage;
};

/** Ämne, text och HTML. Hälsningen är "Hej {förnamn}!", eller "Hej!" utan ett förnamn. */
export function renderaIntervjuMejl(rad: IntervjuIn): Renderat {
  const namn = fornamn(rad.fornamn);
  const hej = namn ? `Hej ${namn}!` : 'Hej!';
  const provrad = rad.prov === 'nej' ? null
    : 'Det här är ett prov av mejlet till den som går vidare till intervju. Det gick till sandlådan, inte till den som sökt.';
  const amne = rad.prov === 'nej' ? INTERVJU.amne : `[Prov till sökande] ${INTERVJU.amne}`;

  const text = [
    ...(provrad ? [provrad, ''] : []),
    hej, '',
    INTERVJU.forsta, '',
    INTERVJU.boka,
    INTERVJU.lank, '',
    INTERVJU.andra, '',
    INTERVJU.halsning,
    INTERVJU.signatur,
  ].join('\n') + '\n';

  const p = (inre: string, marginal = 16) =>
    `<p style="margin:0 0 ${marginal}px;font:400 16px/1.6 ${SANS};color:${FARG.brod}">${inre}</p>`;
  /* Adressen i texten blir en länk, men orden runt den är Leos. */
  const andra = esc(INTERVJU.andra).replace(esc(KONTAKT),
    `<a href="mailto:${KONTAKT}" style="color:${FARG.text}">${esc(KONTAKT)}</a>`);
  const boka = `${esc(INTERVJU.boka)}<br><a href="${esc(INTERVJU.lank)}" style="color:${FARG.text}">${esc(INTERVJU.lank)}</a>`;
  const innehall = p(esc(hej)) + p(esc(INTERVJU.forsta)) + p(boka) + p(andra, 22)
    + p(`${esc(INTERVJU.halsning)}<br>${esc(INTERVJU.signatur)}`, 0);

  return { amne, text, html: skal({ amne, forhandstext: INTERVJU.forsta, innehall, provrad }) };
}
