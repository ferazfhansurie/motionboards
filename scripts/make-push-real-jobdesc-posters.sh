#!/bin/zsh
set -euo pipefail

ROOT="/Users/faeez/motionboards"
OUT="$ROOT/FatHopes IMG/push-posters-real-jobdesc"
FONT="/System/Library/Fonts/HelveticaNeue.ttc"
mkdir -p "$OUT"

make_poster() {
  local src="$1"
  local out="$2"
  local headline="$3"
  local subline="$4"
  local job1="$5"
  local job2="$6"
  local job3="$7"

  ffmpeg -y -loglevel error -i "$src" -vf "scale=1003:1568:force_original_aspect_ratio=increase,crop=1003:1568,eq=saturation=1.06:contrast=1.03,drawbox=x=0:y=0:w=1003:h=705:color=white@0.88:t=fill,drawbox=x=58:y=58:w=280:h=54:color=white@0.70:t=fill,drawtext=fontfile='$FONT':text='FatHopes':fontcolor=#101820:fontsize=36:x=92:y=65,drawtext=fontfile='$FONT':text='ENERGY':fontcolor=#4bad51:fontsize=16:x=94:y=105,drawtext=fontfile='$FONT':text='PROGRAM PUSH':fontcolor=#101820:fontsize=26:x=58:y=168,drawtext=fontfile='$FONT':text='$headline':fontcolor=#101820:fontsize=66:fontcolor=#101820:x=58:y=216:line_spacing=8,drawtext=fontfile='$FONT':text='$subline':fontcolor=#101820:fontsize=36:x=58:y=430:line_spacing=6,drawbox=x=58:y=515:w=887:h=218:color=white@0.86:t=fill,drawtext=fontfile='$FONT':text='JOB DESC':fontcolor=#4bad51:fontsize=29:x=88:y=548,drawtext=fontfile='$FONT':text='•  $job1':fontcolor=#101820:fontsize=27:x=88:y=600,drawtext=fontfile='$FONT':text='•  $job2':fontcolor=#101820:fontsize=27:x=88:y=652,drawtext=fontfile='$FONT':text='•  $job3':fontcolor=#101820:fontsize=27:x=88:y=704,drawbox=x=58:y=1180:w=430:h=94:color=#56bd4d@0.96:t=fill,drawtext=fontfile='$FONT':text='MOHON SEKARANG':fontcolor=white:fontsize=31:x=89:y=1211,drawtext=fontfile='$FONT':text='Usahawan, bukan kerja bergaji tetap':fontcolor=white:fontsize=21:x=58:y=1320,drawtext=fontfile='$FONT':text='Seluruh Malaysia':fontcolor=white:fontsize=30:x=58:y=1370,drawbox=x=0:y=1500:w=1003:h=68:color=#0d5b3c@0.92:t=fill,drawtext=fontfile='$FONT':text='Kutip minyak masak terpakai. Bina nilai baharu.':fontcolor=white:fontsize=23:x=58:y=1522" -frames:v 1 -q:v 2 "$OUT/$out"
}

make_poster "$ROOT/FatHopes IMG/poster-refs/PUSH-2_hero_tanker.jpg" "01-real-tanker-jobdesc.jpg" "Kerja yang bergerak." "Jadi Usahawan Hijau." "Kutip minyak masak terpakai" "Guna kenderaan sendiri" "Dibayar mengikut kutipan"
make_poster "$ROOT/FatHopes IMG/poster-refs/PUSH-3_hero_worker-oil.jpg" "02-real-worker-jobdesc.jpg" "Bina kerja sendiri." "Satu kutipan. Satu langkah." "Kutip dari premis sekitar" "Urus laluan kutipan" "Bina pendapatan sendiri"
make_poster "$ROOT/FatHopes IMG/poster-refs/PUSH-4_hero_newtanker.jpg" "03-real-newtanker-jobdesc.jpg" "Minyak terpakai." "Nilai baharu untuk anda." "Ambil minyak masak terpakai" "Gunakan kenderaan sendiri" "Sertai Program PUSH"
make_poster "$ROOT/FatHopes IMG/poster-refs/PUSH-5_hero_team-newtanker.jpg" "04-real-team-jobdesc.jpg" "Jangan tunggu." "Jadi Usahawan Hijau." "Kutip. Kumpul. Hantar." "Bekerja secara sendiri" "Team kami akan hubungi"

echo "Created $OUT"
