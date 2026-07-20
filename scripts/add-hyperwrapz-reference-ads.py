#!/usr/bin/env python3
import json, os, pathlib, sys, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
GRAPH = "https://graph.facebook.com/v23.0"
ACCOUNT = "3681677928638351"
PAGE = "121551227591222"
ADSET = "52546219738548"
WA = "601161884476"
ASSETS = {
    "colour-wrapping": ("Colour Wrapping Vinyl | Hyperwrapz", "Hi Hyperwrapz, saya nak tahu pasal Colour Wrapping Vinyl.", "https://pub-88ebab5b8de2446f969ca2994121479f.r2.dev/hyperwrapz-ads/2026-07-19-reference-rebrand/colour-wrapping-hyperwrapz.jpeg"),
    "ppf-coating": ("PPF & Coating | Hyperwrapz", "Hi Hyperwrapz, saya nak tahu pasal PPF, Coating dan Combo.", "https://pub-88ebab5b8de2446f969ca2994121479f.r2.dev/hyperwrapz-ads/2026-07-19-reference-rebrand/ppf-coating-hyperwrapz.jpeg"),
    "tinting": ("Window Film Tinting | Hyperwrapz", "Hi Hyperwrapz, saya nak tahu pasal Window Film Tinting.", "https://pub-88ebab5b8de2446f969ca2994121479f.r2.dev/hyperwrapz-ads/2026-07-19-reference-rebrand/tinting-hyperwrapz.jpeg"),
}

def load_env():
    for file in ("env.local", ".env.local"):
        try:
            for line in (ROOT / file).read_text().splitlines():
                if "=" in line and not line.lstrip().startswith("#"):
                    k, v = line.split("=", 1); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        except FileNotFoundError: pass

def call(edge, method="GET", data=None):
    token = os.environ["META_APP_TOKEN"]
    if method == "GET":
        params = dict(data or {}); params["access_token"] = token
        req = urllib.request.Request(f"{GRAPH}/{edge}?{urllib.parse.urlencode(params)}")
    else:
        payload = dict(data or {}); payload["access_token"] = token
        req = urllib.request.Request(f"{GRAPH}/{edge}", data=json.dumps(payload).encode(), headers={"Content-Type":"application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as response: result = json.loads(response.read())
    except urllib.error.HTTPError as exc: raise RuntimeError(exc.read().decode(errors="replace")) from exc
    if result.get("error"): raise RuntimeError(json.dumps(result["error"]))
    return result

def main():
    load_env()
    created = []
    for slug, (name, wa_text, picture) in ASSETS.items():
        link = f"https://wa.me/{WA}?text={urllib.parse.quote(wa_text)}"
        creative = call(f"act_{ACCOUNT}/adcreatives", "POST", {"name": f"Hyperwrapz | {name} | Reference Layout", "object_story_spec": {"page_id": PAGE, "link_data": {"link": link, "picture": picture, "message": "Full service pricing and packages shown in the poster. WhatsApp Hyperwrapz & Detailing, Klang for details.", "name": name, "call_to_action": {"type": "WHATSAPP_MESSAGE", "value": {"link": link}}}}})
        ad = call(f"act_{ACCOUNT}/ads", "POST", {"name": f"Reference Poster | {name}", "adset_id": ADSET, "creative": {"creative_id": creative["id"]}, "status": "PAUSED"})
        created.append({"name": name, "creative": creative["id"], "ad": ad["id"]})
        print(f"created paused {ad['id']} - {name}")
    print(json.dumps({"campaign": call("52546219188148", "GET", {"fields":"id,name,status"}), "new_ads": created}, indent=2))

if __name__ == "__main__":
    try: main()
    except Exception as exc: print(f"FAILED: {exc}", file=sys.stderr); sys.exit(1)
