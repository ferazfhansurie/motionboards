// Build the 4 click-to-WhatsApp ads into the existing (paused) Hyperwrapz campaign.
// Uploads posters -> creates CTWA creatives -> creates ads (PAUSED). Then a
// separate --activate step flips campaign+adset+ads live after review.
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = "/Users/faeez/motionboards";
const POSTERS = path.join(ROOT, "Hyperwrapz & Detailing", "_gen", "posters");
const ACT = "act_3681677928638351";
const CAMP = "52546219188148";
const ADSET = "52546219738548";
const PAGE = "121551227591222";
const WA = "601161884476";
const IG = "17841448306375961"; // connected IG
const V = "v21.0";

async function loadEnv() {
  for (const f of ["env.local", ".env.local"]) {
    try {
      const raw = await fs.readFile(path.join(ROOT, f), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}
const TOK = () => process.env.META_APP_TOKEN;

const ADS = [
  {
    slug: "01-wrap", file: "01-wrap.png",
    name: "HW | Colour Wrap | Klang | WA",
    headline: "Book slot di WhatsApp",
    message:
`Bosan tengok warna kereta yang sama? 🚗

Tukar warna kereta anda TANPA cat semula — 3000+ pilihan warna (matte, satin, gloss, chrome). Cat original tetap terjaga, boleh tanggal bila-bila.

✅ Colour change wrap dari RM2900
✅ Team berpengalaman, installation kemas
✅ After-sales kami jaga

WhatsApp kami untuk book slot & tengok warna 👇`,
  },
  {
    slug: "02-ppf", file: "02-ppf.png",
    name: "HW | PPF & Combos | Klang | WA",
    headline: "Consultation free — WhatsApp",
    message:
`Calar halus & batu jalan buat geram? 😤

Paint Protection Film (PPF) 8.5MIL self-healing — cat kereta kekal licin macam baru.

✅ Full Front PPF dari RM1900
✅ Full Car PPF RM3800
✅ Combo PPF + Tint + Coating dari RM4800

WhatsApp untuk consultation FREE 👇`,
  },
  {
    slug: "03-tint", file: "03-tint.png",
    name: "HW | Window Tint | Klang | WA",
    headline: "Dapatkan quote — WhatsApp",
    message:
`Panas KL dah tak boleh tahan? ☀️

Tint premium heat rejection sampai 99% & UV block 99% — dalam kereta terus sejuk, kulit & dashboard pun terlindung.

✅ Pilihan dari RM850 (S/M/L)
✅ Warranty sampai 10 tahun
✅ Nano Carbon / Sputtering / Royal Titanium

WhatsApp untuk quote ikut kereta anda 👇`,
  },
  {
    slug: "04-coating", file: "04-coating.png",
    name: "HW | Graphene Coating | Klang | WA",
    headline: "Book slot di WhatsApp",
    message:
`Nak kereta sentiasa nampak baru & senang cuci? ✨

Graphene 10H ceramic coating — hydrophobic, air & debu terus lari, kilat tahan lama.

✅ Full car coating RM1200 je
✅ 10H hardness, anti-calar halus
✅ Finish licin & berkilat

WhatsApp untuk book slot 👇`,
  },
];

async function api(pathStr, method, body) {
  const url = `https://graph.facebook.com/${V}/${pathStr}`;
  const opts = { method, headers: {} };
  if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${method} ${pathStr}: ${JSON.stringify(j.error || j).slice(0, 400)}`);
  return j;
}

async function uploadImage(file) {
  const buf = await fs.readFile(path.join(POSTERS, file));
  const fd = new FormData();
  fd.append("access_token", TOK());
  fd.append("filename", new Blob([buf], { type: "image/png" }), file);
  const res = await fetch(`https://graph.facebook.com/${V}/${ACT}/adimages`, { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`upload ${file}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  const key = Object.keys(j.images)[0];
  return j.images[key].hash;
}

async function createCreative(ad, hash) {
  const body = {
    name: `${ad.name} | creative`,
    object_story_spec: {
      page_id: PAGE,
      link_data: {
        message: ad.message,
        image_hash: hash,
        name: ad.headline,
        link: `https://api.whatsapp.com/send?phone=${WA}`,
        call_to_action: {
          type: "WHATSAPP_MESSAGE",
          value: { app_destination: "WHATSAPP", link: `https://api.whatsapp.com/send?phone=${WA}` },
        },
      },
    },
    access_token: TOK(),
  };
  const res = await fetch(`https://graph.facebook.com/${V}/${ACT}/adcreatives`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`creative ${ad.slug}: ${JSON.stringify(j.error || j).slice(0, 400)}`);
  return j.id;
}

async function createAd(ad, creativeId) {
  const body = {
    name: ad.name,
    adset_id: ADSET,
    creative: { creative_id: creativeId },
    status: "PAUSED",
    access_token: TOK(),
  };
  const res = await fetch(`https://graph.facebook.com/${V}/${ACT}/ads`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`ad ${ad.slug}: ${JSON.stringify(j.error || j).slice(0, 400)}`);
  return j.id;
}

async function build() {
  const out = [];
  for (const ad of ADS) {
    process.stdout.write(`[${ad.slug}] upload... `);
    const hash = await uploadImage(ad.file);
    process.stdout.write(`creative... `);
    const cid = await createCreative(ad, hash);
    process.stdout.write(`ad... `);
    const aid = await createAd(ad, cid);
    console.log(`OK ad=${aid}`);
    out.push({ slug: ad.slug, hash, creative: cid, ad: aid });
  }
  await fs.writeFile(path.join(ROOT, "scripts", "_tmp_hw_campaign_ids.json"), JSON.stringify(out, null, 2));
  console.log("\nCreated 4 ads (PAUSED). IDs saved.");
}

async function activate() {
  for (const id of [CAMP, ADSET]) {
    await api(id, "POST", { status: "ACTIVE", access_token: TOK() });
    console.log("activated", id);
  }
  const ids = JSON.parse(await fs.readFile(path.join(ROOT, "scripts", "_tmp_hw_campaign_ids.json"), "utf8"));
  for (const x of ids) {
    await api(x.ad, "POST", { status: "ACTIVE", access_token: TOK() });
    console.log("activated ad", x.ad, `(${x.slug})`);
  }
  console.log("\nCampaign LIVE.");
}

async function main() {
  await loadEnv();
  if (!TOK()) throw new Error("no META_APP_TOKEN");
  if (process.argv[2] === "--activate") await activate();
  else await build();
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
