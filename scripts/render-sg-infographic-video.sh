#!/usr/bin/env bash
set -euo pipefail

base="/Users/faeez/motionboards/FatHopes IMG/SG photossss"
frames="$base/seedance-reference-frames"
assets="$base/sg-infographic-assets"
output="$base/fathopes-singapore-infographic-15s.mp4"
voice="$assets/voiceover.aiff"

swift /Users/faeez/motionboards/scripts/create-sg-infographic-assets.swift

say -v Karen -r 205 -o "$voice" \
  "Singaporeans love eating fried food. But where does all that used cooking oil go? Poured down the drain, and that becomes a problem for the future. Store it, and we'll collect it. FatHopes Energy collects used cooking oil across Singapore. Turn waste into wealth."

ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -framerate 30 -i "$frames/01-singapore-collection-truck.jpg" \
  -loop 1 -framerate 30 -i "$frames/02-used-oil-pumping.jpg" \
  -loop 1 -framerate 30 -i "$frames/03-singapore-oil-storage.jpg" \
  -loop 1 -framerate 30 -i "$assets/end-card.png" \
  -loop 1 -framerate 30 -i "$assets/overlay-01.png" \
  -loop 1 -framerate 30 -i "$assets/overlay-02.png" \
  -loop 1 -framerate 30 -i "$assets/overlay-03.png" \
  -loop 1 -framerate 30 -i "$assets/overlay-04.png" \
  -i "$voice" \
  -filter_complex "
    [0:v]scale=640:1138,crop=576:1024:x='32+8*sin(n/22)':y='57+8*cos(n/28)',trim=duration=4,setpts=PTS-STARTPTS[p0];
    [1:v]scale=640:1138,crop=576:1024:x='32+9*cos(n/24)':y='57+7*sin(n/26)',trim=duration=3.3,setpts=PTS-STARTPTS[p1];
    [2:v]scale=640:1138,crop=576:1024:x='32+7*sin(n/20)':y='57+9*cos(n/24)',trim=duration=3.3,setpts=PTS-STARTPTS[p2];
    [0:v]scale=640:1138,crop=576:1024:x='32+8*cos(n/21)':y='57+7*sin(n/26)',trim=duration=2.4,setpts=PTS-STARTPTS[p3];
    [3:v]trim=duration=2,setpts=PTS-STARTPTS[p4];
    [p0][p1][p2][p3][p4]concat=n=5:v=1:a=0[bg];
    [4:v]trim=duration=15,setpts=PTS-STARTPTS[ov1];
    [5:v]trim=duration=15,setpts=PTS-STARTPTS[ov2];
    [6:v]trim=duration=15,setpts=PTS-STARTPTS[ov3];
    [7:v]trim=duration=15,setpts=PTS-STARTPTS[ov4];
    [bg][ov1]overlay=0:0:enable='between(t,0,4)'[v1];
    [v1][ov2]overlay=0:0:enable='between(t,4,7.3)'[v2];
    [v2][ov3]overlay=0:0:enable='between(t,7.3,10.6)'[v3];
    [v3][ov4]overlay=0:0:enable='between(t,10.6,13)'[video];
    [8:a]aresample=48000,apad=pad_dur=15,atrim=duration=15,afade=t=out:st=14.5:d=0.5[audio]
  " \
  -map "[video]" -map "[audio]" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium \
  -c:a aac -b:a 192k -movflags +faststart -t 15 "$output"

echo "$output"
