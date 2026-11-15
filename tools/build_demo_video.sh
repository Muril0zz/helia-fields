#!/usr/bin/env bash
# Builds the ≤30 s demo video from storyboard frames (captures of the real app, see
# app/public/pitch/video.html). Usage: tools/build_demo_video.sh <frames-dir> <out.mp4>
# Frames must be named 1.jpg … 8.jpg.
set -euo pipefail
FR="$1"
OUT="$2"
DUR=3.9   # seconds per scene
XF=0.4    # crossfade
FPS=30
N=8
FRAMES=$(python3 -c "print(round($DUR*$FPS))")

inputs=()
filters=""
for i in $(seq 1 $N); do
  inputs+=(-i "$FR/$i.jpg")
  k=$((i-1))
  # slow push-in (Ken Burns), centred
  filters+="[$k:v]scale=3840:2160:flags=lanczos,zoompan=z='min(zoom+0.0006,1.07)':d=$FRAMES:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=$FPS,setsar=1,format=yuv420p[v$k];"
done
prev="v0"
for i in $(seq 1 $((N-1))); do
  off=$(python3 -c "print(round($i*($DUR-$XF), 3))")
  filters+="[$prev][v$i]xfade=transition=fade:duration=$XF:offset=$off[x$i];"
  prev="x$i"
done
filters="${filters%;}"
ffmpeg -y -hide_banner -loglevel error "${inputs[@]}" -filter_complex "$filters" -map "[$prev]" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart -r $FPS "$OUT"
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT"
