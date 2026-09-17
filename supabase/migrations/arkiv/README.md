# Arkivet — de numrerade schemafilerna

Fram till september 2026 skrevs databasändringar som `schema.sql`,
`schema-v2.sql` … `schema-v25.sql` och klistrades in i Supabases SQL Editor.
Numret sa ingenting om vad som faktiskt var kört: tre nummer (v13, v16, v17)
togs två gånger på parallella grenar, och en fil (v13) påstod länge att den
inte var körd fast den var det.

Sedan Fas 3 skrivs ny SQL som `../<version>_<namn>.sql`, med samma version som
Supabases migrationstabell. Filerna här är historik. **Sanningen om vad som är
kört står i databasen**, inte här:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

## Vilken fil motsvarar vilken körning

Kontrollerat mot `supabase_migrations.schema_migrations` i projektet
`ddkfiuvcppalutfulvbi` den 17 september 2026. Filerna i tabellen står i den
ordning de ska köras i en ny miljö.

| Fil | Version(er) i databasen | Anmärkning |
|---|---|---|
| `schema.sql` | — | Kördes i SQL Editor innan migrationstabellen användes. **Rensar tabellerna** — kör bara i en tom miljö. |
| `schema-v2.sql` | — | Som ovan. |
| `schema-v3.sql` | — | Som ovan. |
| `schema-v4.sql` | `20260903204828` v4_meddelanden_och_tidsforslag | |
| `schema-v5.sql` | `20260904083115` v5_laxor_material_progress_tillganglighet | |
| `schema-v6.sql` | `20260904085134` v6_lagring_material_och_profilbilder | |
| `schema-v7.sql` | `20260904091142` v7_serier_notiser_omdomen, `20260904091804` v7b_familjens_anteckningar_egen_tabell | Filen innehåller båda delarna. |
| `schema-v8.sql` | `20260905174200` v8_fakturor_och_utbetalningar | |
| `schema-v9.sql` | `20260905174333` v9_hela_timmar_utan_overlapp | |
| `schema-v10.sql` | `20260907192206` v10_klientfel | |
| `schema-v11.sql` | `20260909104020`, `20260909104051`, `20260909104153`, `20260909104226` (och fem tillfälliga körningar samma förmiddag för att prova cv-hinken) | Webhooken längst ned är bortkommenterad; den ersattes av `schema-v25.sql`. |
| `schema-v12.sql` | `20260909191538` ta_bort_skola_ur_publika_vyn | |
| — | `20260910094436` fast_search_path_pa_handle_new_user | Kördes utan egen fil. |
| `schema-v13-agenter.sql` | `20260910161738` schema_v13_agenter | |
| `schema-v13.sql` | `20260910211538` schema_v13_admin | Rubriken påstod "INTE applicerad"; rättad. |
| `schema-v14.sql` | `20260911100803` v14_matchning_per_elev, `20260911103515` v14b, `20260911103759` v14c | |
| `schema-v16-rapportomdome.sql` | `20260914221715` v15_lektionsrapport_omdome | Skrevs som v15 på en gren, bytte namn vid mergen. |
| `schema-v15.sql` | `20260915091701` v15_bookings_location | |
| `schema-v17-sokvag.sql` | `20260915111654` v17_sokvag_och_fortnox_token_grants | |
| `schema-v18.sql` | `20260915113628` v18_tjansten_blir_ett_begrepp | |
| `schema-v16.sql` | `20260915141203` v16_stang_infolackor_och_las_search_path, `20260915141223` v16b, `20260915141335` v16c | Kördes efter v18. |
| `schema-v17.sql` | `20260915144047` notis_hemlighet_i_databasen | |
| `schema-v19.sql` | `20260915211714` v19_tjansterna_pa_engelska | |
| `schema-v20.sql` | `20260915214017` v20_rabattkoder_och_flera_barn | |
| `schema-v21.sql` | `20260915215828` v21_foralder_far_ta_bort_barn | |
| `schema-v22.sql` | — | **Aldrig körd. Kör inte.** Ersatt av `schema-v25.sql`. |
| `schema-v23.sql` | `20260916110427` v23_publicering_blir_ett_aktivt_val | Vyn den skapar är ersatt av funktionen `publika_studiehjalpare` (Fas 1.3). |
| `schema-v24.sql` | `20260916112225` v24_rekryteringssteg_pa_ansokan | |
| `schema-v25.sql` | `20260916113349` v25_notistriggrar_fran_notis_konfig | |

Efter arkivet kommer filerna i `supabase/migrations/`, i namnordning.

## Ändra inte filerna här

De beskriver vad som hände. En rättelse görs som en ny migration i
`supabase/migrations/`, inte genom att skriva om historiken.
