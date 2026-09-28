// ============================================================
// NEXTRUM — Edge Function: ansokan-gallring
//
// Tar bort ansökningar som inte ledde till anställning när de är ett
// år gamla, och CV:t med dem, som integritetspolicyn lovar. Väcks av
// intern.ansokan_gallring_vack() i databasen med pg_net, varje natt
// och bara när något är förfallet.
//
// DATABASEN BESTÄMMER, FUNKTIONEN TAR BORT
//
// Regeln, vilka filer som hör till vilken ansökan och vilka filer som
// saknar ansökan står i migrationen ansokningar_gallras_efter_ett_ar.
// Funktionen finns bara för att en fil i Storage inte går att ta bort
// med SQL: storage.objects har triggern protect_objects_delete, och
// bara Storage-API:t tar bort både raden och själva filen. Arbetet,
// med filen först och raden sedan, ligger i _delad/gallring.ts.
//
// SÄKERHET: samma delade hemlighet som notis-ko och ansokan-notis, i
// x-nextrum-notis, jämförd i konstant tid mot notis_konfig. verify_jwt
// är av (config.toml) eftersom anroparen är databasen. De tre
// funktionerna den anropar kan bara service_role köra.
//
// ETT DELVIS MISSLYCKANDE ÄR 500. Svaret hamnar i net._http_response,
// och det är där man tittar. Står det 200 är allt som listades borta
// eller fick vänta på tiden; allt annat ska se ut som ett fel. Där
// står antal och korta skäl, aldrig ett filnamn: det är vad den
// sökande själv döpt filen till.
// ============================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { CORS, db, hemlighetOk, json } from '../_delad/notis.ts';
import { preflight } from '../_delad/http.ts';
import { gallra, lagringsfel, type Forfallen } from '../_delad/gallring.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405);

  let klient: SupabaseClient;
  try {
    klient = db();
    if (!await hemlighetOk(req, klient)) return json({ error: 'Fel eller saknad hemlighet.' }, 401);
  } catch {
    console.error('ansokan-gallring: hemligheten gick inte att pröva');
    return json({ error: 'Tjänsten är inte tillgänglig just nu.' }, 500);
  }

  try {
    const s = await gallra({
      forfallna: async () => {
        const { data, error } = await klient.rpc('ansokan_gallring_lista');
        if (error) throw new Error('ansokan_gallring_lista ' + (error.code ?? ''));
        return (Array.isArray(data) ? data : []) as Forfallen[];
      },
      foraldralosa: async () => {
        const { data, error } = await klient.rpc('cv_foraldralosa');
        if (error) throw new Error('cv_foraldralosa ' + (error.code ?? ''));
        return (Array.isArray(data) ? data : []).map((r: { namn?: unknown }) => String(r?.namn ?? ''));
      },
      gallra: async (id) => {
        const { data, error } = await klient.rpc('ansokan_gallra', { p_id: id });
        if (error) throw new Error('ansokan_gallra ' + (error.code ?? ''));
        return String(data);
      },
      taBort: async (namn) => {
        const { data, error } = await klient.storage.from('cv').remove(namn);
        if (error) return { fel: lagringsfel(error) };
        return { borttagna: (data ?? []).map((o) => o.name) };
      },
      logg: (rad) => console.log('ansokan-gallring: ' + rad),
    });

    const ok = s.fel.length === 0;
    if (!ok) console.error('ansokan-gallring:', s.fel.length, 'fel');
    return json({ ok, ...s }, ok ? 200 : 500);
  } catch (e) {
    // Listan gick inte att läsa. Ingenting är borttaget.
    console.error('ansokan-gallring:', e instanceof Error ? e.message : 'okänt fel');
    return json({ error: 'Gallringen avbröts innan något togs bort.' }, 500);
  }
});
