#!/usr/bin/env bash
set -euo pipefail

graph_version="v23.0"
account_id="act_725484841474739"
manual_dir="/Users/faeez/motionboards/FatHopes IMG/push-live-creative-mini-tanker/manually"

token="$(awk -F= '/^META_APP_TOKEN=/{sub(/^[^=]*=/, ""); print; exit}' /Users/faeez/motionboards/env.local)"
token="${token%\"}"
token="${token#\"}"
if [[ -z "$token" ]]; then
  echo "META_APP_TOKEN is not configured." >&2
  exit 1
fi

# Existing ad ID | exact manually revised replacement.
replacements=(
  "120250214359280294|motionboards-gen_1784877545277_q4ih.png"
  "120250214349870294|motionboards-gen_1784877726057_bvqo.png"
  "120250591714900294|motionboards-gen_1784877743799_jjup.png"
  "120250214367370294|motionboards-gen_1784877792916_4006.png"
  "120250214342860294|motionboards-gen_1784877843460_2vr9.png"
  "120250591722130294|motionboards-gen_1784877851474_x6l3.png"
  "120250214363290294|motionboards-gen_1784877862067_81uw.png"
  "120250591710580294|motionboards-gen_1784877874363_2s13.png"
  "120250591706010294|motionboards-gen_1784877964988_zdpm.png"
  "120250218251450294|motionboards-gen_1784877545277_q4ih.png"
  "120250223637380294|motionboards-gen_1784877529051_5g3m.png"
)

check_response() {
  local response="$1"
  local context="$2"
  if jq -e '.error' >/dev/null 2>&1 <<<"$response"; then
    echo "$context failed:" >&2
    jq -c '.error | {message,type,code,error_subcode,error_user_title,error_user_msg}' <<<"$response" >&2
    exit 1
  fi
}

for replacement in "${replacements[@]}"; do
  ad_id="${replacement%%|*}"
  filename="${replacement##*|}"
  image_path="$manual_dir/$filename"

  if [[ ! -f "$image_path" ]]; then
    echo "Missing replacement: $image_path" >&2
    exit 1
  fi

  ad_response="$(curl -sS -G \
    "https://graph.facebook.com/$graph_version/$ad_id" \
    --data-urlencode "fields=id,name,status,effective_status,creative{id,name,object_story_spec}" \
    --data-urlencode "access_token=$token")"
  check_response "$ad_response" "Reading ad $ad_id"

  ad_name="$(jq -r '.name' <<<"$ad_response")"
  story_spec="$(jq -c '.creative.object_story_spec' <<<"$ad_response")"
  if [[ "$story_spec" == "null" ]]; then
    echo "Ad $ad_id has no reusable object_story_spec." >&2
    exit 1
  fi

  upload_response="$(curl -sS -X POST \
    "https://graph.facebook.com/$graph_version/$account_id/adimages" \
    -F "filename=@$image_path" \
    -F "access_token=$token")"
  check_response "$upload_response" "Uploading image for $ad_name"
  image_hash="$(jq -r '.images | to_entries[0].value.hash // empty' <<<"$upload_response")"
  if [[ -z "$image_hash" ]]; then
    echo "No image hash returned for $ad_name." >&2
    exit 1
  fi

  updated_story="$(jq -c --arg hash "$image_hash" '
    if .link_data then
      .link_data.image_hash = $hash
      | del(.link_data.picture)
    else
      error("Creative does not contain link_data")
    end
  ' <<<"$story_spec")"

  creative_response="$(curl -sS -X POST \
    "https://graph.facebook.com/$graph_version/$account_id/adcreatives" \
    --data-urlencode "name=$ad_name | Mini Tanker label" \
    --data-urlencode "object_story_spec=$updated_story" \
    --data-urlencode "access_token=$token")"
  check_response "$creative_response" "Creating replacement creative for $ad_name"
  creative_id="$(jq -r '.id // empty' <<<"$creative_response")"
  if [[ -z "$creative_id" ]]; then
    echo "No creative ID returned for $ad_name." >&2
    exit 1
  fi

  update_response="$(curl -sS -X POST \
    "https://graph.facebook.com/$graph_version/$ad_id" \
    --data-urlencode "creative={\"creative_id\":\"$creative_id\"}" \
    --data-urlencode "access_token=$token")"
  check_response "$update_response" "Updating existing ad $ad_name"

  printf '%s\t%s\t%s\t%s\n' "$ad_id" "$ad_name" "$creative_id" "$image_hash"
done
