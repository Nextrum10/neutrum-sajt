import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  dragning, KORTRESERVATION, kortetsDelar, nekadKod, nyckelFor, reservationensPass, reservationsbelopp,
  reserveradTill, slappetsLage,
} from './kortreservation.ts';

const PASS = '3f2b6c1e-8d4a-4b7e-9f10-2a3b4c5d6e7f';
const PRIS = { timprisOre: 39900, extraOre: 6900, barn: 1, rabattOre: 0 };

Deno.test('reservationens pass läses bara ur vår egen nyckel, i uuid-form', () => {
  assertEquals(reservationensPass({ [KORTRESERVATION]: PASS }), PASS);
  // booking_id är kassans nyckel: den betyder inte en reservation.
  assertEquals(reservationensPass({ booking_id: PASS }), null);
  assertEquals(reservationensPass({ [KORTRESERVATION]: 'inte-ett-id' }), null);
  assertEquals(reservationensPass({ [KORTRESERVATION]: 42 }), null);
  assertEquals(reservationensPass(null), null);
  assertEquals(reservationensPass(undefined), null);
});

Deno.test('kortets delar: märke, sista fyra och giltighetstid i sparade_korts former', () => {
  assertEquals(kortetsDelar({ id: 'pm_1Abc', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } }),
    { metod: 'pm_1Abc', marke: 'visa', sista4: '4242', manad: 12, ar: 2030 });
  // Ett fält utan formen blir null; kortet sparas ändå.
  assertEquals(kortetsDelar({ id: 'pm_1Abc', card: { brand: 'Visa', last4: '42', exp_month: 13, exp_year: 1999 } }),
    { metod: 'pm_1Abc', marke: 'visa', sista4: null, manad: null, ar: null });
  assertEquals(kortetsDelar({ id: 'pm_1Abc', card: { brand: 'diners club!', last4: 4242 } }),
    { metod: 'pm_1Abc', marke: null, sista4: null, manad: null, ar: null });
  assertEquals(kortetsDelar({ id: 'pm_1Abc' }), { metod: 'pm_1Abc', marke: null, sista4: null, manad: null, ar: null });
  // Utan ett id i Stripes form finns inget kort.
  assertEquals(kortetsDelar({ id: 'card_1Abc', card: { brand: 'visa' } }), null);
  assertEquals(kortetsDelar('pm_1Abc'), null);
  assertEquals(kortetsDelar(null), null);
});

Deno.test('reservationen håller priset för den bokade tiden, med syskon och rabatt', () => {
  assertEquals(reservationsbelopp(60, PRIS), 39900);
  assertEquals(reservationsbelopp(90, PRIS), 59850);
  // Syskon: ett fast tillägg per timme (69 kr).
  assertEquals(reservationsbelopp(60, { ...PRIS, barn: 2 }), 46800);
  // En rabatt dras en gång, och priset blir aldrig under noll.
  assertEquals(reservationsbelopp(120, { ...PRIS, rabattOre: 39900 }), 39900);
  assertEquals(reservationsbelopp(60, { ...PRIS, rabattOre: 50000 }), 0);
});

