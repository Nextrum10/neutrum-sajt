// ============================================================
// NEXTRUM — delade konstanter
//
// BETALNINGSVILLKOR_DAGAR stod förut i både fakturering och
// faktura-utskick, och den driftsatta faktureringen hade 14 medan
// allt annat sa 10. Nu finns siffran här, en gång.
//
// SEDAN FAS 14.2 ÄR DEN INGET LÖFTE LÄNGRE. Familjen betalar varje
// pass med kort före passet och får ingen månadsfaktura, så varken
// prissidan, FAQ:n eller användarvillkoren nämner ett antal dagar.
// Konstanten används bara av faktura-utskick, när en faktura som
// skapades före Fas 14.2 skickas — och sådana fanns det noll av när
// månadsfakturan revs. Ändra den inte utan att läsa CLAUDE.md
// avsnitt 1: ett villkor på en faktura som inte stämmer med det
// familjen läst är en tvist, inte ett skrivfel.
// ============================================================

export const BETALNINGSVILLKOR_DAGAR = 10;

export const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
                        'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
