#!/usr/bin/env python3
"""Replace the paused simple-hook creatives with the paused pricing creatives."""
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
GRAPH = "https://graph.facebook.com/v23.0"
ACCOUNT = "3681677928638351"
PAGE = "121551227591222"
ADSET = "52546219738548"
OLD_ADS = ["52546220742348", "52546220705548", "52546220683748", "52546220660748", "52546226872748", "52546226863348", "52546226860348"]
WA = "601161884476"
ASSETS = {
    "colour-wrap": ("Colour Wrap — Full Pricing", "Tukar warna. Bukan cat. Saya nak tahu harga Colour Wrap.", "https://pub-88ebab5b8de2446f969ca2994121479f.r2.dev/hyperwrapz-ads/2026-07-19-editorial-pricing/colour-wrap-pricing.png"),
    "ppf-coating": ("PPF, Coating & Combos — Full Pricing", "Saya nak tahu harga PPF, Coating dan Combo packages.", "https://pub-88ebab5b8de2446f969ca2994121479f.r2.dev/hyperwrapz-ads/2026-07-19-editorial-pricing/ppf-coating-pricing.png"),
    "window-film": ("Window Film — Full Pricing", "Saya nak tahu harga tint untuk kereta saya.", "https://pub-88ebab5b8de2446f969ca2994121479f.r2.dev/hyperwrapz-ads/2026-07-19-editorial-pricing/window-film-pricing.png"),
}


def load_env():
    for file in ("env.local", ".env.local"):
        try:
            for line in (ROOT / file).read_text().splitlines():
                if "=" in line and not line.lstrip().startswith("#"):
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        except FileNotFoundError:
            pass


def call(edge, method="GET", data=None):
    token = os.environ["META_APP_TOKEN"]
    if method == "GET":
        params = dict(data or {})
        params["access_token"] = token
        url = f"{GRAPH}/{edge}?{urllib.parse.urlencode(params)}"
        body = None
        headers = {}
    else:
        url = f"{GRAPH}/{edge}"
        payload = dict(data or {})
        payload["access_token"] = token
        body = json.dumps(payload).encode()
        headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            result = json.loads(res.read())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(exc.read().decode(errors="replace")) from exc
    if result.get("error"):
        raise RuntimeError(json.dumps(result["error"]))
    return result


def main():
    load_env()
    if not os.environ.get("META_APP_TOKEN"):
        raise RuntimeError("META_APP_TOKEN missing")
    print("Pausing the four old poster ads...")
    for ad_id in OLD_ADS:
        call(ad_id, "POST", {"status": "PAUSED"})
        print(f"  paused {ad_id}")

    created = []
    for slug, (name, wa_text, picture) in ASSETS.items():
        link = f"https://wa.me/{WA}?text={urllib.parse.quote(wa_text)}"
        creative = call(f"act_{ACCOUNT}/adcreatives", "POST", {
            "name": f"Hyperwrapz | {name} | 2026-07-19",
            "object_story_spec": {
                "page_id": PAGE,
                "link_data": {
                    "link": link,
                    "picture": picture,
                    "message": "Full pricing shown in the poster. WhatsApp Hyperwrapz & Detailing, Klang for availability.",
                    "name": name,
                    "call_to_action": {"type": "WHATSAPP_MESSAGE", "value": {"link": link}},
                },
            },
        })
        ad = call(f"act_{ACCOUNT}/ads", "POST", {
            "name": f"Pricing Poster | {name}",
            "adset_id": ADSET,
            "creative": {"creative_id": creative["id"]},
            "status": "PAUSED",
        })
        created.append({"slug": slug, "creative": creative["id"], "ad": ad["id"]})
        print(f"  created paused {ad['id']} ({name})")

    campaign = call("52546219188148", "GET", {"fields": "id,name,status"})
    adset = call(ADSET, "GET", {"fields": "id,name,status,daily_budget,targeting"})
    print("DONE — campaign remains paused; old ads paused; new pricing ads paused.")
    print(json.dumps({"campaign": campaign, "adset": adset, "new_ads": created}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