Deno.test('dragningen: den hållna tiden, högst det reserverade, och minuterna den avser', () => {
  const reserverat = reservationsbelopp(60, PRIS);
  // Som bokat.
  assertEquals(dragning({ familjensMin: 60, bokadeMin: 60, reserveratOre: reserverat, pris: PRIS }),
    { belopp: 39900, minuter: 60 });
  // Kortare än bokat: bara den hållna tiden, per påbörjad kvart (45 minuter).
  assertEquals(dragning({ familjensMin: 45, bokadeMin: 60, reserveratOre: reserverat, pris: PRIS }),
    { belopp: 29925, minuter: 45 });
  // Längre än bokat: reservationen dras hel, och minuterna är de bokade, så
  // att resten blir ett tillägg (passunderlag.betalda_min läser stripe_minuter).
  assertEquals(dragning({ familjensMin: 90, bokadeMin: 60, reserveratOre: reserverat, pris: PRIS }),
    { belopp: 39900, minuter: 60 });
  // Övertiden som timbanken tog är redan dragen ur familjensMin: som bokat.
  assertEquals(dragning({ familjensMin: 75 - 15, bokadeMin: 60, reserveratOre: reserverat, pris: PRIS }),
    { belopp: 39900, minuter: 60 });
  // Första timmen bjuden på ett pass om två timmar, och passet blev en timme:
  // inget att dra, reservationen släpps.
  const bjuden = { ...PRIS, rabattOre: 39900 };
  assertEquals(dragning({ familjensMin: 60, bokadeMin: 120, reserveratOre: reservationsbelopp(120, bjuden), pris: bjuden }),
    { belopp: 0, minuter: 60 });
});

Deno.test('ett nekat kort står på reservationen; Stripe nere eller vårt fel gör det inte', () => {
  assertEquals(nekadKod({ typ: 'card_error', kod: 'card_declined', meddelande: 'x', status: 402 }), 'card_declined');
  assertEquals(nekadKod({ typ: 'card_error', kod: 'authentication_required', meddelande: 'x', status: 402 }),
    'authentication_required');
  assertEquals(nekadKod({ typ: 'card_error', kod: '', meddelande: 'x', status: 402 }), 'nekat');
  assertEquals(nekadKod({ typ: 'card_error', kod: 'Konstig-Kod', meddelande: 'x', status: 402 }), 'nekat');
  assertEquals(nekadKod({ typ: 'invalid_request_error', kod: 'resource_missing', meddelande: 'x', status: 400 }),
    'kortet_saknas');
  assertEquals(nekadKod({ typ: 'invalid_request_error', kod: 'parameter_unknown', meddelande: 'x', status: 400 }), null);
  assertEquals(nekadKod({ typ: 'api_error', kod: '', meddelande: 'x', status: 500 }), null);
  assertEquals(nekadKod({ typ: 'rate_limit_error', kod: 'rate_limit', meddelande: 'x', status: 429 }), null);
});

Deno.test('släppet: våra egna orsaker är släppt, Stripes är utgången', () => {
  assertEquals(slappetsLage('requested_by_customer'), 'slappt');
  assertEquals(slappetsLage('duplicate'), 'slappt');
  assertEquals(slappetsLage('abandoned'), 'slappt');
  assertEquals(slappetsLage('automatic'), 'utgangen');
  assertEquals(slappetsLage('expired'), 'utgangen');
  assertEquals(slappetsLage(null), 'utgangen');
  assertEquals(slappetsLage(undefined), 'utgangen');
});

Deno.test('gränsen för dragningen läses ur chargen, annars null', () => {
  assertEquals(reserveradTill({ payment_method_details: { card: { capture_before: 1792000000 } } }),
    new Date(1792000000 * 1000).toISOString());
  assertEquals(reserveradTill({ payment_method_details: { card: {} } }), null);
  assertEquals(reserveradTill({ payment_method_details: { card: { capture_before: '1792000000' } } }), null);
  assertEquals(reserveradTill('ch_1Abc'), null);
  assertEquals(reserveradTill(null), null);
});

Deno.test('nyckeln följer radens ändring: samma läge samma nyckel, nytt försök ny', () => {
  const a = nyckelFor('reservera', PASS, '2026-10-14T08:00:00.123+00:00');
  assertEquals(a, nyckelFor('reservera', PASS, '2026-10-14T08:00:00.123Z'));
  assertEquals(a === nyckelFor('reservera', PASS, '2026-10-14T08:10:00Z'), false);
  assertEquals(a === nyckelFor('debitera', PASS, '2026-10-14T08:00:00.123Z'), false);
  assertEquals(nyckelFor('debitera', PASS, null), `nextrum-debitera-${PASS}-0`);
});
