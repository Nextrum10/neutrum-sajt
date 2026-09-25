// ============================================================
// NEXTRUM — delade konstanter
//
// BETALNINGSVILLKOR_DAGAR stod förut i både fakturering och
// faktura-utskick, och den driftsatta faktureringen hade 14 medan
// allt annat sa 10. Nu finns siffran här, en gång.
//
// FAS 14.2 GJORDE DEN TILL HISTORIA, FAS 14.6 TILL ETT LÖFTE IGEN.
// Familjen kan välja faktura på ett pass, och passen samlas på en
// månadsfaktura med den här betalningstiden. Fakturan skapas i Wint,
// så Wints betalningsvillkor ska vara samma siffra. En spegel står i
// nextrum-config.js för vyerna, och verktyg/kolla-betalningsvillkor.py
// jämför de två. Ändra den inte utan att läsa CLAUDE.md avsnitt 1: ett
// villkor på en faktura som inte stämmer med det familjen läst är en
// tvist, inte ett skrivfel.
// ============================================================

export const BETALNINGSVILLKOR_DAGAR = 10;

export const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
                        'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
