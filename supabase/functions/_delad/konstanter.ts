// ============================================================
// NEXTRUM — delade konstanter
//
// BETALNINGSVILLKOR_DAGAR stod förut i både fakturering och
// faktura-utskick, och den driftsatta faktureringen hade 14 medan
// allt annat sa 10. Nu finns siffran här, en gång.
//
// Den måste stämma med prissidan, FAQ:n, användarvillkoren, adminvyn
// och maskoten. verktyg/kolla-betalningsvillkor.py kontrollerar det.
// En faktura som förfaller på en annan dag än villkoret lovar är en
// tvist, inte ett skrivfel.
// ============================================================

export const BETALNINGSVILLKOR_DAGAR = 10;

export const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
                        'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
