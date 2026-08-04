#!/usr/bin/env bash
set -euo pipefail

base="/Users/faeez/motionboards/FatHopes IMG/SG photossss"
assets="$base/fathopes-singapore-video-assets"
output="$base/fathopes-singapore-used-oil-15s.mp4"
voice="$assets/voiceover.aiff"

swift /Users/faeez/motionboards/scripts/create-sg-video-assets.swift

say -v Karen -r 205 -o "$voice" \
  "Singaporeans love eating fried food. But where does all that used cooking oil go? Poured down the drain, and that becomes a problem for the future. Store it, and we'll collect it. FatHopes Energy collects used cooking oil across Singapore. Turn waste into wealth."

ffmpeg -hide_banner -loglevel error -y \
  -i "$base/WhatsApp Video 2026-07-23 at 4.49.29 PM.mp4" \
  -i "$base/WhatsApp Video 2026-07-23 at 6.10.21 PM.mp4" \
  -i "$base/WhatsApp Video 2026-07-23 at 6.10.24 PM.mp4" \
  -loop 1 -i "$assets/end-card.png" \
  -i "$assets/overlay-01-hook.png" \
  -i "$assets/overlay-02-problem.png" \
  -i "$assets/overlay-03-collect.png" \
  -i "$assets/overlay-04-service.png" \
  -i "$voice" \
  -filter_complex "
    [0:v]trim=duration=4,setpts=PTS-STARTPTS[v0];
    [1:v]trim=duration=3.3,setpts=PTS-STARTPTS[v1];
    [2:v]trim=duration=3.3,setpts=PTS-STARTPTS[v2];
    [0:v]trim=start=4:duration=2.4,setpts=PTS-STARTPTS[v3];
    [3:v]trim=duration=2,setpts=PTS-STARTPTS[v4];
    [v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[base];
    [4:v]setpts=PTS-STARTPTS[o1];
    [5:v]setpts=PTS-STARTPTS[o2];
    [6:v]setpts=PTS-STARTPTS[o3];
    [7:v]setpts=PTS-STARTPTS[o4];
    [base][o1]overlay=0:0:enable='between(t,0,4)'[a];
    [a][o2]overlay=0:0:enable='between(t,4,7.3)'[b];
    [b][o3]overlay=0:0:enable='between(t,7.3,10.6)'[c];
    [c][o4]overlay=0:0:enable='between(t,10.6,13)'[video];
    [8:a]aresample=48000,apad=pad_dur=15,atrim=duration=15,afade=t=out:st=14.5:d=0.5[audio]
  " \
  -map "[video]" -map "[audio]" \
  -c:v libx264 -pix_fmt yuv420p -crf 19 -preset medium \
  -c:a aac -b:a 192k -movflags +faststart \
  -t 15 "$output"

echo "$output"
