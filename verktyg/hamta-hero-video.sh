#!/usr/bin/env bash
# ============================================================
# NEXTRUM — hämta och komprimera hero-videon
#
# De inloggade vyerna letar efter bilder/hero-studievy.mp4 och
# visar hero-fotot så länge filen inte finns. Det här skriptet
# hämtar ett färdigt klipp från Higgsfield, komprimerar det och
# lägger det på rätt plats.
#
#   ./verktyg/hamta-hero-video.sh <url-eller-sökväg> [--pendel]
#
# Tar antingen en adress att hämta ifrån, eller en fil du redan
# laddat ner:
#
#   ./verktyg/hamta-hero-video.sh https://…/hf_2026….mp4
#   ./verktyg/hamta-hero-video.sh ~/Downloads/hf_2026….mp4
#
# Kör det från projektets rot. Kräver ffmpeg, och curl bara när
# källan är en adress.
#
# --pendel löser loopskarven på ett klipp där kameran rör sig.
# Se kommentaren vid PENDEL nedan innan du använder den.
#
# Varför ett skript och inte två kommandon: ffmpeg-raden har fem
# flaggor där var och en gör något som spelar roll, och den ska
# köras om varje gång klippet görs om. En rad man klistrar in ur
# ett chattfönster blir förr eller senare fel.
# ============================================================
set -euo pipefail

URL=""
PENDEL=0
SLUTEN=0
for arg in "$@"; do
  case "$arg" in
    --pendel) PENDEL=1 ;;
    --sluten) SLUTEN=1 ;;
    -*)       echo "Okänd flagga: $arg" >&2; exit 1 ;;
    *)        URL="$arg" ;;
  esac
done

if [ "$PENDEL" = "1" ] && [ "$SLUTEN" = "1" ]; then
  echo "--pendel och --sluten löser samma problem på två sätt. Välj en." >&2
  exit 1
fi

# Övertoningens längd i sekunder. 0,8 räcker för att dölja en liten
# glidning utan att kännas som en effekt. Blir skarven för stor för
# det är klippet fel, inte siffran.
TONING=0.8

MAL="bilder/hero-studievy.mp4"
RA="$(mktemp -t hero-ra-XXXXXX.mp4)"
trap 'rm -f "$RA"' EXIT

if [ -z "$URL" ]; then
  echo "Användning: $0 <url-eller-sökväg> [--pendel]" >&2
  echo "Adressen står i HERO-VIDEO.md. Har du redan laddat ner filen" >&2
  echo "går det lika bra att peka på den: $0 ~/Downloads/klippet.mp4" >&2
  exit 1
fi

if [ ! -d bilder ]; then
  echo "Hittar ingen bilder/-katalog. Kör skriptet från projektets rot." >&2
  exit 1
fi

command -v ffmpeg >/dev/null || { echo "ffmpeg saknas." >&2; exit 1; }

# En lokal fil kopieras i stället för att hämtas. Skälet är inte
# bekvämlighet: när CDN:et är blockerat, som det är från vissa nät,
# är en redan nedladdad fil enda vägen in — och då ska skriptet inte
# kräva en adress som ändå inte går att nå.
if [ -f "$URL" ]; then
  echo "Läser $URL"
  cp "$URL" "$RA"
else
  case "$URL" in
    *://*) ;;
    *) echo "Hittar ingen fil på '$URL', och det ser inte ut som en adress." >&2
       exit 1 ;;
  esac
  command -v curl >/dev/null || { echo "curl saknas." >&2; exit 1; }
  echo "Hämtar…"
  curl -fSL --progress-bar -o "$RA" "$URL"
fi

# En tom eller trasig fil ska stoppas här, inte visa sig som ett
# kryptiskt ffmpeg-fel tre rader ner.
if [ ! -s "$RA" ]; then
  echo "Källan gav ingen data." >&2
  exit 1
fi

