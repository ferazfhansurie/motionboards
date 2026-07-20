#!/usr/bin/env python3
"""Create the paused Hyperwrapz poster-only WhatsApp campaign in Meta."""
import json
import mimetypes
import os
import pathlib
import sys
import urllib.parse
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
ACCOUNT = "3681677928638351"
PAGE = "121551227591222"
GRAPH = "https://graph.facebook.com/v23.0"
POSTER_DIR = ROOT / "Hyperwrapz & Detailing" / "_gen" / "posters"
WA = "601161884476"
PUBLIC_ASSET_BASE = "https://pub-88ebab5b8de2446f969ca2994121479f.r2.dev/hyperwrapz-ads/2026-07-19"

POSTERS = [
    ("01-wrap", "Colour Wrap", "Tukar warna. Bukan cat.", "Hi Hyperwrapz, saya nak tahu pasal Colour Change Wrap."),
    ("02-ppf", "Paint Protection Film", "Calar & batu? Cat kekal licin.", "Hi Hyperwrapz, saya nak tahu pasal Paint Protection Film."),
    ("03-tint", "Premium Window Tint", "Panas KL luar. Dalam tetap sejuk.", "Hi Hyperwrapz, saya nak tahu pasal Premium Window Tint."),
    ("04-coating", "Graphene Ceramic Coating", "Hujan asid, debu. Air terus lari.", "Hi Hyperwrapz, saya nak tahu pasal Graphene Ceramic Coating."),
]

INTERESTS = [
    {"id": "6003108301233", "name": "Auto detailing (vehicles)"},
    {"id": "6003717190262", "name": "Car club"},
    {"id": "6003641420907", "name": "Automotive design"},
    {"id": "6003428134689", "name": "Aftermarket (automotive)"},
    {"id": "6003422596441", "name": "Service (motor vehicle)"},
    {"id": "6003346992274", "name": "car wash (vehicle parts and services)"},
]


def load_env():
    for filename in ("env.local", ".env.local"):
        path = ROOT / filename
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            if "=" not in line or line.lstrip().startswith("#"):
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def request(edge, method="GET", payload=None, multipart=None):
    token = os.environ["META_APP_TOKEN"]
    url = f"{GRAPH}/{edge}"
    if method == "GET":
        params = dict(payload or {})
        params["access_token"] = token
        url += "?" + urllib.parse.urlencode(params)
        body = None
        headers = {}
    elif multipart is not None:
        boundary = "----Codex" + uuid.uuid4().hex
        chunks = []
        for name, value, filename, content_type in multipart:
            chunks.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"".encode())
            if filename:
                chunks[-1] += f"; filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n".encode() + value + b"\r\n"
            else:
                chunks[-1] += b"\r\n\r\n" + str(value).encode() + b"\r\n"
        chunks.append(f"--{boundary}--\r\n".encode())
        body = b"".join(chunks)
        headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    else:
        payload = dict(payload or {})
        payload["access_token"] = token
        body = json.dumps(payload).encode()
        headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            result = json.loads(response.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise RuntimeError(f"Meta {method} {edge} failed ({exc.code}): {detail}") from exc
    if isinstance(result, dict) and result.get("error"):
        raise RuntimeError(f"Meta {method} {edge} failed: {result['error']}")
    return result


def main():
    load_env()
    if not os.environ.get("META_APP_TOKEN"):
        raise RuntimeError("META_APP_TOKEN missing in env.local")

    campaign_id = os.environ.get("HYPERWRAPZ_CAMPAIGN_ID")
    if campaign_id:
        print(f"Using existing paused campaign: {campaign_id}")
    else:
        print("Creating paused campaign...")
        campaign = request(f"act_{ACCOUNT}/campaigns", "POST", {
            "name": "Hyperwrapz | Poster Services | Klang | WhatsApp",
            "objective": "OUTCOME_LEADS",
            "status": "PAUSED",
            "special_ad_categories": [],
            "is_adset_budget_sharing_enabled": False,
        })
        campaign_id = campaign["id"]
        print(f"  campaign: {campaign_id}")

    targeting = {
        "age_min": 25,
        "age_max": 65,
        "geo_locations": {"cities": [{"key": "1573488", "radius": 45, "distance_unit": "kilometer"}]},
        "flexible_spec": [{"interests": INTERESTS}],
        "publisher_platforms": ["facebook", "instagram"],
        "facebook_positions": ["feed", "marketplace", "story", "search"],
        "instagram_positions": ["stream", "story", "reels", "explore"],
    }
    adset_id = os.environ.get("HYPERWRAPZ_ADSET_ID")
    if adset_id:
        print(f"Using existing paused ad set: {adset_id}")
    else:
        adset = request(f"act_{ACCOUNT}/adsets", "POST", {
            "name": "Klang 45km | Car owners + detailing interests | RM30/day",
            "campaign_id": campaign_id,
            "daily_budget": "3000",
            "billing_event": "IMPRESSIONS",
            "optimization_goal": "CONVERSATIONS",
            "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
            "destination_type": "WHATSAPP",
            "promoted_object": {"page_id": PAGE},
            "targeting": targeting,
            "status": "PAUSED",
        })
        adset_id = adset["id"]
        print(f"  adset: {adset_id}")

    created = []
    for slug, service, hook, wa_text in POSTERS:
        link = f"https://wa.me/{WA}?text={urllib.parse.quote(wa_text)}"
        creative = request(f"act_{ACCOUNT}/adcreatives", "POST", {
            "name": f"Hyperwrapz | {service} | Poster",
            "object_story_spec": {
                "page_id": PAGE,
                "link_data": {
                    "link": link,
                    "message": f"{hook}\n\n{service} at Hyperwrapz & Detailing, Klang. WhatsApp us for details and availability.",
                    "name": service,
                    "picture": f"{PUBLIC_ASSET_BASE}/{slug}.png",
                    "call_to_action": {"type": "WHATSAPP_MESSAGE", "value": {"link": link}},
                },
            },
        })
        ad = request(f"act_{ACCOUNT}/ads", "POST", {
            "name": f"Poster | {service}",
            "adset_id": adset_id,
            "creative": {"creative_id": creative["id"]},
            "status": "PAUSED",
        })
        created.append({"service": service, "creative": creative["id"], "ad": ad["id"]})
        print(f"  {service}: ad {ad['id']}")

    verified = request(campaign_id, "GET", {"fields": "id,name,status,objective"})
    verified_set = request(adset_id, "GET", {"fields": "id,name,status,daily_budget,optimization_goal,targeting"})
    print("DONE — all campaign objects are PAUSED.")
    print(json.dumps({"campaign": verified, "adset": verified_set, "ads": created}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
