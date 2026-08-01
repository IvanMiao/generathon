#!/usr/bin/env sh
set -eu

input="artifacts/step0/gemini-omni-smoke.mp4"
output_directory="artifacts/demo"
output="$output_directory/gemini-omni-smoke-repaired.mp4"

if [ ! -f "$input" ]; then
  echo "Missing recorded Gemini candidate: $input" >&2
  exit 1
fi

mkdir -p "$output_directory"

ffmpeg \
  -hide_banner \
  -loglevel error \
  -y \
  -i "$input" \
  -filter_complex "[0:v]trim=start=0:end=0.042,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.5[first];[0:v]trim=start=0.5:end=9.199542,setpts=PTS-STARTPTS[retained];[first][retained]concat=n=2:v=1:a=0,format=yuv420p[video]" \
  -map "[video]" \
  -t 9.241542 \
  -an \
  -c:v libx264 \
  -preset medium \
  -crf 18 \
  -movflags +faststart \
  "$output"

echo "$output"
