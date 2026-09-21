# Migrationer som väntar på ett ja

Här ligger SQL som är skriven och testad men **inte körd i driften**,
eftersom den kräver ett uttryckligt ja från Leo. Mappen ligger med flit
utanför `supabase/migrations/`: där ska bara det ligga som faktiskt är
kört, med exakt den version `apply_migration` registrerade
(`verktyg/kolla-migrationer.py`).

När en fil här körs:

1. Kör den med `apply_migration`, oförändrad.
2. Läs versionen ur `supabase_migrations.schema_migrations`. Gissa den inte.
3. Flytta filen till `supabase/migrations/<version>_<namn>.sql` i samma commit.
4. Kör `verktyg/rls-test.sql`. Raderna som börjar på det här stegets
   nummer ska gå från röda till gröna.

## `r2_fas1_7_utbetalningsmetod.sql`

Program 2, Fas 1, punkt 4: studiehjälparens bankkonto eller Swishnummer.
Stoppades av behörighetskontrollen som en driftändring, eftersom den
skapar en ny nyckel i Vault och en tabell för bankuppgifter.

Insamlingen är dessutom avstängd av flaggan `utbetalningsmetod` tills
integritetspolicyn beskriver uppgifterna, så att köra migrationen
öppnar ingenting för studiehjälparna. Den gör bara att funktionerna
finns. Gränssnittet fungerar redan utan dem: det visar att funktionen
inte är öppnad än.
