// ============================================================
// NEXTRUM — Edge Function: barn-konto (barnkonton_och_admin)
//
// Barnets egen inloggning, skapad och skött av föräldern i studievyn:
//
//   skapa               användarnamn, lösenord, vårdnadshavarens ja
//   byt_losenord        genom ändringsfönstret i databasen
//   pausa / aktivera    barn_aktiv, och en spärr i Auth
//   ta_bort_inloggning  kontot i Auth; databasen tömmer resten
//
// Barnet blir en egen användare i Auth med den syntetiska adressen
// <användarnamn>@barn.nextrum.se, bekräftad från början, och
// app_metadata { roll: 'barn', forald_id, barn_id }. Rollen i databasen
// blir nextrum_barn (triggern auth_barnkonto_skapas sätter den vad
// anropet än säger), och kopplingen till barnet görs av databasen i
// samma transaktion som kontot skapas.
//
// SÄKERHET
// verify_jwt är PÅ. Förälderns egen token prövas mot Auth och mot RLS
// innan service_role används, och raden jämförs med den inloggade:
// en admin läser alla barn men är inte förälder till dem. Reglerna
// står i _delad/barnkonto.ts, som provas utan nät i barnkonto_test.ts.
//
// ALDRIG RÅA FEL UTÅT. Svaret visas för föräldern; felet från Auth
// eller databasen stannar i funktionens logg, utan adress och lösenord.
// ============================================================

import { json, preflight } from '../_delad/http.ts';
import { kravInloggad, serviceklient } from '../_delad/auth.ts';
import { type Barnrad, hanteraBarnkonto } from '../_delad/barnkonto.ts';

/** Felets namn och kod, aldrig meddelandet: det kan upprepa adressen. */
function logga(vad: string, fel: unknown): string {
  const f = fel as { name?: unknown; code?: unknown; status?: unknown } | null;
  console.error(`barn-konto ${vad}:`, String(f?.name ?? ''), String(f?.code ?? ''), String(f?.status ?? ''));
  return String((fel as { message?: unknown } | null)?.message ?? fel ?? 'fel');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405);

  try {
    const vem = await kravInloggad(req.headers.get('Authorization'));
    if (!vem.ok) return vem.svar;

    const db = serviceklient();
    const svar = await hanteraBarnkonto(await req.json().catch(() => null), {
      anvandare: vem.anvandare,
      appMetadata: vem.appMetadata,

      lasEgetBarn: async (barnId) => {
        const { data, error } = await vem.klient.from('students').select('id, parent_id').eq('id', barnId).maybeSingle();
        if (error) throw new Error('students (förälderns token) ' + (error.code ?? ''));
        return data as { id: string; parent_id: string } | null;
      },
      lasBarn: async (barnId) => {
        const { data, error } = await db.from('students')
          .select('id, parent_id, user_id, anvandarnamn, barn_aktiv, raderad_at').eq('id', barnId).maybeSingle();
        if (error) throw new Error('students ' + (error.code ?? ''));
        return data as Barnrad | null;
      },
      anvandarnamnUpptaget: async (namn) => {
        const { data, error } = await db.from('students').select('id').eq('anvandarnamn', namn).limit(1);
        if (error) throw new Error('students anvandarnamn ' + (error.code ?? ''));
        return (data ?? []).length > 0;
      },
      skapaAnvandare: async ({ epost, losenord, appMetadata }) => {
        const { data, error } = await db.auth.admin.createUser({
          email: epost,
          password: losenord,
          email_confirm: true,
          app_metadata: appMetadata,
          user_metadata: {},
          // Databasen sätter rollen själv (auth_barnkonto_skapas); den
          // står här för att svaret från Auth ska säga samma sak.
          role: 'nextrum_barn',
        });
        if (error) return { id: null, fel: logga('skapa', error) };
        return { id: data?.user?.id ?? null, fel: null };
      },
      kopplad: async (barnId) => {
        const { data, error } = await db.from('students').select('user_id').eq('id', barnId).maybeSingle();
        if (error) throw new Error('students user_id ' + (error.code ?? ''));
        return (data as { user_id: string | null } | null)?.user_id ?? null;
      },
      bytLosenord: async (userId, losenord) => {
        const { error } = await db.auth.admin.updateUserById(userId, { password: losenord });
        return error ? logga('byt_losenord', error) : null;
      },
      sattPaus: async (userId, banTid) => {
        const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: banTid });
        return error ? logga('paus', error) : null;
      },
      sattAktiv: async (barnId, aktiv) => {
        const { error } = await db.from('students').update({ barn_aktiv: aktiv }).eq('id', barnId);
        return error ? logga('barn_aktiv', error) : null;
      },
      taBortAnvandare: async (userId) => {
        const { error } = await db.auth.admin.deleteUser(userId);
        return error ? logga('ta_bort', error) : null;
      },
      oppnaFonster: async (barnId) => {
        const { error } = await db.from('barn_andringsfonster').insert({ barn_id: barnId });
        return error ? logga('fönster', error) : null;
      },
      stangFonster: async (barnId) => {
        const { error } = await db.from('barn_andringsfonster').delete().eq('barn_id', barnId);
        if (error) logga('stäng fönster', error);
      },
      loggaUt: async (barnId) => {
        const { error } = await db.rpc('barnkonto_logga_ut', { p_barn: barnId });
        if (error) logga('logga ut', error);
      },
    });
    return json(svar.kropp, svar.status);
  } catch (e) {
    logga('oväntat', e);
    return json({ error: 'Något gick fel. Försök igen om en stund.' }, 500);
  }
});
