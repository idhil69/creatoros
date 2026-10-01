#!/bin/sh
# CreatorOS push — teruskan stream masuk ke semua target RTMP serentak.
# RTMP_TARGETS diisi di .env, dipisah "|" antar platform.
# -c copy = TANPA transcode (Larix/OBS sudah kirim H.264+AAC) → CPU nyaris nol.

if [ -z "$RTMP_TARGETS" ]; then
  echo "[push] RTMP_TARGETS kosong — tidak ada tujuan. Isi di .env lalu docker compose restart."
  exit 0
fi

SRC="rtmp://127.0.0.1:1935/${MTX_PATH:-live}"
echo "[push] mulai: $SRC → $(echo "$RTMP_TARGETS" | tr '|' '\n' | wc -l) target"

# Bangun output tee: [f=flv:onfail=ignore]url1|[f=flv:onfail=ignore]url2|...
TEE=""
OLD_IFS="$IFS"; IFS='|'
for t in $RTMP_TARGETS; do
  [ -z "$t" ] && continue
  [ -n "$TEE" ] && TEE="$TEE|"
  TEE="$TEE[f=flv:onfail=ignore]$t"
done
IFS="$OLD_IFS"

exec ffmpeg -hide_banner -loglevel warning \
  -i "$SRC" \
  -c copy -map 0:v? -map 0:a? \
  -flags +global_header \
  -f tee "$TEE"
