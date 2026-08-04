#!/usr/bin/env bash
set -euo pipefail

src_dir="/Users/faeez/motionboards/FatHopes IMG/push-live-creative-mini-tanker/originals"
out_dir="/Users/faeez/motionboards/FatHopes IMG/push-live-creative-mini-tanker/edited"
font="/System/Library/Fonts/Supplemental/Arial Bold.ttf"

mkdir -p "$out_dir"

# Vertical positions are tuned to each exact live poster so the new label sits
# near the existing application CTA without covering the main headline.
posters=(
  "280dc7e22c317a03aa60e09b0c590adb 0.265"
  "6bfac433e398fd365d57561680743d02 0.365"
  "6e177c92912eb2eae44bdb79fa942fbc 0.285"
  "ae982e26c729247249781c7204ad3d7b 0.310"
  "b89489dda8b0559009d523b4403e16db 0.325"
  "ca368167bdfe1f6ceb6284daec24635f 0.305"
  "d359932632f8b53333ae3bdea3e913e6 0.295"
  "d47670dec6fe2a461da98ee9fb46a76a 0.285"
  "e298cccd7e5bfe2cda483d19b8a919e8 0.285"
  "f54659e7bccffb196562e71fdf87bb49 0.300"
  "f84e29dbcc1567e1a0a177dece4e4c5b 0.245"
)

for poster in "${posters[@]}"; do
  hash="${poster%% *}"
  y="${poster##* }"
  input="$src_dir/$hash.jpg"
  output="$out_dir/$hash-mini-tanker.png"

  ffmpeg -hide_banner -loglevel error -y -i "$input" \
    -vf "drawbox=x=iw*0.09:y=ih*${y}:w=iw*0.82:h=ih*0.052:color=0x153C2E@0.96:t=fill,drawbox=x=iw*0.09:y=ih*${y}:w=iw*0.012:h=ih*0.052:color=0xA8D936@1:t=fill,drawtext=fontfile='${font}':text='Pandu Mini Tanker Dan Kutip!':fontcolor=white:fontsize=iw*0.038:x=iw*0.13:y=ih*${y}+(ih*0.052-text_h)/2" \
    -frames:v 1 "$output"
done

echo "Created ${#posters[@]} exact-poster overlays in: $out_dir"