echo "Komprimerar…"
# -an        tar bort ljudspåret helt. Videon är dekor bakom text,
#            den spelas muted och har aria-hidden. Ett ljudspår
#            ingen hör är bara vikt.
# scale      1600 bred räcker: blocket är aldrig bredare än så, och
#            filen laddas av varje inloggad person vid varje besök.
# crf 30     hårt, men bilden ligger bakom en mörk slöja med text
#            över — artefakter som syns i en fullskärmsvisning
#            försvinner där.
# faststart  lägger metadatan först så att uppspelningen kan börja
#            innan hela filen laddats. Utan den står blocket still
#            tills sista byten kommit.
# PENDEL
# En kamera som rör sig gör loopen synlig: sista bildrutan ligger en
# bit ifrån den första, och webbläsaren hoppar tillbaka varje varv.
#
# Pendeln klistrar klippet mot sin egen baklängesversion. Kameran
# glider åt höger och sedan tillbaka, och start och slut är samma
# bildruta — skarven försvinner helt.
#
# Priset: allt annat går också baklänges i andra halvan. Pennan
# skriver bort det den nyss skrev, och ett nickande huvud nickar
# uppåt. Bakom en mörk slöja i åtta sekunder märks det sällan, men
# titta på resultatet innan du bestämmer dig. Utan flaggan får du
# klippet rakt av, med en synlig skarv var åttonde sekund.
#
# Längden fördubblas, filstorleken inte fullt ut — andra halvan är
# samma bilder och komprimerar hårt.
# SLUTEN
# Den bästa loopfixen när kameran nästan står still men glider en
# aning: tona slutet tillbaka in i början.
#
# Klippet börjar om vid TONING sekunder i stället för vid noll, och
# de sista TONING sekunderna korsklipps med de första. Sista rutan
# blir då exakt samma bild som den första, och skarven upphör att
# finnas — utan att något går baklänges, till skillnad från pendeln.
#
# Kostnaden är TONING sekunder av klippet, inget annat.
if [ "$SLUTEN" = "1" ]; then
  D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$RA")
  # Kroppen är klippet från TONING och framåt. Huvudet, de första
  # TONING sekunderna, tonas in ovanpå dess sista TONING sekunder.
  FORSKJUT=$(awk "BEGIN{printf \"%.3f\", $D - 2*$TONING}")
  if awk "BEGIN{exit !($FORSKJUT <= 0)}"; then
    echo "Klippet är för kort för en övertoning på ${TONING}s." >&2
    exit 1
  fi
  echo "  (sluten: slutet tonas tillbaka in i början, ${TONING}s)"
  ffmpeg -y -loglevel error -i "$RA" -filter_complex "\
[0:v]scale=1600:-2,split[kropp][huvud];\
[huvud]trim=duration=$TONING,format=yuva420p,fade=t=in:st=0:d=$TONING:alpha=1,setpts=PTS+$FORSKJUT/TB[in];\
[kropp]trim=start=$TONING,setpts=PTS-STARTPTS[bas];\
[bas][in]overlay=eof_action=pass:format=auto[ut]" \
    -map "[ut]" -an \
    -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p \
    -movflags +faststart \
    "$MAL"
elif [ "$PENDEL" = "1" ]; then
  echo "  (pendel: klippet speglas så att loopen går ihop)"
  ffmpeg -y -loglevel error -i "$RA" \
    -filter_complex "[0:v]scale=1600:-2,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[ut]" \
    -map "[ut]" -an \
    -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p \
    -movflags +faststart \
    "$MAL"
else
  ffmpeg -y -loglevel error -i "$RA" \
    -an -vf "scale=1600:-2" \
    -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p \
    -movflags +faststart \
    "$MAL"
fi

STORLEK=$(du -h "$MAL" | cut -f1)
echo "✓ $MAL — $STORLEK"

# Över tre megabyte är för mycket för något varje inloggad person
# laddar vid varje besök, ofta på mobil. Säg till i stället för att
# låta det upptäckas av en förälder på tåget.
BYTE=$(wc -c < "$MAL")
if [ "$BYTE" -gt 3145728 ]; then
  echo "⚠️  Större än 3 MB. Höj -crf till 32–34 och kör igen." >&2
fi

echo
echo "Filen används av foralder.html, larare.html och admin.html utan"
echo "att någon kod behöver ändras. Ladda om en av vyerna för att se den."
