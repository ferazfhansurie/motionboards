import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const ACT = "act_3681677928638351";
const ADSET = "52546489849548";
const PAGE = "121551227591222";
const WA = "601161884476";
const IG = "17841448306375961";
const V = "v21.0";
const IMAGE = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "posters-story-bigtext", "01-wrap-rm2200.png");

async function env() {
  for (const f of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, f), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {}
  }
}
const token = () => process.env.META_APP_TOKEN;

async function uploadImage() {
  const fd = new FormData();
  fd.append("access_token", token());
  fd.append("filename", new Blob([await fs.readFile(IMAGE)], { type: "image/png" }), "01-wrap-story-bigtext.png");
  const r = await fetch(`https://graph.facebook.com/${V}/${ACT}/adimages`, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw Error(`image upload failed: ${JSON.stringify(j.error || j)}`);
  return Object.values(j.images || {})[0]?.hash;
}
async function main() {
  await env();
  if (!token()) throw Error("META_APP_TOKEN is missing");
  const hash = await uploadImage();
  if (!hash) throw Error("No image hash returned");
  const message = `Bosan tengok warna kereta yang sama? 🚗\n\nTukar warna kereta tanpa cat semula — 3000+ pilihan warna: matte, satin, gloss dan chrome. Cat original tetap terjaga.\n\n✅ Colour change wrap dari RM2200\n✅ Installation kemas\n✅ After-sales kami jaga\n\nWhatsApp kami untuk book slot & colour consultation 👇`;
  const creativeBody = {
    name: "HW | Colour Wrap | Story Big Text | RM2200 | Klang | WA | creative",
    object_story_spec: {
      page_id: PAGE,
      instagram_user_id: IG,
      link_data: {
        message,
        image_hash: hash,
        name: "Colour Change Wrap - WhatsApp Consultation",
        link: `https://api.whatsapp.com/send?phone=${WA}`,
        call_to_action: { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP", link: `https://api.whatsapp.com/send?phone=${WA}` } },
      },
    },
    access_token: token(),
  };
  const cr = await fetch(`https://graph.facebook.com/${V}/${ACT}/adcreatives`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(creativeBody) });
  const cj = await cr.json().catch(() => ({}));
  if (!cr.ok || cj.error) throw Error(`creative failed: ${JSON.stringify(cj.error || cj)}`);
  const adBody = { name: "HW | Colour Wrap | Story Big Text | RM2200 | Klang | WA", adset_id: ADSET, creative: { creative_id: cj.id }, status: "PAUSED", access_token: token() };
  const ar = await fetch(`https://graph.facebook.com/${V}/${ACT}/ads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(adBody) });
  const aj = await ar.json().catch(() => ({}));
  if (!ar.ok || aj.error) throw Error(`ad failed: ${JSON.stringify(aj.error || aj)}`);
  console.log(JSON.stringify({ ad: aj.id, creative: cj.id, image_hash: hash, status: "PAUSED", adset: ADSET }, null, 2));
}
main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
